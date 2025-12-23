import React, { useState, useEffect } from 'react';
import { X, MessageCircle, ArrowRight, Trash2, Clock } from 'lucide-react';
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
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

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

    const handleProcess = async (item: PendingProduct) => {
        setProcessingId(item.id);
        setLoading(true);

        try {
            console.log('🔄 Processing WhatsApp Item:', item.id);

            // 1. Fetch Image Blob
            const response = await fetch(item.imageUrl);
            const blob = await response.blob();
            const file = new File([blob], 'whatsapp_image.jpg', { type: item.imageUrl.includes('png') ? 'image/png' : 'image/jpeg' });

            // 2. Convert to Base64 for Gemini
            const base64 = await collageService.fileToBase64(file);

            // 3. Analyze with Gemini
            console.log('🤖 Analyzing caption and image...');
            const analysis = await geminiService.analyzeCaptionAndImage(base64, item.caption);

            console.log('✅ Analysis result:', analysis);

            // 4. Construct Product Data
            const productData = {
                name: analysis.name || 'Produk Baru',
                description: analysis.description || item.caption,
                category: analysis.category || 'Gamis',
                retailPrice: analysis.price || 0,
                colors: analysis.colors || [],
                sizes: analysis.sizes || [],
                material: analysis.material || '',
                image: item.imageUrl, // Use existing URL or upload new file
                // Pass file to parent to handle re-upload if needed, or structured upload
            };

            // 5. Pass to Parent (AdminPage) to open AutoUploadModal/ManualModal
            // We pass the File object so the modal treats it like a fresh upload + metadata
            onProcess({
                ...productData,
                whatsappId: item.id // To delete later
            }, file);

            // Close inbox
            onClose();

        } catch (error) {
            console.error('failed to process item', error);
            alert('Gagal memproses item: ' + (error as any).message);
        } finally {
            setLoading(false);
            setProcessingId(null);
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
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                        <div className="bg-green-100 p-2 rounded-lg">
                            <MessageCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">WhatsApp Inbox</h2>
                        <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs font-medium">
                            {pendingItems.length}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* List */}
                <div className="overflow-y-auto flex-1 p-4 space-y-4 bg-gray-50/50">
                    {pendingItems.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>Belum ada pesan produk dari WhatsApp.</p>
                            <p className="text-sm mt-1 text-gray-400">Jalankan script `whatsapp-bridge` dan kirim pesan ke nomor sendiri.</p>
                        </div>
                    ) : (
                        pendingItems.map((item) => (
                            <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                                <div className="flex gap-4">
                                    {/* Image */}
                                    <div className="w-24 h-32 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden relative group">
                                        <img src={item.imageUrl} alt="Product" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <a href={item.imageUrl} target="_blank" rel="noreferrer" className="text-white text-xs hover:underline">View</a>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="text-xs text-gray-400 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleString() : 'Baru saja'}
                                            </div>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <p className="text-sm text-gray-800 line-clamp-4 whitespace-pre-wrap font-medium">
                                            {item.caption || '(Tanpa Caption)'}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="mt-4 flex justify-end gap-3 border-t pt-3">
                                    <button
                                        onClick={() => handleProcess(item)}
                                        disabled={loading && processingId === item.id}
                                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading && processingId === item.id ? (
                                            <>Processing...</>
                                        ) : (
                                            <>
                                                Proses ke Katalog <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default WhatsAppInboxModal;
