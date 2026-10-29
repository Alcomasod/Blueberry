// src/components/PaymentModal.tsx
// Универсальная модалка подтверждения оплаты/закрытия счёта.
// Заменяет нативный confirm() на страницах «Заказы», в карточке заказа
// и на странице «Зал и столы» — во всех местах поведение одинаковое:
// выбор способа оплаты (наличные/карта) + подтверждение.
import { useState } from 'react';
import api from '../lib/api';
import { getApiErrorMessage } from '../lib/apiError';
import { Banknote, CreditCard, Loader2 } from 'lucide-react';
import Modal from './Modal';

interface PaymentModalProps {
    orderId: number;
    orderLabel?: string;      // например «Стол #5» или «№12»
    amount?: string | number; // сумма к оплате
    /**
     * close — использовать POST /orders/:id/close (страница «Заказы», карточка стола),
     * pay    — использовать POST /orders/:id/pay с выбранным способом оплаты
     *          (модалка деталей заказа).
     */
    mode?: 'close' | 'pay';
    onClose: () => void;      // закрыть без оплаты
    onSuccess: () => void;    // оплата прошла успешно
}

type PaymentMethod = 'cash' | 'card';

const PaymentModal = ({
    orderId,
    orderLabel,
    amount,
    mode = 'pay',
    onClose,
    onSuccess,
}: PaymentModalProps) => {
    const [method, setMethod] = useState<PaymentMethod>('card');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = async () => {
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            if (mode === 'close') {
                await api.post(`/orders/${orderId}/close`);
            } else {
                await api.post(`/orders/${orderId}/pay`, {
                    payment_method: method,
                    tip_amount: 0,
                    discount_amount: 0,
                });
            }
            onSuccess();
        } catch (err) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            // 404 — старый бэкенд без эндпоинта: fallback через PATCH статуса.
            if (status === 404 && mode === 'close') {
                try {
                    await api.patch(`/orders/${orderId}`, { status: 'paid' });
                    onSuccess();
                    return;
                } catch {
                    setError(getApiErrorMessage(err, 'Не удалось закрыть счёт'));
                    return;
                }
            }
            // 404 на /pay — модалка открылась для уже закрытого/оплаченного заказа
            // (например, предыдущая попытка оплаты прошла успешно, но стол был освобождён).
            // Считаем счёт закрытым и штатно обновляем интерфейс.
            if (status === 404 && mode === 'pay') {
                onSuccess();
                return;
            }
            setError(getApiErrorMessage(err, 'Ошибка оплаты'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen onClose={submitting ? () => {} : onClose} title="Подтверждение оплаты" size="sm">
            <div className="space-y-4">
                <p className="text-sm text-gray-700">
                    Оплатить заказ{orderLabel ? <> {orderLabel}</> : <> №{orderId}</>}
                    {amount !== undefined && (
                        <>
                            {' '}на сумму <span className="font-bold text-blueberry-900">{amount} ₽</span>
                        </>
                    )}
                    ?
                </p>

                {/* Выбор способа оплаты */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setMethod('cash')}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition ${
                            method === 'cash'
                                ? 'border-blueberry-600 bg-blueberry-50 text-blueberry-800'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                    >
                        <Banknote size={16} /> Наличные
                    </button>
                    <button
                        type="button"
                        onClick={() => setMethod('card')}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition ${
                            method === 'card'
                                ? 'border-blueberry-600 bg-blueberry-50 text-blueberry-800'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                    >
                        <CreditCard size={16} /> Карта
                    </button>
                </div>

                {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="flex gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition text-sm font-medium disabled:opacity-50"
                    >
                        Отмена
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={submitting}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition text-sm font-semibold disabled:opacity-60"
                    >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                        Оплатить
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default PaymentModal;
