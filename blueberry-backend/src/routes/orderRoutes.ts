import { Router } from 'express';
import {
    handleCreateOrder,
    handlePayOrder,
    handleCloseOrder,
    handleUpdateOrder,
    handleAddItem,
    handleRemoveItem,
    handleUpdateQuantity,
    handleUpdateOrderComment,
    handleGetOrders,       // <-- ИСПОЛЬЗУЕМ НОВОЕ ИМЯ
    handleGetOrderDetails
} from '../controllers/orderController.js';

const router = Router();

// GET /api/orders - Получить заказы (свои для официанта, все для админа)
router.get('/', handleGetOrders);

// GET /api/orders/my - Алиас для совместимости
router.get('/my', handleGetOrders);

// GET /api/orders/:id - Получить детали конкретного заказа
router.get('/:id', handleGetOrderDetails);

// POST /api/orders - Создать новый заказ
router.post('/', handleCreateOrder);

// POST /api/orders/:id/pay - Оплатить заказ
router.post('/:id/pay', handlePayOrder);

// POST /api/orders/:id/close - Закрыть счёт напрямую (admin+, без смены)
router.post('/:id/close', handleCloseOrder);

// PATCH /api/orders/:id - Обновить заказ (напр. { status: 'paid' } — оплата со страницы «Заказы»).
// ВАЖНО: должен быть объявлен ДО router.get('/:id') не зависит (методы разные),
// но сам роут ранее отсутствовал, из-за чего фронтенд получал 404 на PATCH /api/orders/:id.
router.patch('/:id', handleUpdateOrder);

// POST /api/orders/:id/items - Добавить позицию
router.post('/:id/items', handleAddItem);

// DELETE /api/orders/:id/items/:itemId - Удалить позицию
router.delete('/:id/items/:itemId', handleRemoveItem);

// PATCH /api/orders/:id/comment - Обновить комментарий к заказу (персона, предпочтения гостей)
router.patch('/:id/comment', handleUpdateOrderComment);

// PATCH /api/orders/:id/items/:itemId - Изменить количество
router.patch('/:id/items/:itemId', handleUpdateQuantity);

export default router;