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
    findOpenOrderByTable,
    addOrderGuest,
    updateOrderGuest,
    removeOrderGuest,
    getOrderGuests,
    MAX_GUESTS_PER_ORDER
} from '../services/orderService.js';
import { getActiveShift } from '../services/shiftService.js';
import { hasPermission, PERMISSIONS, Role } from '../config/permissions.js';
import pool from '../config/db.js';

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

// PATCH /api/orders/:id - Обновление заказа.
// Поддерживает { status: 'paid' } — этот вызов использует фронтенд страницы «Заказы»
// (OrderDetailsModal → handlePayOrder). Ранее эндпоинт отсутствовал, из-за чего
// оплата возвращала 404. Логику полностью воспроизводим через payOrder():
// статус -> paid, closed_at = NOW(), начисление баллов, освобождение стола.
export async function handleUpdateOrder(req: Request, res: Response) {
    const { id } = req.params;
    const { status } = req.body ?? {};

    try {
        if (status === 'paid') {
            // Оплата/закрытие счёта — как на странице «Заказы» и «Зал и столы»
            const order = await payOrder(parseInt(id, 10), 'cash', 0, 0, req.user?.id);
            return res.json({ success: true, data: order });
        }

        if (status === 'cancelled') {
            // Отмена открытого заказа (admin+), освобождаем стол
            if (!canManageAnyOrder(req.user?.role)) {
                return res.status(403).json({ success: false, error: 'Недостаточно прав для отмены заказа' });
            }
            const result = await poolQueryCancel(parseInt(id, 10));
            if (!result) {
                return res.status(404).json({ success: false, error: 'Заказ не найден или уже закрыт' });
            }
            return res.json({ success: true, data: result });
        }

        return res.status(400).json({ success: false, error: 'Неподдерживаемое поле обновления' });
    } catch (error) {
        const msg = (error as Error).message || '';
        console.error('Error updating order:', error);
        if (msg.includes('not found') || msg.includes('already paid')) {
            return res.status(404).json({ success: false, error: 'Заказ не найден или уже закрыт' });
        }
        res.status(500).json({ success: false, error: 'Не удалось обновить заказ' });
    }
}

// Вспомогательный запрос для отмены заказа (вынесен, чтобы не тянуть транзакцию в контроллер)
async function poolQueryCancel(orderId: number) {
    const upd = await pool.query(
        `UPDATE orders SET status = 'cancelled', closed_at = NOW() WHERE id = $1 AND status = 'open' RETURNING *`,
        [orderId],
    );
    if (upd.rows.length === 0) return null;
    const order = upd.rows[0];
    if (order.table_id) {
        await pool.query(`UPDATE tables SET status = 'free' WHERE id = $1`, [order.table_id]);
    }
    return order;
}

// POST /api/orders/:id/close - Закрыть (оплатить) заказ напрямую из карточки стола.
// Воспроизводит логику страницы «Заказы» (POST /orders/:id/pay): статус -> paid,
// closed_at = NOW(), стол освобождается, начисляются баллы постояннику.
// Отличие: не требует активной смены — закрытие счёта доступно admin+ (MANAGE_ALL_OPEN_ORDERS).
export async function handleCloseOrder(req: Request, res: Response) {
    const { id } = req.params;
    const role = req.user?.role;

    if (!canManageAnyOrder(role)) {
        return res.status(403).json({
            success: false,
            error: 'Недостаточно прав для закрытия счёта'
        });
    }

    try {
        const order = await payOrder(parseInt(id, 10), 'cash', 0, 0, req.user?.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Заказ не найден или уже закрыт'
            });
        }

        res.json({ success: true, data: order });
    } catch (error) {
        const msg = (error as Error).message || '';
        console.error('Error closing order:', error);
        // «Уже оплачен/не найден» service бросает как ошибку — отдаём корректный код
        if (msg.includes('not found') || msg.includes('already paid')) {
            return res.status(404).json({ success: false, error: 'Заказ не найден или уже закрыт' });
        }
        res.status(500).json({ success: false, error: 'Не удалось закрыть счёт' });
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
    const { quantity, guest_id } = req.body;

    if (!quantity || quantity <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Valid quantity (> 0) is required'
        });
    }

    // guest_id: число — привязать к гостю; null — отвязать; undefined — не менять
    let guestId: number | null | undefined;
    if (guest_id !== undefined) {
        guestId = guest_id === null ? null : parseInt(String(guest_id), 10);
        if (Number.isNaN(guestId)) {
            return res.status(400).json({ success: false, error: 'Invalid guest_id' });
        }
    }

    try {
        const isAdmin = canManageAnyOrder(req.user?.role);

        const result = await updateItemQuantity(
            parseInt(id, 10),
            waiterId,
            parseInt(itemId, 10),
            quantity,
            isAdmin,
            guestId
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error updating quantity:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
    }
}
// ==========================================
// ГОСТИ ЗА СТОЛОМ (раздельный счёт, персональные скидки)
// ==========================================

// GET /api/orders/:id/guests — список гостей с суммами и скидками
export async function handleGetOrderGuests(req: Request, res: Response) {
    try {
        const guests = await getOrderGuests(parseInt(req.params.id, 10));
        res.json({ success: true, data: { guests, max_guests: MAX_GUESTS_PER_ORDER } });
    } catch (error) {
        console.error('Error fetching order guests:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
    }
}

// POST /api/orders/:id/guests — добавить гостя ({ name? })
export async function handleAddOrderGuest(req: Request, res: Response) {
    const waiterId = req.user?.id;
    if (!waiterId) return res.status(401).json({ success: false, error: 'User not authenticated' });

    try {
        const isAdmin = canManageAnyOrder(req.user?.role);
        const guest = await addOrderGuest(
            parseInt(req.params.id, 10),
            waiterId,
            typeof req.body?.name === 'string' ? req.body.name : null,
            isAdmin
        );
        res.status(201).json({ success: true, data: guest });
    } catch (error) {
        console.error('Error adding guest:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
    }
}

// PATCH /api/orders/:id/guests/:guestId — имя/скидка ({ name?, discount_percent? })
export async function handleUpdateOrderGuest(req: Request, res: Response) {
    const waiterId = req.user?.id;
    if (!waiterId) return res.status(401).json({ success: false, error: 'User not authenticated' });

    const { name, discount_percent } = req.body ?? {};
    try {
        const isAdmin = canManageAnyOrder(req.user?.role);
        const guest = await updateOrderGuest(
            parseInt(req.params.id, 10),
            parseInt(req.params.guestId, 10),
            waiterId,
            {
                name: typeof name === 'string' || name === null ? name : undefined,
                discount_percent: typeof discount_percent === 'number' ? discount_percent : undefined,
            },
            isAdmin
        );
        res.json({ success: true, data: guest });
    } catch (error) {
        console.error('Error updating guest:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
    }
}

// DELETE /api/orders/:id/guests/:guestId — удалить гостя (позиции остаются в заказе)
export async function handleRemoveOrderGuest(req: Request, res: Response) {
    const waiterId = req.user?.id;
    if (!waiterId) return res.status(401).json({ success: false, error: 'User not authenticated' });

    try {
        const isAdmin = canManageAnyOrder(req.user?.role);
        const result = await removeOrderGuest(
            parseInt(req.params.id, 10),
            parseInt(req.params.guestId, 10),
            waiterId,
            isAdmin
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error removing guest:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
    }
}
