import pool from '../config/db.js';

export interface Customer {
    id: number;
    name: string;
    phone: string | null;
    points: number;
    visit_count: number;
    created_at: string;
}

// Получить всех постоянников
export async function getAllCustomers() {
    const result = await pool.query(`
        SELECT id, name, phone, points, visit_count, created_at
        FROM customers
        ORDER BY visit_count DESC, name
    `);
    return result.rows;
}

// Найти постоянника по телефону
export async function getCustomerByPhone(phone: string) {
    const result = await pool.query(`
        SELECT id, name, phone, points, visit_count, created_at
        FROM customers
        WHERE phone = $1
    `, [phone]);
    return result.rows[0] || null;
}

// Создать нового постоянника
export async function createCustomer(name: string, phone?: string) {
    const result = await pool.query(`
        INSERT INTO customers (name, phone, points, visit_count)
        VALUES ($1, $2, 0, 0)
        RETURNING *
    `, [name, phone || null]);
    return result.rows[0];
}

// Обновить данные постоянника
export async function updateCustomer(id: number, name?: string, phone?: string, points?: number) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
    }
    if (phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`);
        values.push(phone);
    }
    if (points !== undefined) {
        updates.push(`points = $${paramIndex++}`);
        values.push(points);
    }

    if (updates.length === 0) {
        const result = await pool.query(`SELECT * FROM customers WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(`
        UPDATE customers
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
    `, values);

    return result.rows[0] || null;
}

// Увеличить количество визитов и начислить баллы при оплате заказа
export async function incrementCustomerVisitsAndPoints(customerId: number, orderAmount: number) {
    // Начисляем 10% от суммы заказа в виде баллов
    const pointsToAdd = Math.floor(orderAmount * 0.1);

    const result = await pool.query(`
        UPDATE customers
        SET visit_count = visit_count + 1,
            points = points + $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
    `, [pointsToAdd, customerId]);

    return result.rows[0];
}

// Удалить постоянника
export async function deleteCustomer(id: number) {
    const result = await pool.query(`DELETE FROM customers WHERE id = $1 RETURNING id`, [id]);
    return result.rows.length > 0;
}