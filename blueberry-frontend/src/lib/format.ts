// src/lib/format.ts
// Утилиты форматирования значений для UI.

/**
 * Форматирует денежное значение: приводит строку с точкой (DECIMAL из PostgreSQL)
 * к русскому виду «1234,50». Пустые/некорректные значения → «0,00».
 */
export function formatAmount(value: string | number | null | undefined): string {
    const num = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'));
    if (!Number.isFinite(num)) return '0,00';
    return num.toFixed(2).replace('.', ',');
}
