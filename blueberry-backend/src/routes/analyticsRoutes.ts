import { Router } from 'express';
import {
    handleDailyRevenue,
    handleRevenueByCategory,
    handleTopWaiters,
    handleTopSellingItems,
    handleShiftStatistics
} from '../controllers/analyticsController.js';

const router = Router();

// GET /api/analytics/daily-revenue?date=2026-10-16
router.get('/daily-revenue', handleDailyRevenue);

// GET /api/analytics/revenue-by-category?start_date=2026-10-01&end_date=2026-10-31
router.get('/revenue-by-category', handleRevenueByCategory);

// GET /api/analytics/top-waiters?start_date=2026-10-01&end_date=2026-10-31
router.get('/top-waiters', handleTopWaiters);

// GET /api/analytics/top-items?start_date=2026-10-01&end_date=2026-10-31
router.get('/top-items', handleTopSellingItems);

// GET /api/analytics/shift-stats?start_date=2026-10-01&end_date=2026-10-31
router.get('/shift-stats', handleShiftStatistics);

export default router;