import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Trash2, Layers, Loader, CheckSquare, Package } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
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
    sizes?: string[]; // NEW: Sizes from backend parsing
    colors?: string[]; // NEW: Colors from backend parsing
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

    // Handle Draft Click (Open Editor)
    const handleOpenDraft = async (draft: ProductDraft) => {
        // Generate variant structure
        const variantLabels = collageService.generateVariantLabels(draft.variantCount);
        const stockPerVariant: Record<string, number> = {};
        variantLabels.forEach(label => stockPerVariant[label] = defaultStock);

        const productData = {
            name: draft.name,
            description: draft.description,
            category: draft.category,
            retailPrice: draft.retailPrice,
            resellerPrice: draft.resellerPrice,
            costPrice: draft.costPrice,
            variants: {
                colors: variantLabels,
                sizes: draft.sizes && draft.sizes.length > 0 ? draft.sizes : ['All Size'],
                stock: draft.sizes && draft.sizes.length > 0
                    ? Object.fromEntries(draft.sizes.map(size => [size, stockPerVariant]))
                    : { 'All Size': stockPerVariant }
            }
        };

        // Pass to parent (AdminProductsPage)
        onProcess({
            productData,
            collageUrl: draft.collageUrl,
            draftId: draft.id,
            uploadSettings: {
                costPrice: draft.costPrice,
                stockPerVariant: defaultStock
            }
        }, new File([], 'placeholder'));

        onClose();
    };

    // Delete Draft
    const handleDeleteDraft = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Hapus draft ini?')) {
            await deleteDoc(doc(db, 'product_drafts', id));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-green-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-full">
                            <Layers className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Draft Siap Upload</h2>
                            <p className="text-sm text-gray-600">
                                Silahkan cek terlebih dahulu sebelum upload.
                            </p>
                        </div>
                        <span className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                            {drafts.length} Draft
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-6 bg-gray-50">
                    {loading ? (
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
                        <div className="grid grid-cols-1 gap-4">
                            {drafts.map((draft) => (
                                <div
                                    key={draft.id}
                                    onClick={() => handleOpenDraft(draft)}
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
                <div className="p-4 border-t bg-gray-50 text-center text-xs text-gray-500">
                    💡 Draft diproses otomatis oleh WhatsApp Bridge. Pastikan script <code>node scripts/whatsapp-bridge.cjs</code> berjalan.
                </div>
            </div>
        </div>
    );
};

export default WhatsAppInboxModal;
