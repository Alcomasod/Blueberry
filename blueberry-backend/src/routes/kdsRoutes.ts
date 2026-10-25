import { Router } from 'express';
import { handleGetKdsBoard, handleUpdateKdsItemStatus } from '../controllers/kdsController.js';
import { requirePermission } from '../middleware/authorize.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// Доску видят все авторизованные роли (включая официантов — они забирают готовые блюда)
router.get('/board', handleGetKdsBoard);

// Менять статусы могут только кухня, бар и администраторы (VIEW_HOOKAH_ORDERS есть у kitchen/hookah_bar/admin+)
router.patch('/items/:id/status', requirePermission(PERMISSIONS.VIEW_HOOKAH_ORDERS), handleUpdateKdsItemStatus);

export default router;
