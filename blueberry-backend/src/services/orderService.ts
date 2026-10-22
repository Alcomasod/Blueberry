import pool from '../config/db.js';
import { incrementCustomerVisitsAndPoints } from './customerService.js';

export interface OrderItemInput {
    menu_item_id?: number;
    combo_id?: number;
    quantity: number;
    comment?: string;
}

export interface CreatedOrderItem {
    id: number;
    order_id: number;
    menu_item_id: number | null;
    combo_id: number | null;
    quantity: number;
    price_at_sale: string | null;
    combo_price: string | null;
    waiter_id: number;
    comment: string | null;
}

export interface OrderResult {
    id: number;
    shift_id: number | null;
    table_id: number | null;
    status: string;
    total_amount: string;
    items: CreatedOrderItem[];
}

// ==========================================
// ЖУРНАЛ ИЗМЕНЕНИЙ ЗАКАЗА (хронология карточек)
// ==========================================

async function logOrderHistory(
    executor: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
    orderId: number,
    userId: number,
    action: string,
    details: string
): Promise<void> {
    await executor.query(
        `INSERT INTO order_history (order_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
        [orderId, userId, action, details]
    );
}

// ==========================================
// СОЗДАНИЕ И ОПЛАТА ЗАКАЗА
// ==========================================

export async function createOrder(
    shiftId: number | null,
    tableId: number | null,
    items: OrderItemInput[],
    waiterId: number
): Promise<OrderResult> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (tableId) {
            const tableCheck = await client.query(`
                SELECT id, status, is_active FROM tables WHERE id = $1
            `, [tableId]);

            if (tableCheck.rows.length === 0) throw new Error('Table not found');
            const table = tableCheck.rows[0];
            if (!table.is_active) throw new Error('Table is not active');

            // Независимо от статуса стола сначала ищем ОТКРЫТЫЙ заказ по столу.
            // Это закрывает рассинхронизацию (стол свободен, но заказ админа ещё открыт,
            // или наоборот) и реализует «подхват» чужого стола.
            const existingRes = await client.query(`
                SELECT id, waiter_id FROM orders WHERE table_id = $1 AND status = 'open'
                ORDER BY created_at DESC LIMIT 1
            `, [tableId]);

            if (existingRes.rows.length > 0) {
                const existing = existingRes.rows[0];
                if (existing.waiter_id !== waiterId) {
                    await client.query(`UPDATE orders SET waiter_id = $1 WHERE id = $2`, [waiterId, existing.id]);
                    await logOrderHistory(client, existing.id, waiterId, 'taken_over', 'Стол подхвачен другим сотрудником');
                }
                // Гарантируем консистентность: если заказ открыт — стол должен быть занят
                if (table.status !== 'occupied') {
                    await client.query(`UPDATE tables SET status = 'occupied' WHERE id = $1`, [tableId]);
                }
                const orderResult = await client.query(`SELECT * FROM orders WHERE id = $1`, [existing.id]);
                const itemsRes = await client.query(`SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`, [existing.id]);
                await client.query('COMMIT');
                return { ...orderResult.rows[0], items: itemsRes.rows };
            }

            await client.query(`UPDATE tables SET status = 'occupied' WHERE id = $1`, [tableId]);
        }

        const orderResult = await client.query(`
            INSERT INTO orders (shift_id, waiter_id, table_id, status, total_amount, created_at)
            VALUES ($1, $2, $3, 'open', 0, NOW())
            RETURNING *
        `, [shiftId, waiterId, tableId]);

        const order = orderResult.rows[0];
        await logOrderHistory(client, order.id, waiterId, 'created', 'Заказ создан');

        let totalAmount = 0;
        const createdItems = [];

        for (const item of items) {
            let price: number = 0;
            let isCombo = false;
            let itemName = '';

            if (item.menu_item_id) {
                const priceRes = await client.query(`
                    SELECT p.price, m.name FROM menu_item_prices p
                    JOIN menu_items m ON m.id = p.menu_item_id
                    WHERE p.menu_item_id = $1 AND p.valid_to IS NULL
                `, [item.menu_item_id]);
                if (priceRes.rows.length === 0) throw new Error(`Price not found for menu item ${item.menu_item_id}`);
                price = parseFloat(priceRes.rows[0].price);
                itemName = priceRes.rows[0].name;
            } else if (item.combo_id) {
                isCombo = true;
                const comboRes = await client.query(`
                    SELECT combo_price, name FROM combo_sets WHERE id = $1 AND is_available = true
                `, [item.combo_id]);
                if (comboRes.rows.length === 0) throw new Error(`Combo not found or unavailable ${item.combo_id}`);
                price = parseFloat(comboRes.rows[0].combo_price);
                itemName = comboRes.rows[0].name;
            }

            const itemTotal = price * item.quantity;
            totalAmount += itemTotal;

            const itemResult = await client.query(`
                INSERT INTO order_items (order_id, menu_item_id, combo_id, quantity, price_at_sale, combo_price, waiter_id, comment)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [
                order.id,
                item.menu_item_id || null,
                item.combo_id || null,
                item.quantity,
                isCombo ? null : price,
                isCombo ? price : null,
                waiterId,
                item.comment || null
            ]);
            createdItems.push(itemResult.rows[0]);
            await logOrderHistory(
                client, order.id, waiterId, 'item_added',
                `Добавлено: ${itemName} x${item.quantity}`
            );
        }

        await client.query(`UPDATE orders SET total_amount = $1 WHERE id = $2`, [totalAmount, order.id]);
        await client.query('COMMIT');

        return { ...order, total_amount: totalAmount.toFixed(2), items: createdItems };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function payOrder(
    orderId: number,
    paymentMethod: 'cash' | 'card' | 'mixed',
    tipAmount: number = 0,
    discountAmount: number = 0,
    paidByUserId?: number
) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(`
            UPDATE orders
            SET status = 'paid', closed_at = NOW(), payment_method = $1, tip_amount = $2, discount_amount = $3
            WHERE id = $4 AND status = 'open'
                RETURNING *
        `, [paymentMethod, tipAmount, discountAmount, orderId]);

        if (result.rows.length === 0) throw new Error('Order not found or already paid/cancelled');
        const order = result.rows[0];

        if (paidByUserId) {
            await logOrderHistory(client, orderId, paidByUserId, 'paid', `Заказ оплачен (${paymentMethod})`);
        }

        // Начисляем баллы постояннику, если он привязан к заказу
        if (order.customer_id) {
            const orderAmount = parseFloat(order.total_amount) + tipAmount - discountAmount;
            await incrementCustomerVisitsAndPoints(order.customer_id, orderAmount);
        }

        if (order.table_id) {
            await client.query(`UPDATE tables SET status = 'free' WHERE id = $1`, [order.table_id]);
        }

        await client.query('COMMIT');
        return order;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ==========================================
