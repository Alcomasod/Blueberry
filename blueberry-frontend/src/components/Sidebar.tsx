// src/components/Sidebar.tsx
import { useAuthStore } from '../store/authStore';
import {
    LayoutDashboard,
    UtensilsCrossed,
    BookOpen,
    Users,
    BarChart3,
    Settings,
    UserCircle,
    LogOut
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import ShiftButton from './ShiftButton';
import { theme } from '../theme';

// Определяем структуру пунктов меню
interface MenuItem {
    label: string;
    path: string;
    icon: React.ReactNode;
    roles: string[]; // Какие роли видят этот пункт
}

const menuItems: MenuItem[] = [
    { label: 'Дашборд', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['sys_admin', 'director', 'admin', 'waiter', 'kitchen', 'hookah_master', 'hookah_bar'] },
    { label: 'Зал и столы', path: '/tables', icon: <UtensilsCrossed size={20} />, roles: ['sys_admin', 'director', 'admin', 'waiter'] },
    { label: 'Заказы', path: '/orders', icon: <BookOpen size={20} />, roles: ['sys_admin', 'director', 'admin', 'waiter'] },
    { label: 'Меню', path: '/menu', icon: <BookOpen size={20} />, roles: ['sys_admin', 'director', 'admin', 'waiter'] },
    { label: 'Сотрудники', path: '/users', icon: <Users size={20} />, roles: ['sys_admin', 'director', 'admin'] },
    { label: 'Аналитика', path: '/analytics', icon: <BarChart3 size={20} />, roles: ['sys_admin', 'director', 'admin', 'waiter', 'kitchen', 'hookah_master', 'hookah_bar'] },
    { label: 'Профиль', path: '/profile', icon: <UserCircle size={20} />, roles: ['sys_admin', 'director', 'admin', 'waiter', 'kitchen', 'hookah_master', 'hookah_bar'] },
    { label: 'Настройки', path: '/settings', icon: <Settings size={20} />, roles: ['sys_admin'] },
];

const Sidebar = ({ onCloseMobile }: { onCloseMobile?: () => void }) => {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    // Фильтруем меню по роли пользователя
    const filteredMenu = menuItems.filter(item =>
        user?.role ? item.roles.includes(user.role) : false
    );

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Навигация + закрытие мобильного меню (на десктопе onCloseMobile — no-op)
    const go = (path: string) => {
        navigate(path);
        onCloseMobile?.();
    };

    return (
        <div className={`flex h-screen lg:h-full ${theme.branding.sidebarWidth} flex-col bg-blueberry-900 text-white shadow-xl`}>
            {/* Логотип (строка и ширина — theme.branding) */}
            <div className="flex h-16 shrink-0 items-center justify-center border-b border-blueberry-600">
                <h1 className="text-2xl font-bold tracking-wider">{theme.branding.logoText}</h1>
            </div>

            {/* Информация о пользователе */}
            <div className="shrink-0 border-b border-blueberry-600 p-4">
                <p className="truncate text-sm font-medium text-blueberry-100">{user?.full_name}</p>
                <p className="text-xs capitalize text-blueberry-300">{user?.role.replace('_', ' ')}</p>
            </div>
            {/* Кнопка управления сменой.
                Операционному персоналу (официанты, кальянщики) — обязательно для работы;
                администраторам и выше (admin, director, sys_admin) — опционально,
                они могут создавать заказы и без открытой смены. */}
            {user &&
                ['waiter', 'hookah_master', 'hookah_bar', 'admin', 'director', 'sys_admin'].includes(
                    user.role
                ) && (
                    <div className="shrink-0 border-b border-blueberry-600 p-4">
                        <ShiftButton />
                    </div>
                )}

            {/* Навигация */}
            <nav className="flex-1 overflow-y-auto p-4">
                <ul className="space-y-2">
                    {filteredMenu.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <li key={item.path}>
                                <button
                                    onClick={() => go(item.path)}
                                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left transition-colors ${
                                        isActive
                                            ? 'bg-blueberry-600 text-white shadow-md'
                                            : 'text-blueberry-100 hover:bg-blueberry-800 hover:text-white'
                                    }`}
                                >
                                    {item.icon}
                                    <span className="text-sm font-medium">{item.label}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Подвал сайдбара: кнопка выхода (стили — theme.footer) */}
            <div className={`${theme.footer.container} shrink-0`}>
                <button
                    onClick={handleLogout}
                    className={theme.footer.logoutButton}
                >
                    <LogOut size={20} />
                    <span className="text-sm font-medium">Выйти</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;