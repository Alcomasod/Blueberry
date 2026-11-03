// src/components/Modal.tsx
import React from 'react'; // Импортируем сам React
import { X } from 'lucide-react';
import { theme } from '../theme';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode; // Используем React.ReactNode вместо прямого импорта
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'wide' | 'full';
}

// Размеры контейнеров модалок вынесены в дизайн-систему (src/theme.ts)
const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = theme.modal.sizes;

const Modal = ({ isOpen, onClose, title, children, size = 'md' }: ModalProps) => {
    if (!isOpen) return null;

    return (
        <div
            className={theme.modal.overlay}
            onClick={onClose}
        >
            <div
                className={`${theme.modal.panelResponsive} ${sizeClasses[size]}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center gap-2 mb-4">
                    <h3 className={`${theme.modal.title} truncate`}>{title}</h3>
                    <button onClick={onClose} className={theme.modal.closeButton}>
                        <X size={24} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

export default Modal;