// РЕДАКТИРОВАНИЕ ОТКРЫТОГО ЗАКАЗА
// ==========================================

async function validateOrderForEditing(orderId: number, waiterId: number, isAdmin = false) {
    // Администратор (MANAGE_ALL_OPEN_ORDERS) может редактировать любой открытый заказ.
    // Официант может редактировать ЛЮБОЙ открытый заказ («подхватить» стол):
    // если заказ ведёт другой сотрудник — обслуживание переключается на текущего,
    // а в журнале изменений остаётся запись об этом.
    const result = await pool.query(
        `SELECT id, status, shift_id, waiter_id FROM orders WHERE id = $1 AND status = 'open'`,
        [orderId]
    );
    if (result.rows.length === 0) {
        throw new Error('Order not found or already paid/cancelled');
    }
    const order = result.rows[0];

    if (!isAdmin && order.waiter_id !== waiterId) {
        await pool.query(`UPDATE orders SET waiter_id = $1 WHERE id = $2`, [waiterId, orderId]);
        await logOrderHistory(pool, orderId, waiterId, 'taken_over', 'Заказ подхвачен другим сотрудником');
        order.waiter_id = waiterId;
    }
    return order;
}

async function recalculateOrderTotal(
    orderId: number,
    executor: { query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> } = pool
): Promise<number> {
    const result = await executor.query(`
        SELECT COALESCE(SUM(line_total), 0) as new_total
        FROM (
            SELECT CASE
                WHEN menu_item_id IS NOT NULL THEN quantity * price_at_sale
                WHEN combo_id IS NOT NULL THEN combo_price
                ELSE 0
            END as line_total
            FROM order_items WHERE order_id = $1
        ) as subquery
    `, [orderId]);

    const newTotal = parseFloat(String(result.rows[0].new_total));
    await executor.query(`UPDATE orders SET total_amount = $1 WHERE id = $2`, [newTotal, orderId]);
    return newTotal;
}

