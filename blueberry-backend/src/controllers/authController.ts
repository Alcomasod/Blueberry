import { Request, Response } from 'express';
import { loginUser } from '../services/authService.js';

export async function handleLogin(req: Request, res: Response) {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.status(400).json({
            success: false,
            error: 'Login and password are required'
        });
    }

    try {
        const result = await loginUser(login, password);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({
            success: false,
            error: (error as Error).message
        });
    }
}