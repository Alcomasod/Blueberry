// src/theme.ts
/**
 * Единая дизайн-система проекта Blueberry.
 *
 * Здесь собраны ВСЕ визуальные токены приложения: цвета, шрифты, отступы,
 * скругления, тени, анимации (затухания), логотип, шапка и подвал.
 *
 * Чтобы изменить стиль всего проекта — правьте только этот файл
 * (палитра Tailwind дублируется в tailwind.config.js — держите их в синхроне).
 */

// ─────────────────────────────────────────────
// 1. ПАЛИТРА ЦВЕТОВ (значения для inline-стилей;
//    классы bg-blueberry-500 и т.п. описаны в tailwind.config)
// ─────────────────────────────────────────────
export const colors = {
    // Фирменный цвет «Черника»
    blueberry: {
        50: '#f0f4ff',
        100: '#e0e7ff',
        300: '#a5b4fc',
        500: '#6366f1', // Основной фиолетово-синий цвет
        600: '#4f46e5',
        700: '#4338ca',
        800: '#3730a3',
        900: '#312e81',
    },
    // Статусные цвета
    success: { light: '#dcfce7', main: '#16a34a', dark: '#15803d' }, // green-200/600/700
    danger:  { light: '#fee2e2', main: '#dc2626', dark: '#b91c1c' }, // red-200/600/700
    warning: { light: '#fef9c3', main: '#ca8a04' },                   // yellow-200/600
    // Нейтральные (серые)
    gray: {
        50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db',
        400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151',
        800: '#1f2937', 900: '#111827',
    },
    white: '#ffffff',
    overlay: 'rgba(0, 0, 0, 0.5)', // затемнение фона под модалками
} as const;

// ─────────────────────────────────────────────
// 2. ШРИФТЫ
// ─────────────────────────────────────────────
export const typography = {
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    sizes: {
        xs: '0.75rem',    // 12px — подписи, роли
        sm: '0.875rem',   // 14px — основной текст в списках/кнопках
        base: '1rem',     // 16px
        lg: '1.125rem',   // 18px
        xl: '1.25rem',    // 20px — заголовки модалок
        '2xl': '1.5rem',  // 24px — логотип
        '3xl': '1.875rem',// 30px — заголовки страниц
    },
    weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
} as const;

// ─────────────────────────────────────────────
// 3. СКРУГЛЕНИЯ (border-radius)
// ─────────────────────────────────────────────
export const radii = {
    none: 'rounded-none',
    sm: 'rounded-md',       // кнопки-фильтры, поля
    md: 'rounded-lg',       // карточки-строки, мелкие блоки
    lg: 'rounded-xl',       // модалки, крупные карточки
    full: 'rounded-full',   // бейджи, аватарки
} as const;

// ─────────────────────────────────────────────
// 4. ТЕНИ
// ─────────────────────────────────────────────
export const shadows = {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',      // сайдбар
    modal: 'shadow-2xl',  // модалки
} as const;

// ─────────────────────────────────────────────
// 5. АНИМАЦИИ И ЗАТУХАНИЯ
// ─────────────────────────────────────────────
export const animations = {
    // Плавность переходов цветов/состояний по умолчанию
    transition: 'transition-colors duration-200',
    transitionAll: 'transition-all duration-200',
    // Появление/исчезновение (fade-in + zoom) для модалок и всплывающих сообщений
    fadeInZoom: 'animate-in fade-in zoom-in duration-200',
    fadeIn: 'animate-in fade-in duration-300',
    fadeOut: 'animate-out fade-out duration-200',
    // Toast-уведомления
    toastDurationMs: 6000,
} as const;

// ─────────────────────────────────────────────
// 6. ЛОГОТИП / БРЕНДИНГ
// ─────────────────────────────────────────────
export const branding = {
    name: 'Blueberry',
    emoji: '🫐',
    /** Строка для шапки/сайдбара: "🫐 Blueberry" */
    logoText: '🫐 Blueberry',
    /** Ширина сайдбара на десктопе (lg+); на мобильных скрывается за бургер-меню */
    sidebarWidth: 'w-full lg:w-64',
} as const;

// ─────────────────────────────────────────────
// 7. СЕТКА / ОТСТУПЫ (адаптив: меньше отступов на мобильных)
// ─────────────────────────────────────────────
export const spacing = {
    pagePadding: 'p-3 md:p-6 lg:p-8',  // основной контент страницы
    cardPadding: 'p-4 md:p-6',         // модалки, карточки
    blockGap: 'space-y-2',             // списки
} as const;

// ─────────────────────────────────────────────
// 7.1 АДАПТИВНАЯ ОБХОЛОЧКА (мобильные устройства)
// ─────────────────────────────────────────────
export const responsive = {
    /** Заголовки страниц: крупный текст только на планшете и выше */
    pageTitle: 'text-xl md:text-3xl font-bold text-gray-800',
    /** Строка заголовка + кнопок: вертикально на мобильных, горизонтально на десктопе */
    toolbar: 'flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3',
    /** Панель фильтров/легенды */
    filterBar: 'bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-3 md:gap-4 items-center',
    /** Сайдбар вне экрана на мобильных (выезжает слева при открытии бургер-меню) */
    sidebarHidden: '-translate-x-full lg:translate-x-0',
    /** Затемнение фона под открытым мобильным меню */
    menuOverlay: 'fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden',
    /** Кнопка-бургер в шапке (видна только на мобильных) */
    burgerButton: 'flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 transition-colors lg:hidden',
} as const;

