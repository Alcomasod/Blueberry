// src/pages/AnalyticsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, TrendingUp, Users, Receipt, Clock, Percent, Flame } from 'lucide-react';
import api from '../lib/api';
import { getApiErrorMessage } from '../lib/apiError';
import { useAuthStore } from '../store/authStore';

type Role = string;

interface ShiftSummary {
    total_orders: string;
    total_revenue: string;
    total_discounts: string;
    total_tips: string;
    average_check: string;
    tables_served: string;
    guests_total: string;
    staff_on_shift: string;
    cash_revenue: string;
    card_revenue: string;
}

interface MyStats {
    orders_count: string;
    revenue: string;
    avg_check: string;
    tables_served: string;
    guests_served: string;
    discounts_given: string;
    tips: string;
    hours_today: string;
    hours_30d: string;
    best_table: { table_number: string; total_amount: string } | null;
    avg_check_per_guest: string;
}

interface TopItem {
    menu_item_id: number;
    item_name: string;
    category_name: string;
    total_quantity: string;
    total_revenue: string;
}

interface TopWaiter {
    waiter_id: number;
    full_name: string;
    total_orders: string;
    total_revenue: string;
    average_check: string;
}

const fmtMoney = (v: unknown) => `${Math.round(Number(v ?? 0)).toLocaleString('ru-RU')} ₽`;
const fmtNum = (v: unknown) => Number(v ?? 0).toLocaleString('ru-RU');
const fmtHours = (v: unknown) => `${Number(v ?? 0).toFixed(1)} ч`;

// Специфика заведения: смена 13:00 → 04:00 следующего дня.
// "Операционный день" = дата, к которой относится смена (до 04:00 утра — ещё вчера).
function currentBusinessDate(): string {
    const now = new Date();
    if (now.getHours() < 4) now.setDate(now.getDate() - 1);
    return now.toISOString().slice(0, 10);
}

const Card = ({ title, value, hint, icon }: { title: string; value: string; hint?: string; icon?: React.ReactNode }) => (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            {icon}
            {title}
        </div>
        <p className="mt-2 text-2xl font-bold text-blueberry-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="mb-3 mt-6 text-lg font-semibold text-gray-800">{children}</h2>
);

