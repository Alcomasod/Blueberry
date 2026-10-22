import { Request, Response } from 'express';
import { getAllZones, createZone, updateZone, deleteZone } from '../services/zoneService.js';

export async function handleGetAllZones(req: Request, res: Response) {
    try {
        const zones = await getAllZones();
        res.json({ success: true, data: zones });
    } catch (error) {
        console.error('Error fetching zones:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch zones' });
    }
}

export async function handleCreateZone(req: Request, res: Response) {
    const { name, sort_order = 0 } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, error: 'name is required' });
    }

    try {
        const zone = await createZone(name, sort_order);
        res.status(201).json({ success: true, data: zone });
    } catch (error) {
        console.error('Error creating zone:', error);
        if ((error as Error).message.includes('unique')) {
            return res.status(400).json({ success: false, error: 'Zone name already exists' });
        }
        res.status(500).json({ success: false, error: 'Failed to create zone' });
    }
}

export async function handleUpdateZone(req: Request, res: Response) {
    const { id } = req.params;
    const { name, is_active, sort_order } = req.body;

    try {
        const zone = await updateZone(parseInt(id, 10), name, is_active, sort_order);
        if (!zone) {
            return res.status(404).json({ success: false, error: 'Zone not found' });
        }
        res.json({ success: true, data: zone });
    } catch (error) {
        console.error('Error updating zone:', error);
        res.status(500).json({ success: false, error: 'Failed to update zone' });
    }
}

export async function handleDeleteZone(req: Request, res: Response) {
    const { id } = req.params;

    try {
        const success = await deleteZone(parseInt(id, 10));
        if (!success) {
            return res.status(404).json({ success: false, error: 'Zone not found' });
        }
        res.json({ success: true, message: 'Zone deleted' });
    } catch (error) {
        console.error('Error deleting zone:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
    }
}