import React from 'react';
import { X } from 'lucide-react';
import { StockOpnameItem } from '../types/stockOpname';

interface StockInputModalProps {
    isOpen: boolean;
    item: StockOpnameItem | null;
    onClose: () => void;
    onSave: (actualStock: number, notes?: string) => void;
}

const StockInputModal: React.FC<StockInputModalProps> = ({
    isOpen,
    item,
    onClose,
    onSave,
}) => {
    const [actualStock, setActualStock] = React.useState<string>('');
    const [notes, setNotes] = React.useState('');

    React.useEffect(() => {
        if (item) {
            setActualStock(item.actualStock !== null ? String(item.actualStock) : '');
            setNotes(item.notes || '');
        }
    }, [item]);

    if (!isOpen || !item) return null;

    const handleSave = () => {
        const stockValue = parseInt(actualStock, 10);
        if (isNaN(stockValue) || stockValue < 0) {
            alert('Masukkan angka stok yang valid');
            return;
        }
        onSave(stockValue, notes.trim() || undefined);
        onClose();
    };

    const difference = actualStock !== ''
        ? parseInt(actualStock, 10) - item.systemStock
        : null;

    const getDifferenceColor = () => {
        if (difference === null) return 'text-gray-400';
        if (difference === 0) return 'text-green-600';
        if (difference > 0) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getDifferenceText = () => {
        if (difference === null) return '-';
        if (difference === 0) return '0 ✓';
        if (difference > 0) return `+${difference}`;
        return String(difference);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">Input Stok Fisik</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Product Info */}
                    <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                        {item.productImage && (
                            <img
                                src={item.productImage}
                                alt={item.productName}
                                className="w-16 h-16 object-cover rounded-lg"
                            />
                        )}
                        <div className="flex-1">
                            <p className="font-semibold">{item.productName}</p>
                            <p className="text-sm text-gray-500">
                                Size: {item.size} | Varian: {item.variant}
                            </p>
                        </div>
                    </div>

                    {/* System Stock */}
                    <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg">
                        <span className="text-blue-700">Stok Sistem</span>
                        <span className="text-xl font-bold text-blue-700">{item.systemStock}</span>
                    </div>

                    {/* Actual Stock Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Stok Fisik (Hasil Hitung)
                        </label>
                        <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={actualStock}
                            onChange={(e) => setActualStock(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg text-xl font-bold text-center focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            placeholder="0"
                            autoFocus
                        />
                    </div>

                    {/* Difference Preview */}
                    <div className={`flex justify-between items-center p-3 rounded-lg ${difference === null ? 'bg-gray-100' :
                            difference === 0 ? 'bg-green-50' :
                                difference > 0 ? 'bg-yellow-50' : 'bg-red-50'
                        }`}>
                        <span className={getDifferenceColor()}>Selisih</span>
                        <span className={`text-xl font-bold ${getDifferenceColor()}`}>
                            {getDifferenceText()}
                        </span>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Catatan (Opsional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                            rows={2}
                            placeholder="Keterangan tambahan..."
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-3 p-4 border-t">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={actualStock === ''}
                        className="flex-1 py-3 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StockInputModal;
