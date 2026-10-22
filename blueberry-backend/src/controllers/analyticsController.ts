import { Request, Response } from 'express';
import {
    getDailyRevenue,
    getRevenueByCategory,
    getTopWaiters,
    getTopSellingItems,
    getShiftStatistics
} from '../services/analyticsService.js';

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