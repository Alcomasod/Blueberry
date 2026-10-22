import { Router } from 'express';
import {
    handleCreateBreakage,
    handleGetBreakageLogs,
    handleCreateShiftAdjustment,
    handleGetShiftAdjustments
} from '../controllers/incidentController.js';
import { requirePermission } from '../middleware/authorize.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// Бой посуды: создать может любой сотрудник (waiter+), просмотр - admin+
router.post('/breakage', requirePermission(PERMISSIONS.VIEW_BREAKAGE), handleCreateBreakage);
router.get('/breakage', requirePermission(PERMISSIONS.VIEW_BREAKAGE), handleGetBreakageLogs);

// Корректировки смен: только admin+ (MANAGE_HOURS / MANAGE_ALL_SHIFTS)
router.post('/shifts/:shift_id/adjust', requirePermission(PERMISSIONS.MANAGE_HOURS), handleCreateShiftAdjustment);
router.get('/shifts/:shift_id/adjustments', requirePermission(PERMISSIONS.MANAGE_HOURS), handleGetShiftAdjustments);

export default router;