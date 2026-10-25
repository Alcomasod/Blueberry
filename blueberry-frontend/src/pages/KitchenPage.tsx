// src/pages/KitchenPage.tsx
// Экран «Кухня / Бар» (KDS — Kitchen Display System).
// В отличие от раздела «Заказы» (POS: деньги и столы), здесь важна только
// производственная логика: какие позиции готовить, сколько времени прошло,
// что готово к выдаче. Цены и способы оплаты тут сознательно НЕ показываются.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api';
import { getApiErrorMessage } from '../lib/apiError';
import { useAuthStore } from '../store/authStore';

type KdsStatus = 'new' | 'preparing' | 'ready' | 'served';

interface KdsItem {
    id: number;
    order_id: number;
    table_number: string | null;
    zone_name: string | null;
    order_created_at: string;
    name: string;
    quantity: number;
    comment: string | null;
    created_at: string;
    status: KdsStatus;
    preparing_at: string | null;
    station: string;
}

interface Board {
    active: KdsItem[];
    ready: KdsItem[];
}

const STATUS_LABELS: Record<KdsStatus, string> = {
    new: 'В ожидании',
    preparing: 'Готовится',
    ready: 'Готово к выдаче',
    served: 'Выдано',
};

const STATION_META: Record<string, { label: string; icon: string }> = {
    kitchen: { label: 'Кухня', icon: '🍳' },
    bar: { label: 'Бар', icon: '🍹' },
    breakage: { label: 'Бой посуды', icon: '🍽️' },
    extras: { label: 'Допы', icon: '➕' },
};

