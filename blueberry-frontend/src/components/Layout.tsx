// src/components/Layout.tsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar фиксирован слева */}
            <Sidebar />

            {/* Основной контент справа */}
            <main className="flex-1 overflow-y-auto p-8">
                <Outlet /> {/* Здесь будут рендериться дочерние роуты (Dashboard, Tables и т.д.) */}
            </main>
        </div>
    );
};

export default Layout;