// ─────────────────────────────────────────────
// 8. КНОПКИ (варианты)
// ─────────────────────────────────────────────
export const buttons = {
    primary: `bg-blueberry-600 hover:bg-blueberry-700 text-white font-medium rounded-md px-4 py-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed`,
    secondary: `bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md px-4 py-2 transition-colors duration-200`,
    danger: `bg-red-600 hover:bg-red-700 text-white font-medium rounded-md px-4 py-2 transition-colors duration-200`,
    ghost: `text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md px-2 py-1 transition-colors duration-200`,
    icon: `text-gray-400 hover:text-gray-600 transition-colors duration-200`,
    input: `border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blueberry-500 focus:border-blueberry-500`,
} as const;

// ─────────────────────────────────────────────
// 9. КАРТОЧКИ
// ─────────────────────────────────────────────
export const cards = {
    base: `bg-white ${radii.lg} shadow-md p-6`,
    clickable: `bg-white ${radii.md} shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer`,
    sectionTitle: 'text-lg font-semibold text-gray-800',
    muted: 'text-sm text-gray-500',
} as const;

// ─────────────────────────────────────────────
// 10. БЕЙДЖИ СТАТУСОВ (заказы, столы, смены)
// ─────────────────────────────────────────────
export const badges = {
    base: `inline-flex items-center px-2.5 py-0.5 ${radii.full} text-xs font-medium`,
    open: `bg-blueberry-100 text-blueberry-700`,
    paid: `bg-green-100 text-green-700`,
    closed: `bg-gray-200 text-gray-600`,
    busy: `bg-red-100 text-red-700`,
    free: `bg-green-100 text-green-700`,
    reserved: `bg-yellow-100 text-yellow-800`,
    warning: `bg-red-50 text-red-700 border border-red-200`,
} as const;

// ─────────────────────────────────────────────
// 11. ШАПКА САЙТА (header в Layout)
// ─────────────────────────────────────────────
export const header = {
    container: 'flex items-center justify-between gap-3 px-3 md:px-8 py-3 bg-white border-b border-gray-200 shrink-0',
    height: 'h-16',
} as const;

// ─────────────────────────────────────────────
// 12. ПОДВАЛ САЙТА (нижняя часть сайдбара / футер страниц)
// ─────────────────────────────────────────────
export const footer = {
    container: 'border-t border-blueberry-600 p-4',
    logoutButton: 'flex w-full items-center gap-3 rounded-lg px-4 py-2 text-blueberry-100 transition-colors hover:bg-red-600 hover:text-white',
    copyright: 'text-xs text-gray-400 text-center py-2',
} as const;

// ─────────────────────────────────────────────
// 13. МОДАЛКИ
// ─────────────────────────────────────────────
export const modal = {
    overlay: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm',
    panel: `bg-white ${radii.lg} ${spacing.cardPadding} w-full max-h-[90vh] overflow-y-auto ${shadows.modal} ${animations.fadeInZoom}`,
    title: 'text-xl font-bold text-gray-800',
    closeButton: buttons.icon,
    /** Контейнер модалки: на мобильных занимает почти весь экран */
    panelResponsive: `bg-white ${radii.lg} ${spacing.cardPadding} w-full max-w-full sm:max-h-[90vh] overflow-y-auto ${shadows.modal} ${animations.fadeInZoom}`,
    sizes: {
        sm: 'sm:max-w-sm',
        md: 'sm:max-w-md',
        lg: 'sm:max-w-2xl',
        xl: 'sm:max-w-5xl',
        // Широкий контейнер для модалки заказа с боковым каталогом меню (70% экрана на десктопе)
        wide: 'lg:w-[70vw] lg:max-w-[1100px] sm:max-h-[94vh]',
        full: 'lg:w-[min(1600px,96vw)] sm:max-h-[94vh]',
    },
} as const;

// ─────────────────────────────────────────────
// 14. ТОСТЫ / ВСПЛЫВАЮЩИЕ СООБЩЕНИЯ
// ─────────────────────────────────────────────
export const toasts = {
    base: `fixed top-4 right-4 z-[100] ${radii.md} px-4 py-3 text-sm font-medium shadow-lg ${animations.fadeInZoom}`,
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-blueberry-600 text-white',
} as const;

// ─────────────────────────────────────────────
// 15. LAYOUT (общая оболочка приложения)
// ─────────────────────────────────────────────
export const layout = {
    root: 'flex min-h-screen bg-gray-50',
    main: `flex-1 overflow-y-auto ${spacing.pagePadding}`,
} as const;

// ─────────────────────────────────────────────
// 16. РОЛИ СОТРУДНИКОВ (используются для навигации и прав)
// ─────────────────────────────────────────────
export const roles = {
    sys_admin: 'sys_admin',
    director: 'director',
    admin: 'admin',
    waiter: 'waiter',
    kitchen: 'kitchen',
    hookah_master: 'hookah_master',
    hookah_bar: 'hookah_bar',
} as const;

/** Роли, которым показывается кнопка открытия/закрытия смены */
export const SHIFT_ROLES: string[] = [roles.waiter, roles.hookah_master, roles.hookah_bar, roles.admin, roles.director, roles.sys_admin];

/** Единая точка выхода дизайн-токенов: import { theme } from '../theme' */
export const theme = {
    colors, typography, radii, shadows, animations, branding, spacing, responsive,
    buttons, cards, badges, header, footer, modal, toasts, layout, roles,
} as const;

export default theme;
