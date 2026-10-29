import { Router } from 'express';
import {
    handleDailyRevenue,
    handleRevenueByCategory,
    handleTopWaiters,
    handleTopSellingItems,
    handleShiftStatistics,
    handleShiftSummary,
    handleHookahRevenue,
    handleMyShift
} from '../controllers/analyticsController.js';
import { requirePermission } from '../middleware/authorize.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// ─── Личная статистика — доступна всем сотрудникам (только свои данные) ───
// GET /api/analytics/my-shift?date=YYYY-MM-DD
router.get('/my-shift', handleMyShift);

// Рейтинг меню — доступен всем (VIEW_ITEM_STATISTICS или через own-блок; оставим для админ+waiter ниже)
// GET /api/analytics/top-items?start_date=&end_date=
router.get('/top-items', handleTopSellingItems);

// ─── Админка и выше ───
// GET /api/analytics/shift-summary?date=2026-10-16
router.get('/shift-summary', requirePermission(PERMISSIONS.VIEW_ANALYTICS), handleShiftSummary);

// GET /api/analytics/hookah-revenue?start_date=&end_date=
router.get('/hookah-revenue', requirePermission(PERMISSIONS.VIEW_ANALYTICS), handleHookahRevenue);

// GET /api/analytics/daily-revenue?date=2026-10-16
router.get('/daily-revenue', requirePermission(PERMISSIONS.VIEW_ANALYTICS), handleDailyRevenue);

// GET /api/analytics/revenue-by-category?start_date=2026-10-01&end_date=2026-10-31
router.get('/revenue-by-category', requirePermission(PERMISSIONS.VIEW_ANALYTICS), handleRevenueByCategory);

// GET /api/analytics/top-waiters?start_date=2026-10-01&end_date=2026-10-31
router.get('/top-waiters', requirePermission(PERMISSIONS.VIEW_ANALYTICS), handleTopWaiters);

// GET /api/analytics/shift-stats?start_date=2026-10-01&end_date=2026-10-31
router.get('/shift-stats', requirePermission(PERMISSIONS.VIEW_ANALYTICS), handleShiftStatistics);

export default router;