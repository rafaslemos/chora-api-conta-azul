import React from 'react';
import { AlertCircle } from 'lucide-react';
import Button from './Button';

export interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    subtitle?: string;
    message: React.ReactNode;
    confirmLabel?: string;
    confirmLoadingLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    variant?: 'danger' | 'default';
    closeOnOverlayClick?: boolean;
    children?: React.ReactNode;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    subtitle,
    message,
    confirmLabel = 'Confirmar',
    confirmLoadingLabel,
    cancelLabel = 'Cancelar',
    isLoading = false,
    variant = 'default',
    closeOnOverlayClick = true,
    children,
}) => {
    if (!isOpen) return null;

    const handleOverlayClick = () => {
        if (closeOnOverlayClick && !isLoading) onClose();
    };

    const isDanger = variant === 'danger';
    const iconBg = isDanger ? 'bg-red-100' : 'bg-gray-100';
    const iconColor = isDanger ? 'text-red-600' : 'text-gray-600';
    const confirmClass = isDanger ? 'flex-1 bg-red-600 hover:bg-red-700 text-white' : 'flex-1';
    const confirmButtonLabel = isLoading && confirmLoadingLabel ? confirmLoadingLabel : confirmLabel;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={handleOverlayClick}
        >
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center`}>
                        <AlertCircle className={iconColor} size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
                    </div>
                </div>

                <div className="mb-6">
                    <div className="text-gray-700">{message}</div>
                    {children}
                </div>

                <div className="flex gap-3">
                    <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        className={confirmClass}
                        variant="primary"
                        onClick={onConfirm}
                        isLoading={isLoading}
                        disabled={isLoading}
                    >
                        {confirmButtonLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
