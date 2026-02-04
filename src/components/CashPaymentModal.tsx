import React, { useState, useEffect } from 'react';
import { X, Check, Calculator, Info } from 'lucide-react';
import { Order } from '../types';

interface CashPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null;
    onConfirm: (cashReceived: number, change: number, notes: string) => void;
}

const CashPaymentModal: React.FC<CashPaymentModalProps> = ({
    isOpen,
    onClose,
    order,
    onConfirm
}) => {
    const [cashReceived, setCashReceived] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    // Reset when order opens
    useEffect(() => {
        if (isOpen) {
            setCashReceived('');
            setNotes('');
        }
    }, [isOpen, order]);

    if (!isOpen || !order) return null;

    const total = order.finalTotal || order.totalAmount || 0;
    const received = Number(cashReceived);
    const change = received - total;
    const isSufficient = received >= total;

    const handleQuickAdd = (amount: number) => {
        setCashReceived(String(received + amount));
    };

    const handleExact = () => {
        setCashReceived(String(total));
    };

    const handleSubmit = () => {
        if (!isSufficient) return;
        onConfirm(received, change, notes);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="bg-[#D4AF37] px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                        <Calculator className="w-5 h-5" />
                        <h2 className="text-lg font-bold">Kasir (Terima Tunai)</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full text-white transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">

                    {/* Summary Box */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-center">
                        <p className="text-gray-500 text-sm mb-1">Total Tagihan Pesanan {order.invoiceNumber || `#${order.id}`}</p>
                        <p className="text-2xl font-bold text-gray-800">Rp {total.toLocaleString('id-ID')}</p>
                    </div>

                    {/* Calculator Input */}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Uang Diterima (Rp)
                            </label>
                            <input
                                type="number"
                                value={cashReceived}
                                onChange={(e) => setCashReceived(e.target.value)}
                                autoFocus
                                className="w-full text-xl font-bold p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
                                placeholder="0"
                            />
                        </div>

                        {/* Quick Buttons */}
                        <div className="grid grid-cols-4 gap-2">
                            <button onClick={handleExact} className="px-2 py-2 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold hover:bg-amber-200">Uang Pas</button>
                            <button onClick={() => handleQuickAdd(10000)} className="px-2 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200">+10k</button>
                            <button onClick={() => handleQuickAdd(50000)} className="px-2 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200">+50k</button>
                            <button onClick={() => handleQuickAdd(100000)} className="px-2 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200">+100k</button>
                        </div>
                    </div>

                    {/* Change Display */}
                    {received > 0 && (
                        <div className={`flex justify-between items-center p-3 rounded-xl border-2 ${isSufficient ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-200'}`}>
                            <span className="font-semibold text-gray-700">
                                {isSufficient ? 'KEMBALIAN:' : 'KURANG:'}
                            </span>
                            <span className={`text-xl font-bold ${isSufficient ? 'text-green-700' : 'text-red-600'}`}>
                                Rp {Math.abs(change).toLocaleString('id-ID')}
                            </span>
                        </div>
                    )}

                    {/* Optional Notes */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Catatan Tambahan (Opsional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full p-2 text-sm border border-gray-200 rounded-lg"
                            placeholder="Contoh: Dibayarkan oleh istri..."
                            rows={2}
                        />
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={!isSufficient}
                        className="w-full py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#997B2C] text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check className="w-5 h-5" />
                        Konfirmasi Pembayaran
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CashPaymentModal;
