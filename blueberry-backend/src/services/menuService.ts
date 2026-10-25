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
    // Скрытые категории (is_active = FALSE) не показываем никому — страница «Меню»
    // для всех ролей отображает активный гостевой вид меню.
    // Если в старой схеме нет колонок is_active/sort_order — используем упрощённый
    // запрос, чтобы страница «Меню» никогда не оставалась пустой из-за схемы БД.
    let categories: any[] = [];
    try {
        const categoriesRes = await pool.query(
            `SELECT id, name, parent_id, sort_order
             FROM categories
             WHERE COALESCE(is_active, TRUE) = TRUE
             ORDER BY sort_order ASC`,
        );
        categories = categoriesRes.rows;
    } catch (err) {
        console.warn('menuService: расширенный запрос категорий не удался, пробую упрощённый:', (err as Error).message);
        const fallbackRes = await pool.query(`SELECT id, name, parent_id, 0 AS sort_order FROM categories`);
        categories = fallbackRes.rows;
    }

    // 2. Позиции: берём ВСЕ позиции меню без фильтра по is_available —
    // страницу «Меню» должен видеть персонал любых ролей, а статус доступности
    // отдаётся флагом is_active и затеняется на фронтенде (плюс фильтр
    // «Показывать скрытые» у администратора).
    // LEFT JOIN LATERAL на последнюю действующую цену — блюдо без записи цены
    // не теряется из меню, а показывается с ценой 0.
    // Fallback-запросы по очереди убавляют необязательные колонки
    // (composition → is_for_guests/is_available/sort_order/description),
    // подстраиваясь под старую схему БД.
    const itemQueries = [
        {
            sql: `SELECT m.id, m.name, m.category_id, m.description,
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
                 ORDER BY m.sort_order ASC`,
            normalize: (r: any) => r,
        },
        {
            sql: `SELECT m.id, m.name, m.category_id, m.description,
                        COALESCE((SELECT mp.price FROM menu_item_prices mp
                                  WHERE mp.menu_item_id = m.id AND mp.valid_to IS NULL
                                  ORDER BY mp.valid_from DESC LIMIT 1), 0) AS price,
                        m.is_for_guests, m.is_available AS is_active, m.sort_order
                 FROM menu_items m
                 ORDER BY m.sort_order ASC`,
            normalize: (r: any) => ({ ...r, composition: null }),
        },
        {
            sql: `SELECT m.id, m.name, m.category_id,
                        COALESCE((SELECT mp.price FROM menu_item_prices mp
                                  WHERE mp.menu_item_id = m.id AND mp.valid_to IS NULL
                                  ORDER BY mp.valid_from DESC LIMIT 1), 0) AS price
                 FROM menu_items m`,
            normalize: (r: any) => ({
                ...r,
                description: null,
                composition: null,
                is_for_guests: true,
                is_active: true,
                sort_order: 0,
            }),
        },
    ];

    let items: any[] = [];
    for (const q of itemQueries) {
        try {
            const res = await pool.query(q.sql);
            items = res.rows.map(q.normalize);
            if (items.length > 0) break;
        } catch (err) {
            console.warn('menuService: запрос позиций меню не удался, пробую более простой:', (err as Error).message);
            continue;
        }
    }

    // 3. Собираем дерево в памяти
    const categoryMap = new Map<number, Category>();
    const rootCategories: Category[] = [];

    // Инициализируем карту категорий с пустыми массивами
    for (const cat of categories) {
        categoryMap.set(cat.id, {
            id: cat.id,
            name: cat.name,
            parent_id: cat.parent_id ?? null,
            sort_order: cat.sort_order ?? 0,
            items: [],
            children: []
        });
    }

    // Распределяем категории по родителям; «сироты» (родитель удалён/скрыт,
    // parent_id указывает на отсутствующую категорию) поднимаются в корень,
    // чтобы их блюда не исчезали со страницы меню.
    for (const cat of categoryMap.values()) {
        if (cat.parent_id === null || !categoryMap.get(cat.parent_id)) {
            rootCategories.push(cat);
        } else {
            categoryMap.get(cat.parent_id)!.children.push(cat);
        }
    }

    // Распределяем товары по категориям; позиции с битой category_id
    // кладём в служебную категорию «Без категории», а не выбрасываем.
    let uncategorized: Category | null = null;
    for (const item of items) {
        let category = categoryMap.get(item.category_id);
        if (!category) {
            if (!uncategorized) {
                uncategorized = {
                    id: -1,
                    name: 'Без категории',
                    parent_id: null,
                    sort_order: 9999,
                    items: [],
                    children: [],
                };
                categoryMap.set(-1, uncategorized);
                rootCategories.push(uncategorized);
            }
            category = uncategorized;
        }
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

    // Сортируем дочерние категории внутри каждой категории (на всякий случай)
    for (const cat of categoryMap.values()) {
        cat.children.sort((a, b) => a.sort_order - b.sort_order);
    }

    // Пустые категории без блюд скрываем из дерева — они не несут информации.
    const pruneEmpty = (list: Category[]): Category[] =>
        list
            .map((cat) => ({ ...cat, children: pruneEmpty(cat.children) }))
            .filter((cat) => cat.items.length > 0 || cat.children.length > 0);
    return pruneEmpty(rootCategories);
}