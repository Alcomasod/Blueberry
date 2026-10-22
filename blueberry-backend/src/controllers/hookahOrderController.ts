import { Request, Response } from 'express';
import { createHookahOrder, getOpenHookahOrders, updateHookahOrderStatus, getHookahOrderDetails } from '../services/hookahOrderService.js';

export async function handleCreateHookahOrder(req: Request, res: Response) {
    const masterId = req.user?.id;
    const { table_id, items } = req.body;

    if (!table_id || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'table_id and items array are required'
        });
    }

    if (!masterId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    try {
        const hookahOrder = await createHookahOrder(table_id, items, masterId);
        res.status(201).json({ success: true, data: hookahOrder });
    } catch (error) {
        console.error('Error creating hookah order:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
    }
}

export async function handleGetOpenHookahOrders(req: Request, res: Response) {
    try {
        const orders = await getOpenHookahOrders();
        res.json({ success: true, data: orders });
    } catch (error) {
        console.error('Error fetching hookah orders:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch hookah orders' });
    }
}

export async function handleUpdateHookahOrderStatus(req: Request, res: Response) {
    const masterId = req.user?.id;
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'preparing', 'ready', 'served'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Valid status is required' });
    }

    try {
        const order = await updateHookahOrderStatus(parseInt(id, 10), status, masterId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Hookah order not found' });
        }
        res.json({ success: true, data: order });
    } catch (error) {
        console.error('Error updating hookah order status:', error);
        res.status(500).json({ success: false, error: 'Failed to update status' });
    }
}

export async function handleGetHookahOrderDetails(req: Request, res: Response) {
    const { id } = req.params;

    try {
        const order = await getHookahOrderDetails(parseInt(id, 10));
        if (!order) {
            return res.status(404).json({ success: false, error: 'Hookah order not found' });
        }
        res.json({ success: true, data: order });
    } catch (error) {
        console.error('Error fetching hookah order details:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch hookah order' });
    }
}