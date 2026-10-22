import pool from '../config/db.js';

export async function getAllZones() {
    const result = await pool.query(`
        SELECT id, name, is_active, sort_order, created_at, updated_at
        FROM zones
        ORDER BY sort_order, name
    `);
    return result.rows;
}

export async function createZone(name: string, sortOrder: number = 0) {
    const result = await pool.query(`
        INSERT INTO zones (name, sort_order, is_active)
        VALUES ($1, $2, TRUE)
        RETURNING *
    `, [name, sortOrder]);
    return result.rows[0];
}

export async function updateZone(id: number, name?: string, isActive?: boolean, sortOrder?: number) {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
    }
    if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(isActive);
    }
    if (sortOrder !== undefined) {
        updates.push(`sort_order = $${paramIndex++}`);
        values.push(sortOrder);
    }

    if (updates.length === 0) {
        const result = await pool.query(`SELECT * FROM zones WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(`
        UPDATE zones
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
    `, values);

    return result.rows[0] || null;
}

export async function deleteZone(id: number) {
    // Проверяем, есть ли столы в этой зоне
    const tablesCheck = await pool.query(`SELECT COUNT(*) FROM tables WHERE zone_id = $1`, [id]);
    if (parseInt(tablesCheck.rows[0].count) > 0) {
        throw new Error('Cannot delete zone with existing tables');
    }

    const result = await pool.query(`DELETE FROM zones WHERE id = $1 RETURNING id`, [id]);
    return result.rows.length > 0;
}