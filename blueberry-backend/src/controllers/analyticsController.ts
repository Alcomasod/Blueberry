import { Request, Response } from 'express';
import {
    getDailyRevenue,
    getRevenueByCategory,
    getTopWaiters,
    getTopSellingItems,
    getShiftStatistics,
    getShiftSummary,
    getHookahRevenue,
    getMyStats,
    getAvgCheckPerGuest
} from '../services/analyticsService.js';

// Текущий "операционный день": до 04:00 утра — это ещё вчера (заведение работает 13:00–04:00)
function currentBusinessDate(): string {
    const now = new Date();
    if (now.getHours() < 4) now.setDate(now.getDate() - 1);
    return now.toISOString().slice(0, 10);
}

function resolveDate(raw: unknown): string {
    return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : currentBusinessDate();
}

// GET /api/analytics/shift-summary?date=YYYY-MM-DD (админ+)
export async function handleShiftSummary(req: Request, res: Response) {
    try {
        const data = await getShiftSummary(resolveDate(req.query.date));
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching shift summary:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch shift summary' });
    }
}

// GET /api/analytics/hookah-revenue?start_date=&end_date= (админ+)
export async function handleHookahRevenue(req: Request, res: Response) {
    try {
        const start = typeof req.query.start_date === 'string' ? req.query.start_date : currentBusinessDate();
        const end = typeof req.query.end_date === 'string' ? req.query.end_date : start;
        const data = await getHookahRevenue(start, end);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching hookah revenue:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch hookah revenue' });
    }
}

// GET /api/analytics/my-shift (все сотрудники — только свои данные)
export async function handleMyShift(req: Request, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, error: 'User not authenticated' });
        const date = resolveDate(req.query.date);
        const [stats, avgGuest] = await Promise.all([getMyStats(userId, date), getAvgCheckPerGuest(date)]);
        res.json({ success: true, data: { ...stats, avg_check_per_guest: avgGuest.avg_check_per_guest } });
    } catch (error) {
        console.error('Error fetching my-shift stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch my shift stats' });
    }
}

// Выручка за день
export async function handleDailyRevenue(req: Request, res: Response) {
    try {
        const { date } = req.query;
        if (!date || typeof date !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Date parameter is required (format: YYYY-MM-DD)'
            });
        }

        const revenue = await getDailyRevenue(date);
        res.json({
            success: true,
            data: revenue
        });
    } catch (error) {
        console.error('Error fetching daily revenue:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch daily revenue' });
    }
}

// Выручка по категориям
export async function handleRevenueByCategory(req: Request, res: Response) {
    try {
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                error: 'start_date and end_date parameters are required'
            });
        }

        const categories = await getRevenueByCategory(
            start_date as string,
            end_date as string
        );
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Error fetching revenue by category:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch revenue by category' });
    }
}

// Топ официантов
export async function handleTopWaiters(req: Request, res: Response) {
    try {
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                error: 'start_date and end_date parameters are required'
            });
        }

        const waiters = await getTopWaiters(
            start_date as string,
            end_date as string
        );
        res.json({
            success: true,
            data: waiters
        });
    } catch (error) {
        console.error('Error fetching top waiters:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch top waiters' });
    }
}

// Топ блюд
export async function handleTopSellingItems(req: Request, res: Response) {
    try {
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                error: 'start_date and end_date parameters are required'
            });
        }

        const items = await getTopSellingItems(
            start_date as string,
            end_date as string
        );
        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        console.error('Error fetching top selling items:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch top selling items' });
    }
}

// Статистика смен
export async function handleShiftStatistics(req: Request, res: Response) {
    try {
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                error: 'start_date and end_date parameters are required'
            });
        }

        const stats = await getShiftStatistics(
            start_date as string,
            end_date as string
        );
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching shift statistics:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch shift statistics' });
    }
}