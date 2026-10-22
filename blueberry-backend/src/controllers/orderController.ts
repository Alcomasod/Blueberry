import { Request, Response } from 'express';
import {
    createOrder,
    OrderItemInput,
    payOrder,
    addItemToOrder,
    removeItemFromOrder,
    updateItemQuantity,
    updateOrderComment,
    getOrdersByRole,       // <-- ЗАМЕНИЛИ getMyOrders НА getOrdersByRole
    getOrderDetails,
    findOpenOrderByTable
} from '../services/orderService.js';
import { getActiveShift } from '../services/shiftService.js';
import { hasPermission, PERMISSIONS, Role } from '../config/permissions.js';

// Пользователь с MANAGE_ALL_OPEN_ORDERS (admin+) может работать с заказами
// независимо от собственной открытой смены.
function canManageAnyOrder(role?: string): boolean {
    return !!role && hasPermission(role as Role, PERMISSIONS.MANAGE_ALL_OPEN_ORDERS);
}

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
        // getOrderDetails сам ограничит выборку: waiter/kitchen — только свои заказы, admin+ — любые
        const order = await getOrderDetails(parseInt(id, 10), role, waiterId);
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

    const { table_id, items, comment } = req.body;

    // Пустой заказ разрешён: официант сначала «открывает стол», позиции добавляются позже
    const orderItems: OrderItemInput[] = Array.isArray(items) ? items : [];

    try {
        const role = req.user?.role;
        let shiftId: number | null = null;
        const activeShift = await getActiveShift(waiterId);
        if (activeShift) {
            shiftId = activeShift.id;
        } else if (!canManageAnyOrder(role)) {
            // Требование открытой смены проверяем ТОЛЬКО когда на столе реально
            // нет открытого заказа для «подхвата». Иначе официант получал
            // «No active shift», пытаясь продолжить админский заказ на своём столе.
            const existing = table_id ? await findOpenOrderByTable(table_id) : null;
            if (!existing) {
                return res.status(400).json({ success: false, error: 'No active shift. Please open a shift first.' });
            }
        }

        const order = await createOrder(
            shiftId,
            table_id || null,
            orderItems,
            waiterId,
            typeof comment === 'string' ? comment : null
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
            parseFloat(discount_amount),
            req.user?.id
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
        const isAdmin = canManageAnyOrder(req.user?.role);

        const result = await addItemToOrder(
            parseInt(id, 10),
            waiterId,
            item as OrderItemInput,
            isAdmin
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
        const isAdmin = canManageAnyOrder(req.user?.role);

        const result = await removeItemFromOrder(
            parseInt(id, 10),
            waiterId,
            parseInt(itemId, 10),
            isAdmin
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error removing item:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
    }
}

// Обновление комментария к заказу (персона гостей, предпочтения: «убрать лук», «без сахара»)
export async function handleUpdateOrderComment(req: Request, res: Response) {
    const waiterId = req.user?.id;
    if (!waiterId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { id } = req.params;
    const { comment } = req.body;

    try {
        const isAdmin = canManageAnyOrder(req.user?.role);
        const result = await updateOrderComment(
            parseInt(id, 10),
            waiterId,
            typeof comment === 'string' ? comment : null,
            isAdmin
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error updating order comment:', error);
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
        const isAdmin = canManageAnyOrder(req.user?.role);

        const result = await updateItemQuantity(
            parseInt(id, 10),
            waiterId,
            parseInt(itemId, 10),
            quantity,
            isAdmin
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error updating quantity:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
    }
}