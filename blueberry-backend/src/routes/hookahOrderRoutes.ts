import { Router } from 'express';
import { handleCreateHookahOrder, handleGetOpenHookahOrders, handleUpdateHookahOrderStatus, handleGetHookahOrderDetails } from '../controllers/hookahOrderController.js';
import { requirePermission } from '../middleware/authorize.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// Бар и админ видят все открытые заказы
router.get('/open', requirePermission(PERMISSIONS.VIEW_HOOKAH_ORDERS), handleGetOpenHookahOrders);

// Детали конкретного заказа
router.get('/:id', requirePermission(PERMISSIONS.VIEW_HOOKAH_ORDERS), handleGetHookahOrderDetails);

// Создание заказа (официант, админ)
router.post('/', handleCreateHookahOrder);

// Изменение статуса (кальянщик, бар, админ)
router.patch('/:id/status', requirePermission(PERMISSIONS.MANAGE_HOOKAH_ORDERS), handleUpdateHookahOrderStatus);

export default router;