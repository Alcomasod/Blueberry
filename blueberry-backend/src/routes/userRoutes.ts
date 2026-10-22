import { Router } from 'express';
import {
    handleGetAllUsers,
    handleGetUser,
    handleCreateUser,
    handleUpdateUser,
    handleDeactivateUser
} from '../controllers/userController.js';

const router = Router();

// GET /api/users - Получить всех пользователей
router.get('/', handleGetAllUsers);

// GET /api/users/:id - Получить пользователя по ID
router.get('/:id', handleGetUser);

// POST /api/users - Создать нового пользователя
router.post('/', handleCreateUser);

// PATCH /api/users/:id - Обновить пользователя
router.patch('/:id', handleUpdateUser);

// DELETE /api/users/:id - Деактивировать пользователя
router.delete('/:id', handleDeactivateUser);

export default router;