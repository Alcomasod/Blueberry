import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import { Role, ROLE_HIERARCHY } from '../config/permissions.js';

export interface User {
    id: number;
    role: Role;
    full_name: string;
    login: string;
    is_active: boolean;
    created_at: string;
}

export interface CreateUserInput {
    role: Role;
    full_name: string;
    login: string;
    password: string;
}

export interface UpdateUserInput {
    role?: Role;
    full_name?: string;
    login?: string;
    password?: string;
    is_active?: boolean;
}

// Получить всех пользователей
export async function getAllUsers(): Promise<User[]> {
    const result = await pool.query(`
        SELECT id, role, full_name, login, is_active, created_at
        FROM users
        ORDER BY role, full_name
    `);
    return result.rows;
}

// Получить пользователя по ID
export async function getUserById(id: number): Promise<User | null> {
    const result = await pool.query(`
        SELECT id, role, full_name, login, is_active, created_at
        FROM users
        WHERE id = $1
    `, [id]);
    return result.rows[0] || null;
}

// Создать нового пользователя
export async function createUser(input: CreateUserInput): Promise<User> {
    const passwordHash = await bcrypt.hash(input.password, 10);

    const result = await pool.query(`
        INSERT INTO users (role, full_name, login, password_hash, is_active)
        VALUES ($1, $2, $3, $4, TRUE)
        RETURNING id, role, full_name, login, is_active, created_at
    `, [input.role, input.full_name, input.login, passwordHash]);

    return result.rows[0];
}

// Обновить пользователя
export async function updateUser(id: number, input: UpdateUserInput): Promise<User | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.role !== undefined) {
        updates.push(`role = $${paramIndex++}`);
        values.push(input.role);
    }
    if (input.full_name !== undefined) {
        updates.push(`full_name = $${paramIndex++}`);
        values.push(input.full_name);
    }
    if (input.login !== undefined) {
        updates.push(`login = $${paramIndex++}`);
        values.push(input.login);
    }
    if (input.password !== undefined) {
        const passwordHash = await bcrypt.hash(input.password, 10);
        updates.push(`password_hash = $${paramIndex++}`);
        values.push(passwordHash);
    }
    if (input.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(input.is_active);
    }

    if (updates.length === 0) {
        return getUserById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(`
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, role, full_name, login, is_active, created_at
    `, values);

    return result.rows[0] || null;
}

// Удалить пользователя (мягкое удаление - деактивация)
export async function deactivateUser(id: number): Promise<boolean> {
    const result = await pool.query(`
        UPDATE users
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1
        RETURNING id
    `, [id]);
    return result.rows.length > 0;
}

// Проверка, может ли текущий пользователь управлять целевым
export function canManageUser(currentRole: Role, targetRole: Role): boolean {
    // Sys_admin может управлять всеми
    if (currentRole === 'sys_admin') return true;

    // Director может управлять всеми, кроме sys_admin
    if (currentRole === 'director' && targetRole !== 'sys_admin') return true;

    // Admin может управлять всеми, кроме sys_admin и director
    if (currentRole === 'admin' && targetRole !== 'sys_admin' && targetRole !== 'director') return true;

    // Остальные не могут управлять пользователями
    return false;
}