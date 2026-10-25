import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2, Search } from 'lucide-react';

interface MenuItem {
    id: number;
    name: string;
    price: string | number;
    is_for_guests?: boolean;
    composition?: string | null;
    description?: string | null;
    category_id?: number;
    /** Бэкенд отдаёт поле как `is_active` (GET /menu) и как `is_available` (ответы управления) — принимаем оба */
    is_active?: boolean;
    is_available?: boolean;
}

interface CategoryNode {
    id: number;
    name: string;
    parent_id: number | null;
    sort_order: number;
    items: MenuItem[];
    children: CategoryNode[];
}

interface FlatRow {
    item: MenuItem;
    categoryName: string;
    categoryId: number;
}

/** Доступность позиции: бэкенд отдаёт то is_active, то is_available в зависимости от эндпоинта */
const itemAvailable = (item: MenuItem): boolean => (item.is_active ?? item.is_available ?? true) !== false;

const ADMIN_ROLES = ['sys_admin', 'director', 'admin'];

const EMPTY_ITEM_FORM = { name: '', price: '', category_id: '', description: '', composition: '' };
const EMPTY_CATEGORY_FORM = { name: '', sort_order: '0' };

// Рекурсивно собираем плоский список позиций и карту категорий
function flattenTree(nodes: CategoryNode[]): { rows: FlatRow[]; categories: Map<number, CategoryNode> } {
    const rows: FlatRow[] = [];
    const categories = new Map<number, CategoryNode>();

    const walk = (list: CategoryNode[], pathName?: string) => {
        for (const cat of list || []) {
            categories.set(cat.id, cat);
            const displayName = pathName ? `${pathName} · ${cat.name}` : cat.name;
            for (const item of cat.items || []) {
                rows.push({ item, categoryName: displayName, categoryId: cat.id });
            }
            if (cat.children?.length) walk(cat.children, displayName);
        }
    };
    walk(nodes || []);
    return { rows, categories };
}

