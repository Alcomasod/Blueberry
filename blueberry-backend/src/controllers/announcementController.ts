import { Request, Response } from 'express';
import {
    getActiveAnnouncements,
    createAnnouncement,
    deactivateAnnouncement,
    validateAnnouncement,
} from '../services/announcementService.js';

// GET /api/announcements — активные оповещения (для дашборда, видят все роли)
export async function handleGetAnnouncements(req: Request, res: Response) {
    try {
        const announcements = await getActiveAnnouncements();
        res.json({ success: true, data: announcements });
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch announcements' });
    }
}

// POST /api/announcements — создать оповещение (только admin+, пермишен MANAGE_CONFIG)
export async function handleCreateAnnouncement(req: Request, res: Response) {
    const authorId = req.user?.id;
    if (!authorId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const validationError = validateAnnouncement(req.body);
    if (validationError) {
        return res.status(400).json({ success: false, error: validationError });
    }

    try {
        const announcement = await createAnnouncement(req.body, authorId);
        res.status(201).json({ success: true, data: announcement });
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({ success: false, error: 'Failed to create announcement' });
    }
}

// DELETE /api/announcements/:id — отключить оповещение (мягкое удаление, только admin+)
export async function handleDeactivateAnnouncement(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid announcement id' });
    }

    try {
        const result = await deactivateAnnouncement(id);
        if (!result) {
            return res.status(404).json({ success: false, error: 'Announcement not found or already inactive' });
        }
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error deactivating announcement:', error);
        res.status(500).json({ success: false, error: 'Failed to deactivate announcement' });
    }
}
