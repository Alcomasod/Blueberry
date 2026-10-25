import pool from '../config/db.js';

// ==========================================
// KDS (Kitchen Display System) — экран «Кухня / Бар»
// Позиции открытых заказов с рабочей статусной моделью:
//   new -> preparing -> ready -> served
// Статус хранится в order_items.item_status; время перехода в 'preparing'
// фиксируется в preparing_at для корректных таймеров.
// ==========================================

export const KDS_STATUSES = ['new', 'preparing', 'ready', 'served'] as const;
export type KdsStatus = typeof KDS_STATUSES[number];

// Авто-миграция: колонки статусов KDS (вызывается из database/init.ts).
// Каждая миграция выполняется изолированно: если у какой-то таблицы нет
// ожидаемой колонки или прав недостаточно, остальные миграции всё равно
// применятся, а ошибка попадёт в логи вместо тихого пропуска.
async function safeAlter(sql: string): Promise<void> {
    try {
        await pool.query(sql);
    } catch (e) {
        console.error('⚠️ Blueberry KDS: не удалось выполнить миграцию:', sql, '\n   Причина:', (e as Error).message);
    }
}

export async function ensureKdsSchema(): Promise<void> {
    await safeAlter(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_status VARCHAR(20) NOT NULL DEFAULT 'new'`);
    await safeAlter(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMP`);
    // Страховка от NULL-значений у строк, созданных до появления колонки
    await safeAlter(`UPDATE order_items SET item_status = 'new' WHERE item_status IS NULL`);
    // Подсказка для повара/бармена: зона подачи позиции (Кухня / Бар / Бой посуды / Допы)
    await safeAlter(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS station VARCHAR(30)`);
}

// Зона подачи позиции по дереву категорий меню.
// topName — имя категории верхнего уровня, name — имя самой позиции.
export function resolveStation(topName: string | null | undefined, name: string): string {
    const t = (topName || '').toLowerCase();
    if (t.includes('кухн')) return 'kitchen';
    if (t.includes('бар')) return 'bar';
    if (t.includes('бой')) return 'breakage';
    if (t.includes('доп')) return 'extras';
    // Фолбэк по названию позиции (позиции без категории)
    const n = (name || '').toLowerCase();
    if (n.includes('чай') || n.includes('кофе') || n.includes('напитк')) return 'bar';
    return 'kitchen';
}

interface KdsRow {
    id: number;
    order_id: number;
    table_number: string | null;
    zone_name: string | null;
    order_created_at: Date;
    item_name: string | null;
    quantity: number;
    comment: string | null;
    created_at: Date;
    item_status: string;
    preparing_at: Date | null;
    category_path: string[];
    top_category: string | null;
    station_override: string | null;
}

export interface KdsCardItem {
    id: number;
    order_id: number;
    table_number: string | null;
    zone_name: string | null;
    order_created_at: string;
    name: string;
    quantity: number;
    comment: string | null;
    created_at: string;
    status: KdsStatus;
    preparing_at: string | null;
    station: string;
}

// Открытые позиции всех активных заказов (кроме снятых).
// Готовые к выдаче ('ready') возвращаются отдельным списком — они остаются
// на экране до тех пор, пока официант не заберёт их («Выдано»).
export async function getKdsBoard(): Promise<{ active: KdsCardItem[]; ready: KdsCardItem[] }> {
    const result = await pool.query<KdsRow>(`
        WITH RECURSIVE cat_path AS (
            SELECT id AS leaf_id, id, name, parent_id, 0 AS depth
            FROM categories
            UNION ALL
            SELECT cp.leaf_id, c.id, c.name, c.parent_id, cp.depth + 1
            FROM cat_path cp
            JOIN categories c ON c.id = cp.parent_id
        )
        SELECT
            oi.id,
            oi.order_id,
            t.number AS table_number,
            z.name AS zone_name,
            o.created_at AS order_created_at,
            COALESCE(mi.name, cs.name, 'Позиция без названия') AS item_name,
            oi.quantity,
            oi.comment,
            oi.created_at,
            COALESCE(oi.item_status, 'new') AS item_status,
            oi.preparing_at,
            -- путь категорий позиции: лист — категория получше (Чай), корень — верхнего уровня (Бар)
            ARRAY_AGG(cp.name ORDER BY cp.depth DESC) FILTER (WHERE cp.name IS NOT NULL) AS category_path,
            MAX(cp.name) FILTER (WHERE cp.parent_id IS NULL) AS top_category,
            mi.station AS station_override
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.status = 'open'
        LEFT JOIN tables t ON t.id = o.table_id
        LEFT JOIN zones z ON z.id = t.zone_id
        LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        LEFT JOIN combo_sets cs ON cs.id = oi.combo_id
        LEFT JOIN cat_path cp ON cp.leaf_id = mi.category_id
        WHERE COALESCE(oi.item_status, 'new') <> 'served'
        GROUP BY oi.id, oi.order_id, t.number, z.name, o.created_at,
                 mi.name, cs.name, oi.quantity, oi.comment, oi.created_at,
                 oi.item_status, oi.preparing_at, mi.station
        ORDER BY oi.created_at ASC
    `);

    const mapRow = (r: KdsRow): KdsCardItem => {
        const pathArr: string[] = Array.isArray(r.category_path) ? r.category_path : [];
        const leaf = pathArr.length > 0 ? pathArr[pathArr.length - 1] : null;
        return {
            id: r.id,
            order_id: r.order_id,
            table_number: r.table_number,
            zone_name: r.zone_name,
            order_created_at: new Date(r.order_created_at).toISOString(),
            name: r.item_name || 'Без названия',
            quantity: r.quantity,
            comment: r.comment,
            created_at: new Date(r.created_at).toISOString(),
            status: (KDS_STATUSES.includes(r.item_status as KdsStatus) ? r.item_status : 'new') as KdsStatus,
            preparing_at: r.preparing_at ? new Date(r.preparing_at).toISOString() : null,
            station: r.station_override || resolveStation(leaf ?? r.top_category, r.item_name || ''),
        };
    };

    const all = result.rows.map(mapRow);
    return {
        active: all.filter(i => i.status !== 'ready'),
        ready: all.filter(i => i.status === 'ready'),
    };
}

async function logKdsHistory(orderId: number, userId: number, details: string): Promise<void> {
    try {
        await pool.query(
            `INSERT INTO order_history (order_id, user_id, action, details) VALUES ($1, $2, 'kds_status', $3)`,
            [orderId, userId, details]
        );
    } catch {
        // журнал не должен ломать основной поток
    }
}

// Смена статуса позиции. Разрешены переходы:
//   new -> preparing, preparing -> ready, ready -> served, а также откат
//   preparing -> new (ошибка нажатия) и ready -> preparing (вернуть в работу).
export async function updateKdsItemStatus(
    itemId: number,
    nextStatus: KdsStatus,
    userId: number
): Promise<{ item: unknown; order_id: number } | null> {
    const currentRes = await pool.query(
        `SELECT id, order_id, COALESCE(item_status, 'new') AS status FROM order_items WHERE id = $1`,
        [itemId]
    );
    if (currentRes.rows.length === 0) return null;
    const current = currentRes.rows[0] as { id: number; order_id: number; status: string };

    // Разрешённые переходы. В отличие от строгой машины состояний, здесь
    // допускается «перепрыгивание» вперёд (new -> ready и т.п.): на практике
    // кухню часто отмечают готовой без промежуточного «Готовится», а
    // администратор может любой статус поставить вручную. Откат назад —
    // только соседний шаг (served -> ready -> preparing -> new).
    const ORDER: KdsStatus[] = ['new', 'preparing', 'ready', 'served'];
    const fromIdx = ORDER.indexOf(current.status as KdsStatus);
    const toIdx = ORDER.indexOf(nextStatus);
    if (toIdx < 0) {
        throw new Error(`Неизвестный статус: ${nextStatus}`);
    }
    if (fromIdx < 0 || toIdx > fromIdx + 1) {
        throw new Error(`Недопустимый переход статуса: ${current.status} → ${nextStatus}`);
    }

    const updatedRes = await pool.query(
        `UPDATE order_items
         SET item_status = $1,
             preparing_at = CASE WHEN $1 = 'preparing' AND preparing_at IS NULL THEN NOW() ELSE preparing_at END
         WHERE id = $2
         RETURNING *`,
        [nextStatus, itemId]
    );

    const labels: Record<KdsStatus, string> = {
        new: 'В ожидании',
        preparing: 'Готовится',
        ready: 'Готово к выдаче',
        served: 'Выдано',
    };
    await logKdsHistory(current.order_id, userId, `Статус позиции #${itemId}: ${labels[nextStatus]}`);

    return { item: updatedRes.rows[0], order_id: current.order_id };
}