export default function MenuPage() {
    const user = useAuthStore((state) => state.user);
    const canManage = !!user && ADMIN_ROLES.includes(user.role);

    const [tree, setTree] = useState<CategoryNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [showInactive, setShowInactive] = useState(false);

    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
    const [saving, setSaving] = useState(false);

    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null);
    const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/menu', {
                params: showInactive && canManage ? { includeInactive: 'true' } : {},
            });
            setTree((response.data.data as CategoryNode[]) ?? []);
        } catch (err) {
            const e = err as { response?: { status?: number; data?: { error?: string } }; message?: string };
            const detail =
                e.response?.data?.error ||
                (e.response?.status === 401 ? 'Сессия истекла — войдите заново'
                    : e.response?.status === 403 ? 'Недостаточно прав для просмотра меню'
                        : e.message || 'неизвестная ошибка');
            setError(`Не удалось загрузить меню: ${detail}`);
            console.error(err);
        }
        finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showInactive]);

    const { rows, categories } = flattenTree(tree);
    // Категории сортируем по sort_order — порядок «Кухня → Бар → …» из БД
    const categoryList = Array.from(categories.values()).sort((a, b) => a.sort_order - b.sort_order);

    const filteredRows = rows.filter(({ item }) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            item.name.toLowerCase().includes(q) ||
            (item.composition ?? '').toLowerCase().includes(q) ||
            (item.description ?? '').toLowerCase().includes(q)
        );
    });

    let grouped = categoryList
        .map((cat) => ({ cat, list: filteredRows.filter((r) => r.categoryId === cat.id) }))
        .filter((g) => g.list.length > 0);

    // Не-администраторы видят только доступные позиции (скрытые не показываются)
    if (!canManage) {
        grouped = grouped
            .map((g) => ({ ...g, list: g.list.filter((r) => itemAvailable(r.item)) }))
            .filter((g) => g.list.length > 0);
    }

    // ===== Позиции =====
    const openCreateItem = () => {
        setEditingItem(null);
        setItemForm({ ...EMPTY_ITEM_FORM, category_id: categoryList[0]?.id ? String(categoryList[0].id) : '' });
        setIsItemModalOpen(true);
    };

    const openEditItem = (item: MenuItem) => {
        setEditingItem(item);
        setItemForm({
            name: item.name,
            price: String(item.price),
            category_id: String(item.category_id ?? ''),
            description: item.description ?? '',
            composition: item.composition ?? '',
        });
        setIsItemModalOpen(true);
    };

    // Позиции с битой/сервисной category_id (например, из «Без категории»)
    // при сохранении нельзя отправить — бэкенд отклонит такой запрос.
    const currentCategoryId = editingItem ? String(editingItem.category_id ?? '') : '';
    const categoryOptions = categoryList.filter((c) => c.id > 0);
    const categorySelectValue =
        itemForm.category_id && categoryOptions.some((c) => c.id === Number(itemForm.category_id))
            ? itemForm.category_id
            : currentCategoryId && !categoryOptions.some((c) => c.id === Number(currentCategoryId))
                ? currentCategoryId
                : '';

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemForm.name.trim() || !itemForm.price || !categorySelectValue) return;
        setSaving(true);
        try {
            const payload = {
                category_id: Number(categorySelectValue),
                name: itemForm.name.trim(),
                price: parseFloat(itemForm.price),
                description: itemForm.description.trim() || undefined,
                composition: itemForm.composition.trim() || undefined,
            };
            if (editingItem) {
                await api.patch(`/menu-management/items/${editingItem.id}`, {
                    category_id: payload.category_id,
                    name: payload.name,
                    description: payload.description,
                    composition: payload.composition,
                });
                // Цена меняется отдельным эндпоинтом (сохраняется история цен)
                if (Number(editingItem.price) !== payload.price) {
                    await api.patch(`/menu-management/items/${editingItem.id}/price`, { price: payload.price });
                }
            } else {
                await api.post('/menu-management/items', payload);
            }
            setIsItemModalOpen(false);
            await fetchData();
        } catch (err) {
            alert('Ошибка сохранения блюда');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const toggleAvailability = async (item: MenuItem) => {
        const makeAvailable = !itemAvailable(item);
        if (!confirm(`"${item.name}": ${makeAvailable ? 'вернуть в меню?' : 'скрыть из меню?'}`)) return;
        try {
            await api.patch(`/menu-management/items/${item.id}`, { is_available: makeAvailable });
            await fetchData();
        } catch (err) {
            alert('Ошибка изменения статуса блюда');
            console.error(err);
        }
    };

    const deleteItem = async (item: MenuItem) => {
        if (!confirm(`Удалить "${item.name}"? Если блюдо есть в заказах — оно будет автоматически скрыто (soft delete).`)) return;
        try {
            await api.delete(`/menu-management/items/${item.id}`);
            await fetchData();
        } catch (err) {
            alert('Не удалось удалить блюдо');
            console.error(err);
        }
    };

    // ===== Категории =====
    const openCreateCategory = () => {
        setEditingCategory(null);
        setCategoryForm({ name: '', sort_order: String(categoryList.length + 1) });
        setIsCategoryModalOpen(true);
    };

    const openEditCategory = (cat: CategoryNode) => {
        setEditingCategory(cat);
        setCategoryForm({ name: cat.name, sort_order: String(cat.sort_order) });
        setIsCategoryModalOpen(true);
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!categoryForm.name.trim()) return;
        setSaving(true);
        try {
            const payload = { name: categoryForm.name.trim(), sort_order: parseInt(categoryForm.sort_order || '0', 10) };
            if (editingCategory) {
                await api.patch(`/menu-management/categories/${editingCategory.id}`, payload);
            } else {
                await api.post('/menu-management/categories', payload);
            }
            setIsCategoryModalOpen(false);
            await fetchData();
        } catch (err) {
            alert('Ошибка сохранения категории');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const deleteCategory = async (cat: CategoryNode) => {
        if (!confirm(`Удалить категорию "${cat.name}"? Удаление возможно, только если в ней нет блюд.`)) return;
        try {
            await api.delete(`/menu-management/categories/${cat.id}`);
            await fetchData();
        } catch (err) {
            alert('Не удалось удалить категорию (возможно, в ней есть блюда)');
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin text-blueberry-600" size={32} />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-800">Меню</h1>
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Поиск по названию или составу…"
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blueberry-500"
                    />
                </div>
                {canManage && (
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
                        Показывать скрытые
                    </label>
                )}
                {canManage && (
                    <div className="flex gap-2 ml-auto">
                        <button onClick={openCreateCategory} className="px-3 py-2 text-sm bg-white border border-blueberry-300 text-blueberry-700 rounded-lg hover:bg-blueberry-50">
                            + Категория
                        </button>
                        <button onClick={openCreateItem} className="px-3 py-2 text-sm bg-blueberry-600 text-white rounded-lg hover:bg-blueberry-700 flex items-center gap-1">
                            <Plus size={16} /> Позиция
                        </button>
                    </div>
                )}
            </div>

            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            {!canManage && (
                <p className="text-xs text-gray-500">Режим просмотра. Управление меню доступно только администраторам.</p>
            )}

            {grouped.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400 text-sm">
                    Меню пустое. {canManage ? 'Добавьте категории и позиции.' : 'Попросите администратора заполнить меню.'}
                </div>
            )}

            {grouped.map(({ cat, list }) => (
                <section key={cat.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <header className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-700">{cat.name}</h2>
                        {canManage && (
                            <div className="flex gap-1">
                                <button onClick={() => openEditCategory(cat)} className="p-1.5 text-gray-500 hover:text-blueberry-600" title="Редактировать категорию">
                                    <Pencil size={15} />
                                </button>
                                <button onClick={() => deleteCategory(cat)} className="p-1.5 text-gray-500 hover:text-red-600" title="Удалить категорию">
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        )}
                    </header>
                    <ul className="divide-y divide-gray-50">
                        {list.map(({ item }) => (
                            <li key={item.id} className={`px-4 py-3 flex items-start gap-3 ${!itemAvailable(item) ? 'opacity-50' : ''}`}>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-800 truncate">
                                        {item.name}
                                        {!itemAvailable(item) && <span className="ml-2 text-xs text-gray-400">(скрыто)</span>}
                                    </p>
                                    {item.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>}
                                    {item.composition && (
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            <span className="font-medium text-gray-500">Состав:</span> {item.composition}
                                        </p>
                                    )}
                                </div>
                                <span className="font-semibold text-gray-800 whitespace-nowrap">{Number(item.price).toFixed(0)} ₽</span>
                                {canManage && (
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => openEditItem(item)} className="p-1.5 text-gray-500 hover:text-blueberry-600" title="Редактировать">
                                            <Pencil size={15} />
                                        </button>
                                        <button
                                            onClick={() => toggleAvailability(item)}
                                            className="p-1.5 text-gray-500 hover:text-amber-600"
                                            title={itemAvailable(item) ? 'Скрыть из меню' : 'Вернуть в меню'}
                                        >
                                            {itemAvailable(item) ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                        </button>
                                        <button onClick={() => deleteItem(item)} className="p-1.5 text-gray-500 hover:text-red-600" title="Удалить">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}

            {/* Модалка позиции */}
            {canManage && isItemModalOpen && (
                <Modal isOpen={isItemModalOpen} onClose={() => setIsItemModalOpen(false)} title={editingItem ? 'Редактировать позицию' : 'Новая позиция'}>
                    <form onSubmit={handleSaveItem} className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                            <input required value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Цена *</label>
                                <input required type="number" step="0.01" min="0" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Категория *</label>
                                <select required value={categorySelectValue} onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                                    <option value="">— Выберите —</option>
                                    {categoryOptions.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                    {/* Позиция «сирота» с битой category_id — показываем текущее значение, чтобы select не сбрасывался */}
                                    {currentCategoryId && !categoryOptions.some((c) => c.id === Number(currentCategoryId)) && (
                                        <option value={currentCategoryId}>Без категории</option>
                                    )}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                            <textarea rows={2} value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Состав (подсказка для персонала)</label>
                            <textarea rows={2} value={itemForm.composition} onChange={(e) => setItemForm({ ...itemForm, composition: e.target.value })} placeholder="Например: говядина, лук, соус ткемали…" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setIsItemModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Отмена</button>
                            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blueberry-600 text-white rounded-lg hover:bg-blueberry-700 disabled:opacity-50 flex items-center gap-2">
                                {saving && <Loader2 className="animate-spin" size={15} />} Сохранить
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Модалка категории */}
            {canManage && isCategoryModalOpen && (
                <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title={editingCategory ? 'Редактировать категорию' : 'Новая категория'}>
                    <form onSubmit={handleSaveCategory} className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                            <input required value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Порядок сортировки</label>
                            <input type="number" value={categoryForm.sort_order} onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Отмена</button>
                            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blueberry-600 text-white rounded-lg hover:bg-blueberry-700 disabled:opacity-50 flex items-center gap-2">
                                {saving && <Loader2 className="animate-spin" size={15} />} Сохранить
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}