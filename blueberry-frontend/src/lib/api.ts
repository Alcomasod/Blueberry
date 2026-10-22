// src/lib/api.ts
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
    baseURL: 'http://localhost:3001/api', // URL твоего бэкенда
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
        if (error.response?.status === 401) {
            useAuthStore.getState().logout();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;