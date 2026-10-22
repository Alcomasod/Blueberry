// src/pages/TablesPage.tsx
import { useState, useEffect } from 'react';
import api from '../lib/api';
import { getApiErrorMessage } from '../lib/apiError';
import { useAuthStore } from '../store/authStore';
import OrderDetailsModal from '../components/OrderDetailsModal';
import {
    Users, CheckCircle, XCircle, Clock, RefreshCw,
    Plus, Trash2, Edit
} from 'lucide-react';
import Modal from '../components/Modal';

interface Table {
    id: number;
    number: string;
    zone_id: number;
    zone_name: string;
    capacity: number;
    status: 'free' | 'occupied' | 'reserved';
    reservation_name?: string;
    reservation_phone?: string;
    reservation_time?: string;
    reservation_comment?: string;
}

interface Zone {
    id: number;
    name: string;
    sort_order: number;
}

interface OpenOrder {
    id: number;
    table_id: number | null;
}

const TablesPage = () => {
    const { user } = useAuthStore();
    const isAdmin = user?.role && ['sys_admin', 'director', 'admin'].includes(user.role);
    const canManageStatus = user?.role && ['sys_admin', 'director', 'admin', 'waiter', 'hookah_master', 'hookah_bar'].includes(user.role);

    const [tables, setTables] = useState<Table[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [openOrdersByTable, setOpenOrdersByTable] = useState<Map<number, number>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    // Заказ, открытый прямо на странице столов (модалка с меню из БД)
    const [activeOrderId, setActiveOrderId] = useState<number | null>(null);

    // Состояния модалок
    const [showAddZoneModal, setShowAddZoneModal] = useState(false);
    const [showAddTableModal, setShowAddTableModal] = useState(false);
    const [showReservationForm, setShowReservationForm] = useState(false);
    const [editingTable, setEditingTable] = useState<Table | null>(null);

    // Состояния форм
    const [newZoneName, setNewZoneName] = useState('');
    const [newZoneSort, setNewZoneSort] = useState(0);
    const [newTableNumber, setNewTableNumber] = useState('');
    const [newTableZoneId, setNewTableZoneId] = useState<number | ''>('');
    const [newTableCapacity, setNewTableCapacity] = useState(4);

    const [reservationForm, setReservationForm] = useState({
        name: '',
        phone: '',
        time: '',
        comment: ''
    });

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            // Все три запроса параллельно; карта заказов не должна ронять страницу
            const [tablesRes, zonesRes, ordersRes] = await Promise.all([
                api.get('/tables'),
                api.get('/zones'),
                api.get('/orders', { params: { status: 'open' } }).catch(() => null),
            ]);
            setTables(tablesRes.data.data);
            setZones(zonesRes.data.data);

            // Карта «стол → открытый заказ», чтобы сразу открывать меню заказа.
            // В карту попадают заказы с table_id — в т.ч. открытые администратором
            // без смены (у них shift_id = NULL).
            const map = new Map<number, number>();
            if (ordersRes) {
                for (const o of (ordersRes.data.data || []) as OpenOrder[]) {
                    if (o.table_id != null) map.set(o.table_id, o.id);
                }
            }
            setOpenOrdersByTable(map);
        } catch (err) {
            setError(getApiErrorMessage(err, 'Ошибка загрузки данных'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // ===== CRUD для залов =====
    const handleAddZone = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/zones', { name: newZoneName, sort_order: newZoneSort });
            setNewZoneName('');
            setNewZoneSort(0);
            setShowAddZoneModal(false);
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка создания зала'));
        }
    };

    const handleDeleteZone = async (zoneId: number) => {
        if (!confirm('Удалить зал? В нём не должно быть столов.')) return;
        try {
            await api.delete(`/zones/${zoneId}`);
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка удаления зала'));
        }
    };

    // ===== CRUD для столов =====
    const handleAddTable = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/tables', {
                number: newTableNumber,
                zone_id: newTableZoneId,
                capacity: newTableCapacity,
            });
            setNewTableNumber('');
            setNewTableZoneId('');
            setNewTableCapacity(4);
            setShowAddTableModal(false);
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка создания стола'));
        }
    };

    const handleUpdateTable = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTable) return;
        try {
            await api.patch(`/tables/${editingTable.id}`, {
                number: editingTable.number,
                zone_id: editingTable.zone_id,
                capacity: editingTable.capacity,
            });
            setEditingTable(null);
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка обновления стола'));
        }
    };

    const handleDeleteTable = async (tableId: number) => {
        if (!confirm('Удалить стол? На нём не должно быть активных заказов.')) return;
        try {
            await api.delete(`/tables/${tableId}`);
            setSelectedTable(null);
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка удаления стола'));
        }
    };

    const handleChangeStatus = async (tableId: number, status: 'free' | 'occupied' | 'reserved') => {
        try {
            await api.patch(`/tables/${tableId}/status`, { status });
            setSelectedTable(null);
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка смены статуса'));
        }
    };

    const handleCreateOrder = async () => {
        if (!selectedTable) return;

        try {
            const res = await api.post('/orders', {
                table_id: selectedTable.id,
                items: []
            });

            setSelectedTable(null);
            // Сразу открываем модалку заказа с меню из БД — без перехода на другую страницу
            setActiveOrderId(res.data.data.id);
            await fetchData();
        } catch (err) {
            const errorMsg = getApiErrorMessage(err, 'Ошибка создания заказа');
            alert(errorMsg);
        }
    };

    const handleOpenOrder = async () => {
        if (!selectedTable) return;

        // Сначала по уже загруженной карте столов, затем — резервный запрос к API.
        // Если заказ не найден ни там, ни там — НЕ создаём вслепую: POST /orders
        // сам разберётся (найдёт открытый заказ стола и вернёт его «подхватом»,
        // либо создаст новый). Это лечит случай «Активный заказ не найден».
        let orderId = openOrdersByTable.get(selectedTable.id);

        if (orderId === undefined) {
            try {
                const response = await api.get('/orders', {
                    params: { status: 'open' }
                });
                const orders = response.data.data as OpenOrder[];
                const tableOrder = orders.find((order) => order.table_id === selectedTable.id);
                if (tableOrder) orderId = tableOrder.id;
            } catch {
                // Резервный поиск не удался — переходим к прямому открытию через POST
                orderId = undefined;
            }
        }

        if (orderId !== undefined) {
            setSelectedTable(null);
            setActiveOrderId(orderId);
        } else {
            await openOrCreateOrderForTable(selectedTable.id);
        }
    };

    // Прямое открытие активного заказа стола через POST /orders: бэкенд сам
    // найдёт открытый заказ (любого сотрудника, включая админа без смены)
    // и вернёт его id («подхват»). Это надёжнее поиска по списку: не зависит
    // от состояния кэша-карты и синхронизации статуса стола.
    const openOrCreateOrderForTable = async (tableId: number) => {
        try {
            const res = await api.post('/orders', { table_id: tableId, items: [] });
            setSelectedTable(null);
            setActiveOrderId(res.data.data.id);
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Не удалось открыть заказ стола'));
        }
    };

    const handleReserveTable = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTable) return;

        try {
            await api.patch(`/tables/${selectedTable.id}`, {
                status: 'reserved',
                reservation_name: reservationForm.name,
                reservation_phone: reservationForm.phone || null,
                reservation_time: reservationForm.time ? new Date(reservationForm.time).toISOString() : null,
                reservation_comment: reservationForm.comment || null,
            });

            setShowReservationForm(false);
            setReservationForm({ name: '', phone: '', time: '', comment: '' });
            setSelectedTable(null);
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка бронирования'));
        }
    };

    // ===== Группировка и сортировка =====
    const tablesByZoneId = tables.reduce((acc, table) => {
        if (!acc[table.zone_id]) acc[table.zone_id] = [];
        acc[table.zone_id].push(table);
        return acc;
    }, {} as Record<number, Table[]>);

    const sortedZones = [...zones].sort((a, b) => a.sort_order - b.sort_order);

    // ===== Хелперы для UI =====
    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'free': return 'bg-green-100 border-green-500 text-green-800 hover:bg-green-200';
            case 'occupied': return 'bg-red-100 border-red-500 text-red-800 hover:bg-red-200';
            case 'reserved': return 'bg-yellow-100 border-yellow-500 text-yellow-800 hover:bg-yellow-200';
            default: return 'bg-gray-100 border-gray-500 text-gray-800';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'free': return <CheckCircle size={20} className="text-green-600" />;
            case 'occupied': return <XCircle size={20} className="text-red-600" />;
            case 'reserved': return <Clock size={20} className="text-yellow-600" />;
            default: return null;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'free': return 'Свободен';
            case 'occupied': return 'Занят';
            case 'reserved': return 'Бронь';
            default: return status;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="animate-spin text-blueberry-600" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                <p className="font-bold">Ошибка</p>
                <p>{error}</p>
                <button onClick={fetchData} className="mt-2 text-sm underline">Попробовать снова</button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Заголовок и кнопки */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800"> Карта зала</h1>
                <div className="flex gap-2">
                    {isAdmin && (
                        <>
                            <button onClick={() => setShowAddZoneModal(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
                                <Plus size={16} /> Добавить зал
                            </button>
                            <button onClick={() => setShowAddTableModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blueberry-600 text-white rounded-lg hover:bg-blueberry-700 transition">
                                <Plus size={16} /> Добавить стол
                            </button>
                        </>
                    )}
                    <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">
                        <RefreshCw size={16} /> Обновить
                    </button>
                </div>
            </div>

            {/* Легенда */}
            <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div> Свободен</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Занят</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-500 rounded-full"></div> Бронь</div>
            </div>

            {/* Зоны и столы */}
            {sortedZones.length === 0 ? (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
                    <p className="text-gray-500 mb-4">Залы не созданы.</p>
                    {isAdmin && (
                        <button onClick={() => setShowAddZoneModal(true)} className="px-4 py-2 bg-blueberry-600 text-white rounded-lg hover:bg-blueberry-700">
                            Создать первый зал
                        </button>
                    )}
                </div>
            ) : (
                sortedZones.map((zone) => {
                    const zoneTables = tablesByZoneId[zone.id] || [];
                    return (
                        <div key={zone.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h2 className="text-xl font-semibold text-gray-700">{zone.name}</h2>
                                {isAdmin && (
                                    <button onClick={() => handleDeleteZone(zone.id)} className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1">
                                        <Trash2 size={14} /> Удалить зал
                                    </button>
                                )}
                            </div>

                            {zoneTables.length === 0 ? (
                                <p className="text-gray-400 italic text-sm py-4">В этом зале пока нет столов</p>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {zoneTables.map((table) => (
                                        <button
                                            key={table.id}
                                            onClick={() => setSelectedTable(table)}
                                            className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${getStatusStyles(table.status)}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-2xl font-bold">#{table.number}</span>
                                                {getStatusIcon(table.status)}
                                            </div>
                                            <div className="flex items-center gap-1 text-sm opacity-80">
                                                <Users size={14} />
                                                <span>{table.capacity} мест</span>
                                            </div>
                                            <div className="mt-2 text-xs font-medium uppercase tracking-wide">
                                                {getStatusText(table.status)}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })
            )}

            {/* ===== МОДАЛКА: Детали стола ===== */}
            {selectedTable && (
                <Modal isOpen={true} onClose={() => setSelectedTable(null)} title={`Стол #${selectedTable.number}`}>
                    <div className="space-y-4">
                        <div className="flex justify-between border-b pb-2">
                            <span className="text-gray-600">Зона:</span>
                            <span className="font-medium">{selectedTable.zone_name}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                            <span className="text-gray-600">Вместимость:</span>
                            <span className="font-medium">{selectedTable.capacity} чел.</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                            <span className="text-gray-600">Статус:</span>
                            <span className={`font-medium flex items-center gap-2 ${
                                selectedTable.status === 'free' ? 'text-green-600' :
                                    selectedTable.status === 'occupied' ? 'text-red-600' : 'text-yellow-600'
                            }`}>
                {getStatusIcon(selectedTable.status)}
                                {getStatusText(selectedTable.status)}
              </span>
                        </div>

                        {/* Детали брони */}
                        {selectedTable.status === 'reserved' && selectedTable.reservation_name && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
                                <h4 className="font-semibold text-yellow-800 text-sm flex items-center gap-2">
                                    <Clock size={16} /> Детали брони:
                                </h4>
                                <div className="text-sm space-y-1 text-gray-700">
                                    <p><span className="font-medium text-gray-900">Имя:</span> {selectedTable.reservation_name}</p>
                                    {selectedTable.reservation_phone && <p><span className="font-medium text-gray-900">Телефон:</span> {selectedTable.reservation_phone}</p>}
                                    {selectedTable.reservation_time && <p><span className="font-medium text-gray-900">Время:</span> {new Date(selectedTable.reservation_time).toLocaleString('ru-RU')}</p>}
                                    {selectedTable.reservation_comment && <p><span className="font-medium text-gray-900">Комментарий:</span> <span className="italic">{selectedTable.reservation_comment}</span></p>}
                                </div>
                            </div>
                        )}

                        {/* Кнопки смены статуса (для официантов и админов) */}
                        {canManageStatus && (
                            <div className="pt-2">
                                <p className="text-sm text-gray-600 mb-2">Сменить статус:</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => handleChangeStatus(selectedTable.id, 'free')} className={`px-3 py-2 rounded text-sm font-medium transition ${selectedTable.status === 'free' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                                        Свободен
                                    </button>
                                    <button onClick={() => handleChangeStatus(selectedTable.id, 'occupied')} className={`px-3 py-2 rounded text-sm font-medium transition ${selectedTable.status === 'occupied' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                                        Занят
                                    </button>
                                    <button
                                        onClick={() => {
                                            setReservationForm({
                                                name: selectedTable.reservation_name || '',
                                                phone: selectedTable.reservation_phone || '',
                                                time: selectedTable.reservation_time ? new Date(selectedTable.reservation_time).toISOString().slice(0, 16) : '',
                                                comment: selectedTable.reservation_comment || ''
                                            });
                                            setShowReservationForm(true);
                                        }}
                                        className={`px-3 py-2 rounded text-sm font-medium transition ${selectedTable.status === 'reserved' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}
                                    >
                                        Бронь
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Кнопки работы с заказом */}
                        {selectedTable.status === 'free' && canManageStatus && (
                            <div className="pt-2">
                                {openOrdersByTable.has(selectedTable.id) ? (
                                    // Стол формально «свободен», но на нём есть открытый
                                    // заказ (например, админ открыл счёт без смены или
                                    // статус стола рассинхронизирован) — показываем «подхват»
                                    <button
                                        onClick={handleOpenOrder}
                                        className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium"
                                    >
                                        Открыть заказ стола
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleCreateOrder}
                                        className="w-full px-4 py-2 bg-blueberry-600 text-white rounded-lg hover:bg-blueberry-700 transition font-medium"
                                    >
                                        Создать заказ
                                    </button>
                                )}
                            </div>
                        )}

                        {selectedTable.status === 'occupied' && canManageStatus && (
                            <div className="pt-2 space-y-2">
                                <button
                                    onClick={handleOpenOrder}
                                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium"
                                >
                                    Открыть заказ
                                </button>
                                {!openOrdersByTable.has(selectedTable.id) && (
                                    <p className="text-xs text-gray-500 text-center">
                                        Открытый заказ не найден — при нажатии будет создан новый.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Кнопки управления (только для админа) */}
                        {isAdmin && (
                            <div className="pt-4 border-t flex gap-2">
                                <button onClick={() => { setEditingTable(selectedTable); setSelectedTable(null); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                                    <Edit size={16} /> Редактировать
                                </button>
                                <button onClick={() => handleDeleteTable(selectedTable.id)} className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}

                        <button onClick={() => setSelectedTable(null)} className="w-full mt-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium">
                            Закрыть
                        </button>
                    </div>
                </Modal>
            )}

            {/* ===== МОДАЛКА: Форма брони ===== */}
            {showReservationForm && selectedTable && (
                <Modal isOpen={true} onClose={() => setShowReservationForm(false)} title={`Бронь стола #${selectedTable.number}`}>
                    <form onSubmit={handleReserveTable} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Имя гостя *</label>
                            <input type="text" value={reservationForm.name} onChange={(e) => setReservationForm({ ...reservationForm, name: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blueberry-500 focus:border-blueberry-500" required placeholder="Иван Иванов" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Телефон</label>
                            <input type="tel" value={reservationForm.phone} onChange={(e) => setReservationForm({ ...reservationForm, phone: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blueberry-500 focus:border-blueberry-500" placeholder="+7 (999) 123-45-67" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Время брони *</label>
                            <input type="datetime-local" value={reservationForm.time} onChange={(e) => setReservationForm({ ...reservationForm, time: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blueberry-500 focus:border-blueberry-500" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Комментарий</label>
                            <textarea value={reservationForm.comment} onChange={(e) => setReservationForm({ ...reservationForm, comment: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blueberry-500 focus:border-blueberry-500" rows={3} placeholder="Особые пожелания, количество гостей и т.д." />
                        </div>
                        <button type="submit" className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-medium">
                            {selectedTable.status === 'reserved' ? 'Обновить бронь' : 'Забронировать стол'}
                        </button>
                    </form>
                </Modal>
            )}

            {/* ===== МОДАЛКА: Добавить зал ===== */}
            <Modal isOpen={showAddZoneModal} onClose={() => setShowAddZoneModal(false)} title="Новый зал">
                <form onSubmit={handleAddZone} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Название зала</label>
                        <input type="text" value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" required placeholder="Например: Летняя веранда" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Порядок сортировки</label>
                        <input type="number" value={newZoneSort} onChange={(e) => setNewZoneSort(parseInt(e.target.value))} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                    </div>
                    <button type="submit" className="w-full px-4 py-2 bg-blueberry-600 text-white rounded-lg hover:bg-blueberry-700 transition">Создать зал</button>
                </form>
            </Modal>

            {/* ===== МОДАЛКА: Добавить стол ===== */}
            <Modal isOpen={showAddTableModal} onClose={() => setShowAddTableModal(false)} title="Новый стол">
                <form onSubmit={handleAddTable} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Номер стола</label>
                        <input type="text" value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" required placeholder="Например: 10" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Зал</label>
                        <select value={newTableZoneId} onChange={(e) => setNewTableZoneId(e.target.value ? parseInt(e.target.value) : '')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" required>
                            <option value="">Выберите зал</option>
                            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Вместимость (чел.)</label>
                        <input type="number" value={newTableCapacity} onChange={(e) => setNewTableCapacity(parseInt(e.target.value))} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" min="1" required />
                    </div>
                    <button type="submit" className="w-full px-4 py-2 bg-blueberry-600 text-white rounded-lg hover:bg-blueberry-700 transition">Создать стол</button>
                </form>
            </Modal>

            {/* ===== МОДАЛКА: Редактировать стол ===== */}
            {editingTable && (
                <Modal isOpen={true} onClose={() => setEditingTable(null)} title={`Редактировать стол #${editingTable.number}`}>
                    <form onSubmit={handleUpdateTable} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Номер стола</label>
                            <input type="text" value={editingTable.number} onChange={(e) => setEditingTable({ ...editingTable, number: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Зал</label>
                            <select value={editingTable.zone_id} onChange={(e) => setEditingTable({ ...editingTable, zone_id: parseInt(e.target.value) })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" required>
                                {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Вместимость (чел.)</label>
                            <input type="number" value={editingTable.capacity} onChange={(e) => setEditingTable({ ...editingTable, capacity: parseInt(e.target.value) })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" min="1" required />
                        </div>
                        <button type="submit" className="w-full px-4 py-2 bg-blueberry-600 text-white rounded-lg hover:bg-blueberry-700 transition">Сохранить</button>
                    </form>
                </Modal>
            )}

            {/* ===== МОДАЛКА: карточка заказа с меню из БД ===== */}
            {activeOrderId !== null && (
                <OrderDetailsModal
                    orderId={activeOrderId}
                    onClose={() => {
                        setActiveOrderId(null);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
};

export default TablesPage;