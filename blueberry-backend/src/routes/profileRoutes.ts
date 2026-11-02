import { Router } from 'express';
import {
    handleGetProfile,
    handleUpdateProfile,
    handleChangePassword
} from '../controllers/profileController.js';

const router = Router();

// Все эндпоинты профиля доступны любому авторизованному сотруднику
router.get('/', handleGetProfile);
router.patch('/', handleUpdateProfile);
router.post('/change-password', handleChangePassword);

export default router;
