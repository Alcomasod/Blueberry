// src/components/ShiftButton.tsx
import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Play, Square, Loader2 } from 'lucide-react';

const ShiftButton = () => {
    // Переменная user удалена, так как она не использовалась в этом компоненте
    const [shiftStatus, setShiftStatus] = useState<'open' | 'closed' | 'loading'>('loading');
    const [shiftId, setShiftId] = useState<number | null>(null);

    const checkShift = async () => {
        try {
            const res = await api.get('/shifts/my');
            const shifts = res.data.data;
            const activeShift = shifts.find((s: any) => s.status === 'open');

            if (activeShift) {
                setShiftStatus('open');
                setShiftId(activeShift.id);
            } else {
                setShiftStatus('closed');
                setShiftId(null);
            }
        } catch (err) {
            setShiftStatus('closed');
            setShiftId(null);
        }
    };

    // Оборачиваем асинхронный вызов во внутреннюю функцию, чтобы избежать ошибки Promise
    useEffect(() => {
        const init = async () => {
            await checkShift();
        };
        init();
    }, []);

    const handleOpenShift = async () => {
        try {
            await api.post('/shifts/open');
            await checkShift(); // Синхронизируем состояние с бэкендом
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка открытия смены');
        }
    };

    const handleCloseShift = async () => {
        if (!shiftId) return;
        if (!confirm('Закрыть смену? Убедитесь, что все заказы оплачены.')) return;

        try {
            await api.post(`/shifts/${shiftId}/close`);
            await checkShift(); // Синхронизируем состояние с бэкендом
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка закрытия смены');
        }
    };

    if (shiftStatus === 'loading') {
        return (
            <div className="flex items-center gap-2 text-blueberry-300 text-sm">
                <Loader2 size={14} className="animate-spin" />
                <span>Проверка смены...</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            {shiftStatus === 'closed' ? (
                <button
                    onClick={handleOpenShift}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                >
                    <Play size={14} />
                    Открыть смену
                </button>
            ) : (
                <button
                    onClick={handleCloseShift}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
                >
                    <Square size={14} />
                    Закрыть смену
                </button>
            )}
        </div>
    );
};

export default ShiftButton;