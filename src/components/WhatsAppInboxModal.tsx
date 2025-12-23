import React, { useState, useEffect } from 'react';
import { X, MessageCircle, ArrowRight, Trash2, Clock, CheckSquare, Square } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { geminiService } from '../services/geminiVisionService';
import { collageService } from '../services/collageService';

interface PendingProduct {
    id: string;
    imageUrl: string;
    caption: string;
    timestamp: any;
    status: 'pending' | 'processed';
    storagePath?: string;
}

interface WhatsAppInboxModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (data: any, originalImage: File) => void;
}

const WhatsAppInboxModal: React.FC<WhatsAppInboxModalProps> = ({ isOpen, onClose, onProcess }) => {
    const [pendingItems, setPendingItems] = useState<PendingProduct[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        // Listen to pending_products
        const q = query(collection(db, 'pending_products'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as PendingProduct[];
            setPendingItems(items);
        });

        return () => unsubscribe();
    }, [isOpen]);

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const selectAll = () => {
        if (selectedIds.size === pendingItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(pendingItems.map(item => item.id)));
        }
    };

    const handleProcessSelected = async () => {
        if (selectedIds.size === 0) return;
        setLoading(true);

        try {
            console.log(`🔄 Processing ${selectedIds.size} WhatsApp Items...`);

            // Get selected items
            const selectedItems = pendingItems.filter(item => selectedIds.has(item.id));

            // 1. Find the best caption (longest one usually contains the details)
            const bestCaptionItem = selectedItems.reduce((prev, current) =>
                (prev.caption?.length || 0) > (current.caption?.length || 0) ? prev : current
            );
            const finalCaption = bestCaptionItem.caption || '';
            console.log('📝 Using Caption from ID:', bestCaptionItem.id);

            // 2. Fetch ALL Images
            const imageFiles: File[] = [];
            for (const item of selectedItems) {
                const response = await fetch(item.imageUrl);
                const blob = await response.blob();
                const file = new File([blob], `wa_${item.id}.jpg`, { type: blob.type });
                imageFiles.push(file);
            }

            // 3. Analyze with Gemini (using the first image + caption)
            // We use the first image for analysis, but the caption is crucial
            console.log('🤖 Analyzing caption and image...');
            const firstImageBase64 = await collageService.fileToBase64(imageFiles[0]);

            // NOTE: We rely heavily on the CAPTION for details, image provides visual context
            const analysis = await geminiService.analyzeCaptionAndImage(firstImageBase64, finalCaption);
            console.log('✅ Analysis result:', analysis);

            // 4. Construct Product Data
            const productData = {
                name: analysis.name || 'Produk Baru',
                description: analysis.description || finalCaption,
                category: analysis.category || 'Gamis',
                retailPrice: analysis.price || 0,
                resellerPrice: analysis.resellerPrice || 0, // New field
                colors: analysis.colors || [],
                sizes: analysis.sizes || [],
                material: analysis.material || '',
                status: analysis.status || 'ready', // New field (PO/Ready)
                images: imageFiles, // Pass ALL images array
                // The parent component handles the collage logic if multiple images exist
            };

            // 5. Pass to Parent
            // We pass the first file as "originalImage" for backward compatibility if needed,
            // but we really want passing the whole array in logic.
            // The `onProcess` signature might need slight adjustment effectively, 
            // but we can attach extra data to the first argument.
            onProcess({
                ...productData,
                whatsappIds: Array.from(selectedIds) // To delete later
            }, imageFiles[0]);

            // Close inbox
            onClose();
            setSelectedIds(new Set());

        } catch (error) {
            console.error('failed to process items', error);
            alert('Gagal memproses item: ' + (error as any).message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Hapus pesan ini?')) return;
        try {
            await deleteDoc(doc(db, 'pending_products', id));
        } catch (error) {
            console.error('failed to delete', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                        <div className="bg-green-100 p-2 rounded-lg">
                            <MessageCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">WhatsApp Inbox</h2>
                            <p className="text-xs text-gray-500">Pilih beberapa foto untuk dijadikan satu produk (Collage)</p>
                        </div>
                        <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs font-medium">
                            {pendingItems.length}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-4 py-2 border-b bg-white flex justify-between items-center">
                    <button
                        onClick={selectAll}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                    >
                        {selectedIds.size === pendingItems.length && pendingItems.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-green-600" />
                        ) : (
                            <Square className="w-4 h-4" />
                        )}
                        Pilih Semua
                    </button>

                    <button
                        onClick={handleProcessSelected}
                        disabled={loading || selectedIds.size === 0}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : `Proses ${selectedIds.size} Item Terpilih`}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>

                {/* List Grid */}
                <div className="overflow-y-auto flex-1 p-4 bg-gray-50/50">
                    {pendingItems.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>Belum ada pesan produk dari WhatsApp.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendingItems.map((item) => {
                                const isSelected = selectedIds.has(item.id);
                                return (
                                    <div
                                        key={item.id}
                                        className={`relative bg-white rounded-xl p-3 shadow-sm border transition-all cursor-pointer group
                                            ${isSelected ? 'border-green-500 ring-2 ring-green-100' : 'border-gray-100 hover:shadow-md'}`}
                                        onClick={() => toggleSelection(item.id)}
                                    >
                                        {/* Selection Checkbox */}
                                        <div className="absolute top-3 right-3 z-10">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors shadow-sm border
                                                ${isSelected ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-transparent hover:border-gray-400'}`}>
                                                <CheckSquare className="w-4 h-4" />
                                            </div>
                                        </div>

                                        <div className="flex gap-3">
                                            {/* Image */}
                                            <div className="w-20 h-28 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                                                <img src={item.imageUrl} alt="Product" className="w-full h-full object-cover" />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                                <div>
                                                    <div className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                                                        <Clock className="w-3 h-3" />
                                                        {item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleString() : 'Baru saja'}
                                                    </div>
                                                    <p className={`text-sm line-clamp-3 whitespace-pre-wrap ${item.caption ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                                                        {item.caption || '(Tanpa Caption)'}
                                                    </p>
                                                </div>

                                                <div className="flex justify-end pt-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(item.id);
                                                        }}
                                                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WhatsAppInboxModal;
