import express from 'express';
import cors from 'cors';
// Убедитесь, что импортирован ваш роутер API
// import { apiRouter } from './routes/api'; 

const app = express();

// Список разрешенных доменов из переменных окружения
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || [];

app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, от мобильных приложений, curl или Postman)
    if (!origin) return callback(null, true);
    
    // Проверяем, есть ли origin в нашем списке
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // Если не совпадает, корректно отклоняем, НЕ выбрасывая исключение (throw)
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Базовые настройки перед маршрутами
app.use(express.json());

// Применение middleware к маршрутам API
// Убедитесь, что этот блок находится ПОСЛЕ настройки CORS и БАЗОВЫХ настроек
// app.use('/api', apiRouter);

export default app;
