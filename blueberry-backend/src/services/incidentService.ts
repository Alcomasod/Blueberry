import pool from '../config/db.js';

// ==========================================
// ЖУРНАЛ БОЯ ПОСУДЫ
// ==========================================

export async function createBreakageLog(
    menuItemId: number,
    quantity: number,
    reason: string,
    waiterId: number
) {
    const result = await pool.query(`
        INSERT INTO breakage_logs (menu_item_id, quantity, reason, waiter_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [menuItemId, quantity, reason, waiterId]);
    return result.rows[0];
}

export async function getBreakageLogs(waiterId?: number, startDate?: string, endDate?: string) {
    let query = `
        SELECT 
            bl.id,
            bl.quantity,
            bl.reason,
            bl.created_at,
            mi.name as item_name,
            u.full_name as waiter_name
        FROM breakage_logs bl
        LEFT JOIN menu_items mi ON bl.menu_item_id = mi.id
        LEFT JOIN users u ON bl.waiter_id = u.id
        WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (waiterId) {
        query += ` AND bl.waiter_id = $${paramIndex++}`;
        params.push(waiterId);
    }
    if (startDate) {
        query += ` AND bl.created_at >= $${paramIndex++}`;
        params.push(startDate);
    }
    if (endDate) {
        query += ` AND bl.created_at <= $${paramIndex++}`;
        params.push(endDate);
    }

    query += ` ORDER BY bl.created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
}

// ==========================================
// КОРРЕКТИРОВКИ СМЕН (ШТРАФЫ/ВЫЧЕТЫ)
// ==========================================

export async function createShiftAdjustment(
    shiftId: number,
    amount: number,
    reason: string,
    createdById: number
) {
    const result = await pool.query(`
        INSERT INTO shift_adjustments (shift_id, amount, reason, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [shiftId, amount, reason, createdById]);
    return result.rows[0];
}

export async function getShiftAdjustments(shiftId: number) {
    const result = await pool.query(`
        SELECT 
            sa.id,
            sa.amount,
            sa.reason,
            sa.created_at,
            u.full_name as created_by_name
        FROM shift_adjustments sa
        LEFT JOIN users u ON sa.created_by = u.id
        WHERE sa.shift_id = $1
        ORDER BY sa.created_at DESC
    `, [shiftId]);
    return result.rows;
}