// src/components/OrderDetailsModal.tsx
import { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { getApiErrorMessage } from '../lib/apiError';
import { formatAmount } from '../lib/format';
import { buildCatalog, type CatalogCategory, type FlatMenuItem } from '../lib/menuTree';
import { Plus, Minus, Trash2, CreditCard, Search, Loader2, History, Check, UserPlus, Users, X } from 'lucide-react';
import Modal from './Modal';
import PaymentModal from './PaymentModal';

interface OrderDetailsModalProps {
    orderId: number;
    isOpen?: boolean;
    onClose: () => void;
}

interface OrderItem {
    id: number;
    item_name: string;
    quantity: number;
    price_at_sale: number | string;
    line_total: number | string;
    comment?: string | null;
    guest_id?: number | null;
    guest_name?: string | null;
}

// Гость за столом (раздельный счёт, персональные скидки)
interface OrderGuest {
    id: number;
    order_id: number;
    name: string | null;
    discount_percent: number;
    items_total: string;
    discount_amount: string;
    to_pay: string;
    items_count: number;
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
    total_amount: number | string;
    comment?: string | null;
    items: OrderItem[];
}

export default function OrderDetailsModal({ orderId, isOpen = true, onClose }: OrderDetailsModalProps) {
    const [order, setOrder] = useState<Order | null>(null);
    const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<OrderHistoryEntry[]>([]);
    const [orderComment, setOrderComment] = useState('');
    const [commentDirty, setCommentDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    // Сообщение «Заказ сохранён» после нажатия кнопки «Сохранить»
    const [savedFlash, setSavedFlash] = useState<string | null>(null);
    // Модалка подтверждения оплаты (вместо мгновенной оплаты по кнопке)
    const [showPayModal, setShowPayModal] = useState(false);
    // Гости за столом: раздельный счёт и персональные скидки (макс. 16 — лимит на бэкенде)
    const MAX_GUESTS = 16;
    const [guests, setGuests] = useState<OrderGuest[]>([]);
    const [activeGuestId, setActiveGuestId] = useState<number | null>(null);
    const [guestBusy, setGuestBusy] = useState(false);

    const fetchData = async () => {
        try {
            const [ordersRes, menuRes] = await Promise.all([
                api.get(`/orders/${orderId}`),
                api.get('/menu'),
            ]);
            const o = ordersRes.data.data as Order;
            setOrder(o);
            // buildCatalog принимает сырое дерево категорий из ответа /api/menu
            setCatalog(buildCatalog(menuRes.data.data));
            // синхронизируем поле комментария, если пользователь ещё не редактировал его
            setOrderComment((prev) => (commentDirty ? prev : o.comment ?? ''));
            // список гостей (старые сборки бэкенда могут не иметь эндпоинта — не блокируем работу)
            try {
                const gRes = await api.get(`/orders/${orderId}/guests`);
                let list = (gRes.data.data?.guests ?? []) as OrderGuest[];
                // При открытии заказа хотя бы один гость должен присутствовать всегда
                if (list.length === 0) {
                    try {
                        await api.post(`/orders/${orderId}/guests`, {});
                        const gRes2 = await api.get(`/orders/${orderId}/guests`);
                        list = (gRes2.data.data?.guests ?? []) as OrderGuest[];
                    } catch { /* не блокируем работу модалки */ }
                }
                setGuests(list);
                setActiveGuestId((prev) => (prev && list.some((g) => g.id === prev) ? prev : (list[0]?.id ?? null)));
            } catch {
                setGuests([]);
            }
        } catch (err) {
            alert(getApiErrorMessage(err, 'Не удалось загрузить заказ'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId, isOpen]);

    const filteredCatalog = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return catalog;
        return catalog
            .map((cat) => ({ ...cat, items: cat.items.filter((mi) => mi.name.toLowerCase().includes(q)) }))
            .filter((cat) => cat.items.length > 0);
    }, [catalog, search]);

    const visibleCategories = useMemo(
        () =>
            activeCategory === 'all'
                ? filteredCatalog
                : filteredCatalog.filter((c) => c.key === activeCategory),
        [filteredCatalog, activeCategory],
    );

    const handleRemoveItem = async (itemId: number) => {
        if (!confirm('Удалить позицию?')) return;
        try {
            await api.delete(`/orders/${orderId}/items/${itemId}`);
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка удаления позиции'));
        }
    };

    const handleAddItem = async (item: FlatMenuItem, guestId: number | null = activeGuestId) => {
        try {
            await api.post(`/orders/${orderId}/items`, {
                menu_item_id: item.id,
                quantity: 1,
                guest_id: guestId ?? undefined,
            });
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка добавления позиции'));
        }
    };

    // ===== Гости за столом (раздельный счёт, персональные скидки) =====
    const guestLabel = (g: OrderGuest, idx: number) => g.name?.trim() || `Гость ${idx + 1}`;

    const handleAddGuest = async (e?: React.MouseEvent) => {
        // Защита от дефолтного поведения формы (переход браузера на /api/tables)
        e?.preventDefault();
        e?.stopPropagation();
        if (guests.length >= MAX_GUESTS) return;
        setGuestBusy(true);
        try {
            const res = await api.post(`/orders/${orderId}/guests`, {});
            const newId = (res.data.data as OrderGuest)?.id ?? null;
            if (newId) setActiveGuestId(newId);
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Не удалось добавить гостя'));
        } finally {
            setGuestBusy(false);
        }
    };

    const handleRenameGuest = async (guest: OrderGuest, name: string) => {
        try {
            await api.patch(`/orders/${orderId}/guests/${guest.id}`, { name });
            setGuests((prev) => prev.map((g) => (g.id === guest.id ? { ...g, name } : g)));
        } catch (err) {
            alert(getApiErrorMessage(err, 'Не удалось переименовать гостя'));
        }
    };

    const handleDiscountChange = async (guest: OrderGuest, discountPercent: number) => {
        const clamped = Math.max(0, Math.min(100, Math.round(discountPercent || 0)));
        try {
            await api.patch(`/orders/${orderId}/guests/${guest.id}`, { discount_percent: clamped });
            setGuests((prev) => prev.map((g) => (g.id === guest.id ? { ...g, discount_percent: clamped } : g)));
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Не удалось установить скидку'));
        }
    };

    const handleRemoveGuest = async (guest: OrderGuest) => {
        if (!confirm(`Удалить «${guestLabel(guest, guests.indexOf(guest))}»? Его позиции останутся в заказе как общие.`)) return;
        setGuestBusy(true);
        try {
            await api.delete(`/orders/${orderId}/guests/${guest.id}`);
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Не удалось удалить гостя'));
        } finally {
            setGuestBusy(false);
        }
    };

    // Перенос позиции между гостями (или обратно в «общие»)
    const handleAssignGuest = async (itemId: number, guestId: number | null) => {
        const it = order?.items.find((i) => i.id === itemId);
        if (!it) return;
        try {
            await api.patch(`/orders/${orderId}/items/${itemId}`, { quantity: it.quantity, guest_id: guestId });
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Не удалось перенести позицию'));
        }
    };

    const handleQtyChange = async (itemId: number, delta: number) => {
        const it = order?.items.find((i) => i.id === itemId);
        if (!it) return;
        const newQty = it.quantity + delta;
        if (newQty <= 0) {
            await handleRemoveItem(itemId);
            return;
        }
        try {
            await api.patch(`/orders/${orderId}/items/${itemId}`, { quantity: newQty });
            await fetchData();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка обновления количества'));
        }
    };

    // Сохранение заказа (комментарий): кнопка активна всегда, после успешного
    // сохранения показываем сообщение «Заказ сохранён» и закрываем модалку.
    const handleSaveOrder = async ({ closeAfter = true }: { closeAfter?: boolean } = {}) => {
        setSaving(true);
        try {
            if (commentDirty) {
                await api.patch(`/orders/${orderId}/comment`, { comment: orderComment });
                setCommentDirty(false);
            }
            if (closeAfter) {
                setSavedFlash('Заказ сохранён');
                window.setTimeout(() => onClose(), 900);
            }
            return true;
        } catch (err) {
            alert(getApiErrorMessage(err, 'Не удалось сохранить заказ'));
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handlePayOrder = async () => {
        setShowPayModal(true);
    };

    // Оплата из модалки подтверждения — через основной эндпоинт POST /orders/:id/pay
    // (начисление баллов, освобождение стола и т.д. на бэкенде).
    const confirmPaymentFromDetails = async () => {
        try {
            await api.post(`/orders/${orderId}/pay`, {
                payment_method: 'card',
                tip_amount: 0,
                discount_amount: 0,
            });
            onClose();
        } catch (err) {
            // Fallback для старых сборок бэкенда: PATCH статуса (как было раньше)
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 404) {
                try {
                    await api.patch(`/orders/${orderId}`, { status: 'paid' });
                    onClose();
                    return;
                } catch { /* падаем в общее сообщение об ошибке */ }
            }
            alert(getApiErrorMessage(err, 'Ошибка оплаты заказа'));
        }
    };

    const fetchHistory = async () => {
        setShowHistory((v) => !v);
        if (history.length === 0) {
            try {
                const res = await api.get(`/orders/${orderId}/history`);
                setHistory(res.data.data as OrderHistoryEntry[]);
            } catch (err) {
                alert(getApiErrorMessage(err, 'История недоступна'));
            }
        }
    };

    const total = useMemo(
        () => (order?.items ?? []).reduce((sum, i) => sum + Number(i.line_total), 0),
        [order],
    );

    // Сумма «общих» позиций (не привязанных ни к одному гостю)
    const sharedTotal = useMemo(
        () => (order?.items ?? []).filter((i) => !i.guest_id).reduce((s, i) => s + Number(i.line_total), 0),
        [order],
    );

    // ===== Секция «Гости за столом»: раздельный счёт и персональные скидки =====
    const guestsSection = (
        <div className="rounded-md border border-gray-200 p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                    <Users size={15} /> Гости за столом ({guests.length}/{MAX_GUESTS})
                </h3>
                <button
                    type="button"
                    onClick={handleAddGuest}
                    disabled={guests.length >= MAX_GUESTS || guestBusy}
                    title={guests.length >= MAX_GUESTS ? `Максимум ${MAX_GUESTS} гостей` : 'Добавить гостя'}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blueberry-600 text-white text-xs font-medium hover:bg-blueberry-700 transition disabled:opacity-40"
                >
                    {guestBusy ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} Добавить гостя
                </button>
            </div>

            {guests.length === 0 ? (
                <p className="text-xs text-gray-400">
                    Гостей пока нет — все позиции считаются общими. Добавьте гостя, чтобы вести раздельный счёт и назначать персональные скидки.
                </p>
            ) : (
                <div className="space-y-2">
                    {guests.map((g, idx) => {
                        const isActive = g.id === activeGuestId;
                        return (
                            <div
                                key={g.id}
                                className={`rounded-md border p-2 transition ${isActive ? 'border-blueberry-500 bg-blueberry-50/60 ring-1 ring-blueberry-200' : 'border-gray-200'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setActiveGuestId(isActive ? null : g.id)}
                                      title={isActive ? 'Выключить: блюда добавляются в общий список' : 'Включить: новые блюда оформляются на этого гостя'}
                                      className={`shrink-0 w-2.5 h-2.5 rounded-full border ${isActive ? 'bg-blueberry-600 border-blueberry-600' : 'bg-white border-gray-400'}`}
                                    />
                                    <input
                                        defaultValue={g.name ?? ''}
                                        placeholder={guestLabel(g, idx)}
                                        onBlur={(e) => {
                                            const v = e.target.value.trim();
                                            if (v !== (g.name ?? '')) handleRenameGuest(g, v);
                                        }}
                                        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium hover:border-gray-300 focus:border-blueberry-500 focus:ring-1 focus:ring-blueberry-500 focus:bg-white outline-none"
                                    />
                                    <span className="text-[11px] text-gray-500 shrink-0">{g.items_count} поз.</span>
                                    <label className="flex items-center gap-1 text-xs text-gray-600 shrink-0" title="Персональная скидка, %">
                                        Скидка
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={g.discount_percent}
                                            onChange={(e) => setGuests((prev) => prev.map((x) => (x.id === g.id ? { ...x, discount_percent: parseInt(e.target.value, 10) || 0 } : x)))}
                                            onBlur={(e) => handleDiscountChange(g, parseInt(e.target.value, 10) || 0)}
                                            className="w-12 rounded border border-gray-300 px-1 py-0.5 text-xs text-right"
                                        />
                                        %
                                    </label>
                                    <span className="w-24 text-right text-sm shrink-0">
                                        {Number(g.discount_amount) > 0 ? (
                                            <>
                                                <s className="text-gray-400 text-xs mr-1">{formatAmount(Number(g.items_total))}</s>
                                                <b className="text-green-700">{formatAmount(Number(g.to_pay))} р</b>
                                            </>
                                        ) : (
                                            <b>{formatAmount(Number(g.items_total))} р</b>
                                        )}
                                    </span>
                                    <button type="button" onClick={() => handleRemoveGuest(g)} className="p-1 text-red-500 hover:bg-red-50 rounded shrink-0" title="Удалить гостя (позиции станут общими)">
                                        <X size={14} />
                                    </button>
                                </div>
                                {isActive && (
                                    <p className="mt-1 pl-4 text-[11px] text-blueberry-700">Активен — новые блюда из каталога оформляются на этого гостя.</p>
                                )}
                            </div>
                        );
                    })}
                    {sharedTotal > 0 && (
                        <p className="text-[11px] text-gray-500">Общие позиции (без гостя): <b>{formatAmount(sharedTotal)} р</b></p>
                    )}
                </div>
            )}
        </div>
    );

    // ===== Макет: слева — карточка заказа, справа — каталог меню (при открытом «Добавить блюдо») =====
    const catalogPanel = showAddPanel ? (
        <div className="border border-gray-200 rounded-md p-3 space-y-3 bg-gray-50/60">
            {guests.length > 0 && (
                <p className="text-xs text-gray-500">
                    Новые блюда оформляются на: <b className="text-blueberry-700">{activeGuestId ? guestLabel(guests.find((g) => g.id === activeGuestId)!, guests.findIndex((g) => g.id === activeGuestId)) : 'общий счёт'}</b> — выберите гостя в блоке «Гости за столом», чтобы привязать заказ к конкретному человеку.
                </p>
            )}
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
                    type="button"
                    onClick={() => setActiveCategory('all')}
                    className={`px-2 py-1 rounded-full text-xs ${activeCategory === 'all' ? 'bg-blueberry-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >Все</button>
                {catalog.map((c) => (
                    <button
                        key={c.key}
                        type="button"
                        onClick={() => setActiveCategory(c.key)}
                        className={`px-2 py-1 rounded-full text-xs ${activeCategory === c.key ? 'bg-blueberry-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >{c.name}</button>
                ))}
            </div>
            <div className="max-h-[calc(90vh-14rem)] overflow-y-auto space-y-3">
                {visibleCategories.map((cat) => (
                    <div key={cat.key}>
                        <p className="text-xs font-semibold text-gray-500 mb-1">{cat.name}</p>
                        <div className="grid grid-cols-1 gap-1">
                            {cat.items.map((mi) => (
                                <button
                                    key={mi.id}
                                    type="button"
                                    onClick={() => handleAddItem(mi, activeGuestId)}
                                    title={mi.composition ? `Состав: ${mi.composition}` : undefined}
                                    className="text-left px-2 py-1.5 rounded hover:bg-blueberry-50 text-sm flex justify-between gap-2"
                                >
                                    <span className="truncate">{mi.name}</span>
                                    <span className="text-gray-500 shrink-0">{formatAmount(mi.price)} р</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    ) : null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size={showAddPanel ? 'full' : 'xl'}
            title={order ? `Заказ №${order.id} · Стол ${order.table_number} (${order.zone_name})` : 'Заказ'}
        >
            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin text-blueberry-600" size={32} />
                </div>
            ) : (
                <div className={showAddPanel ? 'flex gap-4 items-start' : 'space-y-4'}>
                <form
                    className={showAddPanel ? 'flex-1 min-w-0 space-y-4' : 'space-y-4'}
                    onSubmit={(e) => { e.preventDefault(); handleSaveOrder({ closeAfter: false }); }}
                >
                    {/* Гости за столом */}
                    {guestsSection}

                    {/* Позиции */}
                    <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Позиции</h3>
                        {order && order.items.length > 0 ? (
                            <ul className="divide-y divide-gray-100">
                                {(() => {
                                    // Группировка позиций по гостям (item 3): секция на гостя + общие позиции
                                    const sections: Array<{ key: string; title: string; items: OrderItem[] }> = [];
                                    if (guests.length > 0) {
                                        guests.forEach((g, gi) => {
                                            const gItems = order.items.filter((i) => i.guest_id === g.id);
                                            if (gItems.length > 0) {
                                                sections.push({ key: `g-${g.id}`, title: guestLabel(g, gi), items: gItems });
                                            }
                                        });
                                        const shared = order.items.filter((i) => !i.guest_id);
                                        if (shared.length > 0) sections.push({ key: 'shared', title: 'Общие позиции', items: shared });
                                    } else {
                                        sections.push({ key: 'all', title: '', items: order.items });
                                    }
                                    return sections.map((sec) => (
                                <li key={sec.key} className="py-2">
                                {sec.title ? (
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{sec.title}</p>
                                ) : null}
                                <ul className="divide-y divide-gray-50">
                                {sec.items.map((it) => (
                                    <li key={it.id} className="py-2 flex items-center gap-2">
                                        <span className="flex-1 text-sm min-w-0">
                                            {it.item_name}
                                            {it.comment ? <em className="ml-1 text-xs text-gray-500">({it.comment})</em> : null}
                                        </span>
                                        {guests.length > 0 && (
                                            <select
                                                value={it.guest_id ?? ''}
                                                onChange={(e) => handleAssignGuest(it.id, e.target.value === '' ? null : parseInt(e.target.value, 10))}
                                                title="Гость, на которого оформлена позиция"
                                                className="shrink-0 max-w-[9rem] rounded border border-gray-300 px-1 py-0.5 text-xs bg-white"
                                            >
                                                <option value="">Общая</option>
                                                {guests.map((g, gi) => (
                                                    <option key={g.id} value={g.id}>{guestLabel(g, gi)}</option>
                                                ))}
                                            </select>
                                        )}
                                        <button onClick={() => handleQtyChange(it.id, -1)} className="p-1 rounded hover:bg-gray-100"><Minus size={14} /></button>
                                        <span className="w-8 text-center text-sm font-medium">{it.quantity}</span>
                                        <button onClick={() => handleQtyChange(it.id, 1)} className="p-1 rounded hover:bg-gray-100"><Plus size={14} /></button>
                                        <span className="w-20 text-right text-sm">{formatAmount(Number(it.line_total))} р</span>
                                        <button type="button" onClick={() => handleRemoveItem(it.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                                    </li>
                                ))}
                                </ul>
                                </li>
                                    ));
                                })()}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-400">Позиций пока нет — добавьте блюда из каталога.</p>
                        )}
                    </div>

                    {/* Итого */}
                    <div className="rounded-md bg-blueberry-50 px-3 py-2 flex justify-between font-bold text-blueberry-900">
                        <span>Итого</span>
                        <span>{formatAmount(total)} р</span>
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

                    {/* Большая кнопка СОХРАНИТЬ (активна всегда) */}
                    <button
                        type="submit"
                        onClick={() => handleSaveOrder()}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blueberry-600 text-white text-base font-bold rounded-lg hover:bg-blueberry-700 transition disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />} Сохранить
                    </button>

                    {/* Сообщение об успешном сохранении */}
                    {savedFlash && (
                        <div className="fixed inset-x-0 top-4 z-[100] flex justify-center pointer-events-none">
                            <div className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
                                <Check size={16} /> {savedFlash}
                            </div>
                        </div>
                    )}

                    {/* Ряд дополнительных действий */}
                    <div className="flex gap-2">
                        <button type="button" onClick={fetchHistory} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm">
                            <History size={16} /> История
                        </button>
                        <button type="button" onClick={() => setShowAddPanel((v) => !v)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md bg-green-100 text-green-800 hover:bg-green-200 text-sm">
                            <Plus size={16} /> {showAddPanel ? 'Скрыть меню' : 'Добавить блюдо'}
                        </button>
                        <button type="button" onClick={handlePayOrder} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md bg-blueberry-100 text-blueberry-800 hover:bg-blueberry-200 text-sm">
                            <CreditCard size={16} /> Оплатить
                        </button>
                    </div>
                </form>

                {/* Каталог меню — справа от основной карточки заказа */}
                {catalogPanel && (
                    <div className="w-[400px] shrink-0 sticky top-0" onClick={(e) => e.stopPropagation()}>
                        {catalogPanel}
                    </div>
                )}
                </div>
            )}

            {/* Модалка подтверждения оплаты (замена мгновенной оплаты по кнопке) */}
            {showPayModal && (
                <PaymentModal
                    orderId={orderId}
                    orderLabel={order ? `Стол #${order.table_number} (заказ №${orderId})` : `№${orderId}`}
                    amount={formatAmount(total)}
                    mode="pay"
                    onClose={() => setShowPayModal(false)}
                    onSuccess={confirmPaymentFromDetails}
                />
            )}
        </Modal>
    );
}