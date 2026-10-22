// src/components/OrderDetailsModal.tsx
import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Plus, Minus, Trash2, CreditCard, Search, Loader2 } from 'lucide-react';
import Modal from './Modal';

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
}

interface Order {
    id: number;
    table_number: string;
    zone_name: string;
    total_amount: string;
    status: string;
    items: OrderItem[];
}

interface MenuItem {
    id: number;
    name: string;
    is_available: boolean;
    current_price: number;
}

const OrderDetailsModal = ({ orderId, onClose }: OrderDetailsModalProps) => {
    const [order, setOrder] = useState<Order | null>(null);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddItem, setShowAddItem] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [orderRes, menuRes] = await Promise.all([
                api.get(`/orders/${orderId}`),
                api.get('/menu'),
            ]);

            setOrder(orderRes.data.data);

            // ПАРСИНГ МЕНЮ (адаптирован под плоскую таблицу menu_items с полями id, name, price, is_active)
            const flatMenu: MenuItem[] = [];
            const menuData = menuRes.data.data;

            if (Array.isArray(menuData)) {
                menuData.forEach((item: any) => {
                    if (item.is_active && (item.price > 0 || item.current_price > 0)) {
                        flatMenu.push({
                            id: item.id,
                            name: item.name,
                            is_available: item.is_active,
                            current_price: item.price || item.current_price || 0,
                        });
                    }
                });
            }

            console.log(`✅ Загружено позиций меню для добавления: ${flatMenu.length}`);
            setMenuItems(flatMenu);
        } catch (err) {
            console.error('❌ Error fetching order details:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [orderId]);

    const handleAddItem = async (item: MenuItem) => {
        try {
            await api.post(`/orders/${orderId}/items`, {
                menu_item_id: item.id,
                quantity: 1,
            });
            setShowAddItem(false);
            setSearchTerm('');
            await fetchData();
        } catch (err: any) {
            console.error('Ошибка добавления:', err.response?.data);
            alert(err.response?.data?.error || 'Ошибка добавления позиции');
        }
    };

    const handleUpdateQuantity = async (itemId: number, newQty: number) => {
        if (newQty <= 0) return handleRemoveItem(itemId);
        try {
            await api.patch(`/orders/${orderId}/items/${itemId}`, { quantity: newQty });
            await fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка обновления количества');
        }
    };

    const handleRemoveItem = async (itemId: number) => {
        if (!confirm('Удалить эту позицию из заказа?')) return;
        try {
            await api.delete(`/orders/${orderId}/items/${itemId}`);
            await fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка удаления позиции');
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
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка оплаты');
        }
    };

    const filteredMenu = menuItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

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

                    <div className="max-h-60 overflow-y-auto space-y-2 border-t border-b py-2">
                        {order.items.length === 0 ? (
                            <p className="text-center text-gray-400 py-4">Заказ пуст. Добавьте позиции.</p>
                        ) : (
                            order.items.map((item) => (
                                <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-800 text-sm">{item.item_name}</p>
                                        <p className="text-xs text-gray-500">{item.line_total} ₽</p>
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
                    <div className="max-h-60 overflow-y-auto space-y-2">
                        {filteredMenu.length === 0 ? (
                            <p className="text-center text-gray-400 py-4">Ничего не найдено или меню пусто</p>
                        ) : (
                            filteredMenu.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleAddItem(item)}
                                    className="w-full flex justify-between items-center p-2 bg-gray-50 rounded-lg hover:bg-blueberry-50 transition text-left"
                                >
                                    <span className="font-medium text-sm text-gray-800">{item.name}</span>
                                    <span className="text-sm text-blueberry-600 font-semibold">{item.current_price} ₽</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default OrderDetailsModal;