import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Trash2, Layers, Loader, CheckSquare, Package, RefreshCw, Check, ArrowLeft, Edit3 } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../utils/firebaseClient';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collageService } from '../services/collageService';

interface ProductDraft {
    id: string;
    name: string;
    description: string;
    category: string;
    retailPrice: number;
    resellerPrice: number;
    costPrice: number;
    collageUrl: string;
    variantCount: number;
    timestamp: any;
    rawImages: string[];
    sizes?: string[];
    colors?: string[];
}

interface WhatsAppInboxModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (data: any, originalImage: File) => void;
}

const WhatsAppInboxModal: React.FC<WhatsAppInboxModalProps> = ({ isOpen, onClose, onProcess }) => {
    const [drafts, setDrafts] = useState<ProductDraft[]>([]);
    const [loading, setLoading] = useState(true);
    const [defaultStock] = useState<number>(10);

    // Editor state
    const [selectedDraft, setSelectedDraft] = useState<ProductDraft | null>(null);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editRetailPrice, setEditRetailPrice] = useState(0);
    const [editResellerPrice, setEditResellerPrice] = useState(0);
    const [isRegenerating, setIsRegenerating] = useState(false);

    // Listen to Processed Drafts (Queue) - View Only
    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);

        const q = query(collection(db, 'product_drafts'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ProductDraft[];
            setDrafts(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen]);

    // Open draft for editing
    const openDraftEditor = (draft: ProductDraft) => {
        setSelectedDraft(draft);
        setSelectedImages([...draft.rawImages]);
        setEditName(draft.name);
        setEditDescription(draft.description);
        setEditRetailPrice(draft.retailPrice);
        setEditResellerPrice(draft.resellerPrice);
    };

    // Toggle image selection
    const toggleImageSelection = (imageUrl: string) => {
        setSelectedImages(prev =>
            prev.includes(imageUrl)
                ? prev.filter(url => url !== imageUrl)
                : [...prev, imageUrl]
        );
    };

    // Regenerate collage from selected images
    const regenerateCollage = async () => {
        if (!selectedDraft || selectedImages.length === 0) return;

        setIsRegenerating(true);
        try {
            // Download selected images as Files
            const imageFiles: File[] = await Promise.all(
                selectedImages.map(async (url, index) => {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    return new File([blob], `image_${index}.jpg`, { type: 'image/jpeg' });
                })
            );

            // Generate new collage
            const labels = collageService.generateVariantLabels(imageFiles.length);
            const collageBlob = await collageService.generateCollage(imageFiles, labels);

            // Upload new collage
            const collageRef = ref(storage, `collages/draft_${Date.now()}.jpg`);
            await uploadBytes(collageRef, collageBlob);
            const newCollageUrl = await getDownloadURL(collageRef);

            // Update draft in Firestore
            await updateDoc(doc(db, 'product_drafts', selectedDraft.id), {
                collageUrl: newCollageUrl,
                rawImages: selectedImages,
                variantCount: selectedImages.length,
                name: editName,
                description: editDescription,
                retailPrice: editRetailPrice,
                resellerPrice: editResellerPrice
            });

            // Update local state
            setSelectedDraft({
                ...selectedDraft,
                collageUrl: newCollageUrl,
                rawImages: selectedImages,
                variantCount: selectedImages.length,
                name: editName,
                description: editDescription,
                retailPrice: editRetailPrice,
                resellerPrice: editResellerPrice
            });

            alert('✅ Collage berhasil di-regenerate!');
        } catch (error) {
            console.error('Error regenerating collage:', error);
            alert('❌ Gagal regenerate collage');
        } finally {
            setIsRegenerating(false);
        }
    };

    // Handle Draft Click (Open Editor/Proceed)
    const handleProceedDraft = async (draft: ProductDraft) => {
        const draftToUse = selectedDraft || draft;

        // Generate variant structure
        const variantLabels = collageService.generateVariantLabels(draftToUse.variantCount);
        const stockPerVariant: Record<string, number> = {};
        variantLabels.forEach(label => stockPerVariant[label] = defaultStock);

        const productData = {
            name: draftToUse.name,
            description: draftToUse.description,
            category: draftToUse.category,
            retailPrice: draftToUse.retailPrice,
            resellerPrice: draftToUse.resellerPrice,
            costPrice: draftToUse.costPrice,
            variants: {
                colors: variantLabels,
                sizes: draftToUse.sizes && draftToUse.sizes.length > 0 ? draftToUse.sizes : ['All Size'],
                stock: draftToUse.sizes && draftToUse.sizes.length > 0
                    ? Object.fromEntries(draftToUse.sizes.map(size => [size, stockPerVariant]))
                    : { 'All Size': stockPerVariant }
            }
        };

        // Pass to parent (AdminProductsPage)
        onProcess({
            productData,
            collageUrl: draftToUse.collageUrl,
            draftId: draftToUse.id,
            uploadSettings: {
                costPrice: draftToUse.costPrice,
                stockPerVariant: defaultStock
            }
        }, new File([], 'placeholder'));

        setSelectedDraft(null);
        onClose();
    };

    // Delete Draft
    const handleDeleteDraft = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Hapus draft ini?')) {
            await deleteDoc(doc(db, 'product_drafts', id));
        }
    };

    // Back to list
    const backToList = () => {
        setSelectedDraft(null);
        setSelectedImages([]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-green-50">
                    <div className="flex items-center gap-3">
                        {selectedDraft && (
                            <button onClick={backToList} className="p-2 hover:bg-green-100 rounded-full transition-colors">
                                <ArrowLeft className="w-5 h-5 text-green-600" />
                            </button>
                        )}
                        <div className="bg-green-100 p-2 rounded-full">
                            <Layers className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">
                                {selectedDraft ? 'Edit Draft' : 'Draft Siap Upload'}
                            </h2>
                            <p className="text-sm text-gray-600">
                                {selectedDraft
                                    ? 'Pilih gambar & edit info sebelum upload'
                                    : 'Silahkan cek terlebih dahulu sebelum upload.'}
                            </p>
                        </div>
                        {!selectedDraft && (
                            <span className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                                {drafts.length} Draft
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-6 bg-gray-50">
                    {selectedDraft ? (
                        /* EDITOR VIEW */
                        <div className="space-y-6">
                            {/* Product Info Edit */}
                            <div className="bg-white p-4 rounded-xl border">
                                <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                    <Edit3 className="w-4 h-4" /> Info Produk
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Nama Produk</label>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="w-full border rounded-lg px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Kategori</label>
                                        <input
                                            type="text"
                                            value={selectedDraft.category}
                                            disabled
                                            className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Harga Retail</label>
                                        <input
                                            type="number"
                                            value={editRetailPrice}
                                            onChange={(e) => setEditRetailPrice(Number(e.target.value))}
                                            className="w-full border rounded-lg px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Harga Reseller</label>
                                        <input
                                            type="number"
                                            value={editResellerPrice}
                                            onChange={(e) => setEditResellerPrice(Number(e.target.value))}
                                            className="w-full border rounded-lg px-3 py-2"
                                        />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Deskripsi</label>
                                    <textarea
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                        rows={3}
                                        className="w-full border rounded-lg px-3 py-2"
                                    />
                                </div>
                            </div>

                            {/* Image Selection */}
                            <div className="bg-white p-4 rounded-xl border">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-gray-700">
                                        Pilih Gambar ({selectedImages.length} / {selectedDraft.rawImages.length})
                                    </h3>
                                    <button
                                        onClick={regenerateCollage}
                                        disabled={isRegenerating || selectedImages.length === 0}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isRegenerating || selectedImages.length === 0
                                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                : 'bg-blue-500 text-white hover:bg-blue-600'
                                            }`}
                                    >
                                        {isRegenerating ? (
                                            <Loader className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="w-4 h-4" />
                                        )}
                                        {isRegenerating ? 'Generating...' : 'Regenerate Collage'}
                                    </button>
                                </div>
                                <p className="text-sm text-gray-500 mb-3">
                                    Klik gambar untuk pilih/hapus. Collage akan dibuat dari gambar yang dipilih.
                                </p>
                                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                                    {selectedDraft.rawImages.map((imageUrl, index) => (
                                        <div
                                            key={index}
                                            onClick={() => toggleImageSelection(imageUrl)}
                                            className={`relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer border-4 transition-all ${selectedImages.includes(imageUrl)
                                                    ? 'border-green-500 shadow-lg'
                                                    : 'border-transparent opacity-50 grayscale'
                                                }`}
                                        >
                                            <img
                                                src={imageUrl}
                                                alt={`Image ${index + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                            {selectedImages.includes(imageUrl) && (
                                                <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                                                    <Check className="w-4 h-4" />
                                                </div>
                                            )}
                                            <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                                {String.fromCharCode(65 + selectedImages.indexOf(imageUrl))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Current Collage Preview */}
                            <div className="bg-white p-4 rounded-xl border">
                                <h3 className="font-bold text-gray-700 mb-3">Preview Collage</h3>
                                <div className="flex justify-center">
                                    <img
                                        src={selectedDraft.collageUrl}
                                        alt="Collage Preview"
                                        className="max-h-64 rounded-lg shadow border"
                                    />
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-4">
                                <button
                                    onClick={backToList}
                                    className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 font-medium hover:bg-gray-100 transition-colors"
                                >
                                    Kembali
                                </button>
                                <button
                                    onClick={() => handleProceedDraft(selectedDraft)}
                                    className="flex-1 py-3 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    Lanjut Upload
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <Loader className="w-12 h-12 animate-spin mb-4" />
                            <p>Memuat draft...</p>
                        </div>
                    ) : drafts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <CheckSquare className="w-16 h-16 mb-4 opacity-50" />
                            <p className="text-lg font-medium">Antrian Kosong</p>
                            <p className="text-sm text-center mt-2">
                                Kirim gambar + caption ke WhatsApp.<br />
                                Draft akan otomatis muncul di sini setelah 15 detik.
                            </p>
                        </div>
                    ) : (
                        /* LIST VIEW */
                        <div className="grid grid-cols-1 gap-4">
                            {drafts.map((draft) => (
                                <div
                                    key={draft.id}
                                    onClick={() => openDraftEditor(draft)}
                                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
                                >
                                    <div className="flex gap-4">
                                        {/* Collage Preview */}
                                        <div className="w-24 h-32 flex-shrink-0">
                                            {draft.collageUrl ? (
                                                <img src={draft.collageUrl} alt="Collage" className="w-full h-full object-cover rounded-lg border" />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                                                    <Package className="w-8 h-8 text-gray-300" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <h3 className="font-bold text-gray-800 mb-1 group-hover:text-green-600 transition-colors">
                                                    {draft.name}
                                                </h3>
                                                <button
                                                    onClick={(e) => handleDeleteDraft(draft.id, e)}
                                                    className="text-gray-400 hover:text-red-500 p-1"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <p className="text-sm text-gray-500 line-clamp-2 mb-2">{draft.description}</p>

                                            <div className="flex items-center gap-3 text-xs font-medium text-gray-600">
                                                <span className="bg-gray-100 px-2 py-1 rounded">
                                                    Retail: Rp {(draft.retailPrice || 0).toLocaleString()}
                                                </span>
                                                <span className="bg-gray-100 px-2 py-1 rounded">
                                                    {draft.variantCount} Varian
                                                </span>
                                                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded">
                                                    {draft.category}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action Icon */}
                                        <div className="flex items-center justify-center px-4 border-l border-gray-100">
                                            <ArrowRight className="w-6 h-6 text-gray-300 group-hover:text-green-600 transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!selectedDraft && (
                    <div className="p-4 border-t bg-gray-50 text-center text-xs text-gray-500">
                        💡 Draft diproses otomatis oleh WhatsApp Bridge di VPS (24/7)
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppInboxModal;
