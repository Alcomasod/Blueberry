// src/pages/DashboardPage.tsx
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../lib/api';
import { getApiErrorMessage } from '../lib/apiError';
import { useAuthStore } from '../store/authStore';
import {
    Megaphone, Plus, Trash2, RefreshCw, AlertTriangle, Info, Octagon, Users
} from 'lucide-react';
import Modal from '../components/Modal';

interface Announcement {
    id: number;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'stoplist';
    is_active: boolean;
    created_at: string;
    author_name?: string;
}

const TYPE_STYLES: Record<Announcement['type'], { badge: string; box: string; icon: ReactNode; label: string }> = {
    info: {
        badge: 'bg-blue-100 text-blue-700',
        box: 'border-blue-200 bg-blue-50',
        icon: <Info size={18} className="text-blue-600" />,
        label: 'Информация',
    },
    warning: {
        badge: 'bg-yellow-100 text-yellow-700',
        box: 'border-yellow-300 bg-yellow-50',
        icon: <AlertTriangle size={18} className="text-yellow-600" />,
        label: 'Внимание',
    },
    stoplist: {
        badge: 'bg-red-100 text-red-700',
        box: 'border-red-300 bg-red-50',
        icon: <Octagon size={18} className="text-red-600" />,
        label: 'СТОП-ЛИСТ',
    },
};

const DashboardPage = () => {
    const { user } = useAuthStore();
    // Оставлять записи могут только администраторы (admin / director / sys_admin)
    const isAdmin = !!user?.role && ['sys_admin', 'director', 'admin'].includes(user.role);

    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Модалка создания записи
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [form, setForm] = useState({ title: '', message: '', type: 'info' as Announcement['type'] });
    const [saving, setSaving] = useState(false);

    const fetchAnnouncements = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/announcements/');
            setAnnouncements(res.data.data);
        } catch (err) {
            setError(getApiErrorMessage(err, 'Ошибка загрузки оповещений'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnnouncements();
    }, [fetchAnnouncements]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim() || !form.message.trim()) return;
        setSaving(true);
        try {
            await api.post('/announcements/', form);
            setForm({ title: '', message: '', type: 'info' });
            setShowCreateModal(false);
            await fetchAnnouncements();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка создания записи'));
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (id: number) => {
        if (!confirm('Убрать это оповещение с дашборда?')) return;
        try {
            await api.delete(`/announcements/${id}`);
            await fetchAnnouncements();
        } catch (err) {
            alert(getApiErrorMessage(err, 'Ошибка удаления записи'));
        }
    };

    const formatDateTime = (dateString: string) =>
        new Date(dateString).toLocaleString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });

    return (
        <div className="space-y-6">
            {/* Заголовок */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Дашборд</h1>
                    <p className="mt-1 text-gray-600">
                        Добро пожаловать, {user?.full_name}! Здесь публикуются важные оповещения (стоп-листы и т.п.).
                    </p>
                </div>
                <div className="flex gap-2">
                    {isAdmin && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blueberry-600 text-white rounded-lg hover:bg-blueberry-700 transition"
                        >
                            <Plus size={16} /> Новая запись
                        </button>
                    )}
                    <button
                        onClick={fetchAnnouncements}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                    >
                        <RefreshCw size={16} /> Обновить
                    </button>
                </div>
            </div>

            {/* Лента оповещений */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <RefreshCw className="animate-spin text-blueberry-600" size={32} />
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    <p className="font-bold">Ошибка</p>
                    <p>{error}</p>
                    <button onClick={fetchAnnouncements} className="mt-2 text-sm underline">Попробовать снова</button>
                </div>
            ) : announcements.length === 0 ? (
                <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-200 text-center">
                    <Megaphone size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 text-lg">Активных оповещений нет.</p>
                    {isAdmin && (
                        <p className="text-gray-400 text-sm mt-1">Нажмите «Новая запись», чтобы опубликовать стоп-лист или объявление.</p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {announcements.map((a) => {
                        const style = TYPE_STYLES[a.type] || TYPE_STYLES.info;
                        return (
                            <div key={a.id} className={`border rounded-xl p-4 flex items-start gap-4 ${style.box}`}>
                                <div className="mt-0.5 shrink-0">{style.icon}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${style.badge}`}>
                                            {style.label}
                                        </span>
                                        <h3 className="font-bold text-gray-800">{a.title}</h3>
                                    </div>
                                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap break-words">{a.message}</p>
                                    <p className="mt-2 text-xs text-gray-500 flex items-center gap-3">
                                        <span className="flex items-center gap-1">
                                            <Users size={12} /> {a.author_name || 'Неизвестно'}
                                        </span>
                                        <span>{formatDateTime(a.created_at)}</span>
                                    </p>
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={() => handleDeactivate(a.id)}
                                        className="shrink-0 p-2 text-red-500 hover:bg-red-100 rounded-lg transition"
                                        title="Убрать оповещение"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Модалка создания записи */}
            {showCreateModal && (
                <Modal isOpen={true} onClose={() => setShowCreateModal(false)} title="Новое оповещение">
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
                            <select
                                value={form.type}
                                onChange={(e) => setForm({ ...form, type: e.target.value as Announcement['type'] })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blueberry-500"
                            >
                                <option value="info">Информация</option>
                                <option value="warning">Предупреждение</option>
                                <option value="stoplist">Стоп-лист</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Заголовок</label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="Например: СЕГОДНЯ НЕТ — Лосось"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blueberry-500"
                                maxLength={200}
                                required
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Текст записи</label>
                            <textarea
                                value={form.message}
                                onChange={(e) => setForm({ ...form, message: e.target.value })}
                                placeholder="Подробности оповещения..."
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blueberry-500"
                                maxLength={5000}
                                required
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                            >
                                Отмена
                            </button>
                            <button
                                type="submit"
                                disabled={saving || !form.title.trim() || !form.message.trim()}
                                className="px-4 py-2 bg-blueberry-600 text-white rounded-lg hover:bg-blueberry-700 transition disabled:opacity-50"
                            >
                                {saving ? 'Публикация...' : 'Опубликовать'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default DashboardPage;
