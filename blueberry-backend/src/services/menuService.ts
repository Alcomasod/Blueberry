import pool from '../config/db.js';

export interface MenuItem {
    id: number;
    name: string;
    price: string; // DECIMAL возвращается как строка в node-postgres
    is_for_guests: boolean;
    composition?: string | null;
}

export interface Category {
    id: number;
    name: string;
    parent_id: number | null;
    sort_order: number;
    items: MenuItem[];
    children: Category[];
}

export async function getMenuTree(): Promise<Category[]> {
    // 1. Получаем все активные категории, отсортированные по sort_order
    const categoriesRes = await pool.query(`
    SELECT id, name, parent_id, sort_order 
    FROM categories 
    WHERE is_active = true 
    ORDER BY sort_order ASC
  `);
    const categories = categoriesRes.rows;

    // 2. Получаем все доступные позиции меню с их ТЕКУЩЕЙ ценой
    const itemsRes = await pool.query(`
    SELECT m.id, m.name, m.category_id, p.price, m.is_for_guests, m.sort_order, m.composition
    FROM menu_items m
    JOIN menu_item_prices p ON m.id = p.menu_item_id AND p.valid_to IS NULL
    WHERE m.is_available = true
    ORDER BY m.sort_order ASC
  `);
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
                composition: item.composition ?? null
            });
        }
    }

    // Сортируем дочерние категории внутри каждой категории (на всякий случай)
    for (const cat of categoryMap.values()) {
        cat.children.sort((a, b) => a.sort_order - b.sort_order);
    }

    return rootCategories;
}