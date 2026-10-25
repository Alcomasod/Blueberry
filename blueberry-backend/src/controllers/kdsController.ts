import { Request, Response } from 'express';
import pool from '../config/db.js';
import { hasPermission, Role, PERMISSIONS } from '../config/permissions.js';
import { getKdsBoard, updateKdsItemStatus, KDS_STATUSES, KdsStatus } from '../services/kdsService.js';

// Страховка: если в JWT отсутствует поле role (старый токен), подтягиваем роль из БД.
async function resolveUserRole(req: Request): Promise<string | undefined> {
    if (req.user?.role) return req.user.role;
    const userId = req.user?.id;
    if (!userId) return undefined;
    try {
        const r = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
        const role = r.rows[0]?.role as string | undefined;
        if (role && req.user) req.user.role = role; // заполняем на весь запрос
        return role;
    } catch {
        return undefined;
    }
}

// GET /api/kds/board — доска «Кухня / Бар»: активные позиции + готовые к выдаче
export async function handleGetKdsBoard(req: Request, res: Response) {
    try {
        const board = await getKdsBoard();
        res.json({ success: true, data: board });
    } catch (error) {
        console.error('Error fetching KDS board:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch KDS board' });
    }
}

// PATCH /api/kds/items/:id/status — смена статуса позиции { status: preparing|ready|served|new }
export async function handleUpdateKdsItemStatus(req: Request, res: Response) {
    const userId = req.user?.id;
    const itemId = parseInt(req.params.id, 10);
    const { status } = req.body as { status?: string };

    if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    if (!Number.isFinite(itemId)) {
        return res.status(400).json({ success: false, error: 'Invalid item id' });
    }
    if (!status || !KDS_STATUSES.includes(status as KdsStatus)) {
        return res.status(400).json({
            success: false,
            error: `Valid status is required: ${KDS_STATUSES.join(', ')}`,
        });
    }

    // Проверка права на смену статусов выполняется здесь (а не только в маршруте),
    // чтобы при отсутствии role в токене подтянуть роль из БД и не отдавать ложный 403.
    const role = await resolveUserRole(req);
    if (!role) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    if (!hasPermission(role as Role, PERMISSIONS.MANAGE_HOOKAH_ORDERS)) {
        return res.status(403).json({
            success: false,
            error: 'Недостаточно прав для смены статуса на доске кухни',
        });
    }

    try {
        const updated = await updateKdsItemStatus(itemId, status as KdsStatus, userId);
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Order item not found' });
        }
        res.json({ success: true, data: updated });
    } catch (error) {
        const message = (error as Error).message || 'Failed to update status';
        // Некорректный переход статуса — это ошибка клиента
        const code = message.startsWith('Недопустимый переход') ? 400 : 500;
        res.status(code).json({ success: false, error: message });
    }
}
