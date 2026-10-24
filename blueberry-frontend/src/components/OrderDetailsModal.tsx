// src/components/OrderDetailsModal.tsx
import { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { getApiErrorMessage } from '../lib/apiError';
import { formatAmount } from '../lib/format';
import { buildCatalog, type CatalogCategory, type FlatMenuItem } from '../lib/menuTree';
import { Plus, Minus, Trash2, CreditCard, Search, Loader2, History, Check } from 'lucide-react';
import Modal from './Modal';
import { useAuthStore } from '../store/authStore';

interface OrderDetailsModalProps {
    orderId: number;
    onClose: () => void;
}

interface OrderItem {
    id: number;
    item_name: string;
    quantity: number;
    price_at_sale: number;
    line_total: number;
    comment?: string | null;
}

interface OrderHistoryEntry {
    id: number;
    action: string;
    details: string;
    author: string;
    created_at: string;
}

interface Order {
    id: number;
    table_number: string;
    zone_name: string;
    status: string;
    total_amount: number;
    comment?: string | null;
    items: OrderItem[];
}

export default function OrderDetailsModal({ orderId, onClose }: OrderDetailsModalProps) {
    const user = useAuthStore((s) => s.user);
    const [order, setOrder] = useState<Order | null>(null);
    const [menuItems, setMenuItems] = useState<FlatMenuItem[]>([]);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<OrderHistoryEntry[]>([]);
    const [orderComment, setOrderComment] = useState('');
    const [commentDirty, setCommentDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetchData = async () => {
            try {
                const [ordersRes, menuRes] = await Promise.all([
                    api.get(`/orders/${orderId}`),
                    api.get('/menu'),
                ]);
                const o = ordersRes.data.data;
                setOrder(o);
                setMenuItems(menuRes.data.data.filter((m: FlatMenuItem) => m.is_active));
                // синхронизируем поле комментария, если пользователь ещё не редактировал его
                setOrderComment((prev) => (commentDirty ? prev : o.comment ?? ''));
            } catch (err) {
                alert(getApiErrorMessage(err, 'Не удалось загрузить заказ'));
            } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId]);

    const catalog: CatalogCategory[] = useMemo(
        () => buildCatalog(menuItems, search),
        [menuItems, search],
    );

    const visibleCategories = useMemo(
        () =>
            activeCategory === 'all'
                ? catalog
                : catalog.filter((c) => c.category === activeCategory),
        [catalog, activeCategory],
    );

    const handleAddItem = async (item: FlatMenuItem) => {
        try {
            await api.post(`/orders/${orderId}/items`, {
                menu_item_id: item.id,
                quantity: 1,
            });
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка добавления позиции'));
        }
    };

    const handleQtyChange = async (itemId: number, delta: number) => {
        const it = order?.items.find((i) => i.id === itemId);
        if (!it) return;
        const newQty = it.quantity + delta;
        if (newQty <= 0) return handleRemoveItem(itemId);
        try {
            await api.patch(`/orders/${orderId}/items/${itemId}`, { quantity: newQty });
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка обновления количества'));
        }
    };

    const handleRemoveItem = async (itemId: number) => {
        if (!confirm('Удалить позицию?')) return;
        try {
            await api.delete(`/orders/${orderId}/items/${itemId}`);
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка удаления позиции'));
        }
    };

    const handleSaveComment = async () => {
        if (!commentDirty) return true;
        try {
            await api.patch(`/orders/${orderId}/comment`, { comment: orderComment });
            setCommentDirty(false);
            return true;
        } catch (err) {
            alert(getApiErrorMessage(err, 'Не удалось сохранить комментарий'));
            return false;
        }
    };

    const handlePayOrder = async () => {
        if (!(await handleSaveComment())) return;
        try {
            await api.patch(`/orders/${orderId}`, { status: 'paid' });
            onClose();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка оплаты заказа'));
        }
    };

    const fetchHistory = async () => {
        setShowHistory((v) => !v);
        if (history.length === 0) {
            try {
                const res = await api.get(`/orders/${orderId}/history`);
                setHistory(res.data.data);
            } catch (err) {
                alert(getApiErrorMessage(err, 'История недоступна'));
            }
        }
    };

    const total = useMemo(
        () => (order?.items ?? []).reduce((sum, i) => sum + Number(i.line_total), 0),
        [order],
    );

    return (
        <Modal title={order ? `Заказ №${order.id} · Стол ${order.table_number} (${order.zone_name})` : 'Заказ'} onClose={onClose}>
            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin text-blueberry-600" size={32} />
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Позиции */}
                    <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Позиции</h3>
                        {order && order.items.length > 0 ? (
                            <ul className="divide-y divide-gray-100">
                                {order.items.map((it) => (
                                    <li key={it.id} className="py-2 flex items-center gap-2">
                                        <span className="flex-1 text-sm">
                                            {it.item_name}
                                            {it.comment ? <em className="ml-1 text-xs text-gray-500">({it.comment})</em> : null}
                                        </span>
                                        <button onClick={() => handleQtyChange(it.id, -1)} className="p-1 rounded hover:bg-gray-100"><Minus size={14} /></button>
                                        <span className="w-8 text-center text-sm font-medium">{it.quantity}</span>
                                        <button onClick={() => handleQtyChange(it.id, 1)} className="p-1 rounded hover:bg-gray-100"><Plus size={14} /></button>
                                        <span className="w-20 text-right text-sm">{formatAmount(Number(it.line_total))}</span>
                                        <button onClick={() => handleRemoveItem(it.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-400">Позиций пока нет — добавьте блюда из каталога.</p>
                        )}
                    </div>

                    {/* Итого */}
                    <div className="rounded-md bg-blueberry-50 px-3 py-2 flex justify-between font-bold text-blueberry-900">
                        <span>Итого</span>
                        <span>{formatAmount(total)}</span>
                    </div>

                    {/* Комментарий к заказу */}
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Комментарий к заказу</label>
                        <textarea
                            value={orderComment}
                            onChange={(e) => { setOrderComment(e.target.value); setCommentDirty(true); }}
                            rows={2}
                            placeholder="Персона гостей, предпочтения: убрать лук из салата, добавить сахар в чай…"
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blueberry-500 focus:border-blueberry-500"
                        />
                    </div>

                    {/* Каталог добавления позиции */}
                    {showAddPanel && (
                        <div className="border border-gray-200 rounded-md p-3 space-y-3">
                            <div className="relative">
                                <Search size={16} className="absolute left-2 top-2.5 text-gray-400" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Поиск по меню…"
                                    className="w-full rounded-md border border-gray-300 pl-8 pr-3 py-2 text-sm"
                                />
                            </div>
                            <div className="flex flex-wrap gap-1">
                                <button
                                    onClick={() => setActiveCategory('all')}
                                    className={`px-2 py-1 rounded-full text-xs ${activeCategory === 'all' ? 'bg-blueberry-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                                >Все</button>
                                {catalog.map((c) => (
                                    <button
                                        key={c.category}
                                        onClick={() => setActiveCategory(c.category)}
                                        className={`px-2 py-1 rounded-full text-xs ${activeCategory === c.category ? 'bg-blueberry-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                                    >{c.category}</button>
                                ))}
                            </div>
                            <div className="max-h-56 overflow-y-auto space-y-3">
                                {visibleCategories.map((cat) => (
                                    <div key={cat.category}>
                                        <p className="text-xs font-semibold text-gray-500 mb-1">{cat.category}</p>
                                        <div className="grid grid-cols-2 gap-1">
                                            {cat.items.map((mi) => (
                                                <button
                                                    key={mi.id}
                                                    onClick={() => handleAddItem(mi)}
                                                    className="text-left px-2 py-1.5 rounded hover:bg-blueberry-50 text-sm flex justify-between gap-2"
                                                >
                                                    <span className="truncate">{mi.name}</span>
                                                    <span className="text-gray-500 shrink-0">{formatAmount(mi.price)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* История изменений */}
                    {showHistory && (
                        <div className="border border-gray-200 rounded-md p-3 max-h-48 overflow-y-auto">
                            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">История изменений</h3>
                            <ol className="space-y-1">
                                {history.map((h) => (
                                    <li key={h.id} className="text-xs text-gray-600">
                                        <span className="font-mono">{new Date(h.created_at).toLocaleTimeString('ru-RU')}</span>{' '}
                                        <b>{h.author}</b>: {h.details}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {/* Большая кнопка СОХРАНИТЬ */}
                    <button
                        onClick={handleSaveComment}
                        disabled={saving || !commentDirty}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blueberry-600 text-white text-base font-bold rounded-lg hover:bg-blueberry-700 transition disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />} Сохранить
                    </button>

                    {/* Ряд дополнительных действий */}
                    <div className="flex gap-2">
                        <button onClick={fetchHistory} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm">
                            <History size={16} /> История
                        </button>
                        <button onClick={() => setShowAddPanel((v) => !v)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md bg-green-100 text-green-800 hover:bg-green-200 text-sm">
                            <Plus size={16} /> Добавить блюдо
                        </button>
                        <button onClick={handlePayOrder} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md bg-blueberry-100 text-blueberry-800 hover:bg-blueberry-200 text-sm">
                            <CreditCard size={16} /> Оплатить
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
}