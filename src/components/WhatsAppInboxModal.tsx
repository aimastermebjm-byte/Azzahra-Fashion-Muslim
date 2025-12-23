import React, { useState, useEffect, useMemo } from 'react';
import { X, MessageCircle, ArrowRight, Trash2, Clock, CheckSquare, Square, Layers, Image as ImageIcon, FileText } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { geminiService } from '../services/geminiVisionService';
import { collageService } from '../services/collageService';

interface PendingProduct {
    id: string;
    imageUrl?: string;
    caption: string;
    timestamp: any;
    status: 'pending' | 'processed';
    storagePath?: string;
    type?: 'image' | 'text';
}

interface ProductBundle {
    id: string;
    items: PendingProduct[];
    mainCaption: string;
    images: PendingProduct[];
    timestamp: any;
    itemCount: number;
}

interface WhatsAppInboxModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (data: any, originalImage: File) => void;
}

const WhatsAppInboxModal: React.FC<WhatsAppInboxModalProps> = ({ isOpen, onClose, onProcess }) => {
    const [pendingItems, setPendingItems] = useState<PendingProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'bundles' | 'list'>('bundles');
    const [defaultStock, setDefaultStock] = useState<number>(10);
    const [profitMargin, setProfitMargin] = useState<number>(30000);

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

    // Smart Grouping Logic
    const bundles = useMemo(() => {
        const groups: ProductBundle[] = [];
        const processedIds = new Set<string>();
        const TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes window

        // Sort items by time descending (newest first)
        const sortedItems = [...pendingItems].sort((a, b) =>
            (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
        );

        sortedItems.forEach((item) => {
            if (processedIds.has(item.id)) return;

            const itemTime = (item.timestamp?.seconds || 0) * 1000;

            // Find items close to this one
            const cluster = sortedItems.filter(other => {
                if (processedIds.has(other.id)) return false;
                const otherTime = (other.timestamp?.seconds || 0) * 1000;
                return Math.abs(itemTime - otherTime) <= TIME_WINDOW_MS;
            });

            // Mark as processed
            cluster.forEach(c => processedIds.add(c.id));

            // Extract content
            const images = cluster.filter(c => c.imageUrl);

            // Find best caption: Prefer text-only messages, then longest caption
            const textOnlyItems = cluster.filter(c => c.type === 'text');
            const imageItemsWithCaption = cluster.filter(c => c.type !== 'text' && c.caption);

            let mainCaption = '';

            if (textOnlyItems.length > 0) {
                // Join multiple text messages if any
                mainCaption = textOnlyItems.map(t => t.caption).join('\n\n');
            } else if (imageItemsWithCaption.length > 0) {
                // Fallback to longest image caption
                const best = imageItemsWithCaption.reduce((prev, curr) =>
                    (prev.caption?.length || 0) > (curr.caption?.length || 0) ? prev : curr
                );
                mainCaption = best.caption;
            }

            groups.push({
                id: `bundle_${item.id}`,
                items: cluster,
                mainCaption,
                images,
                timestamp: item.timestamp,
                itemCount: cluster.length
            });
        });

        return groups;
    }, [pendingItems]);

    // Helper: Extract price from text using robust Regex
    const extractPriceFromText = (text: string): number => {
        if (!text) return 0;

        // Remove common separators and normalize
        // Patterns: Rp 150.000, 150rb, 150.000, IDR 150000
        const cleanText = text.toLowerCase();

        // Match "150rb" or "150k" -> 150000
        const kMatch = cleanText.match(/(\d+)(?:[.,]\d+)?\s*(rb|k|ribu)/);
        if (kMatch) {
            const val = parseFloat(kMatch[1].replace(',', '.'));
            return val * 1000;
        }

        // Match standard price format with Rp/IDR prefix or just numbers with dot/comma
        // Look for numbers > 1000 to avoid confusing dates/years/sizes
        const matches = cleanText.match(/(?:rp|idr)?[\s\.]*([\d\.,]+)/g);

        if (matches) {
            // Filter and converting to numbers
            const candidates = matches.map(m => {
                const numStr = m.replace(/[^0-9]/g, ''); // Keep only digits
                return parseInt(numStr, 10);
            }).filter(n => n >= 10000 && n < 10000000); // Filter range usually for clothes

            if (candidates.length > 0) {
                // Return the largest number found (usually price is strictly the most prominent number)
                // Or find most plausible
                return Math.max(...candidates);
            }
        }

        return 0;
    };

    const handleProcessBundle = async (bundle: ProductBundle) => {
        setLoading(true);

        try {
            console.log(`🔄 Processing Bundle ${bundle.id} with ${bundle.images.length} images...`);

            if (bundle.images.length === 0) {
                alert('Bundle ini tidak memiliki gambar!');
                setLoading(false);
                return;
            }

            const finalCaption = bundle.mainCaption || '';
            console.log('📝 Using Bundled Caption:', finalCaption);

            // Fetch ALL Images in Bundle
            const imageFiles: File[] = [];
            for (const item of bundle.images) {
                if (!item.imageUrl) continue;
                try {
                    const response = await fetch(item.imageUrl);
                    const blob = await response.blob();
                    const file = new File([blob], `wa_${item.id}.jpg`, { type: blob.type });
                    imageFiles.push(file);
                } catch (e) {
                    console.error('Failed to load image', item.id, e);
                }
            }

            if (imageFiles.length === 0) {
                throw new Error('Gagal mendownload gambar dari bundle.');
            }

            // Analyze with Gemini
            console.log('🤖 Analyzing bundle...');
            const firstImageBase64 = await collageService.fileToBase64(imageFiles[0]);

            // Generate analysis but PRIORITIZE existing caption
            const analysis = await geminiService.analyzeCaptionAndImage(firstImageBase64, finalCaption);

            // Enhanced Price Logic
            let retailPrice = analysis.price || 0;
            // Override with regex parser if valid, as it's often more accurate for Indo formatting
            const regexPrice = extractPriceFromText(finalCaption);
            if (regexPrice > 0) {
                console.log('💰 Price Override via Regex:', regexPrice);
                retailPrice = regexPrice;
            }

            // Calculate Cost from Margin (Retail - Margin)
            const costPrice = Math.max(0, retailPrice - profitMargin);

            // Construct Data - FORCE use of existing caption
            const productData = {
                name: analysis.name || 'Produk Baru',
                // Logika deskripsi: Jika ada caption asli, gunakan itu. 
                // Jika user ingin AI melengkapi, bisa ditambahkan, tapi amannya kita pakai caption asli di depan.
                description: finalCaption ? finalCaption : (analysis.description || ''),
                category: analysis.category || 'Gamis',
                retailPrice: retailPrice,
                resellerPrice: analysis.resellerPrice || 0,
                costPrice: costPrice, // Pass calculated cost price
                colors: analysis.colors || [],
                sizes: analysis.sizes || [],
                material: analysis.material || '',
                status: analysis.status || 'ready',
                images: imageFiles, // Parent handles collage
                defaultStock: defaultStock // Pass default stock setting
            };

            onProcess({
                ...productData,
                whatsappIds: bundle.items.map(i => i.id) // Mark all valid items as processed
            }, imageFiles[0]);

            onClose();

        } catch (error) {
            console.error('failed to process bundle', error);
            alert('Gagal memproses bundle: ' + (error as any).message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBundle = async (bundle: ProductBundle) => {
        if (!confirm(`Hapus ${bundle.itemCount} pesan dalam bundle ini?`)) return;
        try {
            for (const item of bundle.items) {
                await deleteDoc(doc(db, 'pending_products', item.id));
            }
        } catch (error) {
            console.error('failed to delete bundle', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-green-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-full">
                            <MessageCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">WhatsApp Inbox</h2>
                            <p className="text-sm text-gray-600">Pesan otomatis dikelompokkan (Bundle) agar siap proses.</p>
                        </div>
                        <span className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                            {bundles.length} Bundle
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-4 py-3 border-b bg-white flex flex-col md:flex-row justify-between items-center gap-3">
                    <button
                        onClick={() => { }}
                        className="flex items-center gap-2 text-sm text-gray-600 cursor-default"
                        disabled
                    >
                        {/* Placeholder for future features */}
                        <Layers className="w-4 h-4 text-green-600" />
                        <span className="font-medium">Mode Otomatis</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border">
                            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Stok / Varian:</span>
                            <input
                                type="number"
                                min="1"
                                value={defaultStock}
                                onChange={(e) => setDefaultStock(parseInt(e.target.value) || 0)}
                                className="w-16 text-sm bg-transparent outline-none font-bold text-gray-700 text-right"
                            />
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border">
                            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Potongan Modal:</span>
                            <span className="text-xs text-gray-400">Rp</span>
                            <input
                                type="number"
                                min="0"
                                step="1000"
                                value={profitMargin}
                                onChange={(e) => setProfitMargin(parseInt(e.target.value) || 0)}
                                className="w-24 text-sm bg-transparent outline-none font-bold text-gray-700 text-right"
                            />
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-6 bg-gray-50">
                    {bundles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
                            <p className="text-lg font-medium">Inbox Kosong</p>
                            <p className="text-sm">Belum ada pesan produk baru dari WhatsApp.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {bundles.map((bundle) => (
                                <div key={bundle.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                                    <div className="flex gap-4">
                                        {/* Image Preview Grid */}
                                        <div className="w-1/4 min-w-[120px] max-w-[200px]">
                                            {bundle.images.length > 0 ? (
                                                <div className={`grid gap-1 ${bundle.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} h-32 rounded-lg overflow-hidden`}>
                                                    {bundle.images.slice(0, 4).map((img, idx) => (
                                                        <img key={idx} src={img.imageUrl} className="w-full h-full object-cover" alt="" />
                                                    ))}
                                                    {bundle.images.length > 4 && (
                                                        <div className="bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                                                            +{bundle.images.length - 4}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="h-32 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400">
                                                    <FileText className="w-8 h-8 mb-2" />
                                                    <span className="text-xs">Teks Only</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                                        <Clock className="w-3 h-3" />
                                                        <span>{bundle.timestamp?.seconds ? new Date(bundle.timestamp.seconds * 1000).toLocaleString() : 'Baru saja'}</span>
                                                        <span className="mx-1">•</span>
                                                        <Layers className="w-3 h-3" />
                                                        <span>{bundle.images.length} Gambar</span>
                                                        {bundle.itemCount > bundle.images.length && (
                                                            <span> + {bundle.itemCount - bundle.images.length} Teks</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-sm text-gray-800 line-clamp-3 mb-4 whitespace-pre-wrap font-medium">
                                                {bundle.mainCaption || <span className="italic text-gray-400">Tidak ada caption</span>}
                                            </p>

                                            <div className="flex items-center justify-between mt-auto">
                                                <button
                                                    onClick={() => handleDeleteBundle(bundle)}
                                                    className="text-gray-400 hover:text-red-500 text-sm flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Hapus Bundle
                                                </button>

                                                <button
                                                    onClick={() => handleProcessBundle(bundle)}
                                                    disabled={loading}
                                                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-green-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                                                >
                                                    {loading ? (
                                                        <span className="flex items-center gap-2">Processing...</span>
                                                    ) : (
                                                        <>
                                                            Proses Jadi Produk
                                                            <ArrowRight className="w-4 h-4" />
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WhatsAppInboxModal;
