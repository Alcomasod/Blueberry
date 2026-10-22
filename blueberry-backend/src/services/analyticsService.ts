import pool from '../config/db.js';

// 1. Выручка заведения за конкретный день (по дате ОПЛАТЫ, не открытия!)
export async function getDailyRevenue(date: string) {
    const result = await pool.query(`
        SELECT 
            COUNT(DISTINCT o.id) as total_orders,
            SUM(o.total_amount) as total_revenue,
            SUM(o.discount_amount) as total_discounts,
            SUM(o.tip_amount) as total_tips,
            AVG(o.total_amount) as average_check
        FROM orders o
        WHERE DATE(o.closed_at) = $1
          AND o.status = 'paid'
    `, [date]);

    return result.rows[0];
}

// 2. Выручка по категориям меню за период
export async function getRevenueByCategory(startDate: string, endDate: string) {
    const result = await pool.query(`
        SELECT 
            c.name as category_name,
            COUNT(oi.id) as items_sold,
            SUM(oi.quantity * oi.price_at_sale) as category_revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN menu_items m ON oi.menu_item_id = m.id
        JOIN categories c ON m.category_id = c.id
        WHERE o.status = 'paid'
          AND o.closed_at BETWEEN $1 AND $2
        GROUP BY c.id, c.name
        ORDER BY category_revenue DESC
    `, [startDate, endDate]);

    return result.rows;
}

// 3. Топ официантов по выручке за период
export async function getTopWaiters(startDate: string, endDate: string) {
    const result = await pool.query(`
        SELECT
            u.id as waiter_id,
            u.full_name,
            COUNT(DISTINCT o.id) as total_orders,
            -- Выручка считается по позициям, где waiter_id = этому официанту
            SUM(CASE
                    WHEN oi.menu_item_id IS NOT NULL THEN oi.quantity * oi.price_at_sale
                    WHEN oi.combo_id IS NOT NULL THEN oi.combo_price
                    ELSE 0
                END) as total_revenue,
            -- Средний чек: выручка / количество уникальных заказов
            SUM(CASE
                    WHEN oi.menu_item_id IS NOT NULL THEN oi.quantity * oi.price_at_sale
                    WHEN oi.combo_id IS NOT NULL THEN oi.combo_price
                    ELSE 0
                END) / NULLIF(COUNT(DISTINCT o.id), 0) as average_check
        FROM users u
                 JOIN order_items oi ON oi.waiter_id = u.id
                 JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'paid'
          AND o.closed_at BETWEEN $1 AND $2
        GROUP BY u.id, u.full_name
        ORDER BY total_revenue DESC
    `, [startDate, endDate]);

    return result.rows;
}

// 4. Топ продаваемых блюд за период
export async function getTopSellingItems(startDate: string, endDate: string) {
    const result = await pool.query(`
        SELECT
            m.id as menu_item_id,
            m.name as item_name,
            c.name as category_name,
            SUM(oi.quantity) as total_quantity,
            SUM(oi.quantity * oi.price_at_sale) as total_revenue,
            AVG(oi.price_at_sale) as average_price
        FROM order_items oi
                 JOIN orders o ON oi.order_id = o.id
                 JOIN menu_items m ON oi.menu_item_id = m.id
                 JOIN categories c ON m.category_id = c.id
        WHERE o.status = 'paid'
          AND o.closed_at BETWEEN $1 AND $2
          AND oi.menu_item_id IS NOT NULL
        GROUP BY m.id, m.name, c.name
        ORDER BY total_quantity DESC
            LIMIT 20
    `, [startDate, endDate]);

    return result.rows;
}

// 5. Статистика по сменам (для управляющего)
export async function getShiftStatistics(startDate: string, endDate: string) {
    const result = await pool.query(`
        SELECT 
            s.id as shift_id,
            u.full_name as waiter_name,
            s.shift_date,
            s.start_time,
            s.end_time,
            COUNT(o.id) as orders_count,
            SUM(o.total_amount) as shift_revenue,
            s.cash_register_start,
            s.cash_register_end,
            (s.cash_register_end - s.cash_register_start) as cash_difference
        FROM shifts s
        JOIN users u ON s.waiter_id = u.id
        LEFT JOIN orders o ON o.shift_id = s.id AND o.status = 'paid'
        WHERE s.shift_date BETWEEN $1 AND $2
        GROUP BY s.id, u.full_name, s.shift_date, s.start_time, s.end_time, 
                 s.cash_register_start, s.cash_register_end
        ORDER BY s.shift_date DESC, s.start_time DESC
    `, [startDate, endDate]);

    return result.rows;
}