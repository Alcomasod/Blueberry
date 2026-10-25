import { Request, Response } from 'express';
import { getMenuTree } from '../services/menuService.js';

export async function getMenu(req: Request, res: Response) {
    try {
        // GET /api/menu возвращает дерево категорий с позициями и актуальными ценами.
        // Скрытые (недоступные) позиции в него не входят — полный список с флагом
        // is_available доступен администраторам через ?includeInactive=true.
        const includeInactive = req.query.includeInactive === 'true';
        const menuTree = await getMenuTree(includeInactive);
        res.json({ success: true, data: menuTree });
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch menu' });
    }
}