import { Request, Response } from 'express';
import { getProfile, updateProfile, changePassword } from '../services/profileService.js';

// GET /api/profile — текущий профиль
export async function handleGetProfile(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Не авторизован' });

    try {
        const profile = await getProfile(userId);
        if (!profile) return res.status(404).json({ success: false, error: 'Профиль не найден' });
        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ success: false, error: 'Не удалось загрузить профиль' });
    }
}

// PATCH /api/profile — обновить ФИО / телефон / email
export async function handleUpdateProfile(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const { full_name, phone, email } = req.body as { full_name?: string; phone?: string; email?: string };

    // Валидация
    if (full_name !== undefined && (typeof full_name !== 'string' || full_name.trim().length < 2)) {
        return res.status(400).json({ success: false, error: 'ФИО слишком короткое' });
    }
    if (email !== undefined && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ success: false, error: 'Некорректный email' });
    }
    if (phone !== undefined && phone && !/^[\d\s()+-]{5,20}$/.test(phone.trim())) {
        return res.status(400).json({ success: false, error: 'Некорректный телефон' });
    }

    try {
        const profile = await updateProfile(userId, { full_name, phone, email });
        if (!profile) return res.status(404).json({ success: false, error: 'Профиль не найден' });
        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ success: false, error: 'Не удалось сохранить изменения' });
    }
}

// POST /api/profile/change-password — смена пароля
export async function handleChangePassword(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const { current_password, new_password } = req.body as { current_password?: string; new_password?: string };
    if (!current_password || !new_password) {
        return res.status(400).json({ success: false, error: 'Укажите текущий и новый пароль' });
    }

    try {
        const result = await changePassword(userId, current_password, new_password);
        if (!result.ok) {
            return res.status(400).json({ success: false, error: result.error });
        }
        res.json({ success: true, message: 'Пароль успешно изменён' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ success: false, error: 'Не удалось изменить пароль' });
    }
}
