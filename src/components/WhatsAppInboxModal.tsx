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

    // Detect category from description (smarter than AI guess)
    const detectCategory = (description: string): string => {
        const descLower = description.toLowerCase();

        // Priority order: main product categories first
        // Ignore "set khimar/scarf" as those are SIZE variants, not product category

        // Check for main product types (HIGH PRIORITY)
        if (descLower.match(/\bgamis\b/) && !descLower.match(/set\s+gamis/i)) return 'Gamis';
        if (descLower.match(/\b(setelan|set\s+dress)\b/i)) return 'Setelan';
        if (descLower.match(/\bdress\b/) && !descLower.match(/set\s+dress/i)) return 'Dress';
        if (descLower.match(/\btunik\b/)) return 'Tunik';
        if (descLower.match(/\bouter\b/)) return 'Outer';
        if (descLower.match(/\bmukena\b/)) return 'Mukena';
        if (descLower.match(/\brok\b/)) return 'Rok';
        if (descLower.match(/\bcelana\b/)) return 'Celana';

        // Accessories (LOWER PRIORITY - only if no main product found)
        // Don't detect "khimar" if it appears in "set khimar" context (that's a size variant)
        if (descLower.match(/\bkhimar\b/) && !descLower.match(/set\s+khimar/i)) return 'Khimar';
        if (descLower.match(/\bhijab\b/)) return 'Hijab';
        if (descLower.match(/\bpashmina\b/)) return 'Pashmina';

        // Default to Gamis (most common product type)
        return 'Gamis';
    };

    // Detect brand from description (look for "by [Brand Name]" pattern)
    const detectBrand = (description: string): string => {
        // Pattern 1: "by [Brand Name]" - most reliable
        const byMatch = description.match(/\bby\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i);
        if (byMatch) {
            // Capitalize properly
            return byMatch[1].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }

        // Pattern 2: "Brand: [Name]" or "Merk: [Name]"
        const labelMatch = description.match(/(?:brand|merk)[:\s]+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i);
        if (labelMatch) {
            return labelMatch[1].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }

        return ''; // Not detected
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

            // Initialize finalSizes from draft first
            let finalSizes = draft.sizes && draft.sizes.length > 0 ? draft.sizes : ['All Size'];

            // ========================================
            // READ GEMINI-PARSED DATA FROM DRAFT
            // Backend already parsed with Gemini - just read it!
            // ========================================

            // Read familyVariants (parsed by Gemini for family products)
            const geminiVariants = (draft as any).familyVariants;
            const geminiSetTypes = (draft as any).setTypes;

            console.log('🤖 GEMINI DATA FROM DRAFT:');
            console.log('   familyVariants:', geminiVariants);
            console.log('   setTypes:', geminiSetTypes);

            // If Gemini parsed familyVariants, use it!
            if (geminiVariants && Array.isArray(geminiVariants) && geminiVariants.length > 0) {
                if (!pricesPerVariant) pricesPerVariant = {};

                geminiVariants.forEach((v: { nama?: string, size?: string, hargaRetail?: number, hargaReseller?: number }) => {
                    const sizeName = v.nama || v.size || 'Unknown';
                    // Add to finalSizes if not exists
                    if (!finalSizes.includes(sizeName) && sizeName !== 'Unknown') {
                        if (finalSizes.length === 1 && finalSizes[0] === 'All Size') {
                            finalSizes = [sizeName];
                        } else {
                            finalSizes.push(sizeName);
                        }
                    }
                    // Add pricing
                    if (v.hargaRetail || v.hargaReseller) {
                        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach(label => {
                            const key = `${sizeName}-${label}`;
                            pricesPerVariant![key] = {
                                retail: v.hargaRetail || v.hargaReseller || 0,
                                reseller: v.hargaReseller || v.hargaRetail || 0
                            };
                        });
                    }
                });
                console.log('✅ Used familyVariants from Gemini');
            }

            // If Gemini parsed setTypes (Set Khimar, Set Scarf, etc), use it!
            if (geminiSetTypes && Array.isArray(geminiSetTypes) && geminiSetTypes.length > 0) {
                if (!pricesPerVariant) pricesPerVariant = {};

                geminiSetTypes.forEach((st: { type?: string, hargaRetail?: number, hargaReseller?: number }) => {
                    const sizeName = st.type || 'Unknown';
                    // Add to finalSizes if not exists
                    if (!finalSizes.includes(sizeName) && sizeName !== 'Unknown') {
                        if (finalSizes.length === 1 && finalSizes[0] === 'All Size') {
                            finalSizes = [sizeName];
                        } else {
                            finalSizes.push(sizeName);
                        }
                    }
                    // Add pricing
                    if (st.hargaRetail || st.hargaReseller) {
                        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach(label => {
                            const key = `${sizeName}-${label}`;
                            pricesPerVariant![key] = {
                                retail: st.hargaRetail || st.hargaReseller || 0,
                                reseller: st.hargaReseller || st.hargaRetail || 0
                            };
                        });
                    }
                });
                console.log('✅ Used setTypes from Gemini');
            }

            // Pass to ManualUploadModal at step='upload'
            // Collage will be generated in browser (Cloud Function disabled to save costs)
            // Intelligent Size Detection & Price Extraction (Client Side Override)
            // ONLY run client-side detection if Gemini didn't provide data
            let detectedPricing: Record<string, { retail: number, reseller: number }> = {};

            // Helper to parse price from various formats: "600.000", "550k", "550rb", "Rp 600.000"
            const parsePrice = (str: string): number | null => {
                if (!str) return null;
                const cleaned = str.toLowerCase().replace(/rp\.?\s*/g, '').replace(/\s/g, '');

                // Format: 550k or 550rb
                const kMatch = cleaned.match(/(\d+)[.,]?(\d*)(k|rb)/);
                if (kMatch) {
                    const base = parseInt(kMatch[1]);
                    const decimal = kMatch[2] ? parseInt(kMatch[2]) : 0;
                    return (base * 1000) + (decimal * 100); // 550k -> 550000, 5.5k -> 5500
                }

                // Format: 600.000 (dots as thousands)
                const dotMatch = cleaned.match(/(\d{1,3}(?:\.\d{3})+)/);
                if (dotMatch) {
                    return parseInt(dotMatch[0].replace(/\./g, ''));
                }

                // Format: plain number 600000
                const plainMatch = cleaned.match(/(\d{4,})/);
                if (plainMatch) {
                    return parseInt(plainMatch[0]);
                }

                return null;
            };

            // Helper to extract retail & reseller prices from a text block
            const extractPricesFromBlock = (block: string): { retail: number | null, reseller: number | null } => {
                const lower = block.toLowerCase();
                let retail: number | null = null;
                let reseller: number | null = null;

                // Look for "retail" keyword
                const retailMatch = lower.match(/retail[:\s]*([^\n,;]+)/i);
                if (retailMatch) {
                    retail = parsePrice(retailMatch[1]);
                }

                // Look for "reseller" or "agen" keyword
                const resellerMatch = lower.match(/(reseller|agen)[:\s]*([^\n,;]+)/i);
                if (resellerMatch) {
                    reseller = parsePrice(resellerMatch[2]);
                }

                return { retail, reseller };
            };

            // Only try detect if AI detected nothing specific (default 'All Size') OR force smarter detection
            if (JSON.stringify(finalSizes) === '["All Size"]' || finalSizes.length === 0) {
                const descLower = draft.description.toLowerCase();
                const matches: string[] = [];

                // Urutan prioritas/deteksi + Price Check
                const patterns = [
                    // Existing patterns - JANGAN DIUBAH
                    { label: 'Set Scarf', keys: ['set scarf', 'set scraf', 'scarf set'] },
                    { label: 'Set Khimar', keys: ['set khimar', 'khimar set'] },
                    { label: 'Set Syari', keys: ['set syari', 'syari set'] },
                    { label: 'Gamis Only', keys: ['gamis only', 'dress only'] },

                    // Family patterns - Mom Look variations
                    { label: 'Mom Look I Scarf', keys: ['mom look i set scraf', 'mom look i ciki set scraf', 'look i set scarf', 'look l set scraf'] },
                    { label: 'Mom Look I Syari', keys: ['mom look i set syari', 'mom look i niesa', 'look i set syari', 'look l set syari'] },
                    { label: 'Mom Look II Scarf', keys: ['mom look ii set scraf', 'mom look ii nuy', 'look ii set scraf', 'look ll set scraf'] },
                    { label: 'Mom Look II Syari', keys: ['mom look ii set syari', 'mom look ii adel', 'look ii set syari', 'look ll set syari'] },

                    // === FAMILY: MOM / IBU / BUNDA / MAMA ===
                    {
                        label: 'Mom', keys: [
                            'mom ', 'mom:', 'size mom', 'size chart mom', 'gamis mom', 'dress mom',
                            'ibu ', 'ibu:', 'size ibu', 'gamis ibu', 'baju ibu',
                            'bunda ', 'bunda:', 'size bunda', 'gamis bunda', 'baju bunda',
                            'mama ', 'mama:', 'size mama', 'gamis mama', 'baju mama',
                            'mommy', 'mami'
                        ]
                    },

                    // === FAMILY: DAD / AYAH / BAPAK / PAPA ===
                    {
                        label: 'Dad', keys: [
                            'dad ', 'dad:', 'dadd ', 'daddy', 'dady', 'size dad', 'size chart dad',
                            'size chart daddy', 'dadd n boy', 'baju dad', 'koko dad',
                            'ayah ', 'ayah:', 'size ayah', 'koko ayah', 'baju ayah',
                            'abah ', 'abah:', 'size abah', 'koko abah', 'baju abah',
                            'bapak ', 'bapak:', 'size bapak', 'koko bapak', 'baju bapak',
                            'papa ', 'papa:', 'size papa', 'koko papa', 'baju papa',
                            'papi', 'daddy lengan'
                        ]
                    },

                    // === FAMILY: BOY / ANAK LAKI / COWOK ===
                    {
                        label: 'Boy', keys: [
                            'boy ', 'boy:', 'boys', 'size boy', 'size chart boy', 'size chart anak boy',
                            'anak boy', 'boy lengan', 'koko boy', 'baju boy',
                            'anak laki', 'anak laki-laki', 'anak laki2', 'anak lelaki',
                            'anak cowok', 'anak cowo', 'size anak laki', 'koko anak laki',
                            'junior laki', 'junior cowok', 'junior boy'
                        ]
                    },

                    // === FAMILY: GIRL / ANAK PEREMPUAN / CEWEK ===
                    {
                        label: 'Girl', keys: [
                            'girl ', 'girl:', 'girls', 'size girl', 'size chart girl', 'size curt anak girls',
                            'anak girl', 'anak girls', 'gamis girl', 'baju girl', 'dress girl',
                            'anak cewe', 'anak cewek', 'anak cew', 'anak perempuan', 'anak wanita',
                            'size anak cewe', 'size anak perempuan', 'gamis anak cewe', 'gamis anak perempuan',
                            'junior cewe', 'junior cewek', 'junior perempuan', 'junior girl'
                        ]
                    }
                ];

                // Enhanced price extractor: also look for "S : 460.000" or "= 245.000" format
                const extractEnhancedPrices = (block: string, isReseller: boolean): { retail: number | null, reseller: number | null } => {
                    let retail: number | null = null;
                    let reseller: number | null = null;

                    // Try standard retail/reseller keywords first
                    const retailMatch = block.match(/retail[:\s]*([^\n,;]+)/i);
                    if (retailMatch) retail = parsePrice(retailMatch[1]);

                    const resellerMatch = block.match(/(reseller|agen)[:\s]*([^\n,;]+)/i);
                    if (resellerMatch) reseller = parsePrice(resellerMatch[2]);

                    // If no keyword found, try to extract first price in block
                    if (!retail && !reseller) {
                        // Match patterns like ": 460.000" or "= 245.000" or "Rp 460.000"
                        const priceMatches = block.match(/[:\s=]\s*((?:rp\.?\s*)?[\d.,]+(?:k|rb)?)/gi);
                        if (priceMatches && priceMatches.length > 0) {
                            const firstPrice = parsePrice(priceMatches[0]);
                            if (firstPrice) {
                                if (isReseller) {
                                    reseller = firstPrice;
                                    // Estimate retail as reseller + ~20%
                                    retail = Math.round(firstPrice * 1.2);
                                } else {
                                    retail = firstPrice;
                                    reseller = Math.round(firstPrice * 0.85);
                                }
                            }
                        }
                    }

                    return { retail, reseller };
                };

                // Check which section we're in (RESELLER or RETAIL)
                const isResellerSection = descLower.indexOf('harga reseller') < descLower.indexOf('harga retail') ||
                    (descLower.includes('harga reseller') && !descLower.includes('harga retail'));

                // Helper to extract size+price pairs from a block: "S : 400.000", "M = 410k", etc.
                const extractSizePrices = (block: string): Array<{ size: string, price: number }> => {
                    const results: Array<{ size: string, price: number }> = [];
                    const sizes = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL'];

                    sizes.forEach(size => {
                        // Match patterns: "S : 400.000", "S = 400k", "S: Rp 400.000", "S pb 90 / ld 72 (3-5 th) = Rp 460.000"
                        const regex = new RegExp(`\\b${size}\\b[^\\n]*?[=:]\\s*((?:rp\\.?\\s*)?[\\d.,]+(?:k|rb)?)`, 'i');
                        const match = block.match(regex);
                        if (match) {
                            const price = parsePrice(match[1]);
                            if (price && price > 10000) { // Minimum valid price
                                results.push({ size, price });
                            }
                        }
                    });

                    return results;
                };

                // Family type patterns that should have per-size pricing
                const familyTypeLabels = ['Mom', 'Dad', 'Boy', 'Girl'];

                patterns.forEach(p => {
                    const foundKey = p.keys.find(k => descLower.includes(k));
                    if (foundKey) {
                        // Extract block of text after keyword (larger block for size chart)
                        const idx = descLower.indexOf(foundKey);
                        const block = draft.description.substring(idx, idx + 500);

                        // Check if this is a family type that might have per-size pricing
                        if (familyTypeLabels.includes(p.label)) {
                            const sizePrices = extractSizePrices(block);

                            if (sizePrices.length > 0) {
                                // Generate combined labels: "Dad S", "Dad M", etc.
                                sizePrices.forEach(sp => {
                                    const combinedLabel = `${p.label} ${sp.size}`;
                                    matches.push(combinedLabel);

                                    const price = sp.price;
                                    detectedPricing[combinedLabel] = {
                                        retail: isResellerSection ? Math.round(price * 1.2) : price,
                                        reseller: isResellerSection ? price : Math.round(price * 0.85)
                                    };
                                });
                            } else {
                                // Fallback: no per-size pricing, use single price
                                matches.push(p.label);
                                const prices = extractEnhancedPrices(block, isResellerSection);
                                if (prices.retail || prices.reseller) {
                                    detectedPricing[p.label] = {
                                        retail: prices.retail || prices.reseller || 0,
                                        reseller: prices.reseller || prices.retail || 0
                                    };
                                }
                            }
                        } else {
                            // Non-family patterns (Set Scarf, Set Khimar, etc.) - single price
                            matches.push(p.label);
                            const prices = extractEnhancedPrices(block, isResellerSection);
                            if (prices.retail || prices.reseller) {
                                detectedPricing[p.label] = {
                                    retail: prices.retail || prices.reseller || 0,
                                    reseller: prices.reseller || prices.retail || 0
                                };
                            }
                        }
                    }
                });

                if (matches.length > 0) {
                    finalSizes = matches;
                }
            }

            // Merge detected prices into pricesPerVariant (Flood fill A-J 10 variants to be safe)
            if (Object.keys(detectedPricing).length > 0) {
                if (!pricesPerVariant) pricesPerVariant = {};

                finalSizes.forEach(size => {
                    const priceData = detectedPricing[size];
                    if (priceData && (priceData.retail || priceData.reseller)) {
                        // Generate for labels A-J (Top 10 variants)
                        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach(label => {
                            const key = `${size}-${label}`;
                            if (!pricesPerVariant![key]) {
                                pricesPerVariant![key] = {
                                    retail: priceData.retail || 0,
                                    reseller: priceData.reseller || 0
                                };
                            }
                        });
                    }
                });
            }

            // DEBUG: Log detected data before sending to ManualUploadModal
            console.log('🔍 FAMILY DETECTION DEBUG:');
            console.log('   finalSizes:', finalSizes);
            console.log('   detectedPricing:', JSON.stringify(detectedPricing, null, 2));
            console.log('   pricesPerVariant:', JSON.stringify(pricesPerVariant, null, 2));

            onProcess({
                step: 'upload', // Start at upload step, collage will be auto-generated in browser
                images: imageFiles,
                productData: {
                    name: draft.name,
                    brand: draft.brand || detectBrand(draft.description) || '',  // Auto-detect brand from description
                    description: draft.description,
                    category: detectCategory(draft.description),  // Smart detect from description, default Gamis
                    retailPrice: draft.retailPrice,
                    resellerPrice: draft.resellerPrice,
                    costPrice: draft.costPrice,
                    variants: {
                        sizes: finalSizes
                    },
                    pricesPerVariant: pricesPerVariant,
                    variantNames: (draft as any).variantNames
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
