// src/controllers/tableController.ts
import { Request, Response } from 'express';
import pool from '../config/db.js';
import {
    getAllTables,
    getTableById,
    createTable,
    updateTable,
    deleteTable,
    updateTableStatus
} from '../services/tableService.js';

// Страховка: если в JWT отсутствует поле role (старый токен), подтягиваем роль из БД.
async function resolveUserRole(req: Request): Promise<string | undefined> {
    if (req.user?.role) return req.user.role;
    const userId = req.user?.id;
    if (!userId) return undefined;
    try {
        const r = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
        const role = r.rows[0]?.role as string | undefined;
        if (role && req.user) req.user.role = role;
        return role;
    } catch {
        return undefined;
    }
}

const ADMIN_ROLES = ['sys_admin', 'director', 'admin'];

export async function handleGetAllTables(req: Request, res: Response) {
    try {
        const tables = await getAllTables();
        res.json({ success: true, data: tables });
    } catch (error) {
        console.error('Error fetching tables:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch tables' });
    }
}

export async function handleGetTable(req: Request, res: Response) {
    const { id } = req.params;
    try {
        const table = await getTableById(parseInt(id, 10));
        if (!table) {
            return res.status(404).json({ success: false, error: 'Table not found' });
        }
        res.json({ success: true, data: table });
    } catch (error) {
        console.error('Error fetching table:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch table' });
    }
}

export async function handleCreateTable(req: Request, res: Response) {
    const { number, zone_id, capacity = 4 } = req.body;

    if (!number || !zone_id) {
        return res.status(400).json({ success: false, error: 'number and zone_id are required' });
    }

    try {
        const table = await createTable(number, zone_id, capacity);
        res.status(201).json({ success: true, data: table });
    } catch (error) {
        console.error('Error creating table:', error);
        res.status(500).json({ success: false, error: 'Failed to create table' });
    }
}

export async function handleUpdateTable(req: Request, res: Response) {
    const { id } = req.params;
    const {
        number, zone_id, capacity, status,
        reservation_name, reservation_phone, reservation_time, reservation_comment
    } = req.body;

    try {
        const table = await updateTable(
            parseInt(id, 10),
            number,
            zone_id,
            capacity,
            status,
            reservation_name,
            reservation_phone,
            reservation_time,
            reservation_comment
        );

        if (!table) {
            return res.status(404).json({ success: false, error: 'Table not found' });
        }

        res.json({ success: true, data: table });
    } catch (error) {
        console.error('Error updating table:', error);
        res.status(500).json({ success: false, error: 'Failed to update table' });
    }
}

export async function handleDeleteTable(req: Request, res: Response) {
    const { id } = req.params;
    try {
        const success = await deleteTable(parseInt(id, 10));
        if (!success) {
            return res.status(404).json({ success: false, error: 'Table not found' });
        }
        res.json({ success: true, message: 'Table deleted' });
    } catch (error) {
        console.error('Error deleting table:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
    }
}

export async function handleUpdateTableStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['free', 'occupied', 'reserved'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Valid status (free, occupied, reserved) is required' });
    }

    try {
        // Защита: нельзя вручную перевести стол в «свободен», если на нём
        // открыт неоплаченный счёт. Сначала закройте счёт (страница «Заказы»
        // или кнопка «Закрыть счёт» в карточке стола).
        // Разрешение админ+ — принудительное освобождение (?force=true),
        // чтобы не блокировать работу при рассинхронизации статусов.
        if (status === 'free') {
            const openRes = await pool.query(
                `SELECT id FROM orders WHERE table_id = $1 AND status = 'open' ORDER BY id DESC LIMIT 1`,
                [parseInt(id, 10)]
            );
            if (openRes.rows.length > 0 && req.query.force !== 'true') {
                const role = await resolveUserRole(req);
                if (role && ADMIN_ROLES.includes(role)) {
                    // admin+: освобождаем стол и закрываем счёт как оплаченный (cash)
                    const orderId = openRes.rows[0].id as number;
                    await pool.query(
                        `UPDATE orders SET status = 'paid', closed_at = NOW(), payment_method = COALESCE(payment_method, 'cash') WHERE id = $1 AND status = 'open'`,
                        [orderId]
                    );
                    await pool.query(
                        `INSERT INTO order_history (order_id, user_id, action, details) VALUES ($1, $2, 'paid', 'Стол освобождён вручную, счёт закрыт автоматически')`,
                        [orderId, req.user?.id ?? 0]
                    ).catch(() => { /* история не критична */ });
                } else {
                    return res.status(409).json({
                        success: false,
                        error: 'На столе открыт неоплаченный счёт. Сначала закройте его.',
                        code: 'OPEN_ORDER_EXISTS',
                        data: { order_id: openRes.rows[0].id }
                    });
                }
            }
        }

        const table = await updateTableStatus(parseInt(id, 10), status);
        if (!table) {
            return res.status(404).json({ success: false, error: 'Table not found' });
        }
        res.json({ success: true, data: table });
    } catch (error) {
        console.error('Error updating table status:', error);
        res.status(500).json({ success: false, error: 'Failed to update table status' });
    }
}