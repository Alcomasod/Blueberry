// src/components/Layout.tsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ShiftButton from './ShiftButton';
import { theme } from '../theme';

const Layout = () => {
    return (
        <div className={theme.layout.root}>
            {/* Sidebar фиксирован слева */}
            <Sidebar />

            {/* Основной контент справа */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Шапка сайта (стили — theme.header) */}
                <header className={theme.header.container}>
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