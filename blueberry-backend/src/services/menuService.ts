import pool from '../config/db.js';

export interface MenuItem {
    id: number;
    name: string;
    price: string; // DECIMAL возвращается как строка в node-postgres
    is_for_guests: boolean;
    composition?: string | null;
    description?: string | null;
    category_id?: number;
    is_active?: boolean;
}

export interface Category {
    id: number;
    name: string;
    parent_id: number | null;
    sort_order: number;
    items: MenuItem[];
    children: Category[];
}

/**
 * Дерево категорий меню с актуальными ценами.
 * @param includeInactive true — включать скрытые категории/позиции (для страницы управления меню).
 */
export async function getMenuTree(includeInactive = false): Promise<Category[]> {
    // 1. Категории: COALESCE защищает от NULL-флага is_active у старых seed-строк.
    const categoriesRes = await pool.query(
        `SELECT id, name, parent_id, sort_order
         FROM categories
                  ${includeInactive ? '' : 'WHERE COALESCE(is_active, TRUE) = TRUE'}
         ORDER BY sort_order ASC`,
    );
    const categories = categoriesRes.rows;

    // 2. Позиции: LEFT JOIN LATERAL на последнюю действующую цену —
    // блюдо без записи цены не теряется из меню, а показывается с ценой 0.
    const itemsRes = await pool.query(
        `SELECT m.id, m.name, m.category_id, m.description,
                COALESCE(p.price, 0) AS price,
                m.is_for_guests, m.is_available AS is_active, m.sort_order, m.composition
         FROM menu_items m
                  LEFT JOIN LATERAL (
             SELECT mp.price
             FROM menu_item_prices mp
             WHERE mp.menu_item_id = m.id AND mp.valid_to IS NULL
             ORDER BY mp.valid_from DESC
                 LIMIT 1
    ) p ON TRUE
             ${includeInactive ? '' : 'WHERE COALESCE(m.is_available, TRUE) = TRUE'}
         ORDER BY m.sort_order ASC`,
    );
    const items = itemsRes.rows;

    // 3. Собираем дерево в памяти
    const categoryMap = new Map<number, Category>();
    const rootCategories: Category[] = [];

    // Инициализируем карту категорий с пустыми массивами
    for (const cat of categories) {
        categoryMap.set(cat.id, {
            id: cat.id,
            name: cat.name,
            parent_id: cat.parent_id,
            sort_order: cat.sort_order,
            items: [],
            children: []
        });
    }

    // Распределяем категории по родителям
    for (const cat of categoryMap.values()) {
        if (cat.parent_id === null) {
            rootCategories.push(cat);
        } else {
            const parent = categoryMap.get(cat.parent_id);
            if (parent) {
                parent.children.push(cat);
            }
        }
    }

    // Распределяем товары по категориям
    for (const item of items) {
        const category = categoryMap.get(item.category_id);
        if (category) {
            category.items.push({
                id: item.id,
                name: item.name,
                price: item.price,
                is_for_guests: item.is_for_guests,
                composition: item.composition ?? null,
                description: item.description ?? null,
                category_id: item.category_id,
                is_active: item.is_active,
            });
        }
    }

    // Сортируем дочерние категории внутри каждой категории (на всякий случай)
    for (const cat of categoryMap.values()) {
        cat.children.sort((a, b) => a.sort_order - b.sort_order);
    }

    return rootCategories;
}