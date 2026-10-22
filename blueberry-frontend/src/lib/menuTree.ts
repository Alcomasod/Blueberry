// src/lib/menuTree.ts
// Утилиты для работы с деревом категорий, который возвращает GET /api/menu.

export interface MenuLeaf {
    id: number;
    name: string;
    price?: string | number;
    current_price?: string | number;
    is_available?: boolean;
    composition?: string | null;
}

export interface MenuCategoryNode {
    id?: number;
    name?: string;
    items?: MenuLeaf[];
    children?: MenuCategoryNode[];
}

export interface FlatMenuItem {
    id: number;
    name: string;
    price: number;
    composition?: string | null;
}

export interface CatalogCategory {
    key: string;
    name: string;
    items: FlatMenuItem[];
}

const parsePrice = (raw: string | number | undefined): number =>
    parseFloat(String(raw ?? '0'));

/**
 * Рекурсивно обходит дерево категорий и собирает список категорий-«листов»
 * (категорий с позициями). Пустые категории пропускаются.
 */
export function collectCatalog(
    nodes: MenuCategoryNode[],
    result: CatalogCategory[] = []
): CatalogCategory[] {
    for (const cat of nodes || []) {
        const items: FlatMenuItem[] = [];
        const seen = new Set<number>();

        for (const item of cat.items || []) {
            const price = parsePrice(item.price ?? item.current_price);
            if (!seen.has(item.id) && price > 0) {
                seen.add(item.id);
                items.push({ id: item.id, name: item.name, price, composition: item.composition ?? null });
            }
        }

        if (items.length > 0) {
            result.push({
                key: `cat-${cat.id ?? result.length}`,
                name: cat.name || 'Без категории',
                items,
            });
        }

        if (Array.isArray(cat.children) && cat.children.length > 0) {
            collectCatalog(cat.children, result);
        }
    }
    return result;
}

/**
 * Разворачивает ответ /api/menu (дерево категорий или плоский список)
 * в каталог: [{ name: 'Горячее', items: [...] }, ...]
 */
export function buildCatalog(menuData: unknown): CatalogCategory[] {
    if (!Array.isArray(menuData)) return [];

    type MenuNode = MenuCategoryNode & MenuLeaf;
    const isTree = menuData.some(
        (x: MenuNode) => Array.isArray(x.items) || Array.isArray(x.children)
    );

    if (isTree) {
        return collectCatalog(menuData as MenuCategoryNode[]);
    }

    // Плоский список без категорий — одна группа «Меню»
    const items: FlatMenuItem[] = [];
    const seen = new Set<number>();
    for (const raw of menuData as MenuLeaf[]) {
        const price = parsePrice(raw.price ?? raw.current_price);
        if (!seen.has(raw.id) && price > 0) {
            seen.add(raw.id);
            items.push({ id: raw.id, name: raw.name, price, composition: raw.composition ?? null });
        }
    }
    return items.length > 0 ? [{ key: 'all', name: 'Меню', items }] : [];
}
