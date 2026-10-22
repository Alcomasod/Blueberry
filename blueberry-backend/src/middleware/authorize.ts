import { Request, Response, NextFunction } from 'express';
import { Permission, Role, hasPermission } from '../config/permissions.js';

// Middleware для проверки наличия пермишена
export function requirePermission(permission: Permission) {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = req.user?.role as Role | undefined;

        if (!userRole) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }

        if (!hasPermission(userRole, permission)) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Required permission: ${permission}`
            });
        }

        next();
    };
}

// Middleware для проверки, что пользователь не может редактировать вышестоящую роль
export function requireRoleNotHigherThan() {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = req.user?.role as Role | undefined;
        const targetUserId = parseInt(req.params.id, 10);

        if (!userRole) {
            return res.status(401).json({ success: false, error: 'User not authenticated' });
        }

        // Здесь мы будем проверять роль целевого пользователя в контроллере
        // Этот middleware просто пропускает дальше
        next();
    };
}