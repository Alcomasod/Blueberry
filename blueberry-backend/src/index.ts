import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
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
import { PERMISSIONS } from './config/permissions.js';
import zoneRoutes from './routes/zoneRoutes.js';
import tableRoutes from './routes/tableRoutes.js';
import hookahFlavorRoutes from './routes/hookahFlavorRoutes.js';
import hookahOrderRoutes from './routes/hookahOrderRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import incidentRoutes from './routes/incidentRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE (Промежуточное ПО)
// ==========================================
app.use(express.json());
app.use(cors()); // <-- ВСТАВЬ ЭТУ СТРОКУ СЮДА (сразу после express.json)

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

// Публичные роуты
app.use('/api/auth', authRoutes);

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
// Просмотр столов — для всех авторизованных
app.use('/api/tables', authenticateToken, tableRoutes);

// Управление столами (создание, редактирование, удаление) — только admin+
app.use('/api/tables', authenticateToken, requirePermission(PERMISSIONS.MANAGE_TABLES), tableRoutes);
// Кальяны
app.use('/api/hookah/flavors', authenticateToken, hookahFlavorRoutes);
app.use('/api/hookah/orders', authenticateToken, hookahOrderRoutes);

// Постоянники
app.use('/api/customers', authenticateToken, customerRoutes);

// Бой посуды
app.use('/api/incidents', authenticateToken, incidentRoutes);

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