
import React, { useEffect, useState } from 'react';
import { X, Clock, OctagonAlert } from 'lucide-react';
import { StockMutation, stockMutationService } from '../services/stockMutationService';
import StockAdjustmentModal from './StockAdjustmentModal';

interface StockHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any; // Add user prop for permission check
    product: {
        id: string;
        name: string;
        variants: {
            sizes: string[];
            colors: string[];
            stock: any; // Complex object structure
        };
    } | null;
}

const StockHistoryModal: React.FC<StockHistoryModalProps> = ({
    isOpen,
    onClose,
    user,
    product
}) => {
    const [mutations, setMutations] = useState<StockMutation[]>([]);
    const [loading, setLoading] = useState(false);

    // State for adjustment modal
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

    // Selection State
    const [selectedSize, setSelectedSize] = useState<string>('');
    const [selectedColor, setSelectedColor] = useState<string>('');

    // Set defaults when product opens
    useEffect(() => {
        if (isOpen && product) {
            const firstSize = product.variants.sizes[0] || '';
            const firstColor = product.variants.colors[0] || '';
            setSelectedSize(firstSize);
            setSelectedColor(firstColor);
        }
    }, [isOpen, product]);

    // Load history when selection changes
    useEffect(() => {
        if (isOpen && product && selectedSize && selectedColor) {
            loadHistory();
        }
    }, [isOpen, product?.id, selectedSize, selectedColor]);

    const loadHistory = async () => {
        if (!product || !selectedSize || !selectedColor) return;

        setLoading(true);
        try {
            const history = await stockMutationService.getHistory(product.id, selectedSize, selectedColor);
            setMutations(history);
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !product) return null;

    // Calculate current stock for selected variant
    const currentStock = product.variants.stock?.[selectedSize]?.[selectedColor] || 0;

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'order': return 'Penjualan';
            case 'stock_opname': return 'Opname';
            case 'adjustment': return 'Adjustment';
            case 'restock': return 'Masuk';
            case 'return': return 'Retur';
            default: return type;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'order': return 'text-red-600 bg-red-50 border-red-200';
            case 'stock_opname': return 'text-purple-600 bg-purple-50 border-purple-200';
            case 'adjustment': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'restock': return 'text-green-600 bg-green-50 border-green-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl">
                {/* Header */}
                <div className="p-4 border-b bg-slate-50 rounded-t-2xl">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Kartu Stok</h2>
                            <p className="text-sm text-gray-600">{product.name}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Ukuran (Size)</label>
                            <select
                                value={selectedSize}
                                onChange={(e) => setSelectedSize(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                {product.variants.sizes.map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Varian / Warna</label>
                            <select
                                value={selectedColor}
                                onChange={(e) => setSelectedColor(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                {product.variants.colors.map(color => (
                                    <option key={color} value={color}>{color}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Summary Card */}
                <div className="p-4 bg-white border-b">
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                        <div>
                            <span className="text-sm text-slate-500">Stok Saat Ini</span>
                            <div className="text-2xl font-bold text-slate-900">{currentStock ?? '-'}</div>
                        </div>
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                </div>

                {/* History List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        </div>
                    ) : mutations.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <OctagonAlert className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>Belum ada riwayat mutasi untuk varian ini</p>
                        </div>
                    ) : (
                        mutations.map((item) => (
                            <div key={item.id} className="border border-gray-100 rounded-xl p-3 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center space-x-2">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-md border ${getTypeColor(item.type)}`}>
                                            {getTypeLabel(item.type)}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {item.createdAt ? new Date(item.createdAt).toLocaleString('id-ID', {
                                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                            }) : '-'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-bold ${item.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.change > 0 ? '+' : ''}{item.change}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            Stok: {item.previousStock} → {item.newStock}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <div className="flex-1 mr-2">
                                        {item.notes ? (
                                            <span className="text-gray-700 block truncate">{item.notes}</span>
                                        ) : (
                                            <span className="italic text-gray-400">Tanpa catatan</span>
                                        )}
                                        {item.referenceId && (
                                            <span className="inline-block bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600 mt-1">
                                                Ref: {item.referenceId}
                                            </span>
                                        )}
                                    </div>
                                    <div className="whitespace-nowrap">
                                        Oleh: {item.performedBy || 'System'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t bg-gray-50 flex justify-end space-x-2 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg"
                    >
                        Tutup
                    </button>
                    <button
                        onClick={() => setShowAdjustmentModal(true)}
                        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                    >
                        Adjustment
                    </button>
                </div>
            </div>

            {/* Adjustment Modal Overlay */}
            {product && selectedSize && selectedColor && (
                <StockAdjustmentModal
                    isOpen={showAdjustmentModal}
                    onClose={() => setShowAdjustmentModal(false)}
                    onSuccess={() => {
                        window.location.reload(); // Simple reload to refresh data everywhere
                        // Better: loadHistory() and maybe trigger parent refresh
                    }}
                    product={{ id: product.id, name: product.name }}
                    size={selectedSize}
                    variant={selectedColor}
                    currentStock={currentStock}
                    user={user}
                />
            )}
        </div>
    );
};

export default StockHistoryModal;