// Таймер: человекочитаемое «mm:ss» / «H:mm:ss» с момента t0
function elapsedSince(iso: string, now: number): string {
    const sec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

const REFRESH_MS = 5000;      // опрос доски каждые 5 секунд
const SOFT_LIMIT_SEC = 5 * 60; // жёлтый таймер
const HARD_LIMIT_SEC = 10 * 60; // красный таймер

// Право управлять статусами: кухня, бар, кальянный мастер и администраторы+
// (совпадает с бэкендом: пермишен MANAGE_HOOKAH_ORDERS)
const KDS_MANAGE_ROLES = ['kitchen', 'hookah_bar', 'hookah_master', 'admin', 'director', 'sys_admin'];

/**
 * Fallback-определение роли из JWT без проверки подписи — только для UI-границ
 * доступа (например, если профиль в localStorage пришёл со старой версии фронта).
 * Реальную безопасность по-прежнему обеспечивает бэкенд.
 */
function getRoleFallback(user: { role?: string } | null | undefined): string | null {
    if (user?.role) return user.role;
    try {
        const token: string | null = useAuthStore.getState().token;
        if (!token) return null;
        const payloadB64 = token.split('.')[1];
        if (!payloadB64) return null;
        const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
        const parsed = JSON.parse(json) as { role?: string };
        return parsed.role ?? null;
    } catch {
        return null;
    }
}

interface FlashMessage {
    text: string;
    type: 'error' | 'success';
    id: number;
}

const KitchenPage = () => {
    const user = useAuthStore((s) => s.user);
    const [board, setBoard] = useState<Board>({ active: [], ready: [] });
    const [error, setError] = useState<string | null>(null);
    const [stationFilter, setStationFilter] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(Date.now());
    const busyRef = useRef<Set<number>>(new Set());
    const [flash, setFlash] = useState<FlashMessage | null>(null);

    // Право менять статусы: роль из профиля, при отсутствии — fallback из JWT
    const effectiveRole = getRoleFallback(user);
    const canManage = !!effectiveRole && KDS_MANAGE_ROLES.includes(effectiveRole);

    // Всплывающее уведомление с таймером (не исчезает при перерисовке часов)
    const showFlash = (text: string, type: FlashMessage['type']) => {
        setFlash({ text, type, id: Date.now() });
    };
    useEffect(() => {
        if (!flash) return;
        const t = setTimeout(() => setFlash(null), 6000);
        return () => clearTimeout(t);
    }, [flash]);

    const fetchBoard = useCallback(async () => {
        try {
            const res = await api.get('/kds/board');
            setBoard(res.data.data as Board);
            setError(null);
        } catch (err) {
            setError(getApiErrorMessage(err, 'Не удалось загрузить доску кухни'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBoard();
        const timer = setInterval(fetchBoard, REFRESH_MS);
        const clock = setInterval(() => setNow(Date.now()), 1000);
        return () => {
            clearInterval(timer);
            clearInterval(clock);
        };
    }, [fetchBoard]);

    const changeStatus = async (item: KdsItem, next: KdsStatus) => {
        if (busyRef.current.has(item.id)) return;
        busyRef.current.add(item.id);
        // Оптимистичный перевод
        setBoard((prev) => {
            const move = (list: KdsItem[]) => list.map((i) =>
                i.id === item.id ? { ...i, status: next, preparing_at: next === 'preparing' && !i.preparing_at ? new Date().toISOString() : i.preparing_at } : i
            );
            const active = [...move(prev.active), ...move(prev.ready)];
            if (next === 'ready') {
                return { active: active.filter(i => i.status !== 'ready'), ready: active.filter(i => i.status === 'ready') };
            }
            return { active: active.filter(i => i.status !== 'ready'), ready: active.filter(i => i.status === 'ready') };
        });
        try {
            await api.patch(`/kds/items/${item.id}/status`, { status: next });
            showFlash(`«${item.name}»: ${STATUS_LABELS[next]}`, 'success');
        } catch (err) {
            showFlash(getApiErrorMessage(err, 'Не удалось изменить статус'), 'error');
        } finally {
            busyRef.current.delete(item.id);
            fetchBoard();
        }
    };

    const stations = useMemo(() => {
        const all = [...board.active, ...board.ready];
        const set = new Set(all.map(i => i.station));
        return Array.from(set).sort();
    }, [board]);

    const applyFilter = (list: KdsItem[]) =>
        stationFilter === 'all' ? list : list.filter(i => i.station === stationFilter);

    const activeItems = applyFilter(board.active);
    const readyItems = applyFilter(board.ready);

    const cardClass = (status: KdsStatus, createdAt: string) => {
        const sec = (now - new Date(createdAt).getTime()) / 1000;
        const base = 'rounded-xl border-2 bg-white p-4 shadow-sm flex flex-col gap-2 transition-colors';
        if (status === 'ready') return `${base} border-emerald-400 bg-emerald-50`;
        if (sec > HARD_LIMIT_SEC) return `${base} border-red-400 bg-red-50`;
        if (sec > SOFT_LIMIT_SEC) return `${base} border-amber-400 bg-amber-50`;
        return `${base} border-gray-200`;
    };

    const renderCard = (item: KdsItem) => {
        const timerFrom = item.status === 'preparing' && item.preparing_at ? item.preparing_at : item.created_at;
        const meta = STATION_META[item.station] || { label: item.station, icon: '📦' };
        return (
            <div key={item.id} className={cardClass(item.status, item.created_at)}>
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <span className="inline-block rounded-md bg-blueberry-900 px-2 py-0.5 text-sm font-bold text-white">
                            Стол {item.table_number ?? '—'}
                        </span>
                        {item.zone_name && <span className="ml-2 text-xs text-gray-500">{item.zone_name}</span>}
                    </div>
                    <span className="text-lg font-mono font-semibold tabular-nums" title="Время с момента создания/взятия в работу">
                        ⏱ {elapsedSince(timerFrom, now)}
                    </span>
                </div>

                <div className="text-base font-bold leading-tight text-gray-900">
                    {item.name}
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-sm font-bold text-gray-700">×{item.quantity}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{meta.icon} {meta.label}</span>
                    <span className={`rounded-full px-2 py-0.5 font-medium ${
                        item.status === 'new' ? 'bg-gray-200 text-gray-700'
                            : item.status === 'preparing' ? 'bg-amber-200 text-amber-800'
                            : 'bg-emerald-200 text-emerald-800'}`}>
                        {STATUS_LABELS[item.status]}
                    </span>
                </div>

                {item.comment && (
                    <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                        📝 {item.comment}
                    </div>
                )}

                {canManage && (
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                        {item.status === 'new' && (
                            <button
                                onClick={() => changeStatus(item, 'preparing')}
                                className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white hover:bg-amber-600"
                            >
                                ▶ В работу
                            </button>
                        )}
                        {item.status === 'preparing' && (
                            <>
                                <button
                                    onClick={() => changeStatus(item, 'new')}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                                    title="Вернуть в ожидание"
                                >
                                    ↩
                                </button>
                                <button
                                    onClick={() => changeStatus(item, 'ready')}
                                    className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-600"
                                >
                                    ✓ Готово
                                </button>
                            </>
                        )}
                        {item.status === 'ready' && (
                            <>
                                <button
                                    onClick={() => changeStatus(item, 'preparing')}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                                    title="Вернуть в работу"
                                >
                                    ↩
                                </button>
                                <button
                                    onClick={() => changeStatus(item, 'served')}
                                    className="flex-1 rounded-lg bg-blueberry-600 px-3 py-2 text-sm font-bold text-white hover:bg-blueberry-700"
                                >
                                    🤵 Выдано официанту
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-4 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">👨‍🍳 Кухня / Бар</h1>
                    <p className="text-sm text-gray-500">
                        Производство заказов · обновление каждые {REFRESH_MS / 1000} сек
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={stationFilter}
                        onChange={(e) => setStationFilter(e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueberry-400"
                    >
                        <option value="all">Все станции</option>
                        {stations.map((st) => {
                            const meta = STATION_META[st] || { label: st, icon: '📦' };
                            return <option key={st} value={st}>{meta.icon} {meta.label}</option>;
                        })}
                    </select>
                    <button
                        onClick={fetchBoard}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                        title="Обновить сейчас"
                    >
                        ⟳
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    ⚠️ {error}
                </div>
            )}

            {/* Всплывающее уведомление о последнем действии — видно несколько секунд */}
            {flash && (
                <div
                    className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-semibold shadow-lg transition-all ${
                        flash.type === 'error'
                            ? 'border border-red-300 bg-red-600 text-white'
                            : 'border border-emerald-300 bg-emerald-600 text-white'
                    }`}
                    role="status"
                    onClick={() => setFlash(null)}
                >
                    {flash.type === 'error' ? '⛔ ' : '✅ '}
                    {flash.text}
                    <span className="ml-2 opacity-70">(нажмите, чтобы скрыть)</span>
                </div>
            )}

            {loading ? (
                <div className="py-20 text-center text-gray-400">Загрузка доски…</div>
            ) : (
                <>
                    {/* Готовые к выдаче — сверху, крупно */}
                    {readyItems.length > 0 && (
                        <section className="mb-6">
                            <h2 className="mb-2 text-lg font-bold text-emerald-700">
                                ✅ Готово к выдаче ({readyItems.length})
                            </h2>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {readyItems.map(renderCard)}
                            </div>
                        </section>
                    )}

                    {/* Активные: новые + готовые */}
                    <section>
                        <h2 className="mb-2 text-lg font-bold text-gray-700">
                            🔥 В работе ({activeItems.length})
                        </h2>
                        {activeItems.length === 0 && readyItems.length === 0 ? (
                            <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center text-gray-400">
                                Нет активных заказов. Как только официант создаст заказ, позиции появятся здесь.
                            </div>
                        ) : activeItems.length === 0 ? (
                            <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center text-gray-400">
                                Новых позиций нет — все готовые ждут выдачи официантом.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {activeItems.map(renderCard)}
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export default KitchenPage;
