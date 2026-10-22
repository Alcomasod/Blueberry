import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken'; // <-- Default import
import dotenv from 'dotenv';

dotenv.config();

export interface JwtPayload {
    id: number;
    role: string;
    full_name: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }

    try {
        const secret = process.env.JWT_SECRET as jwt.Secret;
        const decoded = jwt.verify(token, secret) as JwtPayload;

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
}