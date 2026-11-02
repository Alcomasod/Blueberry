// Конфигурация Tailwind. Палитра и токены синхронизированы с src/theme.ts —
// при изменении стиля правьте ОБА файла (значения hex/классов должны совпадать).

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                blueberry: {
                    50: '#f0f4ff',
                    100: '#e0e7ff',
                    300: '#a5b4fc',
                    500: '#6366f1', // Основной фиолетово-синий цвет "Черники"
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
            },
        },
    },
    plugins: [],
}