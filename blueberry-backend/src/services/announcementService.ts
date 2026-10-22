import pool from '../config/db.js';

export interface AnnouncementInput {
    title: string;
    message: string;
    type: 'info' | 'warning' | 'stoplist';
}

const VALID_TYPES = ['info', 'warning', 'stoplist'] as const;

export function validateAnnouncement(input: Partial<AnnouncementInput>): string | null {
    const { title, message, type } = input;

    if (!title || typeof title !== 'string' || !title.trim()) {
        return 'Title is required';
    }
    if (title.trim().length > 200) {
        return 'Title must be at most 200 characters';
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
        return 'Message is required';
    }
    if (message.trim().length > 5000) {
        return 'Message must be at most 5000 characters';
    }
    if (!type || !(VALID_TYPES as readonly string[]).includes(type)) {
        return `Type must be one of: ${VALID_TYPES.join(', ')}`;
    }
    return null;
}

// Список активных оповещений (видят все авторизованные на дашборде)
export async function getActiveAnnouncements() {
    const result = await pool.query(`
        SELECT a.id, a.title, a.message, a.type, a.is_active,
               a.created_at, a.updated_at,
               u.full_name AS author_name
        FROM announcements a
                 LEFT JOIN users u ON a.created_by = u.id
        WHERE a.is_active = true
        ORDER BY a.created_at DESC
    `);
    return result.rows;
}

// Создание оповещения (только admin+)
export async function createAnnouncement(input: AnnouncementInput, authorId: number) {
    const result = await pool.query(`
        INSERT INTO announcements (title, message, type, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [input.title.trim(), input.message.trim(), input.type, authorId]);
    return result.rows[0];
}

// Отключение оповещения — мягкое «удаление» (только admin+)
export async function deactivateAnnouncement(id: number) {
    const result = await pool.query(`
        UPDATE announcements
        SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING *
    `, [id]);
    return result.rows[0] || null;
}
