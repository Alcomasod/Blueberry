// Роли в порядке возрастания привилегий
export const ROLES = {
    KITCHEN: 'kitchen',
    WAITER: 'waiter',
    HOOKAH_MASTER: 'hookah_master', // <-- НОВОЕ
    HOOKAH_BAR: 'hookah_bar',       // <-- НОВОЕ
    ADMIN: 'admin',
    DIRECTOR: 'director',
    SYS_ADMIN: 'sys_admin'
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// Иерархия ролей
export const ROLE_HIERARCHY: Record<Role, number> = {
    kitchen: 1,
    waiter: 2,
    hookah_master: 3,
    hookah_bar: 4,
    admin: 5,
    director: 6,
    sys_admin: 7
};

// Все возможные пермишены
export const PERMISSIONS = {
    // Меню
    VIEW_MENU: 'view_menu',
    MANAGE_MENU: 'manage_menu',

    // Заказы
    VIEW_ALL_ORDERS: 'view_all_orders',
    VIEW_OWN_ORDERS: 'view_own_orders',
    MANAGE_ALL_OPEN_ORDERS: 'manage_all_open_orders',
    MANAGE_OWN_OPEN_ORDERS: 'manage_own_open_orders',
    MANAGE_CLOSED_ORDERS: 'manage_closed_orders',

    // Аналитика
    VIEW_ANALYTICS: 'view_analytics',
    VIEW_OWN_REVENUE: 'view_own_revenue',
    VIEW_ITEM_STATISTICS: 'view_item_statistics',

    // Смены
    MANAGE_OWN_SHIFTS: 'manage_own_shifts',
    MANAGE_ALL_SHIFTS: 'manage_all_shifts',
    MANAGE_HOURS: 'manage_hours',

    // Столы и зоны
    MANAGE_TABLES: 'manage_tables',
    MANAGE_ZONES: 'manage_zones',
    MANAGE_TABLE_STATUS: 'manage_table_status',

    // Сотрудники
    MANAGE_USERS: 'manage_users',

    // Прочее
    MANAGE_CONFIG: 'manage_config',
    VIEW_BREAKAGE: 'view_breakage',
    MARK_REGULARS: 'mark_regulars',

    // Кальяны (НОВОЕ)
    VIEW_HOOKAH_MENU: 'view_hookah_menu',
    MANAGE_HOOKAH_MENU: 'manage_hookah_menu',
    VIEW_HOOKAH_ORDERS: 'view_hookah_orders',
    MANAGE_HOOKAH_ORDERS: 'manage_hookah_orders'
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Матрица: какая роль имеет какие пермишены
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    kitchen: [
        PERMISSIONS.VIEW_MENU,
        PERMISSIONS.VIEW_ALL_ORDERS
    ],
    waiter: [
        PERMISSIONS.VIEW_MENU,
        PERMISSIONS.VIEW_OWN_ORDERS,
        PERMISSIONS.MANAGE_OWN_OPEN_ORDERS,
        PERMISSIONS.MANAGE_OWN_SHIFTS,
        PERMISSIONS.VIEW_OWN_REVENUE,
        PERMISSIONS.MANAGE_TABLE_STATUS,
        PERMISSIONS.MARK_REGULARS,
        PERMISSIONS.VIEW_HOOKAH_MENU, // Официант может видеть базу кальянов
        PERMISSIONS.VIEW_HOOKAH_MENU
    ],
    hookah_master: [
        PERMISSIONS.VIEW_HOOKAH_MENU,
        PERMISSIONS.MANAGE_HOOKAH_MENU, // Может редактировать базу вкусов
        PERMISSIONS.VIEW_HOOKAH_ORDERS,
        PERMISSIONS.MANAGE_HOOKAH_ORDERS, // Может менять статус своих заказов
        PERMISSIONS.MANAGE_OWN_SHIFTS
    ],
    hookah_bar: [
        PERMISSIONS.VIEW_HOOKAH_MENU,
        PERMISSIONS.VIEW_HOOKAH_ORDERS, // Видит все открытые заказы (аналог кухни)
        PERMISSIONS.MANAGE_HOOKAH_ORDERS // Может менять статус любого заказа
    ],
    admin: [
        PERMISSIONS.VIEW_MENU,
        PERMISSIONS.MANAGE_MENU,
        PERMISSIONS.VIEW_ALL_ORDERS,
        PERMISSIONS.VIEW_OWN_ORDERS,
        PERMISSIONS.MANAGE_ALL_OPEN_ORDERS,
        PERMISSIONS.MANAGE_OWN_OPEN_ORDERS,
        PERMISSIONS.MANAGE_CLOSED_ORDERS,
        PERMISSIONS.VIEW_ANALYTICS,
        PERMISSIONS.VIEW_OWN_REVENUE,
        PERMISSIONS.VIEW_ITEM_STATISTICS,
        PERMISSIONS.MANAGE_OWN_SHIFTS,
        PERMISSIONS.MANAGE_ALL_SHIFTS,
        PERMISSIONS.MANAGE_HOURS,
        PERMISSIONS.MANAGE_TABLES,
        PERMISSIONS.MANAGE_ZONES,
        PERMISSIONS.MANAGE_TABLE_STATUS,
        PERMISSIONS.MANAGE_USERS,
        PERMISSIONS.MANAGE_CONFIG,
        PERMISSIONS.VIEW_BREAKAGE,
        PERMISSIONS.MARK_REGULARS,
        PERMISSIONS.VIEW_HOOKAH_MENU,
        PERMISSIONS.MANAGE_HOOKAH_MENU,
        PERMISSIONS.VIEW_HOOKAH_ORDERS,
        PERMISSIONS.MANAGE_HOOKAH_ORDERS
    ],
    director: [
        PERMISSIONS.VIEW_MENU,
        PERMISSIONS.MANAGE_MENU,
        PERMISSIONS.VIEW_ALL_ORDERS,
        PERMISSIONS.VIEW_OWN_ORDERS,
        PERMISSIONS.MANAGE_ALL_OPEN_ORDERS,
        PERMISSIONS.MANAGE_OWN_OPEN_ORDERS,
        PERMISSIONS.MANAGE_CLOSED_ORDERS,
        PERMISSIONS.VIEW_ANALYTICS,
        PERMISSIONS.VIEW_OWN_REVENUE,
        PERMISSIONS.VIEW_ITEM_STATISTICS,
        PERMISSIONS.MANAGE_OWN_SHIFTS,
        PERMISSIONS.MANAGE_ALL_SHIFTS,
        PERMISSIONS.MANAGE_HOURS,
        PERMISSIONS.MANAGE_TABLES,
        PERMISSIONS.MANAGE_ZONES,
        PERMISSIONS.MANAGE_TABLE_STATUS,
        PERMISSIONS.MANAGE_USERS,
        PERMISSIONS.MANAGE_CONFIG,
        PERMISSIONS.VIEW_BREAKAGE,
        PERMISSIONS.MARK_REGULARS,
        PERMISSIONS.VIEW_HOOKAH_MENU,
        PERMISSIONS.MANAGE_HOOKAH_MENU,
        PERMISSIONS.VIEW_HOOKAH_ORDERS,
        PERMISSIONS.MANAGE_HOOKAH_ORDERS
    ],
    sys_admin: [
        PERMISSIONS.VIEW_MENU,
        PERMISSIONS.MANAGE_MENU,
        PERMISSIONS.VIEW_ALL_ORDERS,
        PERMISSIONS.VIEW_OWN_ORDERS,
        PERMISSIONS.MANAGE_ALL_OPEN_ORDERS,
        PERMISSIONS.MANAGE_OWN_OPEN_ORDERS,
        PERMISSIONS.MANAGE_CLOSED_ORDERS,
        PERMISSIONS.VIEW_ANALYTICS,
        PERMISSIONS.VIEW_OWN_REVENUE,
        PERMISSIONS.VIEW_ITEM_STATISTICS,
        PERMISSIONS.MANAGE_OWN_SHIFTS,
        PERMISSIONS.MANAGE_ALL_SHIFTS,
        PERMISSIONS.MANAGE_HOURS,
        PERMISSIONS.MANAGE_TABLES,
        PERMISSIONS.MANAGE_ZONES,
        PERMISSIONS.MANAGE_TABLE_STATUS,
        PERMISSIONS.MANAGE_USERS,
        PERMISSIONS.MANAGE_CONFIG,
        PERMISSIONS.VIEW_BREAKAGE,
        PERMISSIONS.MARK_REGULARS,
        PERMISSIONS.VIEW_HOOKAH_MENU,
        PERMISSIONS.MANAGE_HOOKAH_MENU,
        PERMISSIONS.VIEW_HOOKAH_ORDERS,
        PERMISSIONS.MANAGE_HOOKAH_ORDERS
    ]
};

export function hasPermission(role: Role, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isRoleHigherOrEqual(role: Role, targetRole: Role): boolean {
    return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[targetRole];
}