// src/lib/apiError.ts
import axios from 'axios';

/**
 * Извлекает человекочитаемое сообщение об ошибке из ответа API
 * (бэкенд всегда возвращает формат { success: false, error: '...' }).
 */
export function getApiErrorMessage(err: unknown, fallback = 'Произошла ошибка'): string {
    if (axios.isAxiosError(err)) {
        const apiError = err.response?.data?.error as string | undefined;
        return apiError ?? err.message ?? fallback;
    }
    if (err instanceof Error) {
        return err.message || fallback;
    }
    return fallback;
}
