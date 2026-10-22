// src/pages/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';

const LoginPage = () => {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { login: authLogin } = useAuthStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await api.post('/auth/login', { login, password });
            const { token, user } = response.data.data;

            // Сохраняем токен и пользователя в Zustand store (и автоматически в localStorage)
            authLogin(token, user);

            // Перенаправляем на дашборд
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ошибка входа');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blueberry-50 to-blueberry-100">
            <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
                <h1 className="mb-6 text-center text-3xl font-bold text-blueberry-900">
                    Blueberry CRM
                </h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Логин
                        </label>
                        <input
                            type="text"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blueberry-500 focus:outline-none focus:ring-1 focus:ring-blueberry-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Пароль
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blueberry-500 focus:outline-none focus:ring-1 focus:ring-blueberry-500"
                            required
                        />
                    </div>

                    {error && (
                        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-md bg-blueberry-600 px-4 py-2 text-white font-medium hover:bg-blueberry-700 focus:outline-none focus:ring-2 focus:ring-blueberry-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {isLoading ? 'Вход...' : 'Войти'}
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-gray-500">
                    <p>Тестовые аккаунты:</p>
                    <p>admin / admin123</p>
                    <p>ivan / waiter123</p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;