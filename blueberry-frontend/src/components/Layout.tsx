// src/components/Layout.tsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ShiftButton from './ShiftButton';

const Layout = () => {
    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar фиксирован слева */}
            <Sidebar />

            {/* Основной контент справа */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Шапка с кнопкой смены */}
                <header className="flex items-center justify-end gap-3 px-8 py-3 bg-white border-b border-gray-200 shrink-0">
                    <ShiftButton />
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    <Outlet /> {/* Здесь будут рендериться дочерние роуты (Dashboard, Tables и т.д.) */}
                </main>
            </div>
        </div>
    );
};

export default Layout;