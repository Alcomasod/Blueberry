import pool from '../config/db.js';

export async function createHookahOrder(
    tableId: number,
    items: Array<{flavor_id: number, quantity: number, comment?: string}>,
    masterId: number
) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Проверяем, есть ли уже открытый заказ на этом столе
        let orderRes = await client.query(`
            SELECT id, shift_id FROM orders
            WHERE table_id = $1 AND status = 'open'
            ORDER BY created_at DESC LIMIT 1
        `, [tableId]);

        let orderId: number;
        let shiftId: number;

        if (orderRes.rows.length > 0) {
            // Заказ уже есть, используем его
            orderId = orderRes.rows[0].id;
            shiftId = orderRes.rows[0].shift_id;
        } else {
            // Заказа нет! Проверяем, есть ли у кальянщика открытая смена
            const shiftRes = await client.query(`
                SELECT id FROM shifts WHERE waiter_id = $1 AND status = 'open' ORDER BY start_time DESC LIMIT 1
            `, [masterId]);

            if (shiftRes.rows.length === 0) {
                throw new Error('Кальянщик должен сначала открыть смену, чтобы создать заказ.');
            }
            shiftId = shiftRes.rows[0].id;

            // Создаем "теневой" основной заказ
            const newOrderRes = await client.query(`
                INSERT INTO orders (shift_id, table_id, status, total_amount, created_at)
                VALUES ($1, $2, 'open', 0, NOW())
                RETURNING id
            `, [shiftId, tableId]);

            orderId = newOrderRes.rows[0].id;

            // Автоматически меняем статус стола на "занят"
            await client.query(`UPDATE tables SET status = 'occupied' WHERE id = $1`, [tableId]);
        }

        // 2. Создаем кальянный заказ, привязанный к основному
        const hookahOrderResult = await client.query(`
            INSERT INTO hookah_orders (order_id, master_id, status)
            VALUES ($1, $2, 'pending')
            RETURNING *
        `, [orderId, masterId]);

        const hookahOrder = hookahOrderResult.rows[0];

        // 3. Добавляем позиции кальяна
        for (const item of items) {
            await client.query(`
                INSERT INTO hookah_order_items (hookah_order_id, flavor_id, quantity, comment)
                VALUES ($1, $2, $3, $4)
            `, [hookahOrder.id, item.flavor_id, item.quantity, item.comment || null]);
        }

        await client.query('COMMIT');
        return { ...hookahOrder, order_id: orderId, table_id: tableId };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function getOpenHookahOrders() {
    const result = await pool.query(`
        SELECT 
            ho.id,
            ho.order_id,
            ho.master_id,
            ho.status,
            ho.created_at,
            o.table_id,
            t.number as table_number,
            z.name as zone_name,
            u.full_name as master_name,
            json_agg(json_build_object(
                'id', hoi.id,
                'flavor_id', hoi.flavor_id,
                'flavor_name', hf.name,
                'quantity', hoi.quantity,
                'comment', hoi.comment
            )) as items
        FROM hookah_orders ho
        LEFT JOIN orders o ON ho.order_id = o.id
        LEFT JOIN tables t ON o.table_id = t.id
        LEFT JOIN zones z ON t.zone_id = z.id
        LEFT JOIN users u ON ho.master_id = u.id
        LEFT JOIN hookah_order_items hoi ON ho.id = hoi.hookah_order_id
        LEFT JOIN hookah_flavors hf ON hoi.flavor_id = hf.id
        WHERE ho.status IN ('pending', 'preparing')
        GROUP BY ho.id, o.table_id, t.number, z.name, u.full_name
        ORDER BY ho.created_at ASC
    `);
    return result.rows;
}

export async function updateHookahOrderStatus(hookahOrderId: number, status: string, masterId?: number) {
    const result = await pool.query(`
        UPDATE hookah_orders
        SET status = $1, master_id = COALESCE($2, master_id), updated_at = NOW()
        WHERE id = $3
        RETURNING *
    `, [status, masterId || null, hookahOrderId]);
    return result.rows[0] || null;
}

export async function getHookahOrderDetails(hookahOrderId: number) {
    const result = await pool.query(`
        SELECT 
            ho.*,
            o.table_id,
            t.number as table_number,
            z.name as zone_name,
            u.full_name as master_name,
            json_agg(json_build_object(
                'id', hoi.id,
                'flavor_id', hoi.flavor_id,
                'flavor_name', hf.name,
                'quantity', hoi.quantity,
                'comment', hoi.comment
            )) as items
        FROM hookah_orders ho
        LEFT JOIN orders o ON ho.order_id = o.id
        LEFT JOIN tables t ON o.table_id = t.id
        LEFT JOIN zones z ON t.zone_id = z.id
        LEFT JOIN users u ON ho.master_id = u.id
        LEFT JOIN hookah_order_items hoi ON ho.id = hoi.hookah_order_id
        LEFT JOIN hookah_flavors hf ON hoi.flavor_id = hf.id
        WHERE ho.id = $1
        GROUP BY ho.id, o.table_id, t.number, z.name, u.full_name
    `, [hookahOrderId]);
    return result.rows[0] || null;
}