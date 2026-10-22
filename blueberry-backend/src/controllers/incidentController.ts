import { Request, Response } from 'express';
import {
    createBreakageLog,
    getBreakageLogs,
    createShiftAdjustment,
    getShiftAdjustments
} from '../services/incidentService.js';

// --- БОЙ ПОСУДЫ ---

export async function handleCreateBreakage(req: Request, res: Response) {
    const waiterId = req.user?.id;
    const { menu_item_id, quantity, reason } = req.body;

    if (!menu_item_id || !quantity || quantity <= 0) {
        return res.status(400).json({ success: false, error: 'menu_item_id and valid quantity are required' });
    }

    try {
        const log = await createBreakageLog(menu_item_id, quantity, reason || 'Не указано', waiterId!);
        res.status(201).json({ success: true, data: log });
    } catch (error) {
        console.error('Error creating breakage log:', error);
        res.status(500).json({ success: false, error: 'Failed to create breakage log' });
    }
}

export async function handleGetBreakageLogs(req: Request, res: Response) {
    const { waiter_id, start_date, end_date } = req.query;

    try {
        const logs = await getBreakageLogs(
            waiter_id ? parseInt(waiter_id as string, 10) : undefined,
            start_date as string | undefined,
            end_date as string | undefined
        );
        res.json({ success: true, data: logs });
    } catch (error) {
        console.error('Error fetching breakage logs:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch breakage logs' });
    }
}

// --- КОРРЕКТИРОВКИ СМЕН ---

export async function handleCreateShiftAdjustment(req: Request, res: Response) {
    const createdById = req.user?.id;
    const { shift_id, amount, reason } = req.body;

    if (!shift_id || amount === undefined || !reason) {
        return res.status(400).json({ success: false, error: 'shift_id, amount, and reason are required' });
    }

    try {
        const adjustment = await createShiftAdjustment(shift_id, parseFloat(amount), reason, createdById!);
        res.status(201).json({ success: true, data: adjustment });
    } catch (error) {
        console.error('Error creating shift adjustment:', error);
        res.status(500).json({ success: false, error: 'Failed to create shift adjustment' });
    }
}

export async function handleGetShiftAdjustments(req: Request, res: Response) {
    const { shift_id } = req.params;

    try {
        const adjustments = await getShiftAdjustments(parseInt(shift_id, 10));
        res.json({ success: true, data: adjustments });
    } catch (error) {
        console.error('Error fetching shift adjustments:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch shift adjustments' });
    }
}