import React, { useState, useMemo } from 'react';
import { X, Upload, Settings, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { collageService } from '../services/collageService';
import { useGlobalProducts } from '../hooks/useGlobalProducts';

interface ManualUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (productData: any) => void;
    categories: string[];
    initialState?: {
        step?: 'upload' | 'details';
        images?: File[];
        collageBlob?: Blob;
        collageUrl?: string; // Support for pre-uploaded collage from Draft
        productData?: {
            name: string;
            brand?: string;
            description: string;
            category: string;
            retailPrice: number;
            resellerPrice: number;
            costPrice: number;
            variants?: {
                sizes: string[];
                colors: string[];
                stock: Record<string, Record<string, number>>;
            };
            pricesPerVariant?: Record<string, { retail: number, reseller: number }>;
        };
        uploadSettings?: {
            stockPerVariant?: number;
            costPrice?: number;
            pricingRules?: PricingRule[];
        };
    };
}

interface PricingRule {
    id: string;
    minCost: number;
    maxCost: number;
    retailMarkup: number; // In Rupiah (not %)
}

interface UploadSettings {
    stockPerVariant: number;
    costPrice: number;
    pricingRules: PricingRule[]; // Rules untuk menghitung harga reseller berdasarkan range modal
    retailMarkup: number; // Tambahan dari reseller untuk harga retail
}

// Default pricing rules untuk reseller (berdasarkan range harga modal)
const DEFAULT_PRICING_RULES: PricingRule[] = [
    { id: '1', minCost: 0, maxCost: 50000, retailMarkup: 25000 },
    { id: '2', minCost: 50001, maxCost: 100000, retailMarkup: 35000 },
    { id: '3', minCost: 100001, maxCost: 150000, retailMarkup: 50000 },
    { id: '4', minCost: 150001, maxCost: 200000, retailMarkup: 60000 },
    { id: '5', minCost: 200001, maxCost: 999999, retailMarkup: 75000 },
];

// Size preset options
const SIZE_PRESETS = ['All Size', 'S', 'M', 'L', 'XL'];

