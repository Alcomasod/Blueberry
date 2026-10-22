import { Router } from 'express';
import { handleLogin } from '../controllers/authController.js';

const router = Router();

// POST /api/auth/login - Вход в систему
router.post('/login', handleLogin);

export default router;