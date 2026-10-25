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
    // 1. Категории. Флаг активности в разных версиях схемы называется то
    // `is_active`, то `is_available` — перебираем варианты. COALESCE защищает
    // от NULL-флага у старых seed-строк. Скрытые категории показываем только
    // управляющему персоналу (includeInactive=true).
    // Если в старой схеме нет колонок is_active/sort_order — используем упрощённый
    // запрос, чтобы страница «Меню» никогда не оставалась пустой из-за схемы БД.
    const activeFlagCandidates = ['is_active', 'is_available'];
    let categories: any[] = [];
    let usedActiveFlag: string | null = null;
    for (const flag of activeFlagCandidates) {
        try {
            const categoriesRes = await pool.query(
                `SELECT id, name, parent_id, sort_order
                 FROM categories
                 WHERE ${includeInactive ? 'TRUE' : `COALESCE(${flag}, TRUE) = TRUE`}
                 ORDER BY sort_order ASC`,
            );
            categories = categoriesRes.rows;
            usedActiveFlag = flag;
            break;
        } catch (err) {
            console.warn(`menuService: расширенный запрос категорий (${flag}) не удался, пробую дальше:`, (err as Error).message);
        }
    }
    if (!usedActiveFlag) {
        // Колонок активности нет вовсе (старая схема) — берём все категории;
        // если нет и sort_order — убираем и его
        try {
            const fallbackRes = await pool.query(`SELECT id, name, parent_id, 0 AS sort_order FROM categories`);
            categories = fallbackRes.rows;
        } catch (err) {
            try {
                const fallbackRes = await pool.query(`SELECT id, name, parent_id FROM categories`);
                categories = fallbackRes.rows.map((r: any) => ({ ...r, sort_order: 0 }));
            } catch (errLast) {
                console.error('menuService: не удалось получить категории ни одним запросом:', (errLast as Error).message);
                throw errLast;
            }
        }
    }

    // 2. Позиции. По умолчанию берём ВСЕ позиции меню — страницу «Меню» должен
    // видеть персонал любых ролей, а статус доступности отдаётся флагом is_active
    // и затеняется на фронтенде. Для гостевого вида (includeInactive=false)
    // скрываем только явно недоступные позиции (COALESCE оставляет NULL как
    // доступные — старые seed-строки без флага не пропадают).
    // Fallback-цепочка подстраивается под разные версии схемы: колонка
    // доступности может называться `is_available` или `is_active`, а также
    // отсутствовать; колонки composition/description/sort_order опциональны.
    // LEFT JOIN LATERAL на последнюю действующую цену — блюдо без записи цены
    // не теряется из меню, а показывается с ценой 0.
    const availExprFor = (col: string) =>
        includeInactive ? 'TRUE' : `COALESCE(m.${col}, TRUE) = TRUE`;

    const buildItemSql = (opts: {
        avail: string | null;   // колонка доступности или null (без фильтра)
        extra: string;          // дополнительные select-колонки
        orderBy: string;        // ORDER BY
    }) => `SELECT m.id, m.name, m.category_id, ${opts.extra}
                   COALESCE((SELECT mp.price FROM menu_item_prices mp
                             WHERE mp.menu_item_id = m.id AND mp.valid_to IS NULL
                             ORDER BY mp.valid_from DESC LIMIT 1), 0) AS price
            FROM menu_items m
            ${opts.avail ? `WHERE ${availExprFor(opts.avail)}` : ''}
            ${opts.orderBy}`;

    const withAvail = (col: string) => `m.${col} AS is_active, `;

    const itemQueries: { sql: string; normalize: (r: any) => any }[] = [];
    for (const availCol of ['is_available', 'is_active', null] as const) {
        const availSelect = availCol ? withAvail(availCol) : '';
        const availWhere = availCol ?? null;
        // Варианты набора колонок: полные → без composition → минимальные
        itemQueries.push(
            {
                sql: buildItemSql({
                    avail: availWhere,
                    extra: `m.description, m.composition, ${availSelect}m.is_for_guests, m.sort_order,`,
                    orderBy: 'ORDER BY m.sort_order ASC',
                }),
                normalize: (r: any) => ({ is_active: true, ...r }),
            },
            {
                sql: buildItemSql({
                    avail: availWhere,
                    extra: `m.description, ${availSelect}m.is_for_guests, m.sort_order,`,
                    orderBy: 'ORDER BY m.sort_order ASC',
                }),
                normalize: (r: any) => ({ composition: null, is_active: true, ...r }),
            },
            {
                sql: buildItemSql({
                    avail: availWhere,
                    extra: `${availSelect}`,
                    orderBy: '',
                }),
                normalize: (r: any) => ({
                    description: null,
                    composition: null,
                    is_for_guests: true,
                    is_active: true,
                    sort_order: 0,
                    ...r,
                }),
            },
        );
    }

    let items: any[] = [];
    for (const q of itemQueries) {
        try {
            const res = await pool.query(q.sql);
            items = res.rows.map(q.normalize);
            break; // даже пустой результат допустим — schema найдена
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