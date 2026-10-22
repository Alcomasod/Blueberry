import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pool from './config/db.js';
import { initDatabase } from './database/init.js';
import menuRoutes from './routes/menuRoutes.js';
import menuManagementRoutes from './routes/menuManagementRoutes.js';
import shiftRoutes from './routes/shiftRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { authenticateToken } from './middleware/auth.js';
import { requirePermission } from './middleware/authorize.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { PERMISSIONS } from './config/permissions.js';
import zoneRoutes from './routes/zoneRoutes.js';
import tableRoutes from './routes/tableRoutes.js';
import hookahFlavorRoutes from './routes/hookahFlavorRoutes.js';
import hookahOrderRoutes from './routes/hookahOrderRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import incidentRoutes from './routes/incidentRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// В production запуск без заданного JWT_SECRET недопустим:
// секрет по умолчанию означал бы, что любой может подделать токены.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET must be set in production');
    process.exit(1);
}

// ==========================================
// MIDDLEWARE (Промежуточное ПО)
// ==========================================
app.use(helmet());
app.use(express.json());

// CORS: список разрешённых источников задаётся через ALLOWED_ORIGINS
// (через запятую). Если переменная не задана — локальные адреса для разработки.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Разрешаем запросы без Origin (curl, мобильные приложения, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
}));

// Защита от брутфорса: не более 10 попыток входа с одного IP за 15 минут
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many login attempts, please try again later' },
});

// Системные роуты
app.get('/', (req: Request, res: Response) => {
    res.json({ message: 'Blueberry CRM API is running 🫐' });
});

app.get('/health', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            status: 'ok',
            project: 'Blueberry',
            database: 'connected',
            time: result.rows[0].now,
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            project: 'Blueberry',
            database: 'disconnected',
            error: (error as Error).message,
        });
    }
});

// Публичные роуты (с защитой от брутфорса)
app.use('/api/auth', authLimiter, authRoutes);

// ==========================================
// ЗАЩИЩЕННЫЕ РОУТЫ
// ==========================================

// Меню: просмотр доступен всем авторизованным
app.use('/api/menu', authenticateToken, menuRoutes);

// Управление меню: только admin+ (требуется пермишен MANAGE_MENU)
app.use('/api/menu-management', authenticateToken, requirePermission(PERMISSIONS.MANAGE_MENU), menuManagementRoutes);

// Смены
app.use('/api/shifts', authenticateToken, shiftRoutes);

// Заказы
app.use('/api/orders', authenticateToken, orderRoutes);

// Аналитика: только admin+
app.use('/api/analytics', authenticateToken, requirePermission(PERMISSIONS.VIEW_ANALYTICS), analyticsRoutes);

// Пользователи: только admin+
app.use('/api/users', authenticateToken, requirePermission(PERMISSIONS.MANAGE_USERS), userRoutes);

// Столы и зоны
app.use('/api/zones', authenticateToken, zoneRoutes);
// Столы: таблица маршрутов (tableRoutes) сама защищает каждую операцию
// соответствующим пермишеном (MANAGE_TABLE_STATUS / MANAGE_TABLES).
// Повторное подключение того же роутера без requirePermission создавало
// лазейку: первый совпавший маршрут выигрывал, и права не проверялись.
app.use('/api/tables', authenticateToken, tableRoutes);
// Кальяны
app.use('/api/hookah/flavors', authenticateToken, hookahFlavorRoutes);
app.use('/api/hookah/orders', authenticateToken, hookahOrderRoutes);

// Постоянники
app.use('/api/customers', authenticateToken, customerRoutes);

// Бой посуды
app.use('/api/incidents', authenticateToken, incidentRoutes);

// Оповещения на дашборде: просмотр — всем авторизованным,
// создание/отключение — только admin+ (проверяется внутри маршрутов)
app.use('/api/announcements', authenticateToken, announcementRoutes);

// 404 для неизвестных путей + централизованная обработка ошибок
app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`🫐 Blueberry server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;