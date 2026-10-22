import { Router } from 'express';
import {
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleCreateMenuItem,
    handleUpdateMenuItem,
    handleUpdateMenuItemPrice,
    handleDeleteMenuItem
} from '../controllers/menuManagementController.js';

const router = Router();

// ==========================================
// КАТЕГОРИИ
// ==========================================

// POST /api/menu-management/categories - Создать категорию
router.post('/categories', handleCreateCategory);

// PATCH /api/menu-management/categories/:id - Обновить категорию
router.patch('/categories/:id', handleUpdateCategory);

// DELETE /api/menu-management/categories/:id - Удалить категорию
router.delete('/categories/:id', handleDeleteCategory);

// ==========================================
// ПОЗИЦИИ МЕНЮ
// ==========================================

// POST /api/menu-management/items - Создать позицию меню
router.post('/items', handleCreateMenuItem);

// PATCH /api/menu-management/items/:id - Обновить позицию меню
router.patch('/items/:id', handleUpdateMenuItem);

// PATCH /api/menu-management/items/:id/price - Изменить цену позиции
router.patch('/items/:id/price', handleUpdateMenuItemPrice);

// DELETE /api/menu-management/items/:id - Удалить позицию меню
router.delete('/items/:id', handleDeleteMenuItem);

export default router;