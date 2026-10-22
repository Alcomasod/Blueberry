import { Router } from 'express';
import { handleGetAllFlavors, handleGetAllFlavorsAdmin, handleCreateFlavor, handleUpdateFlavor, handleDeleteFlavor } from '../controllers/hookahFlavorController.js';
import { requirePermission } from '../middleware/authorize.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// Все авторизованные могут видеть доступные вкусы
router.get('/', handleGetAllFlavors);

// Админ и кальянщик видят все вкусы (включая недоступные)
router.get('/admin', requirePermission(PERMISSIONS.MANAGE_HOOKAH_MENU), handleGetAllFlavorsAdmin);

// Только кальянщик и админ могут управлять
router.post('/', requirePermission(PERMISSIONS.MANAGE_HOOKAH_MENU), handleCreateFlavor);
router.patch('/:id', requirePermission(PERMISSIONS.MANAGE_HOOKAH_MENU), handleUpdateFlavor);
router.delete('/:id', requirePermission(PERMISSIONS.MANAGE_HOOKAH_MENU), handleDeleteFlavor);

export default router;