import { Request, Response } from 'express';
import { getMenuTree } from '../services/menuService.js';
import { hasPermission, PERMISSIONS, Role } from '../config/permissions.js';

export async function getMenu(req: Request, res: Response) {
    try {
        // Скрытые позиции показываем только тем, кто управляет меню (admin+),
        // и только по явному запросу ?includeInactive=true.
        const canManageMenu = hasPermission((req.user?.role ?? '') as Role, PERMISSIONS.MANAGE_MENU);
        const includeInactive = canManageMenu && req.query.includeInactive === 'true';

        const queryText = includeInactive
            ? `SELECT mc.id AS category_id, mc.name AS category_name, mc.sort_order,
                      mi.id, mi.name, mi.description, mi.price, mi.composition, mi.is_active
               FROM menu_categories mc
               JOIN menu_items mi ON mi.category_id = mc.id
               ORDER BY mc.sort_order ASC, mi.name ASC`
            : `SELECT mc.id AS category_id, mc.name AS category_name, mc.sort_order,
                      mi.id, mi.name, mi.description, mi.price, mi.composition, mi.is_active
               FROM menu_categories mc
               JOIN menu_items mi ON mi.category_id = mc.id
               WHERE mi.is_active = TRUE
               ORDER BY mc.sort_order ASC, mi.name ASC`;

        const result = await pool.query(queryText);

        const categoriesMap = new Map<number, { id: number; name: string; items: unknown[] }>();
        for (const row of result.rows) {
            if (!categoriesMap.has(row.category_id)) {
                categoriesMap.set(row.category_id, {
                    id: row.category_id,
                    name: row.category_name,
                    items: [],
                });
            }
            categoriesMap.get(row.category_id)!.items.push({
                id: row.id,
                name: row.name,
                description: row.description,
                price: Number(row.price),
                composition: row.composition,
                is_active: row.is_active,
                category_id: row.category_id,
            });
        }

        res.json({ success: true,  Array.from(categoriesMap.values()) });
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch menu' });
    }
}