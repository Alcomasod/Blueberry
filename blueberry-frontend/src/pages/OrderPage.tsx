// src/pages/OrdersPage.tsx
import { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { formatAmount } from '../lib/format';
import { useAuthStore } from '../store/authStore';
import OrderDetailsModal from '../components/OrderDetailsModal';
import PaymentModal from '../components/PaymentModal';
import {
    RefreshCw, Clock, Users, CreditCard, Search,
    Filter, AlertTriangle, CheckCircle, XCircle, Eye
} from 'lucide-react';

interface Order {
    id: number;
    table_id: number;
    table_number: string;
    zone_name: string;
    total_amount: string;
    status: 'open' | 'paid' | 'cancelled';
    created_at: string;
    items_count: string;
    waiter_id: number | null;
    waiter_name: string;
}

interface Zone {
    id: number;
    name: string;
}

const OrdersPage = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    // Модалка подтверждения оплаты (замена нативного confirm())
    const [payTarget, setPayTarget] = useState<{ id: number; label: string; amount: string } | null>(null);

    // Состояния фильтров
    const [filterStatus, setFilterStatus] = useState<string>('open');
    const [filterZone, setFilterZone] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            // Загружаем все заказы (фильтрацию сделаем на фронте для гибкости)
            const [ordersRes, zonesRes] = await Promise.all([
                api.get('/orders'),
                api.get('/zones'),
            ]);
            setOrders(ordersRes.data.data);
            setZones(zonesRes.data.data);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Функция расчета времени в минутах
    const getDurationMinutes = (createdAt: string) => {
        const diff = Date.now() - new Date(createdAt).getTime();
        return Math.floor(diff / 60000);
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };

    // Фильтрация заказов
    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
            const matchesZone = filterZone === 'all' || order.zone_name === filterZone;
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                order.table_number.toLowerCase().includes(searchLower) ||
                (order.waiter_name && order.waiter_name.toLowerCase().includes(searchLower));

            return matchesStatus && matchesZone && matchesSearch;
        });
    }, [orders, filterStatus, filterZone, searchTerm]);

    // Официанту свои заказы показываются первыми, затем — все остальные открытые.
    // Порядок внутри групп сохраняет сортировку бэкенда.
    const currentUserId = useAuthStore((state) => state.user?.id);
    const currentUserRole = useAuthStore((state) => state.user?.role);
    const isWaiterView = currentUserRole === 'waiter' || currentUserRole === 'hookah_master' || currentUserRole === 'hookah_bar';

    const orderedFilteredOrders = useMemo(() => {
        if (!isWaiterView || !currentUserId) return filteredOrders;
        const mine = filteredOrders.filter((o) => o.waiter_id === currentUserId);
        const others = filteredOrders.filter((o) => o.waiter_id !== currentUserId);
        return [...mine, ...others];
    }, [filteredOrders, isWaiterView, currentUserId]);

    const myOrders = useMemo(
        () => (currentUserId ? filteredOrders.filter((o) => o.waiter_id === currentUserId) : []),
        [filteredOrders, currentUserId]
    );
    const otherOrders = useMemo(
        () => (currentUserId ? filteredOrders.filter((o) => o.waiter_id !== currentUserId) : []),
        [filteredOrders, currentUserId]
    );

    // Быстрая оплата — открывает модалку подтверждения (вместо нативного confirm())
    const handleQuickPay = (e: React.MouseEvent, order: Order) => {
        e.stopPropagation(); // Чтобы не открывалась модалка деталей
        setPayTarget({
            id: order.id,
            label: `Стол #${order.table_number} (заказ №${order.id})`,
            amount: formatAmount(order.total_amount),
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'open': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1"><XCircle size={12}/> Открыт</span>;
            case 'paid': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircle size={12}/> Оплачен</span>;
            case 'cancelled': return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold flex items-center gap-1"><XCircle size={12}/> Отменен</span>;
            default: return null;
        }
    };

    // Карточка заказа (используется в обеих группах списка)
    const renderOrderCard = (order: Order) => {
        const duration = getDurationMinutes(order.created_at);
        const isStuck = order.status === 'open' && duration > 45; // Подсветка "зависших"
        const isForeignOpen = order.status === 'open' && isWaiterView && order.waiter_id !== currentUserId;

        return (
            <div
                key={order.id}
                onClick={() => order.status === 'open' && setSelectedOrderId(order.id)}
                className={`bg-white p-5 rounded-xl shadow-sm border transition-all relative ${
                    order.status === 'open'
                        ? 'hover:shadow-md hover:border-blueberry-300 cursor-pointer'
                        : 'opacity-75 cursor-default'
                } ${isStuck ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-200'}`}
            >
                {/* Индикатор зависшего заказа */}
                {isStuck && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg animate-pulse">
                        <AlertTriangle size={14} />
                    </div>
                )}

                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Стол #{order.table_number}</h3>
                        <p className="text-xs text-gray-500">{order.zone_name}</p>
                    </div>
                    {getStatusBadge(order.status)}
                </div>

                <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-1">
                        <Clock size={14} className={isStuck ? 'text-red-500' : ''} />
                        <span className={isStuck ? 'text-red-600 font-semibold' : ''}>
                            {formatTime(order.created_at)} ({duration} мин)
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Users size={14} />
                        <span>{order.items_count} поз.</span>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500 truncate max-w-[140px]" title={order.waiter_name}>
                        {order.waiter_name || 'Неизвестно'}
                        {isForeignOpen && (
                            <span className="ml-1 text-orange-600 font-medium">(подхватить)</span>
                        )}
                    </span>
                    <span className="text-lg font-bold text-blueberry-900">{formatAmount(order.total_amount)} ₽</span>
                </div>

                {/* Кнопки действий для открытых заказов */}
                {order.status === 'open' && (
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={(e) => handleQuickPay(e, order)}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                            title="Быстрая оплата"
                        >
                            <CreditCard size={14} /> Оплатить
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setSelectedOrderId(order.id); }}
                            className="flex items-center justify-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                            title="Детали заказа"
                        >
                            <Eye size={14} />
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Заголовок и обновление */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800"> Управление заказами</h1>
                <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">
                    <RefreshCw size={16} /> Обновить
                </button>
            </div>

            {/* Панель фильтров */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Поиск по столу или официанту..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blueberry-500 focus:border-blueberry-500 text-sm"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-500" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blueberry-500"
                    >
                        <option value="all">Все статусы</option>
                        <option value="open">Открытые</option>
                        <option value="paid">Оплаченные</option>
                        <option value="cancelled">Отмененные</option>
                    </select>
                </div>

                <select
                    value={filterZone}
                    onChange={(e) => setFilterZone(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blueberry-500"
                >
                    <option value="all">Все зоны</option>
                    {zones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
                </select>
            </div>

            {/* Сетка заказов: официанту — сначала свои, затем чужие открытые столы */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <RefreshCw className="animate-spin text-blueberry-600" size={32} />
                </div>
            ) : orderedFilteredOrders.length === 0 ? (
                <div className="bg-white p-10 rounded-xl shadow-sm border text-center">
                    <p className="text-gray-500 text-lg">Заказы не найдены. Попробуйте изменить фильтры.</p>
                </div>
            ) : isWaiterView ? (
                <>
                    {myOrders.length > 0 && (
                        <section className="space-y-3">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Мои столы</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {myOrders.map(renderOrderCard)}
                            </div>
                        </section>
                    )}
                    {otherOrders.length > 0 && (
                        <section className="space-y-3">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                                Открытые столы других сотрудников
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {otherOrders.map(renderOrderCard)}
                            </div>
                        </section>
                    )}
                </>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {orderedFilteredOrders.map(renderOrderCard)}
                </div>
            )}

            {/* Модалка деталей заказа */}
            {selectedOrderId && (
                <OrderDetailsModal
                    orderId={selectedOrderId}
                    onClose={() => { setSelectedOrderId(null); fetchData(); }}
                />
            )}

            {/* Модалка подтверждения оплаты (быстрая оплата из карточки) */}
            {payTarget && (
                <PaymentModal
                    orderId={payTarget.id}
                    orderLabel={payTarget.label}
                    amount={payTarget.amount}
                    mode="pay"
                    onClose={() => setPayTarget(null)}
                    onSuccess={() => { setPayTarget(null); fetchData(); }}
                />
            )}
        </div>
    );
};

export default OrdersPage;