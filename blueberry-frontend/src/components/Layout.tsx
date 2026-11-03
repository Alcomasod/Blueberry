// src/components/Layout.tsx
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import ShiftButton from './ShiftButton';
import { theme } from '../theme';

const Layout = () => {
    // Мобильное меню: сайдбар выезжает слева (off-canvas), на lg+ всегда виден
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className={theme.layout.root}>
            {/* Затемнение фона под открытым мобильным меню */}
            {menuOpen && (
                <div
                    className={theme.responsive.menuOverlay}
                    onClick={() => setMenuOpen(false)}
                    aria-hidden
                />
            )}

            {/* Sidebar: на мобильных — fixed drawer, на десктопе — статичная колонка */}
            <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 lg:static lg:z-auto ${menuOpen ? 'translate-x-0' : theme.responsive.sidebarHidden}`}>
                <Sidebar onCloseMobile={() => setMenuOpen(false)} />
            </div>

            {/* Основной контент справа */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Шапка сайта (стили — theme.header) */}
                <header className={theme.header.container}>
                    {/* Кнопка-бургер для мобильных */}
                    <button
                        onClick={() => setMenuOpen((v) => !v)}
                        className={theme.responsive.burgerButton}
                        aria-label="Открыть меню"
                    >
                        {menuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                    <ShiftButton />
                </header>

                <main className={theme.layout.main}>
                    <Outlet /> {/* Здесь будут рендериться дочерние роуты (Dashboard, Tables и т.д.) */}
                </main>
            </div>
        </div>
    );
};

export default Layout;