const ManualUploadModal: React.FC<ManualUploadModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    categories,
    initialState
}) => {
    // Brand options - from products + fallback common brands
    const { allProducts: products } = useGlobalProducts();
    const fallbackBrands = ['Agus Hanggono', 'Alila', 'Bungas', 'Elzatta', 'Endomoda', 'Hikmat', 'Marghon', 'Mayra', 'Nibras', 'Rahnem', 'Zoya'];
    const brandOptions = useMemo(() => {
        const fromProducts = products.map((p: any) => p.brand).filter(Boolean);
        const combined = Array.from(new Set([...fallbackBrands, ...fromProducts]));
        return combined.sort() as string[];
    }, [products]);
    const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);

    // Step management
    const [step, setStep] = useState<'upload' | 'details' | 'preview'>('upload');

    // Images state
    const [images, setImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);

    // Collage state
    const [collageBlob, setCollageBlob] = useState<Blob | null>(null);
    const [collagePreview, setCollagePreview] = useState<string>('');
    const [isGeneratingCollage, setIsGeneratingCollage] = useState(false);

    // Variant count from draft (when images array is empty)
    const [draftVariantCount, setDraftVariantCount] = useState<number>(0);

    // Selected image index for tap-to-swap reordering
    const [selectedSwapIndex, setSelectedSwapIndex] = useState<number | null>(null);
    const [customSizeInput, setCustomSizeInput] = useState('');
    // New: Checkbox state for each image (True = Main Variant/Label A-Z, False = Detail/No Label)
    const [isVariant, setIsVariant] = useState<boolean[]>([]);

    // Initialize from initialState when isOpen changes
    React.useEffect(() => {
        if (isOpen && initialState) {
            console.log('📦 ManualUploadModal OPENED', { initialState }); // DEBUG
            if (initialState.step) setStep(initialState.step);

            if (initialState.images && initialState.images.length > 0) {
                setImages(initialState.images);
                const previews = initialState.images.map(file => URL.createObjectURL(file));
                setImagePreviews(previews);
            }

            if (initialState.collageBlob) {
                setCollageBlob(initialState.collageBlob);
                setCollagePreview(URL.createObjectURL(initialState.collageBlob));
            }
            // Handle URL (From Draft Queue)
            else if (initialState.collageUrl) {
                setCollagePreview(initialState.collageUrl);
                // Fetch blob for form submission compatibility
                fetch(initialState.collageUrl)
                    .then(res => res.blob())
                    .then(blob => setCollageBlob(blob))
                    .catch(err => console.error('Failed to load collage blob:', err));
            }

            // Set variant count from draft productData
            if (initialState.productData?.variants?.colors) {
                setDraftVariantCount(initialState.productData.variants.colors.length);
            }

            if (initialState.productData) {
                setProductFormData(prev => ({
                    ...prev,
                    name: initialState.productData?.name || '',
                    brand: initialState.productData?.brand || '',
                    description: initialState.productData?.description || '',
                    category: initialState.productData?.category || categories[0] || 'gamis',
                }));

                // Set sizes from draft
                if (initialState.productData?.variants?.sizes) {
                    setSelectedSizes(initialState.productData.variants.sizes);
                }

                // Set variant names from draft
                if ((initialState.productData as any)?.variantNames) {
                    setVariantNames((initialState.productData as any).variantNames);
                }

                // Set cost price per size from draft
                if ((initialState.productData as any)?.costPricePerSize) {
                    setCostPricePerSize((initialState.productData as any).costPricePerSize);
                }

                // Set prices per variant from draft
                if (initialState.productData?.pricesPerVariant) {
                    console.log('💰 Setting pricesPerVariant from Draft:', initialState.productData.pricesPerVariant); // DEBUG
                    setPricesPerVariant(initialState.productData.pricesPerVariant);
                    setShowPricePerVariant(true);
                } else {
                    console.log('⚠️ No pricesPerVariant in productData'); // DEBUG
                }

                // Load initial stock if available (from WhatsApp Inbox)
                if (initialState.productData?.variants?.stock && initialState.productData?.variants?.colors) {
                    const initialStock: Record<string, string> = {};
                    // Assuming 'All Size' or generic size key for flat structure
                    const sizes = initialState.productData.variants.sizes;
                    const colors = initialState.productData.variants.colors;
                    const stockMatrix = initialState.productData.variants.stock;

                    const primarySize = sizes[0] || 'All Size';

                    // Map nested stock to flat stockPerVariant (Color -> Stock)
                    colors.forEach(color => {
                        const val = stockMatrix[primarySize]?.[color];
                        if (val !== undefined) initialStock[color] = String(val);
                    });

                    setProductFormData(prev => ({ ...prev, stockPerVariant: initialStock }));
                }

                if (initialState.uploadSettings) {
                    setUploadSettings(prev => ({
                        ...prev,
                        ...initialState.uploadSettings
                    }));
                } else if (initialState.productData?.costPrice) {
                    setUploadSettings(prev => ({
                        ...prev,
                        costPrice: initialState.productData?.costPrice || 100000
                    }));
                }

                // Set fixed prices if available
                if (initialState.productData?.retailPrice || initialState.productData?.resellerPrice) {
                    setFixedPrices({
                        retail: initialState.productData.retailPrice,
                        reseller: initialState.productData.resellerPrice
                    });
                } else {
                    setFixedPrices(null);
                }
            }
        }
    }, [isOpen, initialState]);

    // Helper to calculate labels (A, B...) skipping non-variant images
    const getCalculatedLabels = (count: number, flags: boolean[]) => {
        const labels: string[] = [];
        let counter = 0;
        for (let i = 0; i < count; i++) {
            if (flags[i] !== false) { // Default true
                // Generate label A, B, C...
                let label = '';
                let n = counter;
                while (n >= 0) {
                    label = String.fromCharCode(65 + (n % 26)) + label;
                    n = Math.floor(n / 26) - 1;
                }
                labels.push(label);
                counter++;
            } else {
                labels.push('');
            }
        }
        return labels;
    };

    // Variant labels (A, B, C, ...) 
    const variantLabels = useMemo(() => {
        if (images.length > 0) {
            return getCalculatedLabels(images.length, isVariant);
        }
        return collageService.generateVariantLabels(draftVariantCount);
    }, [images.length, draftVariantCount, isVariant]);

    // Active variant labels (exclude empty strings/details) for Matrix & Submission
    const activeVariantLabels = useMemo(() => variantLabels.filter(l => l !== ''), [variantLabels]);

    // Product form data
    const [productFormData, setProductFormData] = useState({
        name: '',
        brand: '',
        description: '',
        category: '', // Empty initially, will be set from initialState or default
        stockPerVariant: {} as Record<string, string>
    });

    // Set default category when categories prop changes (only if not already set)
    React.useEffect(() => {
        if (!productFormData.category && categories.length > 0 && !initialState?.productData?.category) {
            setProductFormData(prev => ({ ...prev, category: categories[0] || 'gamis' }));
        }
    }, [categories, initialState]);

    // Load saved pricing rules from localStorage
    const getSavedPricingRules = (): PricingRule[] => {
        try {
            const saved = localStorage.getItem('azzahra_pricing_rules');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('Error loading pricing rules:', e);
        }
        return DEFAULT_PRICING_RULES;
    };

    const getSavedRetailMarkup = (): number => {
        try {
            const saved = localStorage.getItem('azzahra_retail_markup');
            if (saved) return parseInt(saved) || 20000;
        } catch (e) {
            console.error('Error loading retail markup:', e);
        }
        return 20000;
    };

    // Settings (Parameter) - Reseller = Modal + markup(berdasarkan range), Retail = Reseller + retailMarkup
    const [uploadSettings, setUploadSettings] = useState<UploadSettings>(() => ({
        stockPerVariant: 0, // Default kosong (0 akan jadi empty string di display)
        costPrice: 0, // Default kosong
        pricingRules: getSavedPricingRules(), // Load dari localStorage
        retailMarkup: getSavedRetailMarkup(), // Load dari localStorage
    }));

    // Auto-save pricing rules to localStorage when they change
    React.useEffect(() => {
        try {
            localStorage.setItem('azzahra_pricing_rules', JSON.stringify(uploadSettings.pricingRules));
            localStorage.setItem('azzahra_retail_markup', String(uploadSettings.retailMarkup));
        } catch (e) {
            console.error('Error saving pricing rules:', e);
        }
    }, [uploadSettings.pricingRules, uploadSettings.retailMarkup]);

    // Selected sizes from presets - MULTI SELECT
    const [selectedSizes, setSelectedSizes] = useState<string[]>(['All Size']);

    // Show pricing rules panel
    const [showPricingRules, setShowPricingRules] = useState(false);

    // Show price per size/variant panel (expandable)
    const [showPricePerVariant, setShowPricePerVariant] = useState(false);
    // Show stock matrix (expandable) - collapsed by default in step 2
    const [showStockMatrix, setShowStockMatrix] = useState(false);
    // Key format: "Size-Label" (e.g., "S-A", "XL-B")
    const [pricesPerVariant, setPricesPerVariant] = useState<Record<string, { retail: number, reseller: number }>>({});
    // Editable variant names: key is label (A, B, C), value is custom name for checkout
    // Collage will still show A, B, C but checkout shows "A (Scarf)", "B (Khimar)" etc
    const [variantNames, setVariantNames] = useState<Record<string, string>>({});
    // Cost price per size type (e.g., "Set Khimar": 400000, "Set Scarf": 500000)
    const [costPricePerSize, setCostPricePerSize] = useState<Record<string, number>>({});

    // Family Mode: Group sizes by category (Mom Dress, Kid Dress, etc)
    const [familyMode, setFamilyMode] = useState(false);
    // Family Groups: { "Mom Dress": ["S", "M", "L"], "Kid Dress": ["2", "4", "6"] }
    const [familyGroups, setFamilyGroups] = useState<Record<string, string[]>>({});
    // Preset size options for family groups
    const FAMILY_SIZE_PRESETS = {
        adult: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
        kid: ['2', '4', '6', '8', '10', '12'],
        baby: ['0-6M', '6-12M', '12-18M', '18-24M'],
    };
    // Preset group names
    const FAMILY_GROUP_PRESETS = ['Mom Dress', 'Mom Set Khimar', 'Mom Set Scarf', 'Dad Koko', 'Kid Dress', 'Kid Set', 'Baby Romper'];

    // Generate flat selectedSizes from familyGroups
    React.useEffect(() => {
        if (familyMode && Object.keys(familyGroups).length > 0) {
            const flatSizes: string[] = [];
            Object.entries(familyGroups).forEach(([groupName, sizes]) => {
                sizes.forEach(size => {
                    flatSizes.push(`${groupName} ${size}`);
                });
            });
            if (flatSizes.length > 0) {
                setSelectedSizes(flatSizes);
            }
        }
    }, [familyMode, familyGroups]);

    // Auto-generate collage when images change
    React.useEffect(() => {
        const autoGenerateCollage = async () => {
            if (images.length === 0) {
                setCollageBlob(null);
                setCollagePreview('');
                return;
            }

            setIsGeneratingCollage(true);
            try {
                const labels = getCalculatedLabels(images.length, isVariant);
                const blob = await collageService.generateCollage(images, labels);
                setCollageBlob(blob);
                setCollagePreview(URL.createObjectURL(blob));
            } catch (error) {
                console.error('Auto collage generation failed:', error);
            } finally {
                setIsGeneratingCollage(false);
            }
        };

        autoGenerateCollage();
    }, [images, isVariant]);

    // State for fixed prices (from WhatsApp/Initial State) to prevent auto-calculation override
    const [fixedPrices, setFixedPrices] = useState<{ retail?: number, reseller?: number } | null>(null);

    // NEW FORMULA: Reseller = Modal + markup (berdasarkan range pricing rules)
    const resellerPrice = useMemo(() => {
        if (fixedPrices?.reseller) return fixedPrices.reseller;

        const { costPrice, pricingRules } = uploadSettings;

        // Find matching rule based on cost price range
        const matchingRule = pricingRules.find(
            rule => costPrice >= rule.minCost && costPrice <= rule.maxCost
        );

        if (matchingRule) {
            return costPrice + matchingRule.retailMarkup;
        }

        // Fallback: use highest rule
        const highestRule = pricingRules.reduce((prev, current) =>
            (prev.maxCost > current.maxCost) ? prev : current
        );
        return costPrice + highestRule.retailMarkup;
    }, [uploadSettings.costPrice, uploadSettings.pricingRules, fixedPrices]);

    const retailPrice = useMemo(() => {
        if (fixedPrices?.retail) return fixedPrices.retail;
        return resellerPrice + uploadSettings.retailMarkup;
    }, [resellerPrice, uploadSettings.retailMarkup, fixedPrices]);

    // Auto-initialize pricesPerVariant when sizes, variants, or base prices change
    // IMPORTANT: Don't overwrite values that already exist (e.g., from draft)
    React.useEffect(() => {
        setPricesPerVariant(prev => {
            const next = { ...prev };
            let hasChanges = false;

            selectedSizes.forEach(size => {
                activeVariantLabels.forEach(label => {
                    const key = `${size}-${label}`;
                    // Only add if key doesn't exist (preserve user edits)
                    if (!next[key]) {
                        next[key] = {
                            retail: retailPrice,
                            reseller: resellerPrice
                        };
                        hasChanges = true;
                    }
                });
            });

            return hasChanges ? next : prev;
        });
    }, [selectedSizes, activeVariantLabels, retailPrice, resellerPrice]);

    // Helper untuk format angka ribuan
    const formatThousands = (num: number): string => {
        if (num === 0) return '';
        return num.toLocaleString('id-ID');
    };

    const parseFormattedNumber = (str: string): number => {
        return parseInt(str.replace(/\./g, '')) || 0;
    };

    // Handle image upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newFiles = Array.from(files);
        const validFiles = newFiles.filter(file => {
            const isValid = file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024;
            return isValid;
        });

        if (validFiles.length + images.length > 10) {
            alert('Maksimal 10 gambar');
            return;
        }

        // Create previews
        const newPreviews = validFiles.map(file => URL.createObjectURL(file));

        setImages(prev => [...prev, ...validFiles]);
        setImagePreviews(prev => [...prev, ...newPreviews]);
        setIsVariant(prev => [...prev, ...Array(validFiles.length).fill(true)]);

        // Initialize stock for new variants
        const newStockPerVariant = { ...productFormData.stockPerVariant };
        const startIndex = images.length;
        validFiles.forEach((_, index) => {
            const label = String.fromCharCode(65 + startIndex + index);
            newStockPerVariant[label] = String(uploadSettings.stockPerVariant);
        });
        setProductFormData(prev => ({ ...prev, stockPerVariant: newStockPerVariant }));
    };

    // Remove image
    const handleRemoveImage = (index: number) => {
        URL.revokeObjectURL(imagePreviews[index]);
        setImages(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
        setIsVariant(prev => prev.filter((_, i) => i !== index));

        // Re-index stock
        const newStockPerVariant: Record<string, string> = {};
        const remainingCount = images.length - 1;
        for (let i = 0; i < remainingCount; i++) {
            const label = String.fromCharCode(65 + i);
            newStockPerVariant[label] = productFormData.stockPerVariant[label] || String(uploadSettings.stockPerVariant);
        }
        setProductFormData(prev => ({ ...prev, stockPerVariant: newStockPerVariant }));
    };



    // Handle submit
    const handleSubmit = () => {
        if (!productFormData.name) {
            alert('Nama produk wajib diisi');
            return;
        }

        if (!collageBlob) {
            alert('Collage belum dibuat');
            return;
        }

        // Calculate total stock from all Size-Varian combinations
        let totalStock = 0;
        selectedSizes.forEach((size) => {
            activeVariantLabels.forEach((label) => {
                const key = `${size}-${label}`;
                const defaultStock = uploadSettings.stockPerVariant || 0;
                const editedValue = productFormData.stockPerVariant[key];
                const stock = editedValue !== undefined
                    ? parseInt(editedValue || '0')
                    : defaultStock;
                totalStock += stock;
            });
        });

        if (totalStock === 0) {
            alert('Stok minimal 1 untuk salah satu varian');
            return;
        }

        // Build stock matrix for all size × variant combinations using user-edited values
        const stockMatrix: Record<string, Record<string, number>> = {};
        selectedSizes.forEach((size) => {
            stockMatrix[size] = {};
            activeVariantLabels.forEach((label) => {
                // Use key format "Size-Varian" (e.g., "S-A", "M-B")
                const key = `${size}-${label}`;
                const defaultStock = uploadSettings.stockPerVariant || 0;
                const editedValue = productFormData.stockPerVariant[key];
                // Use edited value if exists, otherwise use default from parameter
                const finalStock = editedValue !== undefined
                    ? parseInt(editedValue || '0')
                    : defaultStock;
                stockMatrix[size][label] = finalStock;
            });
        });

        // Determine Final Display Price (Min Price from Matrix if enabled)
        let finalRetailPrice = String(retailPrice);
        let finalResellerPrice = String(resellerPrice);

        if (showPricePerVariant) {
            let minRet = Number.MAX_VALUE;
            let minRes = Number.MAX_VALUE;
            let found = false;

            selectedSizes.forEach(size => {
                activeVariantLabels.forEach(label => {
                    const key = `${size}-${label}`;
                    const p = pricesPerVariant[key];
                    const r = p?.retail || retailPrice;
                    const res = p?.reseller || resellerPrice;

                    if (r < minRet) minRet = r;
                    if (res < minRes) minRes = res;
                    found = true;
                });
            });

            if (found && minRet !== Number.MAX_VALUE) {
                finalRetailPrice = String(minRet);
                finalResellerPrice = String(minRes);
            }
        }

        const productData = {
            name: productFormData.name,
            brand: productFormData.brand,
            description: productFormData.description,
            category: productFormData.category,
            retailPrice: finalRetailPrice,
            resellerPrice: finalResellerPrice,
            costPrice: String(uploadSettings.costPrice),
            costPricePerSize: Object.keys(costPricePerSize).length > 0 ? costPricePerSize : null,
            stockPerVariant: productFormData.stockPerVariant,
            totalStock,
            variantLabels: activeVariantLabels,
            variantNames, // Custom names for checkout: {A: "Scarf", B: "Khimar", ...}
            variantCount: activeVariantLabels.length,
            collageBlob,
            collageFile: new File([collageBlob], `collage-${Date.now()}.jpg`, { type: 'image/jpeg' }),
            uploadMode: 'direct',
            sizeName: selectedSizes.join(', '), // Display all selected sizes
            // New: Include complete variants structure with all selected sizes
            variants: {
                sizes: selectedSizes,
                colors: activeVariantLabels,
                stock: stockMatrix,
                // Include per-variant pricing if data exists (not just based on UI toggle)
                prices: Object.keys(pricesPerVariant).length > 0 ? pricesPerVariant : null,
                names: variantNames // Custom names for checkout
            },
            // Build pricesPerVariant with CORRECT keys matching activeVariantLabels
            // This ensures ProductDetail can find the price using "Size-Color" key
            pricesPerVariant: (() => {
                if (Object.keys(pricesPerVariant).length === 0) return null;

                // Re-build with correct keys: Size-ActiveLabel
                const correctedPrices: Record<string, { retail: number; reseller: number }> = {};

                // Get unique sizes from existing keys
                const existingSizes = [...new Set(Object.keys(pricesPerVariant).map(k => k.split('-')[0]))];

                // For each size, map the prices to activeVariantLabels
                selectedSizes.forEach(size => {
                    // Find matching prices for this size from original data
                    const sizeEntry = existingSizes.find(s => s === size);

                    activeVariantLabels.forEach((label, idx) => {
                        const newKey = `${size}-${label}`;

                        // Try to find existing price by size + index position (A=0, B=1, etc)
                        const alphabet = 'ABCDEFGHIJ';
                        const originalKey = `${size}-${alphabet[idx] || alphabet[0]}`;

                        if (pricesPerVariant[originalKey]) {
                            correctedPrices[newKey] = pricesPerVariant[originalKey];
                        } else if (pricesPerVariant[`${size}-A`]) {
                            // Fallback: use first variant price for this size
                            correctedPrices[newKey] = pricesPerVariant[`${size}-A`];
                        }
                    });
                });

                console.log('🔄 Corrected pricesPerVariant keys:', correctedPrices);
                return Object.keys(correctedPrices).length > 0 ? correctedPrices : null;
            })()
        };

        onSuccess(productData);
        handleReset();
        onClose();
    };

    // Auto-paste from clipboard if field is empty
    const handleAutoPaste = async (field: 'name' | 'description') => {
        if (productFormData[field]) return; // Don't overwrite existing content

        try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim().length > 0) {
                setProductFormData(prev => ({ ...prev, [field]: text }));
            }
        } catch (error) {
            console.error('Failed to read clipboard:', error);
            // Fail silently - user can manual paste
        }
    };

    // Reset form
    const handleReset = () => {
        imagePreviews.forEach(url => URL.revokeObjectURL(url));
        if (collagePreview) URL.revokeObjectURL(collagePreview);

        setImages([]);
        setImagePreviews([]);
        setIsVariant([]);
        setCollageBlob(null);
        setCollagePreview('');
        setStep('upload');
        setProductFormData({
            name: '',
            brand: '',
            description: '',
            category: categories[0] || 'gamis',
            stockPerVariant: {}
        });
        setCostPricePerSize({});
        setFamilyMode(false);
        setFamilyGroups({});
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">
                            Tambah Produk Manual (Collage)
                        </h2>
                        <p className="text-sm text-gray-500">
                            Step: {step === 'upload' ? '1. Upload Gambar' : step === 'details' ? '2. Detail Produk' : '3. Preview'}
                        </p>
                    </div>
                    <button
                        onClick={() => { handleReset(); onClose(); }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Step 1: Upload Images */}
                    {step === 'upload' && (
                        <div className="space-y-6">
                            {/* Upload Area (Moved to Top) */}
                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-purple-400 transition-colors bg-gray-50">
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    id="manual-image-upload"
                                />
                                <label htmlFor="manual-image-upload" className="cursor-pointer block">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Upload className="w-8 h-8 text-purple-500" />
                                        <p className="text-gray-700 font-bold">Tap untuk Upload Gambar</p>
                                        <p className="text-xs text-gray-400">Banyak gambar (Jpg/Png)</p>
                                    </div>
                                </label>
                            </div>

                            {/* Image Previews with Reorder & Variant Names */}
                            {images.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-medium text-gray-700">📷 Gambar ({images.length})</h4>
                                        {selectedSwapIndex !== null && (
                                            <span className="text-xs text-purple-600 font-medium">🔄 Pilih target swap</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded-lg">
                                        💡 <strong>Tap 2x berbeda</strong> untuk tukar posisi. <strong>Pakai panah</strong> untuk geser.
                                    </p>
                                    <div className="overflow-x-auto pb-2">
                                        <div className="grid grid-cols-5 gap-2 min-w-[500px] md:min-w-0">
                                            {imagePreviews.map((preview, index) => {
                                                const isSelected = selectedSwapIndex === index;
                                                return (
                                                    <div key={index} className="space-y-1">
                                                        <div
                                                            className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${isSelected ? 'border-purple-500 ring-2 ring-purple-300 scale-105 z-10' : 'border-gray-200 hover:border-purple-300'
                                                                }`}
                                                            onClick={() => {
                                                                if (selectedSwapIndex === null) {
                                                                    // First tap: select
                                                                    setSelectedSwapIndex(index);
                                                                } else if (selectedSwapIndex === index) {
                                                                    // Tap same: deselect
                                                                    setSelectedSwapIndex(null);
                                                                } else {
                                                                    // Second tap: swap
                                                                    const fromIdx = selectedSwapIndex;
                                                                    const newImages = [...images];
                                                                    const newPreviews = [...imagePreviews];
                                                                    [newImages[fromIdx], newImages[index]] = [newImages[index], newImages[fromIdx]];
                                                                    [newPreviews[fromIdx], newPreviews[index]] = [newPreviews[index], newPreviews[fromIdx]];
                                                                    setImages(newImages);

                                                                    // Swap isVariant
                                                                    const newIsVariant = [...isVariant];
                                                                    const tempV = newIsVariant[selectedSwapIndex];
                                                                    newIsVariant[selectedSwapIndex] = newIsVariant[index];
                                                                    newIsVariant[index] = tempV;
                                                                    setIsVariant(newIsVariant);
                                                                    setImagePreviews(newPreviews);
                                                                    setSelectedSwapIndex(null);
                                                                }
                                                            }}
                                                        >
                                                            <img
                                                                src={preview}
                                                                alt={`Preview ${index + 1}`}
                                                                className="w-full aspect-[3/4] object-cover"
                                                            />
                                                            {isSelected && (
                                                                <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                                                                    <span className="text-white text-xl font-bold">✓</span>
                                                                </div>
                                                            )}

                                                            {/* Label badge */}
                                                            <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shadow-sm">
                                                                {variantLabels[index]}
                                                            </div>

                                                            {/* Delete button - Fixed Size & Position */}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemoveImage(index);
                                                                }}
                                                                className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full text-white text-xs font-bold hover:bg-red-600 transition-colors shadow-md flex items-center justify-center z-20"
                                                            >
                                                                ×
                                                            </button>

                                                            {/* Variant Toggle Checkbox - Compact */}
                                                            <div
                                                                className="absolute bottom-1 right-1 z-10 bg-white/90 rounded shadow-sm flex items-center justify-center w-5 h-5 cursor-pointer hover:bg-white transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const newFlags = [...isVariant];
                                                                    for (let i = 0; i < images.length; i++) if (newFlags[i] === undefined) newFlags[i] = true;
                                                                    newFlags[index] = !newFlags[index];
                                                                    setIsVariant(newFlags);
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isVariant[index] !== false}
                                                                    readOnly
                                                                    className="w-3.5 h-3.5 accent-purple-600 cursor-pointer"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Editable variant name */}
                                                        <input
                                                            type="text"
                                                            value={variantNames[variantLabels[index]] || ''}
                                                            onChange={(e) => setVariantNames(prev => ({
                                                                ...prev,
                                                                [variantLabels[index]]: e.target.value
                                                            }))}
                                                            onFocus={(e) => e.target.select()}
                                                            placeholder={`${variantLabels[index]}`}
                                                            className="w-full px-1 py-1 text-[10px] text-center border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500 bg-gray-50"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>


                                    <p className="text-[10px] text-gray-400 text-center">
                                        Nama varian akan tampil saat checkout. Collage tetap pakai huruf A, B, C...
                                    </p>
                                </div>
                            )}



                            {/* Product Details - After Image Upload, Before Parameter Produk */}
                            {images.length > 0 && (
                                <div className="bg-white rounded-xl p-4 border border-gray-200">
                                    <h3 className="font-medium text-gray-700 mb-3">📝 Detail Produk</h3>
                                    <div className="space-y-4">
                                        {/* Product Name */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Nama Produk *
                                            </label>
                                            <textarea
                                                value={productFormData.name}
                                                onChange={(e) => setProductFormData(prev => ({ ...prev, name: e.target.value }))}
                                                onClick={() => handleAutoPaste('name')}
                                                placeholder="Contoh: Gamis Syari Premium (Tap untuk memperbesar)"
                                                rows={1}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 min-h-[42px] focus:h-32 transition-[height] duration-300 ease-in-out resize-none"
                                            />
                                        </div>

                                        {/* Brand Selection */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Merk / Brand
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={productFormData.brand}
                                                    onChange={(e) => {
                                                        setProductFormData(prev => ({ ...prev, brand: e.target.value }));
                                                        setShowBrandSuggestions(true);
                                                    }}
                                                    onFocus={() => setShowBrandSuggestions(true)}
                                                    onBlur={() => setTimeout(() => setShowBrandSuggestions(false), 200)}
                                                    placeholder="Pilih atau ketik merk..."
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                                    autoComplete="off"
                                                />

                                                {/* Custom Dropdown Suggestions */}
                                                {showBrandSuggestions && (
                                                    <div className="absolute z-50 w-full bg-white border border-gray-300 rounded-b-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                                                        {brandOptions.filter(b => b.toLowerCase().includes(productFormData.brand.toLowerCase())).length > 0 ? (
                                                            brandOptions
                                                                .filter(b => b.toLowerCase().includes(productFormData.brand.toLowerCase()))
                                                                .map((brand, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="px-3 py-2 hover:bg-purple-50 cursor-pointer text-gray-700 hover:text-purple-700 transition-colors border-b border-gray-50 last:border-0"
                                                                        onClick={() => {
                                                                            setProductFormData(prev => ({ ...prev, brand }));
                                                                            setShowBrandSuggestions(false);
                                                                        }}
                                                                    >
                                                                        {brand}
                                                                    </div>
                                                                ))
                                                        ) : (
                                                            <div className="px-3 py-2 text-gray-400 text-sm italic">
                                                                Ketik untuk membuat merk baru...
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Deskripsi (Opsional)
                                            </label>
                                            <textarea
                                                value={productFormData.description}
                                                onChange={(e) => setProductFormData(prev => ({ ...prev, description: e.target.value }))}
                                                onClick={() => handleAutoPaste('description')}
                                                placeholder="Deskripsi produk... (Tap untuk memperbesar)"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 min-h-[80px] h-[80px] focus:h-48 transition-[height] duration-300 ease-in-out resize-none"
                                            />
                                        </div>

                                        {/* Category */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Kategori
                                            </label>
                                            <select
                                                value={productFormData.category}
                                                onChange={(e) => setProductFormData(prev => ({ ...prev, category: e.target.value }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                            >
                                                {categories.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Settings Panel */}
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <Settings className="w-6 h-6 text-purple-600" />
                                    <h3 className="text-lg font-bold text-purple-800">Parameter Produk</h3>
                                </div>

                                {/* Size Preset - MULTI SELECT with Smart Toggle */}
                                <div className="mb-5">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium text-gray-700">Pilih Ukuran</label>
                                        {/* Family Mode Toggle - Hide if family data already detected */}
                                        {(() => {
                                            // Check if sizes contain family patterns (auto-detected)
                                            const familyKeywords = ['dad', 'mom', 'boy', 'girl', 'ayah', 'bunda', 'ibu'];
                                            const hasFamilyData = selectedSizes.some(size =>
                                                familyKeywords.some(kw => size.toLowerCase().includes(kw))
                                            );

                                            // DON'T auto-set familyMode - let user keep normal SIZE_PRESETS visible
                                            // Family sizes will show as Custom Sizes instead

                                            // Show indicator if family data detected, but keep as clickable toggle
                                            if (hasFamilyData) {
                                                return (
                                                    <span className="px-3 py-1 rounded-lg text-xs font-medium bg-green-600 text-white">
                                                        ✅ Keluarga Terdeteksi
                                                    </span>
                                                );
                                            }

                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newFamilyMode = !familyMode;
                                                        setFamilyMode(newFamilyMode);

                                                        if (newFamilyMode && selectedSizes.length === 1 && selectedSizes[0] === 'All Size') {
                                                            setSelectedSizes([]);
                                                        } else if (!newFamilyMode) {
                                                            setFamilyGroups({});
                                                            if (selectedSizes.length === 0) {
                                                                setSelectedSizes(['All Size']);
                                                            }
                                                        }
                                                    }}
                                                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${familyMode
                                                        ? 'bg-pink-600 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-pink-100 hover:text-pink-600'
                                                        }`}
                                                >
                                                    👨‍👩‍👧‍👦 Mode Keluarga
                                                </button>
                                            );
                                        })()}
                                    </div>

                                    {!familyMode ? (
                                        /* Normal Size Mode */
                                        <div className="flex flex-wrap gap-2">
                                            {SIZE_PRESETS.map((size) => {
                                                const isSelected = selectedSizes.includes(size);
                                                return (
                                                    <button
                                                        key={size}
                                                        type="button"
                                                        onClick={() => {
                                                            if (size === 'All Size') {
                                                                setSelectedSizes(['All Size']);
                                                            } else {
                                                                if (isSelected) {
                                                                    const newSizes = selectedSizes.filter(s => s !== size);
                                                                    if (newSizes.length === 0) {
                                                                        setSelectedSizes(['All Size']);
                                                                    } else {
                                                                        setSelectedSizes(newSizes);
                                                                    }
                                                                } else {
                                                                    const sizesWithoutAllSize = selectedSizes.filter(s => s !== 'All Size');
                                                                    setSelectedSizes([...sizesWithoutAllSize, size]);
                                                                }
                                                            }
                                                        }}
                                                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isSelected
                                                            ? 'bg-purple-600 text-white shadow-md'
                                                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {isSelected && '✓ '}{size}
                                                    </button>
                                                );
                                            })}

                                            {/* Custom Sizes */}
                                            {selectedSizes.filter(s => !SIZE_PRESETS.includes(s)).map((size) => (
                                                <button
                                                    key={size}
                                                    type="button"
                                                    onClick={() => setSelectedSizes(selectedSizes.filter(s => s !== size))}
                                                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-purple-600 text-white shadow-md flex items-center gap-1"
                                                >
                                                    {size} <span className="text-purple-200 hover:text-white">×</span>
                                                </button>
                                            ))}

                                            {/* Custom Size Input */}
                                            <input
                                                type="text"
                                                value={customSizeInput}
                                                onChange={(e) => setCustomSizeInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const val = customSizeInput.trim();
                                                        if (val && !selectedSizes.includes(val)) {
                                                            setSelectedSizes(prev => {
                                                                const sizesWithoutAllSize = prev.filter(s => s !== 'All Size');
                                                                return [...sizesWithoutAllSize, val];
                                                            });
                                                            setCustomSizeInput('');
                                                        }
                                                    }
                                                }}
                                                placeholder="+ Custom (Enter)"
                                                className="px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 w-32 focus:w-56 transition-all"
                                            />
                                        </div>
                                    ) : (
                                        /* Family Mode - Group Editor */
                                        <div className="space-y-3 p-3 bg-pink-50 border border-pink-200 rounded-xl">
                                            <p className="text-xs text-pink-600">Tambah grup ukuran untuk setiap anggota keluarga</p>

                                            {/* Existing Groups */}
                                            {Object.entries(familyGroups).map(([groupName, sizes]) => (
                                                <div key={groupName} className="bg-white rounded-lg p-3 border border-pink-100">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-semibold text-pink-800">{groupName}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newGroups = { ...familyGroups };
                                                                delete newGroups[groupName];
                                                                setFamilyGroups(newGroups);
                                                            }}
                                                            className="text-red-500 hover:text-red-700 text-xs"
                                                        >
                                                            Hapus
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {/* Size preset buttons based on group type */}
                                                        {(groupName.toLowerCase().includes('kid') || groupName.toLowerCase().includes('anak')
                                                            ? FAMILY_SIZE_PRESETS.kid
                                                            : groupName.toLowerCase().includes('baby') || groupName.toLowerCase().includes('bayi')
                                                                ? FAMILY_SIZE_PRESETS.baby
                                                                : FAMILY_SIZE_PRESETS.adult
                                                        ).map(size => {
                                                            const isSelected = sizes.includes(size);
                                                            return (
                                                                <button
                                                                    key={size}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setFamilyGroups(prev => ({
                                                                            ...prev,
                                                                            [groupName]: isSelected
                                                                                ? prev[groupName].filter(s => s !== size)
                                                                                : [...prev[groupName], size]
                                                                        }));
                                                                    }}
                                                                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${isSelected
                                                                        ? 'bg-pink-600 text-white'
                                                                        : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                                                                        }`}
                                                                >
                                                                    {size}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Add New Group */}
                                            <div className="flex flex-wrap gap-2">
                                                {FAMILY_GROUP_PRESETS.filter(g => !familyGroups[g]).map(groupName => (
                                                    <button
                                                        key={groupName}
                                                        type="button"
                                                        onClick={() => {
                                                            setFamilyGroups(prev => ({
                                                                ...prev,
                                                                [groupName]: [] // Start with empty sizes, user picks
                                                            }));
                                                        }}
                                                        className="px-3 py-2 border-2 border-dashed border-pink-300 rounded-lg text-xs font-medium text-pink-600 hover:bg-pink-100 transition-all"
                                                    >
                                                        + {groupName}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Summary */}
                                            {selectedSizes.length > 0 && (
                                                <div className="text-xs text-pink-700 mt-2">
                                                    📦 Total varian: <strong>{selectedSizes.length} size × {activeVariantLabels.length} warna = {selectedSizes.length * activeVariantLabels.length} kombinasi</strong>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Stack Parameters: Stock -> Modal -> Reseller -> Retail */}
                                <div className="space-y-4 mb-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Stok per Varian</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={formatThousands(uploadSettings.stockPerVariant)}
                                            onChange={(e) => setUploadSettings(prev => ({ ...prev, stockPerVariant: parseFormattedNumber(e.target.value) }))}
                                            onFocus={(e) => e.target.select()}
                                            placeholder="Masukkan stok"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg font-semibold focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-800 mb-1">Harga Modal</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={formatThousands(uploadSettings.costPrice)}
                                            onChange={(e) => setUploadSettings(prev => ({ ...prev, costPrice: parseFormattedNumber(e.target.value) }))}
                                            onFocus={(e) => e.target.select()}
                                            placeholder="100.000"
                                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-lg font-bold focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-blue-700 mb-1">Harga Reseller (Otomatis)</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={formatThousands(resellerPrice)}
                                            onChange={(e) => setFixedPrices(prev => ({
                                                ...prev,
                                                reseller: parseFormattedNumber(e.target.value)
                                            }))}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl text-lg font-bold text-blue-700 bg-blue-50 focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-green-700 mb-1">Harga Retail (Otomatis)</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={formatThousands(retailPrice)}
                                            onChange={(e) => setFixedPrices(prev => ({
                                                ...prev,
                                                retail: parseFormattedNumber(e.target.value)
                                            }))}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full px-4 py-3 border-2 border-green-200 rounded-xl text-lg font-bold text-green-700 bg-green-50 focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>

                                    {/* Modal per Jenis (Size Type) - Only show if multiple sizes */}
                                    {selectedSizes.length > 1 && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                            <label className="block text-sm font-bold text-amber-800 mb-2">💰 Modal per Jenis</label>
                                            <p className="text-xs text-amber-600 mb-2">Set modal berbeda untuk tiap jenis (untuk hitung rugi/laba akurat)</p>
                                            <div className="space-y-2">
                                                {selectedSizes.map((size, sizeIndex) => (
                                                    <div key={size} className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={size}
                                                            onChange={(e) => {
                                                                const newSizes = [...selectedSizes];
                                                                newSizes[sizeIndex] = e.target.value;
                                                                setSelectedSizes(newSizes);
                                                            }}
                                                            onFocus={(e) => e.target.select()}
                                                            className="w-36 px-2 py-1 text-sm font-bold text-amber-900 bg-amber-100 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500"
                                                        />
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={formatThousands(costPricePerSize[size] || uploadSettings.costPrice)}
                                                            onChange={(e) => {
                                                                const val = parseFormattedNumber(e.target.value);
                                                                setCostPricePerSize(prev => ({ ...prev, [size]: val }));
                                                            }}
                                                            onFocus={(e) => e.target.select()}
                                                            placeholder={formatThousands(uploadSettings.costPrice)}
                                                            className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-amber-500"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Expandable Price per Variant Matrix */}
                                {/* Show when: multiple sizes OR showPricePerVariant is true (set from draft) */}
                                {/* Always show container so user can toggle it */}
                                <div className="mb-5 border border-orange-200 rounded-xl overflow-hidden bg-white">
                                    <button
                                        type="button"
                                        onClick={() => setShowPricePerVariant(!showPricePerVariant)}
                                        className="w-full px-4 py-3 bg-orange-50 text-left flex justify-between items-center"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-orange-800">
                                                💰 Harga Khusus Size/Varian?
                                            </span>
                                            <span className="text-[10px] text-orange-600 font-normal">
                                                (Isi jika harga berbeda tiap varian)
                                            </span>
                                        </div>
                                        <span className="text-orange-600">
                                            {showPricePerVariant ? '▲ Tutup' : '▼ Mulai'}
                                        </span>
                                    </button>

                                    {showPricePerVariant && (
                                        <div className="p-4 space-y-6">
                                            {/* Retail Price Matrix */}
                                            <div>
                                                <h4 className="text-sm font-bold text-green-700 mb-3">Matrix Harga Retail</h4>
                                                <div className="overflow-x-auto pb-2">
                                                    <table className="w-full">
                                                        <thead>
                                                            <tr className="bg-green-50">
                                                                <th className="p-3 text-left border border-green-100 min-w-[80px]">Size</th>
                                                                {activeVariantLabels.map(label => (
                                                                    <th key={label} className="p-3 text-center border border-green-100 min-w-[80px] font-bold text-green-800">{label}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {selectedSizes.map((size, sizeIndex) => (
                                                                <tr key={size}>
                                                                    <td className="p-2 font-bold border border-green-100 bg-green-50/50">
                                                                        <input
                                                                            type="text"
                                                                            value={size}
                                                                            onChange={(e) => {
                                                                                const newSizes = [...selectedSizes];
                                                                                const oldSize = newSizes[sizeIndex];
                                                                                const newSize = e.target.value;
                                                                                newSizes[sizeIndex] = newSize;
                                                                                setSelectedSizes(newSizes);

                                                                                // Also update pricesPerVariant keys
                                                                                const updatedPrices: typeof pricesPerVariant = {};
                                                                                Object.entries(pricesPerVariant).forEach(([key, val]) => {
                                                                                    const newKey = key.replace(`${oldSize}-`, `${newSize}-`);
                                                                                    updatedPrices[newKey] = val;
                                                                                });
                                                                                setPricesPerVariant(updatedPrices);
                                                                            }}
                                                                            onFocus={(e) => e.target.select()}
                                                                            className="w-full px-2 py-1 text-sm font-bold bg-transparent border-0 focus:ring-2 focus:ring-green-500 rounded min-w-[80px]"
                                                                        />
                                                                    </td>
                                                                    {activeVariantLabels.map(label => {
                                                                        const key = `${size}-${label}`;
                                                                        return (
                                                                            <td key={key} className="p-2 border border-green-100">
                                                                                <input
                                                                                    type="text"
                                                                                    inputMode="numeric"
                                                                                    value={formatThousands(pricesPerVariant[key]?.retail || retailPrice)}
                                                                                    onChange={(e) => {
                                                                                        const val = parseFormattedNumber(e.target.value);
                                                                                        setPricesPerVariant(prev => ({
                                                                                            ...prev,
                                                                                            [key]: {
                                                                                                ...(prev[key] || { reseller: resellerPrice }),
                                                                                                retail: val
                                                                                            }
                                                                                        }));
                                                                                    }}
                                                                                    onFocus={(e) => e.target.select()}
                                                                                    className="w-full px-2 py-3 text-center bg-white border border-green-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-green-500 shadow-sm min-w-[90px]"
                                                                                    placeholder="0"
                                                                                />
                                                                            </td>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Reseller Price Matrix */}
                                            <div>
                                                <h4 className="text-sm font-bold text-blue-700 mb-3">Matrix Harga Reseller</h4>
                                                <div className="overflow-x-auto pb-2">
                                                    <table className="w-full">
                                                        <thead>
                                                            <tr className="bg-blue-50">
                                                                <th className="p-3 text-left border border-blue-100 min-w-[80px]">Size</th>
                                                                {activeVariantLabels.map(label => (
                                                                    <th key={label} className="p-3 text-center border border-blue-100 min-w-[80px] font-bold text-blue-800">{label}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {selectedSizes.map((size, sizeIndex) => (
                                                                <tr key={size}>
                                                                    <td className="p-2 font-bold border border-blue-100 bg-blue-50/50">
                                                                        <input
                                                                            type="text"
                                                                            value={size}
                                                                            onChange={(e) => {
                                                                                const newSizes = [...selectedSizes];
                                                                                const oldSize = newSizes[sizeIndex];
                                                                                const newSize = e.target.value;
                                                                                newSizes[sizeIndex] = newSize;
                                                                                setSelectedSizes(newSizes);

                                                                                // Also update pricesPerVariant keys
                                                                                const updatedPrices: typeof pricesPerVariant = {};
                                                                                Object.entries(pricesPerVariant).forEach(([key, val]) => {
                                                                                    const newKey = key.replace(`${oldSize}-`, `${newSize}-`);
                                                                                    updatedPrices[newKey] = val;
                                                                                });
                                                                                setPricesPerVariant(updatedPrices);
                                                                            }}
                                                                            onFocus={(e) => e.target.select()}
                                                                            className="w-full px-2 py-1 text-sm font-bold bg-transparent border-0 focus:ring-2 focus:ring-blue-500 rounded min-w-[80px]"
                                                                        />
                                                                    </td>
                                                                    {activeVariantLabels.map(label => {
                                                                        const key = `${size}-${label}`;
                                                                        return (
                                                                            <td key={key} className="p-2 border border-blue-100">
                                                                                <input
                                                                                    type="text"
                                                                                    inputMode="numeric"
                                                                                    value={formatThousands(pricesPerVariant[key]?.reseller || resellerPrice)}
                                                                                    onChange={(e) => {
                                                                                        const val = parseFormattedNumber(e.target.value);
                                                                                        setPricesPerVariant(prev => ({
                                                                                            ...prev,
                                                                                            [key]: {
                                                                                                ...(prev[key] || { retail: retailPrice }),
                                                                                                reseller: val
                                                                                            }
                                                                                        }));
                                                                                    }}
                                                                                    onFocus={(e) => e.target.select()}
                                                                                    className="w-full px-2 py-3 text-center bg-white border border-blue-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 shadow-sm min-w-[90px]"
                                                                                    placeholder="0"
                                                                                />
                                                                            </td>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pricing Rules Editor (Moved Retail Markup Inside) */}
                            <div className="mb-5 border border-blue-200 rounded-xl overflow-hidden bg-white">
                                <button
                                    type="button"
                                    onClick={() => setShowPricingRules(!showPricingRules)}
                                    className="w-full px-4 py-3 bg-blue-50 text-left flex justify-between items-center"
                                >
                                    <span className="text-sm font-medium text-blue-800">
                                        ⚙️ Aturan Harga & Markup
                                    </span>
                                    <span className="text-blue-600 text-xs">
                                        {showPricingRules ? '▲ Tutup' : '▼ Setup'}
                                    </span>
                                </button>

                                {showPricingRules && (
                                    <div className="p-4 space-y-5">
                                        {/* Retail Markup Input (Moved Here) */}
                                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                            <label className="block text-xs font-bold text-green-800 mb-1">Selisih Retail - Reseller (Markup Retail)</label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={formatThousands(uploadSettings.retailMarkup)}
                                                onChange={(e) => setUploadSettings(prev => ({ ...prev, retailMarkup: parseFormattedNumber(e.target.value) }))}
                                                onFocus={(e) => e.target.select()}
                                                className="w-full px-3 py-2 border border-green-300 rounded-lg text-base font-bold text-green-700 focus:ring-1 focus:ring-green-500"
                                            />
                                            <p className="text-[10px] text-green-600 mt-1">Retail = Harga Reseller + Nilai ini</p>
                                        </div>

                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 mb-2">
                                                Rumus Reseller = Modal + Markup (berdasarkan grafik range):
                                            </p>
                                            <div className="space-y-3">
                                                {uploadSettings.pricingRules.map((rule, index) => (
                                                    <div key={rule.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs font-bold text-gray-500">Range #{index + 1}</span>
                                                            {uploadSettings.pricingRules.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newRules = uploadSettings.pricingRules.filter((_, i) => i !== index);
                                                                        setUploadSettings(prev => ({ ...prev, pricingRules: newRules }));
                                                                    }}
                                                                    className="text-xs text-red-500"
                                                                >
                                                                    Hapus
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                                            <div>
                                                                <label className="block text-[10px] text-gray-500">Min Modal</label>
                                                                <input
                                                                    type="text"
                                                                    value={formatThousands(rule.minCost)}
                                                                    onChange={(e) => {
                                                                        const newRules = [...uploadSettings.pricingRules];
                                                                        newRules[index] = { ...rule, minCost: parseFormattedNumber(e.target.value) };
                                                                        setUploadSettings(prev => ({ ...prev, pricingRules: newRules }));
                                                                    }}
                                                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] text-gray-500">Max Modal</label>
                                                                <input
                                                                    type="text"
                                                                    value={formatThousands(rule.maxCost)}
                                                                    onChange={(e) => {
                                                                        const newRules = [...uploadSettings.pricingRules];
                                                                        newRules[index] = { ...rule, maxCost: parseFormattedNumber(e.target.value) };
                                                                        setUploadSettings(prev => ({ ...prev, pricingRules: newRules }));
                                                                    }}
                                                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-blue-600 font-bold">+ Markup Reseller (Cuan)</label>
                                                            <input
                                                                type="text"
                                                                value={formatThousands(rule.retailMarkup)}
                                                                onChange={(e) => {
                                                                    const newRules = [...uploadSettings.pricingRules];
                                                                    newRules[index] = { ...rule, retailMarkup: parseFormattedNumber(e.target.value) };
                                                                    setUploadSettings(prev => ({ ...prev, pricingRules: newRules }));
                                                                }}
                                                                className="w-full px-2 py-2 text-base font-bold text-blue-700 bg-blue-50 border border-blue-300 rounded"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const lastRule = uploadSettings.pricingRules[uploadSettings.pricingRules.length - 1];
                                                    const newRule: PricingRule = {
                                                        id: Date.now().toString(),
                                                        minCost: lastRule ? lastRule.maxCost + 1 : 0,
                                                        maxCost: lastRule ? lastRule.maxCost + 100000 : 100000,
                                                        retailMarkup: lastRule ? lastRule.retailMarkup + 10000 : 30000
                                                    };
                                                    setUploadSettings(prev => ({
                                                        ...prev,
                                                        pricingRules: [...prev.pricingRules, newRule]
                                                    }));
                                                }}
                                                className="w-full mt-3 py-2 border border-dashed border-blue-400 rounded-lg text-blue-600 text-sm font-medium hover:bg-blue-50"
                                            >
                                                + Tambah Range Rule
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>




                            {/* Auto-Generated Collage Preview (Moved to Bottom) */}
                            {images.length > 0 && (
                                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200 mb-6">
                                    <h3 className="font-medium text-purple-700 mb-3 text-center">🖼️ Preview Collage (Auto)</h3>
                                    <div className="aspect-[3/4] w-full max-w-xs mx-auto bg-white rounded-xl overflow-hidden border-2 border-purple-300 shadow-lg">
                                        {isGeneratingCollage ? (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <div className="text-center">
                                                    <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                                    <p className="text-sm text-purple-600">Membuat collage...</p>
                                                </div>
                                            </div>
                                        ) : collagePreview ? (
                                            <img
                                                src={collagePreview}
                                                alt="Collage Preview"
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <X className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                <p className="text-xs">No preview</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Go to Preview Button */}
                            {images.length > 0 && collageBlob && (
                                <button
                                    onClick={() => setStep('details')}
                                    disabled={isGeneratingCollage || !productFormData.name}
                                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
                                >
                                    {isGeneratingCollage ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Sedang membuat collage...
                                        </span>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            <Check className="w-5 h-5" />
                                            Lanjut ke Preview →
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>
                    )}


                    {/* Step 2: Details */}
                    {step === 'details' && (
                        <div className="space-y-6">
                            {/* Collage Preview */}
                            {/* 1. Large Collage Preview */}
                            <div className="w-full">
                                <h3 className="font-medium text-gray-700 mb-2 text-center">Preview Collage</h3>
                                <div className="aspect-[3/4] w-full max-w-sm mx-auto bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative">
                                    {isGeneratingCollage ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
                                            <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                            <p className="text-sm text-purple-600">Memproses collage...</p>
                                        </div>
                                    ) : (
                                        <img
                                            src={collagePreview}
                                            alt="Collage Preview"
                                            className="w-full h-full object-contain"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* 2. Product Info - Editable */}
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                                <h4 className="font-medium text-purple-800 mb-3">📦 Informasi Produk</h4>
                                <div className="space-y-3">
                                    {/* Nama Produk */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Nama Produk</label>
                                        <input
                                            type="text"
                                            value={productFormData.name}
                                            onChange={(e) => setProductFormData(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                                            placeholder="Nama produk..."
                                        />
                                    </div>

                                    {/* Kategori & Brand */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">Kategori</label>
                                            <select
                                                value={productFormData.category}
                                                onChange={(e) => setProductFormData(prev => ({ ...prev, category: e.target.value }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                                            >
                                                {categories.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="relative">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">Brand</label>
                                            <input
                                                type="text"
                                                value={productFormData.brand}
                                                onChange={(e) => {
                                                    setProductFormData(prev => ({ ...prev, brand: e.target.value }));
                                                    setShowBrandSuggestions(true);
                                                }}
                                                onFocus={() => setShowBrandSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowBrandSuggestions(false), 200)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                                                placeholder="Pilih atau ketik brand..."
                                                autoComplete="off"
                                            />
                                            {/* Brand Suggestions Dropdown */}
                                            {showBrandSuggestions && (
                                                <div className="absolute z-50 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-32 overflow-y-auto">
                                                    {brandOptions.filter(b => b.toLowerCase().includes(productFormData.brand.toLowerCase())).length > 0 ? (
                                                        brandOptions
                                                            .filter(b => b.toLowerCase().includes(productFormData.brand.toLowerCase()))
                                                            .slice(0, 5)
                                                            .map((brand, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="px-3 py-2 hover:bg-purple-50 cursor-pointer text-gray-700 hover:text-purple-700 transition-colors border-b border-gray-50 last:border-0 text-sm"
                                                                    onClick={() => {
                                                                        setProductFormData(prev => ({ ...prev, brand }));
                                                                        setShowBrandSuggestions(false);
                                                                    }}
                                                                >
                                                                    {brand}
                                                                </div>
                                                            ))
                                                    ) : (
                                                        <div className="px-3 py-2 text-gray-400 text-xs italic">
                                                            Ketik untuk membuat brand baru...
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Deskripsi */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Deskripsi</label>
                                        <textarea
                                            value={productFormData.description}
                                            onChange={(e) => setProductFormData(prev => ({ ...prev, description: e.target.value }))}
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 bg-white resize-none"
                                            placeholder="Deskripsi produk..."
                                        />
                                    </div>

                                    {/* Size */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Size</label>
                                        <div className="flex flex-wrap gap-2">
                                            {SIZE_PRESETS.map(size => (
                                                <button
                                                    key={size}
                                                    onClick={() => {
                                                        if (selectedSizes.includes(size)) {
                                                            setSelectedSizes(prev => prev.filter(s => s !== size));
                                                        } else {
                                                            setSelectedSizes(prev => [...prev, size]);
                                                        }
                                                    }}
                                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selectedSizes.includes(size)
                                                        ? 'bg-purple-600 text-white'
                                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                                        }`}
                                                >
                                                    {size}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Price Summary - Editable */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="font-medium text-gray-700 mb-2">Ringkasan Harga</h4>
                                <div className="space-y-4 text-sm max-w-sm mx-auto">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Harga Modal</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={formatThousands(uploadSettings.costPrice)}
                                            onChange={(e) => setUploadSettings(prev => ({ ...prev, costPrice: parseFormattedNumber(e.target.value) }))}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg font-bold focus:ring-2 focus:ring-purple-500 bg-white"
                                            placeholder="0"
                                        />
                                    </div>

                                    {/* Modal per Jenis (Size Type) - Only show if multiple sizes */}
                                    {selectedSizes.length > 1 && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                            <label className="block text-sm font-bold text-amber-800 mb-2">💰 Modal per Jenis</label>
                                            <div className="space-y-2">
                                                {selectedSizes.map(size => (
                                                    <div key={size} className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-amber-700 w-28 truncate">{size}:</span>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={formatThousands(costPricePerSize[size] || uploadSettings.costPrice)}
                                                            onChange={(e) => {
                                                                const val = parseFormattedNumber(e.target.value);
                                                                setCostPricePerSize(prev => ({ ...prev, [size]: val }));
                                                            }}
                                                            onFocus={(e) => e.target.select()}
                                                            placeholder={formatThousands(uploadSettings.costPrice)}
                                                            className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-amber-500"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-bold text-green-700 mb-1">Harga Jual (Retail)</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={formatThousands(retailPrice)}
                                            onChange={(e) => setFixedPrices(prev => ({ ...prev, retail: parseFormattedNumber(e.target.value) }))}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full px-4 py-3 border-2 border-green-400 rounded-xl text-lg font-bold text-green-700 bg-green-50 focus:ring-2 focus:ring-green-500"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-blue-700 mb-1">Harga Reseller</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={formatThousands(resellerPrice)}
                                            onChange={(e) => setFixedPrices(prev => ({ ...prev, reseller: parseFormattedNumber(e.target.value) }))}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full px-4 py-3 border-2 border-blue-400 rounded-xl text-lg font-bold text-blue-700 bg-blue-50 focus:ring-2 focus:ring-blue-500"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                {/* Expand Harga per Size/Varian - show when multiple sizes OR has pricing data */}
                                {(() => {
                                    const hasVariantPricing = Object.keys(pricesPerVariant).length > 0;
                                    const shouldShowSection = selectedSizes.length > 0 && (selectedSizes[0] !== 'All Size' || hasVariantPricing);
                                    console.log('🔍 Step2 Matrix check:', { selectedSizes, hasVariantPricing, showPricePerVariant, shouldShowSection, pricesPerVariant });
                                    return shouldShowSection;
                                })() && (
                                        <div className="mt-4 border-t pt-4">
                                            <button
                                                type="button"
                                                onClick={() => setShowPricePerVariant(!showPricePerVariant)}
                                                className="w-full px-3 py-2 bg-orange-50 rounded-lg text-left flex justify-between items-center border border-orange-200"
                                            >
                                                <span className="text-xs font-medium text-orange-800">
                                                    💰 Harga Beda per Size / Varian?
                                                </span>
                                                <span className="text-orange-600">
                                                    {showPricePerVariant ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </span>
                                            </button>

                                            {showPricePerVariant && (
                                                <div className="mt-3 p-4 bg-white rounded-lg border border-orange-200 space-y-5">
                                                    {/* Retail Price Matrix */}
                                                    <div>
                                                        <h4 className="text-sm font-bold text-green-700 mb-3">💚 Matrix Harga Retail</h4>
                                                        <div className="overflow-x-auto -mx-2 px-2" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
                                                            <table className="w-full text-sm min-w-[320px]">
                                                                <thead>
                                                                    <tr className="bg-green-50">
                                                                        <th className="px-2 py-1 text-left border border-green-100">Size</th>
                                                                        {activeVariantLabels.map(label => (
                                                                            <th key={label} className="px-2 py-1 text-center border border-green-100">{label}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {selectedSizes.map(size => (
                                                                        <tr key={size}>
                                                                            <td className="px-2 py-1 font-bold border border-green-100">{size}</td>
                                                                            {activeVariantLabels.map(label => {
                                                                                const key = `${size}-${label}`;
                                                                                return (
                                                                                    <td key={key} className="px-2 py-2 border border-green-100 min-w-[95px]">
                                                                                        <input
                                                                                            type="text"
                                                                                            inputMode="numeric"
                                                                                            value={formatThousands(pricesPerVariant[key]?.retail || retailPrice)}
                                                                                            onChange={(e) => {
                                                                                                const val = parseFormattedNumber(e.target.value);
                                                                                                setPricesPerVariant(prev => ({
                                                                                                    ...prev,
                                                                                                    [key]: {
                                                                                                        ...(prev[key] || { reseller: resellerPrice }),
                                                                                                        retail: val
                                                                                                    }
                                                                                                }));
                                                                                            }}
                                                                                            onFocus={(e) => e.target.select()}
                                                                                            className="w-full px-2 py-2 text-center bg-white border border-green-300 rounded text-sm font-medium focus:ring-2 focus:ring-green-500"
                                                                                        />
                                                                                    </td>
                                                                                );
                                                                            })}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>

                                                    {/* Reseller Price Matrix */}
                                                    <div>
                                                        <h4 className="text-sm font-bold text-blue-700 mb-3">💙 Matrix Harga Reseller</h4>
                                                        <div className="overflow-x-auto -mx-2 px-2" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
                                                            <table className="w-full text-sm min-w-[320px]">
                                                                <thead>
                                                                    <tr className="bg-blue-50">
                                                                        <th className="px-2 py-2 text-left border border-blue-100 font-bold">Size</th>
                                                                        {activeVariantLabels.map(label => (
                                                                            <th key={label} className="px-2 py-2 text-center border border-blue-100 font-bold min-w-[80px]">{label}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {selectedSizes.map(size => (
                                                                        <tr key={size}>
                                                                            <td className="px-2 py-2 font-bold border border-blue-100">{size}</td>
                                                                            {activeVariantLabels.map(label => {
                                                                                const key = `${size}-${label}`;
                                                                                return (
                                                                                    <td key={key} className="px-2 py-2 border border-blue-100 min-w-[95px]">
                                                                                        <input
                                                                                            type="text"
                                                                                            inputMode="numeric"
                                                                                            value={formatThousands(pricesPerVariant[key]?.reseller || resellerPrice)}
                                                                                            onChange={(e) => {
                                                                                                const val = parseFormattedNumber(e.target.value);
                                                                                                setPricesPerVariant(prev => ({
                                                                                                    ...prev,
                                                                                                    [key]: {
                                                                                                        ...(prev[key] || { retail: retailPrice }),
                                                                                                        reseller: val
                                                                                                    }
                                                                                                }));
                                                                                            }}
                                                                                            onFocus={(e) => e.target.select()}
                                                                                            className="w-full px-2 py-2 text-center bg-white border border-blue-300 rounded text-sm font-medium focus:ring-2 focus:ring-blue-500"
                                                                                        />
                                                                                    </td>
                                                                                );
                                                                            })}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                            </div>

                            {/* Stock per Size × Variant Matrix - Collapsible */}
                            <div className="bg-gray-50 rounded-xl p-4">
                                <button
                                    type="button"
                                    onClick={() => setShowStockMatrix(!showStockMatrix)}
                                    className="w-full flex justify-between items-center"
                                >
                                    <div>
                                        <h3 className="font-medium text-gray-700">📦 Stok per Size × Varian</h3>
                                        {!showStockMatrix && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Total: {selectedSizes.reduce((totalSum, size) => {
                                                    return totalSum + activeVariantLabels.reduce((sum, label) => {
                                                        const key = `${size}-${label}`;
                                                        return sum + parseInt(productFormData.stockPerVariant[key] || String(uploadSettings.stockPerVariant) || '0');
                                                    }, 0);
                                                }, 0)} pcs ({activeVariantLabels.length} varian × {selectedSizes.length} size)
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-gray-500">
                                        {showStockMatrix ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                    </span>
                                </button>

                                {showStockMatrix && (
                                    <>
                                        <p className="text-xs text-gray-500 mt-3 mb-3">Edit angka di bawah jika ingin mengubah stok</p>

                                        {/* Matrix Table */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-purple-100">
                                                        <th className="px-2 py-1 text-left font-semibold text-purple-800 rounded-tl-lg sticky left-0 z-10 bg-purple-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-xs">Size</th>
                                                        {activeVariantLabels.map((label) => (
                                                            <th key={label} className="px-1 py-1 text-center font-bold text-purple-700 min-w-[35px] text-xs">{label}</th>
                                                        ))}
                                                        <th className="px-2 py-1 text-center font-semibold text-purple-800 rounded-tr-lg text-xs">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedSizes.map((size) => {
                                                        const sizeTotal = activeVariantLabels.reduce((sum, label) => {
                                                            const key = `${size}-${label}`;
                                                            return sum + parseInt(productFormData.stockPerVariant[key] || String(uploadSettings.stockPerVariant) || '0');
                                                        }, 0);

                                                        return (
                                                            <tr key={size} className="border-b border-gray-200">
                                                                <td className="px-2 py-1 font-semibold text-gray-700 bg-purple-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-xs">{size}</td>
                                                                {activeVariantLabels.map((label) => {
                                                                    const key = `${size}-${label}`;
                                                                    const defaultValue = uploadSettings.stockPerVariant || 0;
                                                                    const currentValue = productFormData.stockPerVariant[key];

                                                                    return (
                                                                        <td key={key} className="px-0 py-1 min-w-[35px]">
                                                                            <input
                                                                                type="text"
                                                                                inputMode="numeric"
                                                                                value={currentValue !== undefined ? currentValue : (defaultValue > 0 ? defaultValue : '')}
                                                                                onChange={(e) => setProductFormData(prev => ({
                                                                                    ...prev,
                                                                                    stockPerVariant: {
                                                                                        ...prev.stockPerVariant,
                                                                                        [key]: e.target.value
                                                                                    }
                                                                                }))}
                                                                                onFocus={(e) => e.target.select()}
                                                                                placeholder="0"
                                                                                className="w-full px-1 py-1 border border-gray-300 rounded text-center text-sm font-bold focus:ring-1 focus:ring-purple-500 focus:border-purple-500 h-8"
                                                                            />
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="px-3 py-2 text-center font-bold text-purple-700 bg-purple-50">
                                                                    {sizeTotal}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="bg-green-100">
                                                        <td className="px-2 py-1 font-bold text-green-800 rounded-bl-lg sticky left-0 z-10 bg-green-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-xs">Total</td>
                                                        {activeVariantLabels.map((label) => {
                                                            const variantTotal = selectedSizes.reduce((sum, size) => {
                                                                const key = `${size}-${label}`;
                                                                return sum + parseInt(productFormData.stockPerVariant[key] || String(uploadSettings.stockPerVariant) || '0');
                                                            }, 0);
                                                            return (
                                                                <td key={label} className="px-1 py-1 text-center font-bold text-green-700 min-w-[35px] text-xs">
                                                                    {variantTotal}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-3 py-2 text-center font-bold text-green-800 bg-green-200 rounded-br-lg">
                                                            {selectedSizes.reduce((totalSum, size) => {
                                                                return totalSum + activeVariantLabels.reduce((sum, label) => {
                                                                    const key = `${size}-${label}`;
                                                                    return sum + parseInt(productFormData.stockPerVariant[key] || String(uploadSettings.stockPerVariant) || '0');
                                                                }, 0);
                                                            }, 0)} pcs
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('upload')}
                                    className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                                >
                                    Kembali
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <Check className="w-5 h-5" />
                                    Upload Produk
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div >
        </div >
    );
};

export default ManualUploadModal;
