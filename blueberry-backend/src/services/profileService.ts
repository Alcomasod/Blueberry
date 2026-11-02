import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

export interface Profile {
    id: number;
    role: string;
    full_name: string;
    login: string;
    phone: string | null;
    email: string | null;
    department: string | null;
    hired_at: string | null;
    is_active: boolean;
    created_at: string;
}

const PROFILE_SELECT = `
    SELECT id, role, full_name, login, phone, email, department, hired_at, is_active, created_at
    FROM users
    WHERE id = $1
`;

// Получить профиль текущего пользователя
export async function getProfile(userId: number): Promise<Profile | null> {
    const result = await pool.query(PROFILE_SELECT, [userId]);
    return result.rows[0] || null;
}

export interface UpdateProfileInput {
    full_name?: string;
    phone?: string | null;
    email?: string | null;
}

// Обновить профиль (только разрешённые поля, без изменения роли/логина)
export async function updateProfile(userId: number, input: UpdateProfileInput): Promise<Profile | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.full_name !== undefined) {
        updates.push(`full_name = $${paramIndex++}`);
        values.push(input.full_name.trim());
    }
    if (input.phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`);
        values.push(input.phone ? input.phone.trim() : null);
    }
    if (input.email !== undefined) {
        updates.push(`email = $${paramIndex++}`);
        values.push(input.email ? input.email.trim().toLowerCase() : null);
    }

    if (updates.length === 0) {
        return getProfile(userId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id`,
        values
    );
    if (result.rows.length === 0) return null;
    return getProfile(userId);
}

// Смена пароля: проверяем текущий, ставим новый
export async function changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
): Promise<{ ok: boolean; error?: string }> {
    const userRes = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
    if (userRes.rows.length === 0) {
        return { ok: false, error: 'Пользователь не найден' };
    }

    const valid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!valid) {
        return { ok: false, error: 'Текущий пароль указан неверно' };
    }

    if (newPassword.length < 6) {
        return { ok: false, error: 'Новый пароль должен быть не короче 6 символов' };
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, userId]);
    return { ok: true };
}
