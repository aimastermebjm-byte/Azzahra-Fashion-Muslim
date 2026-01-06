
import React, { useState } from 'react';
import { X, ArrowRight, Save, Lock } from 'lucide-react';
import { stockAdjustmentService } from '../services/stockAdjustmentService';
import { stockMutationService } from '../services/stockMutationService';
import { doc, updateDoc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

interface StockAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    product: {
        id: string;
        name: string;
    };
    size: string;
    variant: string;
    currentStock: number;
    user: {
        uid: string;
        displayName: string;
        role: string;
    };
}

const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    product,
    size,
    variant,
    currentStock,
    user
}) => {
    const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract' | 'set'>('add');
    const [quantity, setQuantity] = useState<string>('');
    const [reason, setReason] = useState<string>('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const calculateNewStock = () => {
        const qty = parseInt(quantity) || 0;
        if (adjustmentType === 'add') return currentStock + qty;
        if (adjustmentType === 'subtract') return currentStock - qty;
        if (adjustmentType === 'set') return qty;
        return currentStock;
    };

    const calculateChange = () => {
        const qty = parseInt(quantity) || 0;
        if (adjustmentType === 'add') return qty;
        if (adjustmentType === 'subtract') return -qty;
        if (adjustmentType === 'set') return qty - currentStock;
        return 0;
    };

    const newStock = calculateNewStock();
    const change = calculateChange();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!quantity || parseInt(quantity) < 0) {
            alert('Jumlah tidak valid');
            return;
        }

        if (!reason.trim()) {
            alert('Alasan wajib diisi');
            return;
        }

        if (newStock < 0) {
            alert('Stok tidak boleh kurang dari 0');
            return;
        }

        setLoading(true);

        try {
            if (user.role === 'owner') {
                // OWNER: Execute immediately
                await runTransaction(db, async (transaction) => {
                    // 1. Get fresh product data
                    const productRef = doc(db, 'products', product.id);
                    const productDoc = await transaction.get(productRef);
                    if (!productDoc.exists()) throw new Error("Product not found");

                    const productData = productDoc.data();
                    const variants = productData.variants;
                    const stockMap = variants.stock || {};
                    const sizeStock = stockMap[size] || {};

                    // Update specific variant stock
                    sizeStock[variant] = newStock;
                    stockMap[size] = sizeStock;

                    // Recalculate total stock
                    let totalStock = 0;
                    Object.values(stockMap).forEach((s: any) => {
                        Object.values(s).forEach((v: any) => {
                            totalStock += (typeof v === 'number' ? v : parseInt(v) || 0);
                        });
                    });

                    // 2. Update product
                    transaction.update(productRef, {
                        "variants.stock": stockMap,
                        stock: totalStock
                    });

                    // 3. Log mutation (using service helper or manual doc write in transaction)
                    // Since stockMutationService.logMutation is not transactional by itself passed here, 
                    // we'll rely on consistency. ideally logMutation should accept transaction but for now we do async
                    // better: do it after transaction success or inside if we restructure service.
                    // For now, let's assume loose coupling is acceptable for logs, but strictly consistent for stock.
                });

                // Helper to log AFTER transaction (to avoid complex service refactoring)
                await stockMutationService.logMutation({
                    productId: product.id,
                    productName: product.name,
                    size,
                    variant,
                    previousStock: currentStock,
                    newStock: newStock,
                    change: change,
                    type: 'adjustment',
                    referenceId: `adj_${Date.now()}`,
                    notes: reason,
                    createdBy: user.uid,
                    performedBy: user.displayName || 'Owner'
                });

                alert('✅ Stok berhasil diperbarui (Owner Override)');
            } else {
                // ADMIN: Create Request
                await stockAdjustmentService.createRequest({
                    productId: product.id,
                    productName: product.name,
                    size,
                    variant,
                    currentStock,
                    proposedStock: newStock,
                    reason,
                    requesterId: user.uid,
                    requesterName: user.displayName || 'Admin'
                });

                alert('📝 Permintaan penyesuaian stok telah dikirim ke Owner untuk persetujuan.');
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Adjustment failed:', error);
            alert('Gagal melakukan penyesuaian: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className={`p-4 border-b ${user.role === 'owner' ? 'bg-purple-600' : 'bg-orange-500'} text-white`}>
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            {user.role === 'owner' ? '⚡ Adjustment Stok (Direct)' : '📝 Request Adjustment'}
                        </h3>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition">
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>
                    <p className="text-white/80 text-xs mt-1">
                        {product.name} ({size} - {variant})
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Current Stock Display */}
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <span className="text-gray-500 text-sm">Stok Saat Ini</span>
                        <span className="text-xl font-bold text-gray-800">{currentStock}</span>
                    </div>

                    {/* Adjustment Type */}
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setAdjustmentType('add')}
                            className={`py-2 text-sm font-medium rounded-lg border ${adjustmentType === 'add' ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            + Tambah
                        </button>
                        <button
                            type="button"
                            onClick={() => setAdjustmentType('subtract')}
                            className={`py-2 text-sm font-medium rounded-lg border ${adjustmentType === 'subtract' ? 'bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            - Kurang
                        </button>
                        <button
                            type="button"
                            onClick={() => setAdjustmentType('set')}
                            className={`py-2 text-sm font-medium rounded-lg border ${adjustmentType === 'set' ? 'bg-purple-50 border-purple-500 text-purple-700 ring-1 ring-purple-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            = Set
                        </button>
                    </div>

                    {/* Quantity Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {adjustmentType === 'set' ? 'Stok Baru' : 'Jumlah Perubahan'}
                        </label>
                        <input
                            type="number"
                            min="0"
                            required
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full px-4 py-2 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-bold text-center"
                            placeholder="0"
                        />
                    </div>

                    {/* Preview Calculation */}
                    <div className="flex items-center justify-center space-x-4 text-sm py-2">
                        <div className="text-center">
                            <span className="block text-gray-400 text-xs">Awal</span>
                            <span className="font-bold text-gray-600">{currentStock}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-300" />
                        <div className="text-center">
                            <span className="block text-gray-400 text-xs">Perubahan</span>
                            <span className={`font-bold ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                {change > 0 ? '+' : ''}{change}
                            </span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-300" />
                        <div className="text-center">
                            <span className="block text-gray-400 text-xs">Akhir</span>
                            <span className="font-bold text-blue-600 text-lg">{newStock}</span>
                        </div>
                    </div>

                    {/* Reason Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Alasan / Catatan *
                        </label>
                        <textarea
                            required
                            rows={2}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="Contoh: Barang rusak, bonus dari supplier, salah hitung..."
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || !quantity || parseInt(quantity) < 0}
                        className={`w-full py-3 rounded-xl text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all ${user.role === 'owner'
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
                                : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600'
                            } ${loading ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {loading ? 'Memproses...' : (
                            <>
                                {user.role === 'owner' ? <Save className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                                {user.role === 'owner' ? 'Simpan Perubahan' : 'Ajukan Request'}
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default StockAdjustmentModal;
