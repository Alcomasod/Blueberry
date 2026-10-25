import { Router } from 'express';
import { handleGetKdsBoard, handleUpdateKdsItemStatus } from '../controllers/kdsController.js';

const router = Router();

// Доску видят все авторизованные роли (включая официантов — они забирают готовые блюда)
router.get('/board', handleGetKdsBoard);

// Менять статусы могут кухня, бар, кальянный мастер и администраторы+.
// Проверка прав выполняется в контроллере с fallback на роль из БД,
// если в JWT отсутствует поле role (старые токены).
router.patch('/items/:id/status', handleUpdateKdsItemStatus);

export default router;
