import { Request, Response } from 'express';
import pool from '../config/db.js';
import { getAllShifts } from '../services/shiftService.js';

// Открыть смену
export async function handleOpenShift(req: Request, res: Response) {
    const waiterId = req.user?.id;
    if (!waiterId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    try {
        // Проверяем, нет ли уже открытой смены
        const existingShift = await pool.query(`
            SELECT id FROM shifts WHERE waiter_id = $1 AND status = 'open'
        `, [waiterId]);

        if (existingShift.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Shift is already open' });
        }

        const today = new Date().toISOString().split('T')[0];
        const result = await pool.query(`
            INSERT INTO shifts (waiter_id, shift_date, start_time, status)
            VALUES ($1, $2, NOW(), 'open')
            RETURNING *
        `, [waiterId, today]);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error opening shift:', error);
        res.status(500).json({ success: false, error: 'Failed to open shift' });
    }
}

// Закрыть смену
export async function handleCloseShift(req: Request, res: Response) {
    const waiterId = req.user?.id;
    const { id } = req.params;
    const { cash_register_end } = req.body;

    if (!waiterId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    try {
        // Проверяем, что смена принадлежит этому официанту и открыта
        const shiftCheck = await pool.query(`
            SELECT id, status FROM shifts WHERE id = $1 AND waiter_id = $2
        `, [parseInt(id, 10), waiterId]);

        if (shiftCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Shift not found or access denied' });
        }

        if (shiftCheck.rows[0].status !== 'open') {
            return res.status(400).json({ success: false, error: 'Shift is already closed' });
        }

        const result = await pool.query(`
            UPDATE shifts 
            SET status = 'closed', end_time = NOW(), cash_register_end = $1
            WHERE id = $2
            RETURNING *
        `, [cash_register_end || null, parseInt(id, 10)]);

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error closing shift:', error);
        res.status(500).json({ success: false, error: 'Failed to close shift' });
    }
}

// Получить все смены (для админа)
export async function handleGetAllShifts(req: Request, res: Response) {
    const { start_date, end_date } = req.query;

    try {
        const shifts = await getAllShifts(
            start_date as string | undefined,
            end_date as string | undefined
        );
        res.json({ success: true, data: shifts });
    } catch (error) {
        console.error('Error fetching all shifts:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch shifts' });
    }
}

// Получить свои смены (для официанта)
export async function handleGetMyShifts(req: Request, res: Response) {
    const waiterId = req.user?.id;
    if (!waiterId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    try {
        const result = await pool.query(`
            SELECT 
                s.id,
                s.shift_date,
                s.start_time,
                s.end_time,
                s.status,
                s.cash_register_start,
                s.cash_register_end,
                COUNT(o.id) as orders_count,
                COALESCE(SUM(o.total_amount), 0) as total_revenue
            FROM shifts s
            LEFT JOIN orders o ON o.shift_id = s.id AND o.status = 'paid'
            WHERE s.waiter_id = $1
            GROUP BY s.id
            ORDER BY s.shift_date DESC, s.start_time DESC
        `, [waiterId]);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching my shifts:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch shifts' });
    }
}