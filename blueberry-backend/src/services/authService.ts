import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken'; // <-- Default import (работает благодаря esModuleInterop)
import dotenv from 'dotenv';

dotenv.config();

export interface LoginResult {
    token: string;
    user: {
        id: number;
        role: string;
        full_name: string;
        login: string;
    };
}

export async function loginUser(login: string, password: string): Promise<LoginResult> {
    const userRes = await pool.query(`
        SELECT id, role, full_name, login, password_hash, is_active
        FROM users
        WHERE login = $1
    `, [login]);

    if (userRes.rows.length === 0) {
        throw new Error('Invalid login or password');
    }

    const user = userRes.rows[0];

    if (!user.is_active) {
        throw new Error('Account is deactivated');
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
        throw new Error('Invalid login or password');
    }

    const payload = {
        id: user.id,
        role: user.role,
        full_name: user.full_name
    };

    // Явное приведение типов для строгого TypeScript
    const signOptions: jwt.SignOptions = {
        expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as jwt.SignOptions['expiresIn']
    };

    const token = jwt.sign(
        payload,
        process.env.JWT_SECRET as jwt.Secret,
        signOptions
    );

    return {
        token,
        user: {
            id: user.id,
            role: user.role,
            full_name: user.full_name,
            login: user.login
        }
    };
}