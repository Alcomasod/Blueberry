import { Request, Response } from 'express';
import {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deactivateUser,
    canManageUser,
    CreateUserInput,
    UpdateUserInput
} from '../services/userService.js';
import { Role } from '../config/permissions.js';

// GET /api/users - Получить всех пользователей
export async function handleGetAllUsers(req: Request, res: Response) {
    try {
        const users = await getAllUsers();
        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
}

// GET /api/users/:id - Получить пользователя по ID
export async function handleGetUser(req: Request, res: Response) {
    const { id } = req.params;

    try {
        const user = await getUserById(parseInt(id, 10));
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch user' });
    }
}

// POST /api/users - Создать нового пользователя
export async function handleCreateUser(req: Request, res: Response) {
    const currentRole = req.user?.role as Role;
    const { role, full_name, login, password } = req.body;

    if (!role || !full_name || !login || !password) {
        return res.status(400).json({
            success: false,
            error: 'role, full_name, login, and password are required'
        });
    }

    // Проверка прав: может ли текущий пользователь создать пользователя с такой ролью
    if (!canManageUser(currentRole, role)) {
        return res.status(403).json({
            success: false,
            error: `You cannot create users with role: ${role}`
        });
    }

    try {
        const user = await createUser({ role, full_name, login, password } as CreateUserInput);
        res.status(201).json({ success: true, data: user });
    } catch (error) {
        console.error('Error creating user:', error);
        if ((error as Error).message.includes('unique')) {
            return res.status(400).json({ success: false, error: 'Login already exists' });
        }
        res.status(500).json({ success: false, error: 'Failed to create user' });
    }
}

// PATCH /api/users/:id - Обновить пользователя
export async function handleUpdateUser(req: Request, res: Response) {
    const currentRole = req.user?.role as Role;
    const { id } = req.params;
    const updates = req.body as UpdateUserInput;

    try {
        // Получаем целевого пользователя
        const targetUser = await getUserById(parseInt(id, 10));
        if (!targetUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Проверка прав: может ли текущий пользователь управлять целевым
        if (!canManageUser(currentRole, targetUser.role)) {
            return res.status(403).json({
                success: false,
                error: 'You cannot manage this user'
            });
        }

        // Если меняется роль, проверяем, может ли текущий пользователь назначить новую роль
        if (updates.role && !canManageUser(currentRole, updates.role)) {
            return res.status(403).json({
                success: false,
                error: `You cannot assign role: ${updates.role}`
            });
        }

        const user = await updateUser(parseInt(id, 10), updates);
        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Error updating user:', error);
        if ((error as Error).message.includes('unique')) {
            return res.status(400).json({ success: false, error: 'Login already exists' });
        }
        res.status(500).json({ success: false, error: 'Failed to update user' });
    }
}

// DELETE /api/users/:id - Деактивировать пользователя
export async function handleDeactivateUser(req: Request, res: Response) {
    const currentRole = req.user?.role as Role;
    const currentUserId = req.user?.id;
    const { id } = req.params;

    const targetId = parseInt(id, 10);

    // Нельзя деактивировать себя
    if (targetId === currentUserId) {
        return res.status(400).json({
            success: false,
            error: 'You cannot deactivate yourself'
        });
    }

    try {
        // Получаем целевого пользователя
        const targetUser = await getUserById(targetId);
        if (!targetUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Проверка прав
        if (!canManageUser(currentRole, targetUser.role)) {
            return res.status(403).json({
                success: false,
                error: 'You cannot deactivate this user'
            });
        }

        const success = await deactivateUser(targetId);
        if (!success) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, message: 'User deactivated successfully' });
    } catch (error) {
        console.error('Error deactivating user:', error);
        res.status(500).json({ success: false, error: 'Failed to deactivate user' });
    }
}