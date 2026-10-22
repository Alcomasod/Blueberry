import pool from '../config/db.js';

export async function getAllFlavors() {
    const result = await pool.query(`
        SELECT id, name, description, category, is_available, sort_order, created_at, updated_at
        FROM hookah_flavors
        WHERE is_available = TRUE
        ORDER BY category, sort_order, name
    `);
    return result.rows;
}

export async function getAllFlavorsAdmin() {
    const result = await pool.query(`
        SELECT id, name, description, category, is_available, sort_order, created_at, updated_at
        FROM hookah_flavors
        ORDER BY category, sort_order, name
    `);
    return result.rows;
}

export async function createFlavor(name: string, description?: string, category?: string, sortOrder: number = 0) {
    const result = await pool.query(`
        INSERT INTO hookah_flavors (name, description, category, sort_order, is_available)
        VALUES ($1, $2, $3, $4, TRUE)
        RETURNING *
    `, [name, description || null, category || null, sortOrder]);
    return result.rows[0];
}

export async function updateFlavor(id: number, name?: string, description?: string, category?: string, isAvailable?: boolean, sortOrder?: number) {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
    }
    if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
    }
    if (category !== undefined) {
        updates.push(`category = $${paramIndex++}`);
        values.push(category);
    }
    if (isAvailable !== undefined) {
        updates.push(`is_available = $${paramIndex++}`);
        values.push(isAvailable);
    }
    if (sortOrder !== undefined) {
        updates.push(`sort_order = $${paramIndex++}`);
        values.push(sortOrder);
    }

    if (updates.length === 0) {
        const result = await pool.query(`SELECT * FROM hookah_flavors WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(`
        UPDATE hookah_flavors
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
    `, values);

    return result.rows[0] || null;
}

export async function deleteFlavor(id: number) {
    const result = await pool.query(`DELETE FROM hookah_flavors WHERE id = $1 RETURNING id`, [id]);
    return result.rows.length > 0;
}