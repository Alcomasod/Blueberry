// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import TablesPage from './pages/TablesPage';
import OrdersPage from './pages/OrderPage';
// import ordersPage from './pages/OrderPage';
import OrderDetailsPage from "./pages/OrderDetailsPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";

// Заглушки для страниц (мы будем наполнять их по мере выбора)
// const TablesPage = () => <h1 className="text-3xl font-bold text-gray-800">Зал и столы</h1>;
// const OrdersPage = () => <h1 className="text-3xl font-bold text-gray-800">Заказы</h1>;
const KitchenPage = () => <h1 className="text-3xl font-bold text-gray-800">Кухня / Бар</h1>;
import MenuPage from './pages/MenuPage';
const UsersPage = () => <h1 className="text-3xl font-bold text-gray-800">Сотрудники</h1>;
const AnalyticsPage = () => <h1 className="text-3xl font-bold text-gray-800">Аналитика</h1>;
const SettingsPage = () => <h1 className="text-3xl font-bold text-gray-800">Настройки</h1>;

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Публичный роут */}
                <Route path="/login" element={<LoginPage />} />

                {/* Защищенные роуты с Layout (Sidebar) */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/tables" element={<TablesPage />} />
                        <Route path="/orders" element={<OrdersPage />} />
                        <Route path="/orders/:id" element={<OrderDetailsPage />} />
                        <Route path="/kitchen" element={<KitchenPage />} />
                        <Route path="/menu" element={<MenuPage />} />
                        <Route path="/users" element={<UsersPage />} />
                        <Route path="/analytics" element={<AnalyticsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                </Route>

                {/* Перенаправление неизвестных путей */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;