import React, { useState, useEffect } from 'react';
import {
    Folder, Plus, Edit, Trash2, X, Save,
    AlertCircle, Search, Tag, Users, CheckCircle, Clock
} from 'lucide-react';
import { collectionService } from '../services/collectionService';
import { Collection, CreateCollectionInput } from '../types/collection';
import { Product } from '../types';
import ProductSelectorModal from './ProductSelectorModal';

interface CollectionManagerProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    onUpdateProduct: (productId: string, data: Partial<Product>) => Promise<void>;
}

type ViewMode = 'list' | 'create' | 'edit';

const CollectionManager: React.FC<CollectionManagerProps> = ({
    isOpen,
    onClose,
    products,
    onUpdateProduct
}) => {
    const [mode, setMode] = useState<ViewMode>('list');
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<CreateCollectionInput>({
        name: '',
        description: '',
        productIds: [],
        isActive: true
    });

    // Discount State
    const [applyDiscount, setApplyDiscount] = useState(false);
    const [discountAmount, setDiscountAmount] = useState(0);

    // Selector State
    const [showSelector, setShowSelector] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadCollections();
            resetForm();
        }
    }, [isOpen]);

    const loadCollections = async () => {
        setLoading(true);
        try {
            const data = await collectionService.getAllCollections();
            setCollections(data);
        } catch (error) {
            console.error('Error loading collections:', error);
            alert('Gagal memuat koleksi');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setMode('list');
        setEditingId(null);
        setFormData({
            name: '',
            description: '',
            productIds: [],
            isActive: true
        });
        setApplyDiscount(false);
        setDiscountAmount(0);
    };

    const handleCreate = () => {
        setMode('create');
        setFormData({
            name: '',
            description: '',
            productIds: [],
            isActive: true
        });
    };

    const handleEdit = (collection: Collection) => {
        setMode('edit');
        setEditingId(collection.id);
        setFormData({
            name: collection.name,
            description: collection.description || '',
            productIds: collection.productIds || [],
            isActive: collection.isActive
        });
        // We usually don't auto-enable discount on edit to avoid accidental double-discount
        setApplyDiscount(false);
        setDiscountAmount(0);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Yakin ingin menghapus koleksi "${name}"?\n\nHarga produk dalam koleksi ini akan kembali normal.`)) return;

        try {
            // Get collection to find products
            const collection = collections.find(c => c.id === id);

            // Clear collectionId from all products in this collection
            if (collection && collection.productIds) {
                console.log(`🧹 Clearing collectionId from ${collection.productIds.length} products...`);
                for (const pid of collection.productIds) {
                    try {
                        await onUpdateProduct(pid, { collectionId: undefined } as any);
                    } catch (err) {
                        console.error(`Failed to clear collectionId from product ${pid}:`, err);
                    }
                }
            }

            await collectionService.deleteCollection(id);
            setCollections(prev => prev.filter(c => c.id !== id));
            alert('✅ Koleksi dihapus. Harga produk kembali normal.');
        } catch (error) {
            console.error('Error deleting collection:', error);
            alert('Gagal menghapus koleksi');
        }
    };


    const handleSave = async () => {
        if (!formData.name.trim()) {
            alert('Nama koleksi wajib diisi');
            return;
        }

        setProcessing(true);
        try {
            // Prepare collection data with discount amount
            const collectionData = {
                ...formData,
                discountAmount: applyDiscount ? discountAmount : 0
            };

            let newCollectionId = editingId;

            // 1. Create/Update Collection (with discountAmount)
            if (mode === 'create') {
                newCollectionId = await collectionService.createCollection(collectionData);
            } else if (mode === 'edit' && editingId) {
                await collectionService.updateCollection(editingId, collectionData);
            }

            // 2. Link products to collection via collectionId (VIRTUAL - no price change)
            if (newCollectionId && formData.productIds.length > 0) {
                console.log(`📦 Linking ${formData.productIds.length} products to collection ${newCollectionId}`);

                for (const pid of formData.productIds) {
                    try {
                        // Only update collectionId, NOT prices
                        await onUpdateProduct(pid, {
                            collectionId: newCollectionId
                        });
                    } catch (err) {
                        console.error(`Failed to link product ${pid}:`, err);
                    }
                }
            }

            if (applyDiscount && discountAmount > 0) {
                alert(`✅ Koleksi berhasil disimpan!\n💰 Diskon Rp ${discountAmount.toLocaleString('id-ID')} akan otomatis tampil di produk.\n\nHapus koleksi = harga kembali normal.`);
            } else {
                alert('Koleksi berhasil disimpan!');
            }

            loadCollections();
            resetForm();
        } catch (error) {
            console.error('Error saving collection:', error);
            alert('Terjadi kesalahan saat menyimpan koleksi');
        } finally {
            setProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-[#FDFBF7] rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <Folder className="w-6 h-6 text-[#D4AF37]" />
                        <h2 className="text-xl font-bold text-gray-800">Manajemen Koleksi</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {mode === 'list' ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-700">Daftar Koleksi</h3>
                                    <p className="text-sm text-gray-500">
                                        Kelola grup produk untuk memudahkan promosi di Banner.
                                    </p>
                                </div>
                                <button
                                    onClick={handleCreate}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] text-white rounded-lg hover:bg-[#B5952F] transition shadow-md"
                                >
                                    <Plus className="w-5 h-5" />
                                    Buat Koleksi Baru
                                </button>
                            </div>

                            {loading ? (
                                <div className="text-center py-10">Memuat data...</div>
                            ) : collections.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                                    <Folder className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500">Belum ada koleksi dibuat.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {collections.map(collection => (
                                        <div key={collection.id} className="bg-white p-4 rounded-xl border hover:shadow-md transition-shadow relative group">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-2 bg-yellow-50 text-[#D4AF37] rounded-lg">
                                                        <Folder className="w-5 h-5" />
                                                    </span>
                                                    <div>
                                                        <h4 className="font-bold text-gray-800">{collection.name}</h4>
                                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {collection.productIds?.length || 0} Produk
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={`w-2 h-2 rounded-full ${collection.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                                            </div>

                                            <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5em]">
                                                {collection.description || 'Tidak ada deskripsi'}
                                            </p>

                                            <div className="flex gap-2 mt-2 pt-3 border-t">
                                                <button
                                                    onClick={() => handleEdit(collection)}
                                                    className="flex-1 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg flex items-center justify-center gap-1"
                                                >
                                                    <Edit className="w-4 h-4" /> Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(collection.id, collection.name)}
                                                    className="flex-1 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center justify-center gap-1"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Hapus
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        // Form Create/Edit
                        <div className="bg-white p-6 rounded-xl border shadow-sm max-w-3xl mx-auto">
                            <h3 className="text-lg font-bold mb-6 pb-2 border-b flex items-center gap-2">
                                {mode === 'create' ? <Plus className="w-5 h-5" /> : <Edit className="w-5 h-5" />}
                                {mode === 'create' ? 'Buat Koleksi Baru' : 'Edit Koleksi'}
                            </h3>

                            <div className="space-y-5">
                                {/* Basic Info */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Koleksi</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                                        placeholder="Contoh: Promo Ramadhan, Gamis Premium"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi (Opsional)</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                                        rows={2}
                                    />
                                </div>

                                {/* Products Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Produk dalam Koleksi</label>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="font-bold text-gray-700">
                                                {formData.productIds.length} Produk Dipilih
                                            </span>
                                            <button
                                                onClick={() => setShowSelector(true)}
                                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2 shadow-sm text-sm"
                                            >
                                                <Search className="w-4 h-4" />
                                                Pilih Produk
                                            </button>
                                        </div>

                                        {formData.productIds.length > 0 && (
                                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                                {formData.productIds.map(pid => {
                                                    const prod = products.find(p => p.id === pid);
                                                    return (
                                                        <span key={pid} className="inline-flex items-center gap-1 px-2 py-1 bg-white border rounded text-xs text-gray-600">
                                                            {prod?.name || pid}
                                                            <button
                                                                onClick={() => setFormData(prev => ({
                                                                    ...prev,
                                                                    productIds: prev.productIds.filter(id => id !== pid)
                                                                }))}
                                                                className="hover:text-red-500"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Discount Option */}
                                <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 p-1 bg-yellow-200 rounded text-yellow-800">
                                            <Tag className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <input
                                                    type="checkbox"
                                                    id="applyDiscount"
                                                    checked={applyDiscount}
                                                    onChange={e => setApplyDiscount(e.target.checked)}
                                                    className="w-4 h-4 text-[#D4AF37] rounded border-gray-300 focus:ring-[#D4AF37]"
                                                />
                                                <label htmlFor="applyDiscount" className="font-bold text-gray-800 cursor-pointer">
                                                    Terapkan Diskon ke Produk Terpilih
                                                </label>
                                            </div>

                                            {applyDiscount && (
                                                <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                                                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Potongan Harga (Rp)</label>
                                                    <input
                                                        type="number"
                                                        value={discountAmount}
                                                        onChange={e => setDiscountAmount(Number(e.target.value))}
                                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37]"
                                                        placeholder="Contoh: 15000"
                                                    />
                                                    <p className="text-xs text-yellow-700 mt-2 flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" />
                                                        Harga produk akan dipotong permanen. Harga asli disimpan di history.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-4 border-t">
                                    <button
                                        onClick={resetForm}
                                        className="flex-1 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition"
                                        disabled={processing}
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={processing}
                                        className="flex-1 py-3 bg-[#D4AF37] text-white hover:bg-[#B5952F] rounded-lg font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                                    >
                                        {processing ? (
                                            <>Menyimpan...</>
                                        ) : (
                                            <>
                                                <Save className="w-5 h-5" />
                                                Simpan Koleksi {applyDiscount ? '& Diskon' : ''}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Product Selector Modal */}
            <ProductSelectorModal
                isOpen={showSelector}
                onClose={() => setShowSelector(false)}
                onSelect={(ids) => {
                    setFormData(prev => ({ ...prev, productIds: ids }));
                }}
                initialSelectedIds={formData.productIds}
            />
        </div>
    );
};

export default CollectionManager;
