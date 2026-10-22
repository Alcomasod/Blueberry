// src/services/tableService.ts
import pool from '../config/db.js';

export async function getAllTables() {
    const result = await pool.query(`
        SELECT
            t.id, t.number, t.zone_id, t.capacity, t.status, t.is_active,
            t.reservation_name, t.reservation_phone, t.reservation_time, t.reservation_comment,
            t.created_at,
            z.name as zone_name
        FROM tables t
                 LEFT JOIN zones z ON t.zone_id = z.id
        ORDER BY z.sort_order, t.number::int
    `);
    return result.rows;
}

export async function getTableById(id: number) {
    const result = await pool.query(`
        SELECT
            t.*,
            z.name as zone_name
        FROM tables t
                 LEFT JOIN zones z ON t.zone_id = z.id
        WHERE t.id = $1
    `, [id]);
    return result.rows[0] || null;
}

export async function createTable(number: string, zoneId: number, capacity: number = 4) {
    const result = await pool.query(`
        INSERT INTO tables (number, zone_id, capacity, status, is_active)
        VALUES ($1, $2, $3, 'free', TRUE)
            RETURNING *
    `, [number, zoneId, capacity]);
    return result.rows[0];
}

export async function updateTable(
    id: number,
    number?: string,
    zoneId?: number,
    capacity?: number,
    status?: string,
    reservationName?: string | null,
    reservationPhone?: string | null,
    reservationTime?: string | null,
    reservationComment?: string | null
) {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (number !== undefined) { updates.push(`number = $${paramIndex++}`); values.push(number); }
    if (zoneId !== undefined) { updates.push(`zone_id = $${paramIndex++}`); values.push(zoneId); }
    if (capacity !== undefined) { updates.push(`capacity = $${paramIndex++}`); values.push(capacity); }
    if (status !== undefined) { updates.push(`status = $${paramIndex++}`); values.push(status); }
    if (reservationName !== undefined) { updates.push(`reservation_name = $${paramIndex++}`); values.push(reservationName); }
    if (reservationPhone !== undefined) { updates.push(`reservation_phone = $${paramIndex++}`); values.push(reservationPhone); }
    if (reservationTime !== undefined) { updates.push(`reservation_time = $${paramIndex++}`); values.push(reservationTime); }
    if (reservationComment !== undefined) { updates.push(`reservation_comment = $${paramIndex++}`); values.push(reservationComment); }

    if (updates.length === 0) {
        return getTableById(id);
    }

    values.push(id);
    const result = await pool.query(`
        UPDATE tables
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
            RETURNING *
    `, values);

    return result.rows[0] || null;
}

export async function updateTableStatus(id: number, status: string) {
    let query = `UPDATE tables SET status = $1`;
    const values: unknown[] = [status];
    let paramIndex = 2;

    // Умная очистка: если стол освобождают, стираем данные о брони
    if (status === 'free') {
        query += `, reservation_name = NULL, reservation_phone = NULL, reservation_time = NULL, reservation_comment = NULL`;
    }

    query += ` WHERE id = $${paramIndex} RETURNING *`;
    values.push(id);

    const result = await pool.query(query, values);
    return result.rows[0] || null;
}

export async function deleteTable(id: number) {
    // Защита: нельзя удалить стол, если по нему есть история заказов
    const ordersCheck = await pool.query(`SELECT COUNT(*) FROM orders WHERE table_id = $1`, [id]);
    if (parseInt(ordersCheck.rows[0].count) > 0) {
        throw new Error('Cannot delete table with existing order history');
    }

    const result = await pool.query(`DELETE FROM tables WHERE id = $1 RETURNING id`, [id]);
    return result.rows.length > 0;
}