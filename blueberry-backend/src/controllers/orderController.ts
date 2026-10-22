import { Request, Response } from 'express';
import {
    createOrder,
    OrderItemInput,
    payOrder,
    addItemToOrder,
    removeItemFromOrder,
    updateItemQuantity,
    getOrdersByRole,       // <-- ЗАМЕНИЛИ getMyOrders НА getOrdersByRole
    getOrderDetails
} from '../services/orderService.js';
import { getActiveShift } from '../services/shiftService.js';

// ==========================================
// ПОЛУЧЕНИЕ СПИСКА ЗАКАЗОВ
// ==========================================

export async function handleGetOrders(req: Request, res: Response) {
    const waiterId = req.user?.id;
    const role = req.user?.role;

    if (!waiterId || !role) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { status } = req.query;

    try {
        // getOrdersByRole сама решит: админ видит все, официант/кухня - только свои
        const orders = await getOrdersByRole(
            role,
            waiterId,
            status as string | undefined
        );

        res.json({ success: true, data: orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
}

// ==========================================
// ДЕТАЛИ ЗАКАЗА
// ==========================================

export async function handleGetOrderDetails(req: Request, res: Response) {
    const waiterId = req.user?.id;
    const role = req.user?.role;

    if (!waiterId || !role) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { id } = req.params;

    try {
        // Для официанта/кухни проверяем активную смену, для админа передаем null
        let shiftId = null;
        if (role === 'waiter' || role === 'kitchen') {
            const activeShift = await getActiveShift(waiterId);
            shiftId = activeShift ? activeShift.id : null;
        }

        const order = await getOrderDetails(parseInt(id, 10), role, shiftId);
        res.json({ success: true, data: order });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
    }
}

// ==========================================
// СОЗДАНИЕ И УПРАВЛЕНИЕ ЗАКАЗОМ
// ==========================================

export async function handleCreateOrder(req: Request, res: Response) {
    const waiterId = req.user?.id;
    if (!waiterId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { table_id, items } = req.body;

    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'Items must be an array' });
    }

    try {
        const activeShift = await getActiveShift(waiterId);
        if (!activeShift) {
            return res.status(400).json({ success: false, error: 'No active shift. Please open a shift first.' });
        }

        const order = await createOrder(
            activeShift.id,
            table_id || null,
            items as OrderItemInput[],
            waiterId
        );

        res.status(201).json({ success: true, data: order });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create order',
            details: (error as Error).message
        });
    }
}

export async function handlePayOrder(req: Request, res: Response) {
    const { id } = req.params;
    const { payment_method, tip_amount = 0, discount_amount = 0 } = req.body;

    if (!payment_method || !['cash', 'card', 'mixed'].includes(payment_method)) {
        return res.status(400).json({
            success: false,
            error: 'Valid payment_method (cash, card, mixed) is required'
        });
    }

    try {
        const order = await payOrder(
            parseInt(id, 10),
            payment_method,
            parseFloat(tip_amount),
            parseFloat(discount_amount)
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found or already paid/cancelled'
            });
        }

        res.json({ success: true, data: order });
    } catch (error) {
        console.error('Error paying order:', error);
        res.status(500).json({ success: false, error: 'Failed to pay order' });
    }
}

export async function handleAddItem(req: Request, res: Response) {
    const waiterId = req.user?.id;
    if (!waiterId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { id } = req.params;
    const item = req.body;

    if (!item || (!item.menu_item_id && !item.combo_id) || !item.quantity) {
        return res.status(400).json({
            success: false,
            error: 'Item must contain menu_item_id or combo_id, and quantity'
        });
    }

    try {
        const activeShift = await getActiveShift(waiterId);
        if (!activeShift) {
            return res.status(400).json({ success: false, error: 'No active shift' });
        }

        const result = await addItemToOrder(
            parseInt(id, 10),
            activeShift.id,
            item as OrderItemInput,
            waiterId
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error adding item:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
    }
}

export async function handleRemoveItem(req: Request, res: Response) {
    const waiterId = req.user?.id;
    if (!waiterId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { id, itemId } = req.params;

    try {
        const activeShift = await getActiveShift(waiterId);
        if (!activeShift) {
            return res.status(400).json({ success: false, error: 'No active shift' });
        }

        const result = await removeItemFromOrder(
            parseInt(id, 10),
            activeShift.id,
            parseInt(itemId, 10)
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error removing item:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
    }
}

export async function handleUpdateQuantity(req: Request, res: Response) {
    const waiterId = req.user?.id;
    if (!waiterId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { id, itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Valid quantity (> 0) is required'
        });
    }

    try {
        const activeShift = await getActiveShift(waiterId);
        if (!activeShift) {
            return res.status(400).json({ success: false, error: 'No active shift' });
        }

        const result = await updateItemQuantity(
            parseInt(id, 10),
            activeShift.id,
            parseInt(itemId, 10),
            quantity
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error updating quantity:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
    }
}