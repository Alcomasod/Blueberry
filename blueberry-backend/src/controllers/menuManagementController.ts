import { Request, Response } from 'express';
import {
    createCategory,
    updateCategory,
    deleteCategory,
    createMenuItem,
    updateMenuItem,
    updateMenuItemPrice,
    deleteMenuItem
} from '../services/menuManagementService.js';

// ==========================================
// КАТЕГОРИИ
// ==========================================

export async function handleCreateCategory(req: Request, res: Response) {
    const { name, parent_id, sort_order = 0 } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, error: 'name is required' });
    }

    try {
        const category = await createCategory(name, parent_id || null, sort_order);
        res.status(201).json({ success: true, data: category });
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ success: false, error: 'Failed to create category' });
    }
}

export async function handleUpdateCategory(req: Request, res: Response) {
    const { id } = req.params;
    const { name, parent_id, sort_order, is_active } = req.body;

    try {
        const category = await updateCategory(
            parseInt(id, 10),
            name,
            parent_id,
            sort_order,
            is_active
        );

        if (!category) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }

        res.json({ success: true, data: category });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ success: false, error: 'Failed to update category' });
    }
}

export async function handleDeleteCategory(req: Request, res: Response) {
    const { id } = req.params;

    try {
        const success = await deleteCategory(parseInt(id, 10));
        if (!success) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }
        res.json({ success: true, message: 'Category deleted' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ success: false, error: 'Failed to delete category' });
    }
}

// ==========================================
// ПОЗИЦИИ МЕНЮ
// ==========================================

export async function handleCreateMenuItem(req: Request, res: Response) {
    const userId = req.user?.id;
    const { category_id, name, price, description, image_url, is_for_guests = true, sort_order = 0 } = req.body;

    if (!category_id || !name || price === undefined) {
        return res.status(400).json({
            success: false,
            error: 'category_id, name, and price are required'
        });
    }

    try {
        const menuItem = await createMenuItem(
            category_id,
            name,
            price,
            description,
            image_url,
            is_for_guests,
            sort_order
        );
        res.status(201).json({ success: true, data: menuItem });
    } catch (error) {
        console.error('Error creating menu item:', error);
        res.status(500).json({ success: false, error: 'Failed to create menu item' });
    }
}

export async function handleUpdateMenuItem(req: Request, res: Response) {
    const { id } = req.params;
    const { category_id, name, description, image_url, is_for_guests, is_available, sort_order } = req.body;

    try {
        const menuItem = await updateMenuItem(
            parseInt(id, 10),
            category_id,
            name,
            description,
            image_url,
            is_for_guests,
            is_available,
            sort_order
        );

        if (!menuItem) {
            return res.status(404).json({ success: false, error: 'Menu item not found' });
        }

        res.json({ success: true, data: menuItem });
    } catch (error) {
        console.error('Error updating menu item:', error);
        res.status(500).json({ success: false, error: 'Failed to update menu item' });
    }
}

export async function handleUpdateMenuItemPrice(req: Request, res: Response) {
    const userId = req.user?.id;
    const { id } = req.params;
    const { price } = req.body;

    if (price === undefined || price < 0) {
        return res.status(400).json({ success: false, error: 'Valid price (>= 0) is required' });
    }

    try {
        const result = await updateMenuItemPrice(parseInt(id, 10), price, userId!);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error updating price:', error);
        res.status(500).json({ success: false, error: 'Failed to update price' });
    }
}

export async function handleDeleteMenuItem(req: Request, res: Response) {
    const { id } = req.params;

    try {
        const success = await deleteMenuItem(parseInt(id, 10));
        if (!success) {
            return res.status(404).json({ success: false, error: 'Menu item not found' });
        }
        res.json({ success: true, message: 'Menu item deleted' });
    } catch (error) {
        console.error('Error deleting menu item:', error);
        res.status(500).json({ success: false, error: 'Failed to delete menu item' });
    }
}