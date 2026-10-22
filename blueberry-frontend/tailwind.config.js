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
                    500: '#6366f1', // Основной фиолетово-синий цвет "Черники"
                    600: '#4f46e5',
                    900: '#312e81',
                }
            }
        },
    },
    plugins: [],
}