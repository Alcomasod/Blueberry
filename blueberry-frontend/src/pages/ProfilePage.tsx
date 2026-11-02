// src/pages/ProfilePage.tsx
// Страница профиля сотрудника: личные данные, смена пароля, текущая смена, о системе.
import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { roles, branding } from '../theme';

interface Profile {
    id: number;
    role: string;
    full_name: string;
    login: string;
    phone: string | null;
    email: string | null;
    department: string | null;
    hired_at: string | null;
    is_active: boolean;
    created_at: string;
}

interface ActiveShift {
    id: number;
    start_time: string;
    shift_date: string;
    end_time?: string | null;
    status?: string;
}

const ROLE_LABELS: Record<string, string> = {
    [roles.sys_admin]: 'Системный администратор',
    [roles.director]: 'Директор',
    [roles.admin]: 'Администратор',
    [roles.waiter]: 'Официант',
    [roles.kitchen]: 'Кухня',
    [roles.hookah_master]: 'Кальянщик',
    [roles.hookah_bar]: 'Бар',
};

function initials(fullName: string): string {
    return fullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('');
}

export default function ProfilePage() {
    const authUser = useAuthStore((s) => s.user);
    const setAuthUser = useAuthStore((s) => s.login);
    const token = useAuthStore((s) => s.token);

    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Личные данные
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [savingInfo, setSavingInfo] = useState(false);
    const [infoMsg, setInfoMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    // Пароль
    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [savingPwd, setSavingPwd] = useState(false);
    const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    // Смена
    const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);

    const loadProfile = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await api.get('/profile');
            const p = res.data.data as Profile;
            setProfile(p);
            setFullName(p.full_name ?? '');
            setPhone(p.phone ?? '');
            setEmail(p.email ?? '');
        } catch (e) {
            setError('Не удалось загрузить профиль. Проверьте, что бэкенд пересобран.');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadShift = async () => {
        try {
            const res = await api.get('/shifts/my');
            const shifts = (res.data.data ?? []) as ActiveShift[];
            const open = Array.isArray(shifts) ? shifts.find((s) => !s.end_time || (s as unknown as { status?: string }).status === 'open') : null;
            setActiveShift(open ?? null);
        } catch {
            // Не все роли имеют доступ к сменам — молча игнорируем
            setActiveShift(null);
        }
    };

    useEffect(() => {
        void loadProfile();
        void loadShift();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSaveInfo = async (e: React.FormEvent) => {
        e.preventDefault();
        setInfoMsg(null);
        if (fullName.trim().length < 2) {
            setInfoMsg({ type: 'err', text: 'ФИО слишком короткое' });
            return;
        }
        try {
            setSavingInfo(true);
            const res = await api.patch('/profile', { full_name: fullName, phone, email });
            const updated = res.data.data as Profile;
            setProfile(updated);
            // Синхронизируем имя в глобальном сторе (шапка/сайдбар)
            if (authUser && token) {
                setAuthUser(token, { ...authUser, full_name: updated.full_name });
            }
            setInfoMsg({ type: 'ok', text: 'Данные сохранены' });
        } catch (err) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
                ?? 'Не удалось сохранить изменения';
            setInfoMsg({ type: 'err', text: msg });
        } finally {
            setSavingInfo(false);
        }
    };

    const pwdStrength = (() => {
        if (!newPwd) return 0;
        let score = 0;
        if (newPwd.length >= 6) score++;
        if (newPwd.length >= 10) score++;
        if (/[A-ZА-Я]/.test(newPwd) && /[a-zа-я]/.test(newPwd)) score++;
        if (/\d/.test(newPwd)) score++;
        if (/[^A-Za-zА-Яа-я0-9]/.test(newPwd)) score++;
        return Math.min(score, 4);
    })();

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwdMsg(null);
        if (newPwd.length < 6) {
            setPwdMsg({ type: 'err', text: 'Новый пароль должен быть не короче 6 символов' });
            return;
        }
        if (newPwd !== confirmPwd) {
            setPwdMsg({ type: 'err', text: 'Пароли не совпадают' });
            return;
        }
        try {
            setSavingPwd(true);
            await api.post('/profile/change-password', { current_password: currentPwd, new_password: newPwd });
            setPwdMsg({ type: 'ok', text: 'Пароль успешно изменён' });
            setCurrentPwd('');
            setNewPwd('');
            setConfirmPwd('');
        } catch (err) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
                ?? 'Не удалось изменить пароль';
            setPwdMsg({ type: 'err', text: msg });
        } finally {
            setSavingPwd(false);
        }
    };

    const inputCls =
        'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueberry-300';
    const labelCls = 'block text-xs font-medium text-gray-500 mb-1';
    const cardCls = 'bg-white rounded-xl shadow-sm p-5 space-y-4';
    const msgCls = (m: { type: 'ok' | 'err' } | null) =>
        m ? (m.type === 'ok' ? 'text-green-600 text-sm' : 'text-red-600 text-sm') : '';

    if (loading) {
        return <div className="p-6 text-gray-500">Загрузка профиля…</div>;
    }

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
            {/* Шапка профиля */}
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blueberry-600 text-white flex items-center justify-center text-xl font-bold shrink-0">
                    {profile ? initials(profile.full_name) : initials(authUser?.full_name ?? '?')}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{profile?.full_name ?? authUser?.full_name}</h1>
                    <p className="text-sm text-gray-500">
                        {ROLE_LABELS[profile?.role ?? ''] ?? profile?.role} · логин: {profile?.login}
                    </p>
                </div>
            </div>

            {error && <div className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{error}</div>}

            {/* Личные данные */}
            <form onSubmit={handleSaveInfo} className={cardCls}>
                <h2 className="text-lg font-semibold text-gray-800">Личные данные</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>ФИО</label>
                        <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов Иван Иванович" />
                    </div>
                    <div>
                        <label className={labelCls}>Телефон</label>
                        <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" />
                    </div>
                    <div>
                        <label className={labelCls}>Email</label>
                        <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Роль</label>
                            <input className={inputCls + ' bg-gray-100'} disabled value={ROLE_LABELS[profile?.role ?? ''] ?? profile?.role ?? ''} />
                        </div>
                        <div>
                            <label className={labelCls}>Отдел</label>
                            <input className={inputCls + ' bg-gray-100'} disabled value={profile?.department ?? '—'} />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
                    <div>Дата приёма: {profile?.hired_at ? new Date(profile.hired_at).toLocaleDateString('ru-RU') : 'не указана'}</div>
                    <div>Аккаунт создан: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ru-RU') : '—'}</div>
                </div>
                <div className="flex items-center gap-4">
                    <button type="submit" className="bg-blueberry-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blueberry-700 disabled:opacity-50" disabled={savingInfo}>
                        {savingInfo ? 'Сохранение…' : 'Сохранить'}
                    </button>
                    <span className={msgCls(infoMsg)}>{infoMsg?.text}</span>
                </div>
            </form>

            {/* Смена пароля */}
            <form onSubmit={handleChangePassword} className={cardCls}>
                <h2 className="text-lg font-semibold text-gray-800">Безопасность</h2>
                <div className="space-y-3">
                    <div>
                        <label className={labelCls}>Текущий пароль</label>
                        <input className={inputCls} type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} autoComplete="current-password" />
                    </div>
                    <div>
                        <label className={labelCls}>Новый пароль</label>
                        <input className={inputCls} type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoComplete="new-password" />
                        {newPwd && (
                            <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all ${['bg-red-500', 'bg-red-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-600'][pwdStrength]}`}
                                        style={{ width: `${(pwdStrength / 4) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs text-gray-500 w-16">
                                    {['—', 'слабый', 'средний', 'хороший', 'надёжный'][pwdStrength]}
                                </span>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className={labelCls}>Повторите новый пароль</label>
                        <input className={inputCls} type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} autoComplete="new-password" />
                        {confirmPwd && newPwd !== confirmPwd && (
                            <p className="text-xs text-red-600 mt-1">Пароли не совпадают</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button type="submit" className="bg-blueberry-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blueberry-700 disabled:opacity-50" disabled={savingPwd || !currentPwd || !newPwd}>
                        {savingPwd ? 'Изменение…' : 'Изменить пароль'}
                    </button>
                    <span className={msgCls(pwdMsg)}>{pwdMsg?.text}</span>
                </div>
            </form>

            {/* Текущая смена */}
            <div className={cardCls}>
                <h2 className="text-lg font-semibold text-gray-800">Смена</h2>
                {activeShift ? (
                    <p className="text-sm text-gray-600">
                        Открыта смена от{' '}
                        <b>{new Date(activeShift.start_time).toLocaleString('ru-RU')}</b>. Закрыть смену можно через
                        кнопку «Смена» в шапке сайта.
                    </p>
                ) : (
                    <p className="text-sm text-gray-500">Сейчас у вас нет открытой смены.</p>
                )}
            </div>

            {/* О системе */}
            <div className={cardCls}>
                <h2 className="text-lg font-semibold text-gray-800">О системе</h2>
                <p className="text-sm text-gray-500">
                    {branding.name ?? 'Blueberry'} CRM · версия сборки уточняется по{' '}
                    <code className="bg-gray-100 px-1 rounded">GET /api/_build-info</code>
                </p>
            </div>
        </div>
    );
}
