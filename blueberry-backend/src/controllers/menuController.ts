import { Request, Response } from 'express';
import { getMenuTree } from '../services/menuService.js';

export async function getMenu(req: Request, res: Response) {
    try {
        const menuTree = await getMenuTree();
        res.json({
            success: true,
            data: menuTree
        });
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch menu'
        });
    }
}