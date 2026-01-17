import React, { useState, useEffect } from 'react';
import { Search, X, Check, Package, Loader2, AlertCircle } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

interface Product {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    category?: string;
    brand?: string;
}

interface ProductSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (selectedIds: string[]) => void;
    initialSelectedIds?: string[];
}

const ProductSelectorModal: React.FC<ProductSelectorModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    initialSelectedIds = []
}) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));

    useEffect(() => {
        if (isOpen) {
            loadProducts();
            setSelectedIds(new Set(initialSelectedIds));
        }
    }, [isOpen]);

    const loadProducts = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('🔍 ProductSelectorModal: Loading products from productBatches...');
            const snapshot = await getDocs(collection(db, 'productBatches'));
            const allProducts: Product[] = [];

            console.log(`📦 Found ${snapshot.docs.length} batch documents`);

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                console.log(`📄 Batch ${doc.id}: ${Array.isArray(data.products) ? data.products.length : 0} products`);

                if (Array.isArray(data.products)) {
                    data.products.forEach((p: any) => {
                        if (p.id && p.name) {
                            allProducts.push({
                                id: p.id,
                                name: p.name,
                                price: Number(p.retailPrice || p.price || 0),
                                imageUrl: p.image || p.images?.[0],
                                category: p.category,
                                brand: p.brand || p.merk
                            });
                        }
                    });
                }
            });

            console.log(`✅ ProductSelectorModal: Loaded ${allProducts.length} total products`);
            setProducts(allProducts);

            if (allProducts.length === 0) {
                setError('Tidak ada produk ditemukan di database');
            }
        } catch (err: any) {
            console.error('❌ ProductSelectorModal: Error loading products:', err);
            setError(`Gagal memuat produk: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (productId: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(productId)) {
            newSelected.delete(productId);
        } else {
            newSelected.add(productId);
        }
        setSelectedIds(newSelected);
    };

    const handleSave = () => {
        onSelect(Array.from(selectedIds));
        onClose();
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg">Pilih Produk</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cari nama produk, brand, atau kategori..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37] mb-2" />
                            <p className="text-gray-500">Memuat produk...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <AlertCircle className="w-12 h-12 text-red-400 mb-2" />
                            <p className="text-red-500 font-medium">{error}</p>
                            <button
                                onClick={loadProducts}
                                className="mt-4 px-4 py-2 bg-[#D4AF37] text-white rounded-lg hover:bg-[#B5952F]"
                            >
                                Coba Lagi
                            </button>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-10">
                            <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500">
                                {searchQuery ? 'Tidak ada produk yang cocok' : 'Belum ada produk'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            {filteredProducts.map(product => {
                                const isSelected = selectedIds.has(product.id);
                                return (
                                    <div
                                        key={product.id}
                                        onClick={() => toggleSelection(product.id)}
                                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${isSelected
                                            ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                                            : 'border-gray-200 hover:border-[#D4AF37]/50'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-[#D4AF37] border-[#D4AF37]' : 'border-gray-300'
                                            }`}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>

                                        {product.imageUrl ? (
                                            <img src={product.imageUrl} alt={product.name} className="w-10 h-10 object-cover rounded" />
                                        ) : (
                                            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                                                <Package className="w-5 h-5 text-gray-400" />
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{product.name}</p>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span>Rp {product.price.toLocaleString('id-ID')}</span>
                                                {product.brand && <span>• {product.brand}</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t flex justify-between items-center bg-gray-50 rounded-b-xl">
                    <p className="text-sm text-gray-600">
                        {selectedIds.size} produk dipilih
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-[#D4AF37] text-white font-medium rounded-lg hover:bg-[#B5952F] transition shadow-md"
                        >
                            Simpan Pilihan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductSelectorModal;
