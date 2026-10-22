// src/controllers/tableController.ts
import { Request, Response } from 'express';
import {
    getAllTables,
    getTableById,
    createTable,
    updateTable,
    deleteTable,
    updateTableStatus
} from '../services/tableService.js';

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