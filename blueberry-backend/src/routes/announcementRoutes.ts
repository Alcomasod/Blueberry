import { Router } from 'express';
import { requirePermission } from '../middleware/authorize.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
    handleGetAnnouncements,
    handleCreateAnnouncement,
    handleDeactivateAnnouncement,
} from '../controllers/announcementController.js';

const router = Router();

// Просмотр активных оповещений — доступен всем авторизованным (дашборд)
router.get('/', handleGetAnnouncements);

// Создание и отключение оповещений — только роли с MANAGE_CONFIG (admin, director, sys_admin)
router.post('/', requirePermission(PERMISSIONS.MANAGE_CONFIG), handleCreateAnnouncement);
router.delete('/:id', requirePermission(PERMISSIONS.MANAGE_CONFIG), handleDeactivateAnnouncement);

export default router;
