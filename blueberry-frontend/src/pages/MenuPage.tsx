import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { hasPermission } from '../config/permissions';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Archive, Loader2, Search } from 'lucide-react';

interface MenuItem {
    id: number;
    name: string;
    description?: string | null;
    price: number;
    category_id?: number | null;
    composition?: string | null;
    is_active: boolean;
}

interface MenuCategory {
    id: number;
    name: string;
    sort_order: number;
}

const EMPTY_ITEM_FORM = { name: '', price: '', category_id: '', description: '', composition: '' };
const EMPTY_CATEGORY_FORM = { name: '', sort_order: '0' };

export default function MenuPage() {
    const user = useAuthStore((state) => state.user);
    const canManage = user ? hasPermission(user.role, 'MANAGE_MENU_ITEMS') : false;

    const [items, setItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [showInactive, setShowInactive] = useState(false);

    // Модалка позиции
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
    const [saving, setSaving] = useState(false);

    // Модалка категории
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
    const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            // Единый эндпоинт /menu возвращает дерево: [{ id, name, items: [...] }]
            const response = await api.get('/menu', {
                params: showInactive && canManage ? { includeInactive: 'true' } : {},
            });
            const groups = response.data.data as Array<{
                id: number | null;
                name: string;
                items: MenuItem[];
            }>;
            setCategories(groups.map((g) => ({ id: g.id ?? 0, name: g.name, sort_order: 0 })));
            setItems(groups.flatMap((g) => g.items));
        } catch (err) {
            setError('Не удалось загрузить меню. Проверьте подключение к серверу.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showInactive]);

    const openCreateItem = () => {
        setEditingItem(null);
        setItemForm({ ...EMPTY_ITEM_FORM, category_id: categories[0]?.id ? String(categories[0].id) : '' });
        setIsItemModalOpen(true);
    };

    const openEditItem = (item: MenuItem) => {
        setEditingItem(item);
        setItemForm({
            name: item.name,
            price: String(item.price),
            category_id: item.category_id != null ? String(item.category_id) : '',
            description: item.description ?? '',
            composition: item.composition ?? '',
        });
        setIsItemModalOpen(true);
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemForm.name.trim() || !itemForm.price) return;
        setSaving(true);
        try {
            const payload = {
                name: itemForm.name.trim(),
                price: parseFloat(itemForm.price),
                category_id: itemForm.category_id ? Number(itemForm.category_id) : null,
                description: itemForm.description.trim() || undefined,
                composition: itemForm.composition.trim() || undefined,
            };
            if (editingItem) {
                await api.put(`/menu/items/${editingItem.id}`, payload);
            } else {
                await api.post('/menu/items', payload);
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

    const toggleArchiveItem = async (item: MenuItem) => {
        if (!confirm(`"${item.name}": ${item.is_active ? 'скрыть из меню?' : 'вернуть в меню?'}`)) return;
        try {
            await api.patch(`/menu/items/${item.id}/archive`, { is_active: !item.is_active });
            await fetchData();
        } catch (err) {
            alert('Ошибка изменения статуса блюда');
            console.error(err);
        }
    };

    const deleteItem = async (item: MenuItem) => {
        if (!confirm(`Удалить "${item.name}" безвозвратно? Если блюдо есть в заказах — используйте «скрыть».`)) return;
        try {
            await api.delete(`/menu/items/${item.id}`);
            await fetchData();
        } catch (err) {
            alert('Не удалось удалить блюдо (возможно, на него ссылаются заказы). Скройте его вместо удаления.');
            console.error(err);
        }
    };

    const openCreateCategory = () => {
        setEditingCategory(null);
        setCategoryForm({ ...EMPTY_CATEGORY_FORM, sort_order: String(categories.length + 1) });
        setIsCategoryModalOpen(true);
    };

    const openEditCategory = (cat: MenuCategory) => {
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
                await api.put(`/menu/categories/${editingCategory.id}`, payload);
            } else {
                await api.post('/menu/categories', payload);
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

    const deleteCategory = async (cat: MenuCategory) => {
        if (!confirm(`Удалить категорию "${cat.name}"? Блюда в ней останутся, но потеряют категорию.`)) return;
        try {
            await api.delete(`/menu/categories/${cat.id}`);
            await fetchData();
        } catch (err) {
            alert('Не удалось удалить категорию');
            console.error(err);
        }
    };

    const filtered = items.filter((i) => {
        if (!showInactive && !i.is_active) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return i.name.toLowerCase().includes(q) || (i.composition ?? '').toLowerCase().includes(q);
    });

    const groupedByCategory = categories
        .map((cat) => ({ cat, list: filtered.filter((i) => i.category_id === cat.id) }))
        .concat([{ cat: { id: 0, name: 'Без категории', sort_order: 999 }, list: filtered.filter((i) => !i.category_id) }])
        .filter((g) => g.list.length > 0 || g.cat.id !== 0);

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
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
                    Показывать скрытые
                </label>
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

            {groupedByCategory.map(({ cat, list }) => (
                <section key={cat.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <header className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-700">{cat.name}</h2>
                        {canManage && cat.id !== 0 && (
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
                        {list.map((item) => (
                            <li key={item.id} className={`px-4 py-3 flex items-start gap-3 ${!item.is_active ? 'opacity-50' : ''}`}>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-800 truncate">
                                        {item.name}
                                        {!item.is_active && <span className="ml-2 text-xs text-gray-400">(скрыто)</span>}
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
                                        <button onClick={() => toggleArchiveItem(item)} className="p-1.5 text-gray-500 hover:text-amber-600" title={item.is_active ? 'Скрыть из меню' : 'Вернуть в меню'}>
                                            <Archive size={15} />
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
                                <select value={itemForm.category_id} onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                                    <option value="">— Без категории —</option>
                                    {categories.filter((c) => c.id !== 0).map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
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