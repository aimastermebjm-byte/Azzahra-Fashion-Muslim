import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Trash2, Layers, Loader, Package } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

interface ProductDraft {
    id: string;
    name: string;
    brand?: string;  // Add brand
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
    variantPricing?: Array<{
        label: string;
        type: string;
        retailPrice: number;
        resellerPrice: number;
    }>;
}

interface WhatsAppInboxModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (data: any, originalImage: File) => void;
}

const WhatsAppInboxModal: React.FC<WhatsAppInboxModalProps> = ({ isOpen, onClose, onProcess }) => {
    const [drafts, setDrafts] = useState<ProductDraft[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingDraftId, setProcessingDraftId] = useState<string | null>(null);

    // Normalize kategori dari AI ke format dropdown
    const normalizeCategory = (category: string): string => {
        const mapping: Record<string, string> = {
            'set': 'Setelan',
            'setelan': 'Setelan',
            'gamis': 'Gamis',
            'tunik': 'Tunik',
            'dress': 'Dress',
            'outer': 'Outer',
            'khimar': 'Khimar',
            'hijab': 'Hijab',
            'rok': 'Rok',
            'celana': 'Celana',
            'aksesoris': 'Aksesoris',
            'mukena': 'Mukena',
            'pashmina': 'Pashmina'
        };
        const lower = (category || '').toLowerCase().trim();
        return mapping[lower] || 'Gamis'; // Default ke Gamis jika tidak match
    };

    // Listen to Drafts
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

    // Handle Draft Click - Download images and pass to ManualUploadModal at step='upload'
    const handleDraftClick = async (draft: ProductDraft) => {
        setProcessingDraftId(draft.id);

        try {
            // Download raw images as File objects
            const imageFiles: File[] = await Promise.all(
                draft.rawImages.map(async (url, index) => {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    return new File([blob], `image_${index + 1}.jpg`, { type: 'image/jpeg' });
                })
            );

            // Transform variant pricing for ManualUploadModal
            let pricesPerVariant: Record<string, { retail: number, reseller: number }> | undefined;

            console.log('🔍 DEBUG: draft.variantPricing =', draft.variantPricing);

            if (draft.variantPricing && Array.isArray(draft.variantPricing)) {
                pricesPerVariant = {};
                const sizes = draft.sizes && draft.sizes.length > 0 ? draft.sizes : ['All Size'];

                console.log('🔍 DEBUG: sizes =', sizes);

                draft.variantPricing.forEach((vp) => {
                    // vp.label is "A", "B", etc.
                    sizes.forEach(size => {
                        const key = `${size}-${vp.label}`; // e.g. "All Size-A"
                        if (vp.retailPrice && vp.resellerPrice) {
                            pricesPerVariant![key] = {
                                retail: vp.retailPrice,
                                reseller: vp.resellerPrice
                            };
                        }
                    });
                });

                console.log('💰 DEBUG: pricesPerVariant =', pricesPerVariant);
            } else {
                console.log('⚠️ DEBUG: No variantPricing in draft');
            }

            // Pass to ManualUploadModal at step='upload'
            // Collage will be generated in browser (Cloud Function disabled to save costs)
            onProcess({
                step: 'upload', // Start at upload step, collage will be auto-generated in browser
                images: imageFiles,
                productData: {
                    name: draft.name,
                    brand: draft.brand || '',  // Add brand from draft
                    description: draft.description,
                    category: normalizeCategory(draft.category),  // Normalize kategori
                    retailPrice: draft.retailPrice,
                    resellerPrice: draft.resellerPrice,
                    costPrice: draft.costPrice,
                    variants: {
                        sizes: draft.sizes && draft.sizes.length > 0 ? draft.sizes : ['All Size']
                    },
                    pricesPerVariant: pricesPerVariant
                },
                draftId: draft.id,
                uploadSettings: {
                    costPrice: draft.costPrice,
                    stockPerVariant: 1  // Default stok = 1
                }
            }, imageFiles[0] || new File([], 'placeholder'));

            onClose();
        } catch (error) {
            console.error('Error processing draft:', error);
            alert('Gagal memproses draft. Coba lagi.');
        } finally {
            setProcessingDraftId(null);
        }
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <Package className="w-6 h-6" />
                        <div>
                            <h2 className="text-lg font-bold">Draft Siap Upload</h2>
                            <p className="text-sm text-green-100">Klik untuk edit & upload</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-4 bg-gray-50">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader className="w-8 h-8 animate-spin text-green-500" />
                        </div>
                    ) : drafts.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>Belum ada draft</p>
                            <p className="text-sm mt-1">Kirim gambar ke WhatsApp untuk membuat draft</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {drafts.map(draft => (
                                <div
                                    key={draft.id}
                                    onClick={() => !processingDraftId && handleDraftClick(draft)}
                                    className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md hover:border-green-300 ${processingDraftId === draft.id ? 'opacity-50 pointer-events-none' : ''
                                        }`}
                                >
                                    <div className="flex gap-4">
                                        {/* Thumbnail */}
                                        <div className="w-20 h-20 flex-shrink-0">
                                            {draft.rawImages && draft.rawImages.length > 0 ? (
                                                <img
                                                    src={draft.rawImages[0]}
                                                    alt="Preview"
                                                    className="w-full h-full object-cover rounded-lg"
                                                />
                                            ) : draft.collageUrl ? (
                                                <img
                                                    src={draft.collageUrl}
                                                    alt="Collage"
                                                    className="w-full h-full object-cover rounded-lg"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                                                    <Package className="w-8 h-8 text-gray-400" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-800 truncate">
                                                {draft.name || 'Produk Tanpa Nama'}
                                            </h3>
                                            <div className="flex flex-wrap gap-2 mt-1 text-xs">
                                                <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                                    {draft.category}
                                                </span>
                                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                    {draft.rawImages?.length || draft.variantCount} gambar
                                                </span>
                                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                                    Rp {(draft.retailPrice || 0).toLocaleString('id-ID')}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-2">
                                                {draft.timestamp?.toDate?.()?.toLocaleString('id-ID') || 'Baru saja'}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-2">
                                            {processingDraftId === draft.id ? (
                                                <Loader className="w-5 h-5 animate-spin text-green-500" />
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={(e) => handleDeleteDraft(draft.id, e)}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Hapus Draft"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                    <div className="p-2 text-green-500">
                                                        <ArrowRight className="w-4 h-4" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 rounded-b-xl">
                    <p className="text-xs text-gray-500 text-center">
                        Klik draft untuk membuka editor upload (sama seperti Tambah Produk Manual)
                    </p>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppInboxModal;
