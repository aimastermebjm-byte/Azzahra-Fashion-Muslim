import React, { useState, useEffect } from 'react';
import { X, Banknote, CreditCard, Check, AlertCircle } from 'lucide-react';
import { Order } from '../services/ordersService';

interface PaymentInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null;
    onConfirm: (amount: number, method: 'cash' | 'transfer', notes: string) => void;
    isLoading?: boolean;
    userRole?: 'admin' | 'owner' | string; // ✅ NEW: untuk hide Transfer jika Admin
}

const PaymentInputModal: React.FC<PaymentInputModalProps> = ({
    isOpen,
    onClose,
    order,
    onConfirm,
    isLoading = false,
    userRole = '' // ✅ NEW: default empty
}) => {
    const [amount, setAmount] = useState<string>('');
    const [method, setMethod] = useState<'cash' | 'transfer'>('cash');
    const [notes, setNotes] = useState<string>('');

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setAmount('');
            setMethod('cash');
            setNotes('');
        }
    }, [isOpen, order]);

    if (!isOpen || !order) return null;

    // Calculate amounts
    const totalAmount = order.finalTotal || 0;
    const totalPaid = order.totalPaid || 0;
    const remainingAmount = order.remainingAmount ?? (totalAmount - totalPaid);
    const inputAmount = Number(amount) || 0;
    const isValidAmount = inputAmount > 0 && inputAmount <= remainingAmount;

    const handleSubmit = () => {
        if (!isValidAmount) return;
        onConfirm(inputAmount, method, notes);
    };

    const handleSetExact = () => {
        setAmount(String(remainingAmount));
    };

    const handleQuickAdd = (value: number) => {
        const newAmount = inputAmount + value;
        if (newAmount <= remainingAmount) {
            setAmount(String(newAmount));
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="bg-gradient-to-r from-[#D4AF37] to-[#997B2C] px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                        <Banknote className="w-5 h-5" />
                        <h2 className="text-lg font-bold">Tambah Pembayaran</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full text-white transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">

                    {/* Order Summary */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <p className="text-gray-500 text-sm mb-2">Pesanan #{order.id}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <span className="text-gray-600">Total Tagihan:</span>
                            </div>
                            <div className="text-right font-bold">
                                Rp {totalAmount.toLocaleString('id-ID')}
                            </div>
                            <div>
                                <span className="text-gray-600">Sudah Dibayar:</span>
                            </div>
                            <div className="text-right font-bold text-green-600">
                                Rp {totalPaid.toLocaleString('id-ID')}
                            </div>
                            <div className="border-t pt-2">
                                <span className="text-gray-800 font-semibold">Sisa:</span>
                            </div>
                            <div className="text-right font-bold text-lg text-amber-600 border-t pt-2">
                                Rp {remainingAmount.toLocaleString('id-ID')}
                            </div>
                        </div>
                    </div>

                    {/* Payment Method Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Metode Pembayaran
                        </label>
                        <div className={`grid gap-3 ${userRole === 'admin' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            <button
                                onClick={() => setMethod('cash')}
                                className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${method === 'cash'
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <Banknote className="w-5 h-5" />
                                <span className="font-semibold">Cash</span>
                                {method === 'cash' && <Check className="w-4 h-4" />}
                            </button>
                            {/* ✅ Transfer button: ONLY show for Owner, hide for Admin */}
                            {userRole !== 'admin' && (
                                <button
                                    onClick={() => setMethod('transfer')}
                                    className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${method === 'transfer'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <CreditCard className="w-5 h-5" />
                                    <span className="font-semibold">Transfer</span>
                                    {method === 'transfer' && <Check className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                        {/* ✅ Info untuk Admin: mengapa hanya Cash */}
                        {userRole === 'admin' && (
                            <p className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                                💡 Admin hanya bisa input pembayaran Cash. Untuk Transfer, hubungi Owner.
                            </p>
                        )}
                    </div>

                    {/* Amount Input */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Jumlah Pembayaran (Rp)
                        </label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            autoFocus
                            className={`w-full text-xl font-bold p-3 border-2 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent ${inputAmount > remainingAmount ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                }`}
                            placeholder="0"
                        />

                        {/* Quick Buttons */}
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            <button
                                onClick={handleSetExact}
                                className="px-2 py-2 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold hover:bg-amber-200"
                            >
                                Lunas
                            </button>
                            <button
                                onClick={() => handleQuickAdd(50000)}
                                className="px-2 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200"
                            >
                                +50k
                            </button>
                            <button
                                onClick={() => handleQuickAdd(100000)}
                                className="px-2 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200"
                            >
                                +100k
                            </button>
                            <button
                                onClick={() => handleQuickAdd(200000)}
                                className="px-2 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200"
                            >
                                +200k
                            </button>
                        </div>
                    </div>

                    {/* Validation Error */}
                    {inputAmount > remainingAmount && (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">Jumlah melebihi sisa pembayaran!</span>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Catatan (Opsional)
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
                            placeholder="Contoh: DP pertama, Pelunasan, dll"
                        />
                    </div>

                    {/* After Payment Preview */}
                    {isValidAmount && (
                        <div className={`p-3 rounded-xl border-2 ${inputAmount === remainingAmount
                            ? 'bg-green-50 border-green-400'
                            : 'bg-blue-50 border-blue-200'
                            }`}>
                            <p className="text-sm">
                                {inputAmount === remainingAmount ? (
                                    <span className="text-green-700 font-bold">✅ Setelah pembayaran ini, order akan LUNAS!</span>
                                ) : (
                                    <span className="text-blue-700">
                                        Setelah pembayaran: Sisa <strong>Rp {(remainingAmount - inputAmount).toLocaleString('id-ID')}</strong>
                                    </span>
                                )}
                            </p>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!isValidAmount || isLoading}
                        className="px-6 py-2 bg-gradient-to-r from-[#D4AF37] to-[#997B2C] text-white font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Memproses...</span>
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                <span>Simpan Pembayaran</span>
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default PaymentInputModal;
