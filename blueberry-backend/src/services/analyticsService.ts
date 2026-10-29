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

// ─── Утилиты аналитики ─────────────────────────────────────────────
// Специфика заведения: смена длится с 13:00 до 04:00 следующего дня.
// "Операционный день" N = интервал [N 13:00, N+1 04:00).
export function shiftWindow(date: string): { from: string; to: string } {
    return {
        from: `${date} 13:00:00`,
        to: `${shiftNextDate(date)} 04:00:00`,
    };
}

function shiftNextDate(date: string): string {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
}

// 5. Сводка смены для администрации: всё за операционный день
export async function getShiftSummary(date: string) {
    const w = shiftWindow(date);
    const result = await pool.query(`
        WITH paid AS (
            SELECT o.* FROM orders o
            WHERE o.status = 'paid' AND o.closed_at >= $1 AND o.closed_at < $2
        )
        SELECT
            (SELECT COUNT(*) FROM paid)                                          AS total_orders,
            (SELECT COALESCE(SUM(total_amount), 0) FROM paid)                    AS total_revenue,
            (SELECT COALESCE(SUM(discount_amount), 0) FROM paid)                 AS total_discounts,
            (SELECT COALESCE(SUM(tip_amount), 0) FROM paid)                      AS total_tips,
            (SELECT COALESCE(AVG(total_amount), 0) FROM paid)                    AS average_check,
            (SELECT COUNT(DISTINCT table_id) FROM paid WHERE table_id IS NOT NULL) AS tables_served,
            (SELECT COUNT(g.id) FROM order_guests g
                JOIN orders o ON o.id = g.order_id
                WHERE o.status = 'paid' AND o.closed_at >= $1 AND o.closed_at < $2) AS guests_total,
            (SELECT COUNT(*) FROM shifts s
                WHERE s.start_time >= $1 AND s.start_time < $2)                  AS staff_on_shift,
            (SELECT COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) FROM paid) AS cash_revenue,
            (SELECT COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) FROM paid) AS card_revenue
    `, [w.from, w.to]);
    return result.rows[0];
}

// 6. Выручка по кальянам за период (через hookah_orders -> orders)
export async function getHookahRevenue(startDate: string, endDate: string) {
    const result = await pool.query(`
        SELECT
            COUNT(DISTINCT ho.id)                          AS hookah_orders_count,
            COALESCE(SUM(hoi.quantity), 0)                 AS flavors_quantity,
            COALESCE(SUM(o.total_amount), 0)               AS hookah_revenue
        FROM hookah_orders ho
            JOIN orders o ON o.id = ho.order_id
            LEFT JOIN hookah_order_items hoi ON hoi.hookah_order_id = ho.id
        WHERE o.status = 'paid'
          AND o.closed_at >= $1 AND o.closed_at < $2
    `, [`${startDate} 13:00:00`, `${shiftNextDate(endDate)} 04:00:00`]);
    return result.rows[0];
}

// 7. Персональная статистика сотрудника ("Моя смена")
export async function getMyStats(userId: number, date: string) {
    const w = shiftWindow(date);
    // Основной блок: по закрытым заказам официанта за операционный день
    const main = await pool.query(`
        SELECT
            COUNT(o.id)                                            AS orders_count,
            COALESCE(SUM(o.total_amount), 0)                       AS revenue,
            COALESCE(AVG(NULLIF(o.total_amount, 0)), 0)            AS avg_check,
            COUNT(DISTINCT o.table_id)                             AS tables_served,
            COALESCE(SUM((SELECT COUNT(*) FROM order_guests g WHERE g.order_id = o.id)), 0) AS guests_served,
            COALESCE(SUM(o.discount_amount), 0)                    AS discounts_given,
            COALESCE(SUM(o.tip_amount), 0)                         AS tips
        FROM orders o
        WHERE o.waiter_id = $1
          AND o.status = 'paid'
          AND o.closed_at >= $2 AND o.closed_at < $3
    `, [userId, w.from, w.to]);

    // Отработанные часы: суммарная длительность смен за последние 30 дней (план "б": timestamp из shifts)
    const hours = await pool.query(`
        SELECT
            COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(s.end_time, NOW()) - s.start_time)) / 3600), 0) AS hours_30d,
            COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(s.end_time, NOW()) - s.start_time)) / 3600)
                FILTER (WHERE s.shift_date = $2 OR (s.shift_date = ($2::date - 1) AND s.start_time >= ($2::date - 1 || ' 13:00')::timestamp))
            , 0)                                      AS hours_today
        FROM shifts s
        WHERE s.waiter_id = $1
          AND s.start_time >= CURRENT_DATE - INTERVAL '30 days'
    `, [userId, date]);

    // Лучший стол смены
    const bestTable = await pool.query(`
        SELECT t.number AS table_number, o.total_amount
        FROM orders o
            LEFT JOIN tables t ON t.id = o.table_id
        WHERE o.waiter_id = $1 AND o.status = 'paid'
          AND o.closed_at >= $2 AND o.closed_at < $3
        ORDER BY o.total_amount DESC
        LIMIT 1
    `, [userId, w.from, w.to]);

    return { ...main.rows[0], ...hours.rows[0], best_table: bestTable.rows[0] ?? null };
}

// 8. Средний чек по гостю за операционный день (админ)
export async function getAvgCheckPerGuest(date: string) {
    const w = shiftWindow(date);
    const result = await pool.query(`
        SELECT
            COALESCE(SUM(o.total_amount), 0)                                    AS revenue,
            NULLIF(SUM((SELECT COUNT(*) FROM order_guests g WHERE g.order_id = o.id)), 0) AS guests,
            COALESCE(SUM(o.total_amount) / NULLIF(SUM((SELECT COUNT(*) FROM order_guests g WHERE g.order_id = o.id)), 0), 0) AS avg_check_per_guest
        FROM orders o
        WHERE o.status = 'paid' AND o.closed_at >= $1 AND o.closed_at < $2
    `, [w.from, w.to]);
    return result.rows[0];
}

// 9. Статистика по сменам (для управляющего)
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