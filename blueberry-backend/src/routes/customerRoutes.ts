import { Router } from 'express';
import {
    handleGetAllCustomers,
    handleGetCustomerByPhone,
    handleCreateCustomer,
    handleUpdateCustomer,
    handleDeleteCustomer
} from '../controllers/customerController.js';
import { requirePermission } from '../middleware/authorize.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// Все авторизованные могут видеть список постоянников
router.get('/', handleGetAllCustomers);

// Поиск по телефону
router.get('/phone/:phone', handleGetCustomerByPhone);

// Создание/редактирование/удаление — только для тех, у кого есть пермишен MARK_REGULARS
router.post('/', requirePermission(PERMISSIONS.MARK_REGULARS), handleCreateCustomer);
router.patch('/:id', requirePermission(PERMISSIONS.MARK_REGULARS), handleUpdateCustomer);
router.delete('/:id', requirePermission(PERMISSIONS.MARK_REGULARS), handleDeleteCustomer);

export default router;