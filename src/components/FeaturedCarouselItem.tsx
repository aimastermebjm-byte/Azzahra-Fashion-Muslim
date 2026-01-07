import React, { useState } from 'react';
import { Heart, Plus } from 'lucide-react';
import { Product } from '../types';

interface FeaturedCarouselItemProps {
    product: Product;
    onProductClick: (product: Product) => void;
    onAddToCart: (product: Product) => void;
}

const FeaturedCarouselItem: React.FC<FeaturedCarouselItemProps> = ({
    product,
    onProductClick,
    onAddToCart,
}) => {
    const [isLiked, setIsLiked] = useState(false);

    return (
        <div
            className="relative min-w-[280px] max-w-[280px] snap-center bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden group border border-brand-border/30 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            onClick={() => onProductClick(product)}
        >
            {/* Image Area */}
            <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
                <img
                    src={product.image || product.images?.[0] || '/placeholder-product.jpg'}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60"></div>

                {/* Wishlist Button (Heart) */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsLiked(!isLiked);
                    }}
                    className="absolute top-3 right-3 p-2 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 transition-all border border-white/30 text-white"
                >
                    <Heart className={`w-5 h-5 transition-all ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                </button>

                {/* Badge if Flash Sale */}
                {product.isFlashSale && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-bold rounded-lg tracking-wide shadow-lg">
                        FLASH SALE
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="p-4 relative">
                <h3 className="font-display font-semibold text-brand-primary text-base mb-1 truncate pr-8">
                    {product.name}
                </h3>

                {/* Price Section */}
                <div className="flex items-end justify-between mt-2">
                    <div className="flex flex-col">
                        {product.isFlashSale && product.flashSalePrice ? (
                            <>
                                <span className="text-xs text-gray-400 line-through decoration-red-400/50">
                                    Rp {product.retailPrice.toLocaleString('id-ID')}
                                </span>
                                <span className="text-lg font-bold text-brand-accent font-price">
                                    Rp {product.flashSalePrice.toLocaleString('id-ID')}
                                </span>
                            </>
                        ) : (
                            <span className="text-lg font-bold text-brand-primary font-price">
                                Rp {product.retailPrice.toLocaleString('id-ID')}
                            </span>
                        )}
                    </div>

                    {/* Add to Cart Button (+) */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAddToCart(product);
                        }}
                        className="absolute bottom-4 right-4 w-10 h-10 bg-brand-primary text-brand-accent rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all group-hover:bg-brand-accent group-hover:text-brand-primary"
                        title="Tambah ke Keranjang"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeaturedCarouselItem;