const AnalyticsPage = () => {
    const user = useAuthStore((s) => s.user);
    const isAdmin = !!user && ['admin', 'director', 'sys_admin'].includes(user.role as Role);

    const [date, setDate] = useState<string>(currentBusinessDate());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const [summary, setSummary] = useState<ShiftSummary | null>(null);
    const [mine, setMine] = useState<MyStats | null>(null);
    const [topItems, setTopItems] = useState<TopItem[]>([]);
    const [topWaiters, setTopWaiters] = useState<TopWaiter[]>([]);
    const [hookah, setHookah] = useState<{ hookah_orders_count: string; flavors_quantity: string; hookah_revenue: string } | null>(null);

    // Диапазон для рейтингов: выбранная смена (13:00 → 04:00 след. дня)
    const range = useMemo(() => {
        const next = new Date(`${date}T12:00:00`);
        next.setDate(next.getDate() + 1);
        return { start: date, end: next.toISOString().slice(0, 10) };
    }, [date]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                // Личная статистика и рейтинг меню — всем ролям
                const tasks: Promise<unknown>[] = [
                    api.get('/analytics/my-shift', { params: { date } }),
                    api.get('/analytics/top-items', {
                        params: { start_date: `${range.start} 13:00:00`, end_date: `${range.end} 04:00:00` },
                    }),
                ];
                if (isAdmin) {
                    tasks.push(
                        api.get('/analytics/shift-summary', { params: { date } }),
                        api.get('/analytics/hookah-revenue', { params: { start_date: range.start, end_date: date } }),
                        api.get('/analytics/top-waiters', {
                            params: { start_date: `${range.start} 13:00:00`, end_date: `${range.end} 04:00:00` },
                        }),
                    );
                }
                const res = await Promise.all(tasks) as { data: { success: boolean; data: any } }[];
                if (cancelled) return;
                setMine(res[0].data.data);
                setTopItems(res[1].data.data);
                if (isAdmin) {
                    setSummary(res[2]?.data?.data ?? null);
                    setHookah(res[3]?.data?.data ?? null);
                    setTopWaiters(res[4]?.data?.data ?? []);
                }
            } catch (e) {
                if (!cancelled) setError(getApiErrorMessage(e, 'Не удалось загрузить аналитику'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [date, isAdmin, refreshKey, range]);

    return (
        <div className="mx-auto max-w-5xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-3xl font-bold text-gray-800">Аналитика</h1>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">Смена:</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => e.target.value && setDate(e.target.value)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                    <button
                        onClick={() => setRefreshKey((k) => k + 1)}
                        className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
                        title="Обновить"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>
            <p className="mt-1 text-xs text-gray-400">
                Учтён график работы заведения: смена считается с 13:00 выбранной даты до 04:00 следующего дня.
            </p>

            {loading && (
                <div className="mt-10 flex justify-center text-gray-400">
                    <Loader2 className="animate-spin" size={28} />
                </div>
            )}
            {error && !loading && (
                <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            )}

            {!loading && !error && (
                <>
                    {/* ─── Моя смена (все сотрудники) ─── */}
                    <SectionTitle>Моя смена — {user?.full_name}</SectionTitle>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <Card title="Выручка" value={fmtMoney(mine?.revenue)} icon={<TrendingUp size={14} />} />
                        <Card title="Столов обслужено" value={fmtNum(mine?.tables_served)} icon={<Receipt size={14} />} />
                        <Card title="Гостей обслужено" value={fmtNum(mine?.guests_served)} icon={<Users size={14} />} />
                        <Card title="Заказов закрыто" value={fmtNum(mine?.orders_count)} />
                        <Card title="Средний чек по столу" value={fmtMoney(mine?.avg_check)} />
                        <Card title="Средний чек по гостю" value={fmtMoney(mine?.avg_check_per_guest)} />
                        <Card title="Часов в этой смене" value={fmtHours(mine?.hours_today)} icon={<Clock size={14} />} hint="по открытым/закрытым сменам" />
                        <Card title="Часов за 30 дней" value={fmtHours(mine?.hours_30d)} icon={<Clock size={14} />} />
                    </div>
                    {(Number(mine?.discounts_given ?? 0) > 0 || mine?.best_table) && (
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                            {Number(mine?.discounts_given ?? 0) > 0 && (
                                <span className="flex items-center gap-1"><Percent size={14} /> Скидок выдано: {fmtMoney(mine?.discounts_given)}</span>
                            )}
                            {Number(mine?.tips ?? 0) > 0 && (
                                <span>Чаевые: {fmtMoney(mine?.tips)}</span>
                            )}
                            {mine?.best_table && (
                                <span>Лучший стол смены: №{mine.best_table.table_number ?? '—'} — {fmtMoney(mine.best_table.total_amount)}</span>
                            )}
                        </div>
                    )}

                    {/* ─── Рейтинг меню (все сотрудники) ─── */}
                    <SectionTitle>Рейтинг меню за смену</SectionTitle>
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-4 py-2">#</th>
                                    <th className="px-4 py-2">Блюдо / позиция</th>
                                    <th className="px-4 py-2">Категория</th>
                                    <th className="px-4 py-2 text-right">Продано</th>
                                    <th className="px-4 py-2 text-right">Выручка</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topItems.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Нет продаж за выбранную смену</td></tr>
                                )}
                                {topItems.slice(0, 10).map((it, i) => (
                                    <tr key={it.menu_item_id} className="border-t border-gray-100">
                                        <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                                        <td className="px-4 py-2 font-medium text-gray-800">{it.item_name}</td>
                                        <td className="px-4 py-2 text-gray-500">{it.category_name}</td>
                                        <td className="px-4 py-2 text-right">{fmtNum(it.total_quantity)}</td>
                                        <td className="px-4 py-2 text-right font-medium">{fmtMoney(it.total_revenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ─── Админ-блок ─── */}
                    {isAdmin && summary && (
                        <>
                            <SectionTitle>Заведение за смену</SectionTitle>
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                <Card title="Выручка со всех столов" value={fmtMoney(summary.total_revenue)} icon={<TrendingUp size={14} />}
                                      hint={`Наличные: ${fmtMoney(summary.cash_revenue)} · Карта: ${fmtMoney(summary.card_revenue)}`} />
                                <Card title="Сотрудников на смене" value={fmtNum(summary.staff_on_shift)} icon={<Users size={14} />} />
                                <Card title="Гостей за смену" value={fmtNum(summary.guests_total)} icon={<Users size={14} />} />
                                <Card title="Столов за смену" value={fmtNum(summary.tables_served)} icon={<Receipt size={14} />} />
                                <Card title="Средний чек" value={fmtMoney(summary.average_check)} />
                                <Card title="Скидок начислено" value={fmtMoney(summary.total_discounts)} icon={<Percent size={14} />} />
                                <Card title="Чаевые" value={fmtMoney(summary.total_tips)} />
                                <Card title="Заказов оплачено" value={fmtNum(summary.total_orders)} />
                            </div>

                            {hookah && (
                                <div className="mt-4 flex flex-wrap items-center gap-6 rounded-xl border border-orange-100 bg-orange-50 p-4 text-sm text-gray-700">
                                    <span className="flex items-center gap-2 font-semibold text-orange-700"><Flame size={16} /> Кальяны</span>
                                    <span>Заказов: <b>{fmtNum(hookah.hookah_orders_count)}</b></span>
                                    <span>Вкусов забито: <b>{fmtNum(hookah.flavors_quantity)}</b></span>
                                    <span>Выручка: <b>{fmtMoney(hookah.hookah_revenue)}</b></span>
                                </div>
                            )}

                            <SectionTitle>Рейтинг официантов за смену</SectionTitle>
                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                                        <tr>
                                            <th className="px-4 py-2">#</th>
                                            <th className="px-4 py-2">Официант</th>
                                            <th className="px-4 py-2 text-right">Заказов</th>
                                            <th className="px-4 py-2 text-right">Выручка</th>
                                            <th className="px-4 py-2 text-right">Средний чек</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topWaiters.length === 0 && (
                                            <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Нет данных за выбранную смену</td></tr>
                                        )}
                                        {topWaiters.map((w, i) => (
                                            <tr key={w.waiter_id} className="border-t border-gray-100">
                                                <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                                                <td className="px-4 py-2 font-medium text-gray-800">{w.full_name}</td>
                                                <td className="px-4 py-2 text-right">{fmtNum(w.total_orders)}</td>
                                                <td className="px-4 py-2 text-right font-medium">{fmtMoney(w.total_revenue)}</td>
                                                <td className="px-4 py-2 text-right">{fmtMoney(w.average_check)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default AnalyticsPage;
