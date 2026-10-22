import pool from '../config/db.js';
import { incrementCustomerVisitsAndPoints } from './customerService.js';

export interface OrderItemInput {
    menu_item_id?: number;
    combo_id?: number;
    quantity: number;
    comment?: string;
}

export interface OrderResult {
    id: number;
    shift_id: number;
    table_id: number | null;
    status: string;
    total_amount: string;
    items: any[];
}

// ==========================================
// СОЗДАНИЕ И ОПЛАТА ЗАКАЗА
// ==========================================

export async function createOrder(
    shiftId: number,
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
            if (table.status === 'occupied') throw new Error('Table is already occupied');

            await client.query(`UPDATE tables SET status = 'occupied' WHERE id = $1`, [tableId]);
        }

        const orderResult = await client.query(`
            INSERT INTO orders (shift_id, table_id, status, total_amount, created_at)
            VALUES ($1, $2, 'open', 0, NOW())
            RETURNING *
        `, [shiftId, tableId]);

        const order = orderResult.rows[0];
        let totalAmount = 0;
        const createdItems = [];

        for (const item of items) {
            let price: number = 0;
            let isCombo = false;

            if (item.menu_item_id) {
                const priceRes = await client.query(`
                    SELECT price FROM menu_item_prices WHERE menu_item_id = $1 AND valid_to IS NULL
                `, [item.menu_item_id]);
                if (priceRes.rows.length === 0) throw new Error(`Price not found for menu item ${item.menu_item_id}`);
                price = parseFloat(priceRes.rows[0].price);
            } else if (item.combo_id) {
                isCombo = true;
                const comboRes = await client.query(`
                    SELECT combo_price FROM combo_sets WHERE id = $1 AND is_available = true
                `, [item.combo_id]);
                if (comboRes.rows.length === 0) throw new Error(`Combo not found or unavailable ${item.combo_id}`);
                price = parseFloat(comboRes.rows[0].combo_price);
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
    discountAmount: number = 0
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

        // <-- НОВОЕ: Начисляем баллы постояннику, если он привязан к заказу
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

async function validateOrderForEditing(orderId: number, shiftId: number) {
    const result = await pool.query(`
        SELECT id, status, shift_id FROM orders WHERE id = $1 AND status = 'open' AND shift_id = $2
    `, [orderId, shiftId]);
    if (result.rows.length === 0) {
        throw new Error('Order not found, already paid/cancelled, or belongs to another shift');
    }
    return result.rows[0];
}

async function recalculateOrderTotal(orderId: number): Promise<number> {
    const result = await pool.query(`
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

    const newTotal = parseFloat(result.rows[0].new_total);
    await pool.query(`UPDATE orders SET total_amount = $1 WHERE id = $2`, [newTotal, orderId]);
    return newTotal;
}

export async function addItemToOrder(orderId: number, shiftId: number, item: OrderItemInput, waiterId: number) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderCheck = await client.query(`SELECT id, status FROM orders WHERE id = $1`, [orderId]);
        if (orderCheck.rows.length === 0 || orderCheck.rows[0].status !== 'open') {
            throw new Error('Order not found or already paid/cancelled');
        }

        let price: number = 0;
        let isCombo = false;
        if (item.menu_item_id) {
            const priceRes = await client.query(`SELECT price FROM menu_item_prices WHERE menu_item_id = $1 AND valid_to IS NULL`, [item.menu_item_id]);
            if (priceRes.rows.length === 0) throw new Error(`Price not found for menu item ${item.menu_item_id}`);
            price = parseFloat(priceRes.rows[0].price);
        } else if (item.combo_id) {
            isCombo = true;
            const comboRes = await client.query(`SELECT combo_price FROM combo_sets WHERE id = $1 AND is_available = true`, [item.combo_id]);
            if (comboRes.rows.length === 0) throw new Error(`Combo not found or unavailable ${item.combo_id}`);
            price = parseFloat(comboRes.rows[0].combo_price);
        }

        const itemResult = await client.query(`
            INSERT INTO order_items (order_id, menu_item_id, combo_id, quantity, price_at_sale, combo_price, waiter_id, comment)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `, [orderId, item.menu_item_id || null, item.combo_id || null, item.quantity, isCombo ? null : price, isCombo ? price : null, waiterId, item.comment || null]);

        const newTotal = await recalculateOrderTotal(orderId);
        await client.query('COMMIT');
        return { item: itemResult.rows[0], new_total: newTotal.toFixed(2) };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function removeItemFromOrder(orderId: number, shiftId: number, itemId: number) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await validateOrderForEditing(orderId, shiftId);
        const deleteResult = await client.query(`DELETE FROM order_items WHERE id = $1 AND order_id = $2 RETURNING *`, [itemId, orderId]);
        if (deleteResult.rows.length === 0) throw new Error('Item not found in this order');

        const newTotal = await recalculateOrderTotal(orderId);
        await client.query('COMMIT');
        return { deleted_item: deleteResult.rows[0], new_total: newTotal.toFixed(2) };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function updateItemQuantity(orderId: number, shiftId: number, itemId: number, newQuantity: number) {
    if (newQuantity <= 0) throw new Error('Quantity must be greater than 0. Use DELETE endpoint instead.');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await validateOrderForEditing(orderId, shiftId);
        const updateResult = await client.query(`UPDATE order_items SET quantity = $1 WHERE id = $2 AND order_id = $3 RETURNING *`, [newQuantity, itemId, orderId]);
        if (updateResult.rows.length === 0) throw new Error('Item not found in this order');

        const newTotal = await recalculateOrderTotal(orderId);
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
// ПОЛУЧЕНИЕ СПИСКА ЗАКАЗОВ (ИСПРАВЛЕНО!)
// ==========================================

export async function getOrdersByRole(
    role: string,
    waiterId: number,
    status?: string
) {
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
            COUNT(oi.id) as items_count,
            s.waiter_id,
            u.full_name as waiter_name
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.id
        LEFT JOIN zones z ON t.zone_id = z.id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN shifts s ON o.shift_id = s.id
        LEFT JOIN users u ON s.waiter_id = u.id
        WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Официант и кухня видят только свои заказы
    if (role === 'waiter' || role === 'kitchen') {
        query += ` AND s.waiter_id = $${paramIndex++}`;
        params.push(waiterId);
    }
    // Админ, директор, sys_admin видят все заказы (дополнительных условий нет)

    if (status) {
        query += ` AND o.status = $${paramIndex++}`;
        params.push(status);
    }

    query += ` GROUP BY o.id, t.number, z.name, s.waiter_id, u.full_name ORDER BY o.created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
}

// ==========================================
// ДЕТАЛИ ЗАКАЗА
// ==========================================

export async function getOrderDetails(orderId: number, userRole: string, userShiftId: number | null) {
    let query = `
        SELECT
            o.*,
            t.number as table_number,
            z.name as zone_name
        FROM orders o
                 LEFT JOIN tables t ON o.table_id = t.id
                 LEFT JOIN zones z ON t.zone_id = z.id
        WHERE o.id = $1
    `;
    const params: any[] = [orderId];

    if (userRole === 'waiter' || userRole === 'kitchen') {
        if (userShiftId) {
            query += ` AND o.shift_id = $2`;
            params.push(userShiftId);
        } else {
            query += ` AND 1=0`;
        }
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

    return { ...order, items: itemsRes.rows };
}