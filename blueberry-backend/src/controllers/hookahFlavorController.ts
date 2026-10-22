import { Request, Response } from 'express';
import { getAllFlavors, getAllFlavorsAdmin, createFlavor, updateFlavor, deleteFlavor } from '../services/hookahFlavorService.js';

export async function handleGetAllFlavors(req: Request, res: Response) {
    try {
        const flavors = await getAllFlavors();
        res.json({ success: true, data: flavors });
    } catch (error) {
        console.error('Error fetching flavors:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch flavors' });
    }
}

export async function handleGetAllFlavorsAdmin(req: Request, res: Response) {
    try {
        const flavors = await getAllFlavorsAdmin();
        res.json({ success: true, data: flavors });
    } catch (error) {
        console.error('Error fetching flavors:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch flavors' });
    }
}

export async function handleCreateFlavor(req: Request, res: Response) {
    const { name, description, category, sort_order = 0 } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, error: 'name is required' });
    }

    try {
        const flavor = await createFlavor(name, description, category, sort_order);
        res.status(201).json({ success: true, data: flavor });
    } catch (error) {
        console.error('Error creating flavor:', error);
        res.status(500).json({ success: false, error: 'Failed to create flavor' });
    }
}

export async function handleUpdateFlavor(req: Request, res: Response) {
    const { id } = req.params;
    const { name, description, category, is_available, sort_order } = req.body;

    try {
        const flavor = await updateFlavor(parseInt(id, 10), name, description, category, is_available, sort_order);
        if (!flavor) {
            return res.status(404).json({ success: false, error: 'Flavor not found' });
        }
        res.json({ success: true, data: flavor });
    } catch (error) {
        console.error('Error updating flavor:', error);
        res.status(500).json({ success: false, error: 'Failed to update flavor' });
    }
}

export async function handleDeleteFlavor(req: Request, res: Response) {
    const { id } = req.params;

    try {
        const success = await deleteFlavor(parseInt(id, 10));
        if (!success) {
            return res.status(404).json({ success: false, error: 'Flavor not found' });
        }
        res.json({ success: true, message: 'Flavor deleted' });
    } catch (error) {
        console.error('Error deleting flavor:', error);
        res.status(500).json({ success: false, error: 'Failed to delete flavor' });
    }
}