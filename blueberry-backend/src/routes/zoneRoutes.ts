import { Router } from 'express';
import {
    handleGetAllZones,
    handleCreateZone,
    handleUpdateZone,
    handleDeleteZone
} from '../controllers/zoneController.js';
import { requirePermission } from '../middleware/authorize.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// Просмотр — для всех авторизованных
router.get('/', handleGetAllZones);

// Управление — только admin+
router.post('/', requirePermission(PERMISSIONS.MANAGE_ZONES), handleCreateZone);
router.patch('/:id', requirePermission(PERMISSIONS.MANAGE_ZONES), handleUpdateZone);
router.delete('/:id', requirePermission(PERMISSIONS.MANAGE_ZONES), handleDeleteZone);

export default router;