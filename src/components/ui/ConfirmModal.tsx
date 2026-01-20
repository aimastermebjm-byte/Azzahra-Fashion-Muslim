import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning';
    loading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Konfirmasi',
    message,
    confirmText = 'Ya, Hapus',
    cancelText = 'Batal',
    variant = 'danger',
    loading = false
}) => {
    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !loading) {
            onClose();
        }
    };

    const iconBg = variant === 'danger' ? 'bg-red-100' : 'bg-amber-100';
    const iconColor = variant === 'danger' ? 'text-red-600' : 'text-amber-600';
    const confirmBg = variant === 'danger'
        ? 'bg-red-500 hover:bg-red-600'
        : 'bg-amber-500 hover:bg-amber-600';

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={handleBackdropClick}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-[scaleIn_0.2s_ease-out]"
                style={{ animation: 'scaleIn 0.2s ease-out' }}
            >
                {/* Header with Icon */}
                <div className="p-6 text-center">
                    <div className={`mx-auto w-14 h-14 ${iconBg} rounded-full flex items-center justify-center mb-4`}>
                        {variant === 'danger' ? (
                            <Trash2 className={`w-7 h-7 ${iconColor}`} />
                        ) : (
                            <AlertTriangle className={`w-7 h-7 ${iconColor}`} />
                        )}
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-sm text-gray-600">{message}</p>
                </div>

                {/* Actions */}
                <div className="flex border-t border-gray-100">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 py-3.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <div className="w-px bg-gray-100" />
                    <button
                        onClick={() => {
                            onConfirm();
                            if (!loading) onClose();
                        }}
                        disabled={loading}
                        className={`flex-1 py-3.5 text-sm font-bold text-white ${confirmBg} transition-colors disabled:opacity-50`}
                    >
                        {loading ? 'Loading...' : confirmText}
                    </button>
                </div>
            </div>

            <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
        </div>
    );
};

export default ConfirmModal;
