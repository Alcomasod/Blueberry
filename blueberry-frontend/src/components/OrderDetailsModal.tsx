// src/components/OrderDetailsModal.tsx
import { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { getApiErrorMessage } from '../lib/apiError';
import { buildCatalog, type CatalogCategory, type FlatMenuItem } from '../lib/menuTree';
import { Plus, Minus, Trash2, CreditCard, Search, Loader2, History } from 'lucide-react';
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
    comment: string;
    created_at: string;
    waiter_id: number | null;
    waiter_name: string | null;
}

interface HistoryEntry {
    id: number;
    action: string;
    details: string;
    created_at: string;
    user_name: string | null;
}

interface Order {
    id: number;
    table_number: string;
    zone_name: string;
    total_amount: string;
    status: string;
    waiter_id: number | null;
    waiter_name: string | null;
    items: OrderItem[];
    history: HistoryEntry[];
}

const OrderDetailsModal = ({ orderId, onClose }: OrderDetailsModalProps) => {
    const [order, setOrder] = useState<Order | null>(null);
    const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddItem, setShowAddItem] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategoryKey, setActiveCategoryKey] = useState<string>('all');
    const [showHistory, setShowHistory] = useState(false);
    const currentUserId = useAuthStore((state) => state.user?.id);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [orderRes, menuRes] = await Promise.all([
                api.get(`/orders/${orderId}`),
                api.get('/menu'),
            ]);

            setOrder(orderRes.data.data);

            // GET /api/menu возвращает ДЕРЕВО категорий:
            // [{ id, name, items: [{ id, name, price }], children: [...] }, ...]
            // Строим из него каталог по категориям (горячее, салаты и т.д.).
            const builtCatalog = buildCatalog(menuRes.data.data);
            console.log(
                `✅ Каталог меню: ${builtCatalog.length} категорий, ` +
                    `${builtCatalog.reduce((n, c) => n + c.items.length, 0)} позиций`
            );
            setCatalog(builtCatalog);
        } catch (err) {
            console.error('❌ Error fetching order details:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [orderId]);

    const handleAddItem = async (item: FlatMenuItem) => {
        try {
            await api.post(`/orders/${orderId}/items`, {
                menu_item_id: item.id,
                quantity: 1,
            });
            setShowAddItem(false);
            setSearchTerm('');
            await fetchData();
        } catch (err) {
            console.error('Ошибка добавления:', err);
            alert(getApiErrorMessage(err, 'Ошибка добавления позиции'));
        }
    };

    const handleUpdateQuantity = async (itemId: number, newQty: number) => {
        if (newQty <= 0) return handleRemoveItem(itemId);
        try {
            await api.patch(`/orders/${orderId}/items/${itemId}`, { quantity: newQty });
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка обновления количества'));
        }
    };

    const handleRemoveItem = async (itemId: number) => {
        if (!confirm('Удалить эту позицию из заказа?')) return;
        try {
            await api.delete(`/orders/${orderId}/items/${itemId}`);
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка удаления позиции'));
        }
    };

    const handlePayOrder = async () => {
        if (!confirm(`Оплатить заказ на сумму ${order?.total_amount} руб.?`)) return;
        try {
            await api.post(`/orders/${orderId}/pay`, {
                payment_method: 'card',
                tip_amount: 0,
                discount_amount: 0,
            });
            alert('Заказ успешно оплачен!');
            onClose();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка оплаты'));
        }
    };

    // Каталог по категориям (горячее, салаты и т.д.) + поиск по всему меню.
    const visibleCategories = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) {
            return activeCategoryKey === 'all'
                ? catalog
                : catalog.filter((c) => c.key === activeCategoryKey);
        }
        // При поиске ищем по всем категориям
        return catalog
            .map((c) => ({
                ...c,
                items: c.items.filter((i) => i.name.toLowerCase().includes(term)),
            }))
            .filter((c) => c.items.length > 0);
    }, [catalog, searchTerm, activeCategoryKey]);

    const totalFound = visibleCategories.reduce((n, c) => n + c.items.length, 0);

    if (loading) {
        return (
            <Modal isOpen={true} onClose={onClose} title="Загрузка...">
                <div className="flex justify-center py-4">
                    <Loader2 className="animate-spin text-blueberry-600" size={24} />
                </div>
            </Modal>
        );
    }

    if (!order) {
        return (
            <Modal isOpen={true} onClose={onClose} title="Ошибка">
                <p>Заказ не найден.</p>
            </Modal>
        );
    }

    return (
        <>
            <Modal isOpen={true} onClose={onClose} title={`Заказ #${order.id} • Стол ${order.table_number || 'Без стола'}`}>
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-blueberry-50 p-3 rounded-lg">
                        <div>
                            <p className="text-xs text-gray-500">Зона</p>
                            <p className="font-semibold text-blueberry-900">{order.zone_name || 'Не указана'}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500">Итого</p>
                            <p className="text-xl font-bold text-blueberry-900">{order.total_amount} ₽</p>
                        </div>
                    </div>

                    {/* Карточки позиций в хронологическом порядке: кто и когда добавил */}
                    <div className="max-h-60 overflow-y-auto space-y-2 border-t border-b py-2">
                        {order.items.length === 0 ? (
                            <p className="text-center text-gray-400 py-4">Заказ пуст. Добавьте позиции.</p>
                        ) : (
                            [...order.items]
                                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                                .map((item) => (
                                <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-800 text-sm">{item.item_name}</p>
                                        <p className="text-xs text-gray-500">
                                            {item.line_total} ₽
                                            {item.waiter_name && (
                                                <span className={item.waiter_id === currentUserId ? 'text-green-700 ml-1' : 'text-orange-600 ml-1'}>
                                                    • {item.waiter_name}
                                                </span>
                                            )}
                                            <span className="text-gray-400 ml-1">
                                                {new Date(item.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </p>
                                        {item.comment && <p className="text-xs italic text-gray-500">«{item.comment}»</p>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} className="p-1 bg-gray-200 rounded hover:bg-gray-300">
                                            <Minus size={14} />
                                        </button>
                                        <span className="w-6 text-center font-medium">{item.quantity}</span>
                                        <button onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} className="p-1 bg-gray-200 rounded hover:bg-gray-300">
                                            <Plus size={14} />
                                        </button>
                                        <button onClick={() => handleRemoveItem(item.id)} className="p-1 text-red-500 hover:bg-red-50 rounded ml-2">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowHistory((v) => !v)}
                            className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg transition ${
                                showHistory ? 'bg-blueberry-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                            title="История изменений заказа"
                        >
                            <History size={16} />
                        </button>
                        <button
                            onClick={() => setShowAddItem(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                            <Plus size={16} /> Добавить
                        </button>
                        <button
                            onClick={handlePayOrder}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blueberry-600 text-white rounded-lg hover:bg-blueberry-700 transition"
                        >
                            <CreditCard size={16} /> Оплатить
                        </button>
                    </div>

                    {/* Хронология всех изменений заказа (каждое изменение — отдельная карточка) */}
                    {showHistory && (
                        <div className="border-t pt-2 max-h-48 overflow-y-auto space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">История изменений</p>
                            {(order.history ?? []).length === 0 ? (
                                <p className="text-xs text-gray-400 py-2">Изменений пока нет.</p>
                            ) : (
                                (order.history ?? []).map((h) => (
                                    <div key={h.id} className="flex items-start gap-2 text-xs bg-blueberry-50 rounded-lg p-2">
                                        <span className="text-gray-400 whitespace-nowrap">
                                            {new Date(h.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-gray-700">
                                            <span className="font-medium">{h.user_name || 'Система'}</span> — {h.details}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </Modal>

            <Modal isOpen={showAddItem} onClose={() => setShowAddItem(false)} title="Добавить позицию">
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Поиск по меню..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blueberry-500"
                            autoFocus
                        />
                    </div>

                    {/* Каталог: вкладки категорий (горячее, салаты и т.д.) */}
                    {!searchTerm && catalog.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setActiveCategoryKey('all')}
                                className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                                    activeCategoryKey === 'all'
                                        ? 'bg-blueberry-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Все
                            </button>
                            {catalog.map((cat) => (
                                <button
                                    key={cat.key}
                                    onClick={() => setActiveCategoryKey(cat.key)}
                                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                                        activeCategoryKey === cat.key
                                            ? 'bg-blueberry-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="max-h-72 overflow-y-auto space-y-3">
                        {totalFound === 0 ? (
                            <p className="text-center text-gray-400 py-4">Ничего не найдено или меню пусто</p>
                        ) : (
                            visibleCategories.map((cat) => (
                                <div key={cat.key}>
                                    <p className="sticky top-0 bg-white text-xs font-semibold uppercase tracking-wide text-gray-500 py-1">
                                        {cat.name}
                                    </p>
                                    <div className="space-y-2">
                                        {cat.items.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => handleAddItem(item)}
                                                className="w-full flex justify-between items-start p-2 bg-gray-50 rounded-lg hover:bg-blueberry-50 transition text-left"
                                            >
                                                <span className="font-medium text-sm text-gray-800">
                                                    {item.name}
                                                    {item.composition && (
                                                        <span className="block text-xs font-normal text-gray-500 mt-0.5 line-clamp-2">
                                                            {item.composition}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="text-sm text-blueberry-600 font-semibold ml-2 whitespace-nowrap">{item.price} ₽</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default OrderDetailsModal;