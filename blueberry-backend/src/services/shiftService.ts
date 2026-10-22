import pool from '../config/db.js';

export interface Shift {
    id: number;
    waiter_id: number;
    shift_date: string;
    start_time: string;
    end_time: string | null;
    status: 'open' | 'closed';
}

// Открыть новую смену (или вернуть уже открытую)
export async function openShift(waiterId: number): Promise<Shift> {
    // Проверяем, нет ли уже открытой смены у этого официанта
    const existingShift = await pool.query<Shift>(`
        SELECT * FROM shifts 
        WHERE waiter_id = $1 AND status = 'open'
        LIMIT 1
    `, [waiterId]);

    if (existingShift.rows.length > 0) {
        return existingShift.rows[0]; // Смена уже открыта, возвращаем её
    }

    // Открываем новую смену
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const result = await pool.query<Shift>(`
        INSERT INTO shifts (waiter_id, shift_date, start_time, status)
        VALUES ($1, $2, NOW(), 'open')
        RETURNING *
    `, [waiterId, today]);

    return result.rows[0];
}

// Получить активную смену официанта
export async function getActiveShift(waiterId: number): Promise<Shift | null> {
    const result = await pool.query<Shift>(`
        SELECT * FROM shifts 
        WHERE waiter_id = $1 AND status = 'open'
        LIMIT 1
    `, [waiterId]);

    return result.rows[0] || null;
}
export async function closeShift(waiterId: number, cashRegisterEnd: number): Promise<Shift | null> {
    const result = await pool.query<Shift>(`
        UPDATE shifts 
        SET end_time = NOW(), 
            status = 'closed',
            cash_register_end = $1
        WHERE waiter_id = $2 AND status = 'open'
        RETURNING *
    `, [cashRegisterEnd, waiterId]);

    return result.rows[0] || null;
}
export async function getAllShifts(startDate?: string, endDate?: string) {
    let query = `
        SELECT 
            s.id,
            s.waiter_id,
            s.shift_date,
            s.start_time,
            s.end_time,
            s.status,
            s.cash_register_start,
            s.cash_register_end,
            u.full_name as waiter_name,
            COUNT(o.id) as orders_count,
            COALESCE(SUM(o.total_amount), 0) as total_revenue
        FROM shifts s
        LEFT JOIN users u ON s.waiter_id = u.id
        LEFT JOIN orders o ON o.shift_id = s.id AND o.status = 'paid'
        WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
        query += ` AND s.shift_date >= $${paramIndex++}`;
        params.push(startDate);
    }

    if (endDate) {
        query += ` AND s.shift_date <= $${paramIndex++}`;
        params.push(endDate);
    }

    query += ` GROUP BY s.id, u.full_name ORDER BY s.shift_date DESC, s.start_time DESC`;

    const result = await pool.query(query, params);
    return result.rows;
}