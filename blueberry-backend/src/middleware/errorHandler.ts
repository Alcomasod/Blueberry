import { Request, Response, NextFunction } from 'express';

/**
 * Централизованный обработчик ошибок.
 * Подключается ПОСЛЕДНИМ (после всех роутов). Не отдаёт клиенту
 * внутренние детали ошибки — они пишутся только в лог сервера.
 */
export function notFoundHandler(req: Request, res: Response) {
    res.status(404).json({ success: false, error: 'Not found' });
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
    // Ошибка CORS считается ожидаемой для клиента
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ success: false, error: 'Origin not allowed' });
    }

    console.error(`[${req.method} ${req.originalUrl}]`, err);

    res.status(500).json({ success: false, error: 'Internal server error' });
}
