import { Router } from 'express';
import {
    handleGetAllTables,
    handleGetTable,
    handleCreateTable,
    handleUpdateTable,
    handleDeleteTable,
    handleUpdateTableStatus
} from '../controllers/tableController.js';
import { requirePermission } from '../middleware/authorize.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// Просмотр — для всех авторизованных
router.get('/', handleGetAllTables);
router.get('/:id', handleGetTable);

// Смена статуса — для официантов и админов
router.patch('/:id/status', requirePermission(PERMISSIONS.MANAGE_TABLE_STATUS), handleUpdateTableStatus);

// Полное управление — только admin+
router.post('/', requirePermission(PERMISSIONS.MANAGE_TABLES), handleCreateTable);
router.patch('/:id', requirePermission(PERMISSIONS.MANAGE_TABLES), handleUpdateTable);
router.delete('/:id', requirePermission(PERMISSIONS.MANAGE_TABLES), handleDeleteTable);

export default router;