// src/pages/OrderDetailsPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import OrderDetailsModal from '../components/OrderDetailsModal';
import { ArrowLeft } from 'lucide-react';

const OrderDetailsPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(true);

    const handleCloseModal = () => {
        setShowModal(false);
        navigate('/orders');
    };

    if (!id) {
        return (
            <div className="p-10 text-center">
                <p className="text-gray-500">ID заказа не указан</p>
                <button
                    onClick={() => navigate('/orders')}
                    className="mt-4 px-4 py-2 bg-blueberry-600 text-white rounded-lg hover:bg-blueberry-700"
                >
                    Вернуться к заказам
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/orders')}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                >
                    <ArrowLeft size={16} />
                    Назад к заказам
                </button>
                <h1 className="text-3xl font-bold text-gray-800">
                    Заказ #{id}
                </h1>
            </div>

            {showModal && (
                <OrderDetailsModal
                    orderId={parseInt(id)}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
};

export default OrderDetailsPage;