import React from 'react';
import { Tag } from 'lucide-react';
import { Product } from '../types';

interface FlashSaleCardProps {
    product: Product;
    onProductClick: (product: Product) => void;
    onAddToCart?: (product: Product) => void;
}

const FlashSaleCard: React.FC<FlashSaleCardProps> = ({
    product,
    onProductClick,
    onAddToCart
}) => {
    // Calculate discount percentage
    const originalPrice = product.retailPrice;
    const salePrice = product.flashSalePrice || product.retailPrice * 0.7;
    const discountPercent = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

    // Get primary image
    const imageUrl = product.images?.[0] || product.image || '/placeholder-product.png';

    const handleBuyClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        // Always open product detail for variant selection
        onProductClick(product);
    };

    return (
        <div
            onClick={() => onProductClick(product)}
            className="relative bg-gradient-to-b from-[#FFF8F0] to-[#F5E6D3] rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(139,69,19,0.12)] cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(139,69,19,0.18)] border border-[#E8D4B8]/50"
        >
            {/* SALE Badge - Top Right - Aligned with PO badge */}
            <div className="absolute top-2 right-2 z-20">
                <div className="bg-gradient-to-r from-[#B8860B] via-[#D4AF37] to-[#B8860B] text-[#0F172A] px-2.5 py-1 rounded-full shadow-md">
                    <span className="text-[10px] font-bold tracking-wider flex items-center gap-1">
                        <Tag className="w-3 h-3" /> SALE
                    </span>
                </div>
            </div>

            {/* Status Badge - Ready/PO with Stock - Top Left */}
            <div className="absolute top-2 left-2 z-20">
                <div className={`px-2.5 py-1 bg-white/95 backdrop-blur-sm border border-[#D4AF37]/50 text-[#997B2C] text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm`}>
                    {product.status === 'ready' ? 'Ready' : 'PO'} ({product.stock || 0})
                </div>
            </div>

            {/* Product Image */}
            <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-b from-[#FDFBF7] to-[#F5E6D3]">
                <img
                    src={imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                />
                {/* Subtle overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#F5E6D3]/60 via-transparent to-transparent"></div>
            </div>

            {/* Product Info */}
            <div className="p-3 pt-2 space-y-2">
                {/* Product Name */}
                <h3 className="text-[#0F172A] font-medium text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
                    {product.name}
                </h3>

                {/* Price Section */}
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[#B8860B] font-bold text-base">
                        Rp {salePrice.toLocaleString('id-ID')}
                    </span>
                    <span className="text-slate-400 text-xs line-through">
                        Rp {originalPrice.toLocaleString('id-ID')}
                    </span>
                </div>

                {/* Buy Button - Gold Gradient */}
                <button
                    onClick={handleBuyClick}
                    className="w-full bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-[#5d4008] py-2.5 rounded-full font-bold text-sm shadow-[0_4px_14px_0_rgba(153,123,44,0.3)] hover:shadow-[0_6px_20px_rgba(153,123,44,0.4)] transition-all transform hover:-translate-y-0.5 active:scale-95 relative overflow-hidden group border border-[#D4AF37]/30"
                >
                    <span className="relative z-10 font-serif tracking-wide">Beli Sekarang</span>
                    {/* Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out" />
                </button>
            </div>
        </div>
    );
};

export default FlashSaleCard;
