import React, { useState, useMemo } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { Product } from '../types';

interface VariantSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    mode: 'addToCart' | 'buyNow';
    onConfirm: (variant: { size: string; color: string }, quantity: number) => void;
    user: any;
    collectionDiscount?: number;
    // 🔥 NEW: External sync for image switching
    externalSelectedColor?: string;
    onColorChange?: (color: string) => void;
}

const VariantSelectionModal: React.FC<VariantSelectionModalProps> = ({
    isOpen,
    onClose,
    product,
    mode,
    onConfirm,
    user,
    collectionDiscount = 0,
    externalSelectedColor,
    onColorChange
}) => {
    const [internalSize, setInternalSize] = useState('');
    const [internalColor, setInternalColor] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [isZoomOpen, setIsZoomOpen] = useState(false);

    // Sync with external color if provided
    const selectedColor = externalSelectedColor !== undefined ? externalSelectedColor : internalColor;
    const setSelectedColor = (color: string) => {
        if (onColorChange) onColorChange(color);
        setInternalColor(color);
    };

    // Size selection is always internal to modal until confirm
    const [selectedSize, setSelectedSize] = useState('');

    const productAny = product as any;
    const isGalleryMode = !!productAny.variantImageIndices;

    // 🔥 NEW: Filter sizes based on selected variant (For Family/Gallery Mode)
    // AND Ensure uniqueness of clean labels to prevent "S M S M"
    const filteredUniqueSizes = useMemo(() => {
        const allSizes = product.variants?.sizes || [];
        if (!isGalleryMode || !selectedColor) return allSizes;

        const variantName = productAny.variantNames?.[selectedColor] || productAny.variants?.names?.[selectedColor];
        if (!variantName) return allSizes;

        // 1. Get sizes that belong to this variant (startsWith prefix)
        const relevantSizes = allSizes.filter(s => s.toLowerCase().startsWith(variantName.toLowerCase()));
        
        // 2. Map to clean labels but keep track of original full size
        // We want to show "S", "M" etc but they must be unique
        const seenClean = new Set<string>();
        const result: string[] = [];
        
        relevantSizes.forEach(size => {
            const clean = getCleanSizeLabel(size);
            if (!seenClean.has(clean)) {
                seenClean.add(clean);
                result.push(size);
            }
        });

        return result.length > 0 ? result : allSizes;
    }, [product.variants?.sizes, selectedColor, productAny.variantNames, isGalleryMode]);

    // 🔥 NEW: Clean size label
    function getCleanSizeLabel(size: string) {
        if (!size) return 'All Size';
        
        const variantName = productAny.variantNames?.[selectedColor] || productAny.variants?.names?.[selectedColor];
        
        if (variantName && size.toLowerCase().startsWith(variantName.toLowerCase() + ' ')) {
            const stripped = size.substring(variantName.length).trim();
            if (stripped) return stripped;
        }

        const parts = size.trim().split(' ');
        if (parts.length > 1) {
            const lastPart = parts[parts.length - 1];
            if (/^(S|M|L|XL|XXL|XXXL|[0-9]+(-[0-9]+M)?|Standar|Jumbo|All\s*Size)$/i.test(lastPart)) {
                return lastPart;
            }
        }

        return size;
    };

    // Stock calculation logic
    const getVariantStock = (size: string, color: string): number => {
        if (!product.variants?.stock) return 0;
        return Number(product.variants.stock[size]?.[color] || 0);
    };

    const getSelectedVariantStock = (): number => {
        if (!selectedSize || !selectedColor) return 0;
        return getVariantStock(selectedSize, selectedColor);
    };

    // Price calculation
    const getPrice = () => {
        const productAny = product as any;

        if (product.isFlashSale) {
            const discount = productAny.flashSaleDiscount || 0;
            if (discount > 0) {
                let basePrice = 0;
                if (productAny.pricesPerVariant && selectedSize && selectedColor) {
                    const variantKey = `${selectedSize}-${selectedColor}`;
                    const variantPricing = productAny.pricesPerVariant[variantKey];
                    if (variantPricing?.retail && Number(variantPricing.retail) > 0) {
                        basePrice = user?.role === 'reseller' && variantPricing.reseller
                            ? Number(variantPricing.reseller)
                            : Number(variantPricing.retail);
                    }
                }
                if (basePrice === 0) {
                    basePrice = user?.role === 'reseller' ? product.resellerPrice : product.retailPrice;
                }
                return Math.max(0, basePrice - (basePrice * (discount / 100)));
            }
        }

        if (productAny.pricesPerVariant && selectedSize && selectedColor) {
            const variantKey = `${selectedSize}-${selectedColor}`;
            const variantPricing = productAny.pricesPerVariant[variantKey];
            if (variantPricing?.retail && Number(variantPricing.retail) > 0) {
                return user?.role === 'reseller' && variantPricing.reseller
                    ? Number(variantPricing.reseller)
                    : Number(variantPricing.retail);
            }
        }

        return user?.role === 'reseller' ? product.resellerPrice : product.retailPrice;
    };

    const finalPrice = getPrice() - collectionDiscount;

    // Reset selected size if it becomes incompatible with selected variant
    React.useEffect(() => {
        if (selectedSize && !filteredUniqueSizes.includes(selectedSize)) {
            setSelectedSize('');
        }
    }, [selectedColor, filteredUniqueSizes]);

    const handleConfirm = () => {
        if (!selectedSize || !selectedColor) return;
        if (quantity > getSelectedVariantStock()) return;

        onConfirm({ size: selectedSize, color: selectedColor }, quantity);
        onClose();
    };

    // 🔥 NEW: Helper to get current display image based on selection
    const getDisplayImage = () => {
        const productAny = product as any;
        if (selectedColor && productAny.variantImageIndices) {
            const idx = productAny.variantImageIndices[selectedColor];
            if (idx !== undefined && idx !== null && product.images?.[idx]) {
                return product.images[idx];
            }
        }
        return product.image || product.images?.[0];
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between rounded-t-3xl z-10">
                    <h2 className="text-lg font-bold text-gray-900">Pilih Varian & Ukuran</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-5 pb-safe">
                    {/* Product Quick Info */}
                    <div className="flex gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100 items-start">
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border bg-white">
                            {(() => {
                                let displayImg = product.image || product.images?.[0];
                                // 🔥 NEW: Modal specific image sync
                                if (isGalleryMode && selectedColor && productAny.variantImageIndices) {
                                    const idx = productAny.variantImageIndices[selectedColor];
                                    if (idx !== undefined && idx !== null && product.images?.[idx]) {
                                        displayImg = product.images[idx];
                                    }
                                }
                                return <img src={displayImg} alt={product.name} className="w-full h-full object-cover" />;
                            })()}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-gray-800 leading-tight mb-1">{product.name}</h3>
                            <p className="text-[#997B2C] font-black text-lg">Rp {finalPrice.toLocaleString('id-ID')}</p>
                        </div>
                    </div>

                    {/* Variant Selector */}
                    {product.variants?.colors && product.variants.colors.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-gray-800 mb-2">Varian</h3>
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                                {product.variants.colors.map((color) => {
                                    const colorSizes = product.variants?.sizes || [];
                                    const colorStock = colorSizes.reduce((total, size) => total + getVariantStock(size, color), 0);
                                    const displayName = productAny.variantNames?.[color] || productAny.variants?.names?.[color] || color;

                                    return (
                                        <button
                                            key={color}
                                            onClick={() => setSelectedColor(color)}
                                            disabled={colorStock === 0}
                                            className={`flex-shrink-0 min-w-[60px] px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all duration-300 ${selectedColor === color
                                                ? 'bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-[#5d4008] border-[#B8860B] shadow-[0_4px_14px_0_rgba(153,123,44,0.39)] scale-105'
                                                : colorStock === 0
                                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:border-yellow-500'
                                                }`}
                                        >
                                            {displayName}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Size Selector */}
                    {filteredUniqueSizes.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-gray-800 mb-2">Ukuran</h3>
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                                {filteredUniqueSizes.map((size) => {
                                    const sizeTotalStock = selectedColor
                                        ? getVariantStock(size, selectedColor)
                                        : (product.variants?.colors || []).reduce((total, color) => total + getVariantStock(size, color), 0);

                                    return (
                                        <button
                                            key={size}
                                            onClick={() => setSelectedSize(size)}
                                            disabled={sizeTotalStock === 0}
                                            className={`flex-shrink-0 min-w-[50px] px-3 py-2 rounded-full text-sm font-bold border-2 transition-all duration-300 ${selectedSize === size
                                                ? 'bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-[#5d4008] border-[#B8860B] shadow-[0_4px_14px_0_rgba(153,123,44,0.39)] scale-105'
                                                : sizeTotalStock === 0
                                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:border-yellow-500'
                                                }`}
                                        >
                                            {getCleanSizeLabel(size)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Stock Info */}
                    {selectedSize && selectedColor && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-xs text-blue-700">
                                📦 Stok <strong>{selectedSize} - {selectedColor}</strong>:{' '}
                                <strong className={getSelectedVariantStock() > 5 ? 'text-green-600' : getSelectedVariantStock() > 0 ? 'text-yellow-600' : 'text-red-600'}>
                                    {getSelectedVariantStock()} pcs
                                </strong>
                            </p>
                        </div>
                    )}

                    {/* Quantity Selector */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-800 mb-2">Jumlah</h3>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-gray-100 rounded-full p-1">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition"
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-10 text-center font-bold">{quantity}</span>
                                <button
                                    onClick={() => {
                                        const maxStock = getSelectedVariantStock();
                                        if (quantity < maxStock) setQuantity(quantity + 1);
                                    }}
                                    disabled={quantity >= getSelectedVariantStock()}
                                    className={`w-8 h-8 flex items-center justify-center rounded-full transition ${quantity >= getSelectedVariantStock()
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'hover:bg-gray-200'
                                        }`}
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            <span className="text-xs text-gray-600">
                                Maks: <strong>{getSelectedVariantStock()}</strong> pcs
                            </span>
                        </div>
                    </div>

                    {/* Confirm Button */}
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedSize || !selectedColor || quantity === 0 || quantity > getSelectedVariantStock()}
                        className={`w-full py-4 rounded-full font-bold text-white transition shadow-lg ${!selectedSize || !selectedColor || quantity === 0 || quantity > getSelectedVariantStock()
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-[#5d4008] shadow-[0_4px_14px_0_rgba(153,123,44,0.39)] hover:shadow-[0_6px_20px_rgba(153,123,44,0.23)] hover:bg-[100%_0]'
                            }`}
                    >
                        {mode === 'addToCart' ? '🛒 Tambah ke Keranjang' : '⚡ Beli Sekarang'}
                    </button>
                </div>
            </div>

            {/* Image Zoom Modal */}
            {isZoomOpen && (
                <div
                    className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsZoomOpen(false);
                    }}
                >
                    <button
                        onClick={() => setIsZoomOpen(false)}
                        className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img
                        src={getDisplayImage()}
                        alt={product.name}
                        className="max-w-[90%] max-h-[90%] object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="absolute bottom-4 text-white/70 text-sm">
                        Tap untuk tutup
                    </div>
                </div>
            )}
        </div>
    );
};

export default VariantSelectionModal;
