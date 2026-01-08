import React from 'react';
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
        if (onAddToCart) {
            onAddToCart(product);
        } else {
            onProductClick(product);
        }
    };

    return (
        <div
            onClick={() => onProductClick(product)}
            className="relative bg-gradient-to-b from-[#FFF8F0] to-[#F5E6D3] rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(139,69,19,0.12)] cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(139,69,19,0.18)] border border-[#E8D4B8]/50"
        >
            {/* Navy Ribbon Badge - "XX% OFF" */}
            <div className="absolute top-0 left-0 z-20">
                <div className="relative">
                    {/* Ribbon Main */}
                    <div className="bg-[#0F172A] text-white px-3 py-2 rounded-tl-2xl rounded-br-xl shadow-md">
                        <span className="text-lg font-bold">{discountPercent}%</span>
                        <span className="text-[10px] block -mt-1 font-medium tracking-wide">OFF</span>
                    </div>
                    {/* Ribbon Tail */}
                    <div className="absolute -bottom-2 left-0 w-0 h-0 border-l-[12px] border-l-[#1e293b] border-b-[8px] border-b-transparent"></div>
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
