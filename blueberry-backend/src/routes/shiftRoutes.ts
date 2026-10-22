import { Router } from 'express';
import {
    handleOpenShift,
    handleCloseShift,
    handleGetAllShifts,
    handleGetMyShifts
} from '../controllers/shiftController.js';
import { requirePermission } from '../middleware/authorize.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// Получить все смены (только admin+)
router.get('/', requirePermission(PERMISSIONS.MANAGE_ALL_SHIFTS), handleGetAllShifts);

// Получить свои смены (waiter+)
router.get('/my', requirePermission(PERMISSIONS.MANAGE_OWN_SHIFTS), handleGetMyShifts);

// Открыть смену
router.post('/open', handleOpenShift);

// Закрыть смену
router.post('/:id/close', handleCloseShift);

export default router;