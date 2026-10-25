import { Request, Response } from 'express';
import { getMenuTree } from '../services/menuService.js';
import { hasPermission, PERMISSIONS, Role } from '../config/permissions.js';

export async function getMenu(req: Request, res: Response) {
    try {
        // GET /api/menu возвращает дерево категорий с позициями и актуальными ценами.
        // Скрытые (недоступные) позиции в него не входят — полный список с флагом
        // is_available доступен администраторам через ?includeInactive=true.
        const includeInactive = req.query.includeInactive === 'true';
        // Скрытые позиции может запрашивать только роль с правом управления меню;
        // для остальных это всегда обычный гостевой вид.
        const canManageMenu = hasPermission(req.user?.role as Role, PERMISSIONS.MANAGE_MENU);
        const menuTree = await getMenuTree(includeInactive && canManageMenu);
        res.json({ success: true, data: menuTree });
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch menu' });
    }
}