export async function addItemToOrder(orderId: number, waiterId: number, item: OrderItemInput, isAdmin = false) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Проверяем право редактирования (свой/чужой открытый заказ),
        // наличие открытой смены при этом не требуется.
        await validateOrderForEditing(orderId, waiterId, isAdmin);

        let price: number = 0;
        let isCombo = false;
        let itemName = '';
        if (item.menu_item_id) {
            const priceRes = await client.query(
                `SELECT p.price, m.name FROM menu_item_prices p
                 JOIN menu_items m ON m.id = p.menu_item_id
                 WHERE p.menu_item_id = $1 AND p.valid_to IS NULL`,
                [item.menu_item_id]
            );
            if (priceRes.rows.length === 0) throw new Error(`Price not found for menu item ${item.menu_item_id}`);
            price = parseFloat(priceRes.rows[0].price);
            itemName = priceRes.rows[0].name;
        } else if (item.combo_id) {
            isCombo = true;
            const comboRes = await client.query(
                `SELECT combo_price, name FROM combo_sets WHERE id = $1 AND is_available = true`,
                [item.combo_id]
            );
            if (comboRes.rows.length === 0) throw new Error(`Combo not found or unavailable ${item.combo_id}`);
            price = parseFloat(comboRes.rows[0].combo_price);
            itemName = comboRes.rows[0].name;
        }

        const itemResult = await client.query(`
            INSERT INTO order_items (order_id, menu_item_id, combo_id, quantity, price_at_sale, combo_price, waiter_id, comment)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `, [orderId, item.menu_item_id || null, item.combo_id || null, item.quantity, isCombo ? null : price, isCombo ? price : null, waiterId, item.comment || null]);

        await logOrderHistory(client, orderId, waiterId, 'item_added', `Добавлено: ${itemName} x${item.quantity}`);
        const newTotal = await recalculateOrderTotal(orderId, client);
        await client.query('COMMIT');
        return { item: itemResult.rows[0], new_total: newTotal.toFixed(2) };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function removeItemFromOrder(orderId: number, waiterId: number, itemId: number, isAdmin = false) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await validateOrderForEditing(orderId, waiterId, isAdmin);
        const deleteResult = await client.query(
            `DELETE FROM order_items WHERE id = $1 AND order_id = $2 RETURNING *`,
            [itemId, orderId]
        );
        if (deleteResult.rows.length === 0) throw new Error('Item not found in this order');

        const removed = deleteResult.rows[0];
        const nameRes = await client.query(
            `SELECT COALESCE(m.name, c.name, 'позиция') as name
             FROM order_items oi
             LEFT JOIN menu_items m ON oi.menu_item_id = m.id
             LEFT JOIN combo_sets c ON oi.combo_id = c.id
             WHERE oi.id = $1`,
            [itemId]
        );
        await logOrderHistory(
            client, orderId, waiterId, 'item_removed',
            `Удалено: ${nameRes.rows[0]?.name ?? 'позиция'} x${removed.quantity}`
        );

        const newTotal = await recalculateOrderTotal(orderId, client);
        await client.query('COMMIT');
        return { deleted_item: removed, new_total: newTotal.toFixed(2) };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function updateItemQuantity(orderId: number, waiterId: number, itemId: number, newQuantity: number, isAdmin = false) {
    if (newQuantity <= 0) throw new Error('Quantity must be greater than 0. Use DELETE endpoint instead.');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await validateOrderForEditing(orderId, waiterId, isAdmin);
        const updateResult = await client.query(
            `UPDATE order_items SET quantity = $1 WHERE id = $2 AND order_id = $3 RETURNING *`,
            [newQuantity, itemId, orderId]
        );
        if (updateResult.rows.length === 0) throw new Error('Item not found in this order');

        const nameRes = await client.query(
            `SELECT COALESCE(m.name, c.name, 'позиция') as name
             FROM order_items oi
             LEFT JOIN menu_items m ON oi.menu_item_id = m.id
             LEFT JOIN combo_sets c ON oi.combo_id = c.id
             WHERE oi.id = $1`,
            [itemId]
        );
        await logOrderHistory(
            client, orderId, waiterId, 'item_updated',
            `Изменено количество: ${nameRes.rows[0]?.name ?? 'позиция'} → x${newQuantity}`
        );

        const newTotal = await recalculateOrderTotal(orderId, client);
        await client.query('COMMIT');
        return { updated_item: updateResult.rows[0], new_total: newTotal.toFixed(2) };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ==========================================
// ПОЛУЧЕНИЕ СПИСКА ЗАКАЗОВ
// ==========================================

export async function getOrdersByRole(
    role: string,
    waiterId: number,
    status?: string
) {
    // Официант видит ВСЕ заказы (в т.ч. открытые других сотрудников — чтобы «подхватить» стол),
    // но сортировка ставит его собственные заказы первыми.
    // Кухня и кальянная видят все заказы без разделения по сотрудникам.
    const isWaiterLike = role === 'waiter' || role === 'hookah_master' || role === 'hookah_bar';

    let query = `
        SELECT
            o.id,
            o.shift_id,
            o.table_id,
            o.status,
            o.total_amount,
            o.discount_amount,
            o.tip_amount,
            o.payment_method,
            o.created_at,
            o.closed_at,
            t.number as table_number,
            z.name as zone_name,
            COUNT(DISTINCT oi.id) as items_count,
            COALESCE(o.waiter_id, s.waiter_id) as waiter_id,
            COALESCE(wu.full_name, u.full_name) as waiter_name,
            MAX(oh.last_action_at) as last_action_at
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.id
        LEFT JOIN zones z ON t.zone_id = z.id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN shifts s ON o.shift_id = s.id
        LEFT JOIN users u ON s.waiter_id = u.id
        LEFT JOIN users wu ON o.waiter_id = wu.id
        LEFT JOIN (
            SELECT order_id, MAX(created_at) as last_action_at
            FROM order_history
            GROUP BY order_id
        ) oh ON oh.order_id = o.id
        WHERE 1=1
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    if (status) {
        query += ` AND o.status = $${paramIndex++}`;
        params.push(status);
    }

    query += ` GROUP BY o.id, t.number, z.name, o.waiter_id, s.waiter_id, u.full_name, wu.full_name`;

    if (isWaiterLike) {
        // Свои — первые; остальные открытые — после них (в пределах выбранного статуса).
        query += `
            ORDER BY
                (COALESCE(o.waiter_id, s.waiter_id) = $${paramIndex++}) DESC NULLS LAST,
                MAX(oh.last_action_at) DESC NULLS LAST,
                o.created_at DESC
        `;
        params.push(waiterId);
    } else {
        query += ` ORDER BY o.created_at DESC`;
    }

    const result = await pool.query(query, params);
    return result.rows;
}

// ==========================================
// ДЕТАЛИ ЗАКАЗА
// ==========================================

export async function getOrderDetails(orderId: number, userRole: string, userId: number) {
    // Любой авторизованный сотрудник может открыть детали открытого заказа
    // (официант «подхватывает» стол прямо из карточки). Оплаченные/отменённые
    // исторические заказы доступны только админ-ролям.
    const isAdmin = userRole === 'admin' || userRole === 'director' || userRole === 'sys_admin';

    let query = `
        SELECT
            o.*,
            t.number as table_number,
            z.name as zone_name,
            COALESCE(wu.full_name, u.full_name) as waiter_name
        FROM orders o
                 LEFT JOIN tables t ON o.table_id = t.id
                 LEFT JOIN zones z ON t.zone_id = z.id
                 LEFT JOIN shifts s ON o.shift_id = s.id
                 LEFT JOIN users u ON s.waiter_id = u.id
                 LEFT JOIN users wu ON o.waiter_id = wu.id
        WHERE o.id = $1
    `;
    const params: unknown[] = [orderId];

    if (!isAdmin) {
        query += ` AND o.status = 'open'`;
    }

    const orderRes = await pool.query(query, params);
    if (orderRes.rows.length === 0) {
        throw new Error('Order not found or access denied');
    }
    const order = orderRes.rows[0];

    const itemsRes = await pool.query(`
        SELECT
            oi.id,
            oi.quantity,
            oi.price_at_sale,
            oi.combo_price,
            oi.comment,
            oi.created_at,
            COALESCE(m.name, cs.name) as item_name,
            CASE
                WHEN oi.menu_item_id IS NOT NULL THEN 'item'
                WHEN oi.combo_id IS NOT NULL THEN 'combo'
                END as item_type,
            (
                CASE
                    WHEN oi.menu_item_id IS NOT NULL THEN oi.quantity * oi.price_at_sale
                    WHEN oi.combo_id IS NOT NULL THEN oi.combo_price
                    ELSE 0
                    END
                ) as line_total,
            oi.waiter_id,
            u.full_name as waiter_name
        FROM order_items oi
                 LEFT JOIN menu_items m ON oi.menu_item_id = m.id
                 LEFT JOIN combo_sets cs ON oi.combo_id = cs.id
                 LEFT JOIN users u ON oi.waiter_id = u.id
        WHERE oi.order_id = $1
        ORDER BY oi.id
    `, [orderId]);

    const historyRes = await pool.query(`
        SELECT oh.id, oh.action, oh.details, oh.created_at, u.full_name as user_name
        FROM order_history oh
                 LEFT JOIN users u ON oh.user_id = u.id
        WHERE oh.order_id = $1
        ORDER BY oh.created_at ASC, oh.id ASC
    `, [orderId]);

    return { ...order, items: itemsRes.rows, history: historyRes.rows };
}
