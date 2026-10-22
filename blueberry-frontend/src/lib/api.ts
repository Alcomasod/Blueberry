// src/lib/api.ts
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
    // URL бэкенда берётся из переменных окружения (VITE_API_URL),
    // значение по умолчанию подходит для локальной разработки.
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Интерсептор запросов: добавляем JWT-токен к каждому запросу
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Интерсептор ответов: обрабатываем 401 (токен протух)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const isAuthRequest = String(error.config?.url || '').includes('/auth/');
        // 401 на самом логине — это неверные креды, лоутить и редиректить не нужно
        if (status === 401 && !isAuthRequest) {
            const { logout } = useAuthStore.getState();
            logout();
            // Не плодим редиректы, если уже на странице логина
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;