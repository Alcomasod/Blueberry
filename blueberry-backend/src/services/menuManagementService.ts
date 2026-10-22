import pool from '../config/db.js';

// ==========================================
// КАТЕГОРИИ
// ==========================================

export async function createCategory(
    name: string,
    parentId: number | null,
    sortOrder: number
) {
    const result = await pool.query(`
        INSERT INTO categories (name, parent_id, sort_order, is_active)
        VALUES ($1, $2, $3, TRUE)
        RETURNING *
    `, [name, parentId, sortOrder]);
    return result.rows[0];
}

export async function updateCategory(
    id: number,
    name?: string,
    parentId?: number | null,
    sortOrder?: number,
    isActive?: boolean
) {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
    }
    if (parentId !== undefined) {
        updates.push(`parent_id = $${paramIndex++}`);
        values.push(parentId);
    }
    if (sortOrder !== undefined) {
        updates.push(`sort_order = $${paramIndex++}`);
        values.push(sortOrder);
    }
    if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(isActive);
    }

    if (updates.length === 0) {
        const result = await pool.query(`SELECT * FROM categories WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(`
        UPDATE categories
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
    `, values);

    return result.rows[0] || null;
}

export async function deleteCategory(id: number) {
    const result = await pool.query(`
        DELETE FROM categories WHERE id = $1 RETURNING id
    `, [id]);
    return result.rows.length > 0;
}

// ==========================================
// ПОЗИЦИИ МЕНЮ
// ==========================================

export async function createMenuItem(
    categoryId: number,
    name: string,
    price: number,
    description?: string,
    imageUrl?: string,
    isForGuests: boolean = true,
    sortOrder: number = 0,
    composition?: string
) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Создаем позицию меню
        const itemResult = await client.query(`
            INSERT INTO menu_items 
            (category_id, name, description, composition, image_url, is_for_guests, sort_order, is_available)
            VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
            RETURNING *
        `, [categoryId, name, description || null, composition || null, imageUrl || null, isForGuests, sortOrder]);

        const menuItem = itemResult.rows[0];

        // Создаем начальную цену
        await client.query(`
            INSERT INTO menu_item_prices (menu_item_id, price, valid_from, changed_by)
            VALUES ($1, $2, NOW(), 1)
        `, [menuItem.id, price]);

        await client.query('COMMIT');
        return menuItem;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function updateMenuItem(
    id: number,
    categoryId?: number,
    name?: string,
    description?: string,
    imageUrl?: string,
    isForGuests?: boolean,
    isAvailable?: boolean,
    sortOrder?: number,
    composition?: string
) {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (categoryId !== undefined) {
        updates.push(`category_id = $${paramIndex++}`);
        values.push(categoryId);
    }
    if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
    }
    if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
    }
    if (composition !== undefined) {
        updates.push(`composition = $${paramIndex++}`);
        values.push(composition);
    }
    if (imageUrl !== undefined) {
        updates.push(`image_url = $${paramIndex++}`);
        values.push(imageUrl);
    }
    if (isForGuests !== undefined) {
        updates.push(`is_for_guests = $${paramIndex++}`);
        values.push(isForGuests);
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
        const result = await pool.query(`SELECT * FROM menu_items WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(`
        UPDATE menu_items
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
    `, values);

    return result.rows[0] || null;
}

export async function updateMenuItemPrice(menuItemId: number, newPrice: number, changedBy: number) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Закрываем старую цену
        await client.query(`
            UPDATE menu_item_prices
            SET valid_to = NOW()
            WHERE menu_item_id = $1 AND valid_to IS NULL
        `, [menuItemId]);

        // Добавляем новую цену
        await client.query(`
            INSERT INTO menu_item_prices (menu_item_id, price, valid_from, changed_by)
            VALUES ($1, $2, NOW(), $3)
        `, [menuItemId, newPrice, changedBy]);

        await client.query('COMMIT');
        return { menu_item_id: menuItemId, price: newPrice };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function deleteMenuItem(id: number) {
    // Защита от удаления: позиция участвует в истории заказов —
    // вместо физического удаления деактивируем (soft delete),
    // чтобы не ломать исторические ссылки и финансовую аналитику.
    const usedRes = await pool.query(
        `SELECT 1 FROM order_items WHERE menu_item_id = $1 LIMIT 1`,
        [id]
    );

    if (usedRes.rows.length > 0) {
        const result = await pool.query(
            `UPDATE menu_items SET is_available = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
            [id]
        );
        return result.rows.length > 0 ? 'deactivated' : null;
    }

    const result = await pool.query(`
        DELETE FROM menu_items WHERE id = $1 RETURNING id
    `, [id]);
    return result.rows.length > 0 ? 'deleted' : null;
}