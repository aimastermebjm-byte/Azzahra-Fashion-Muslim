import React from 'react';
import { ArrowLeft, ShoppingBag, Package } from 'lucide-react';
import { Banner } from '../types/banner';
import { Product } from '../types';
import ProductCard from './ProductCard';

interface BannerProductsPageProps {
    banner: Banner;
    allProducts: Product[];
    user: any;
    onBack: () => void;
    onProductClick: (product: Product) => void;
    onAddToCart: (product: Product) => void;
}

const BannerProductsPage: React.FC<BannerProductsPageProps> = ({
    banner,
    allProducts,
    user,
    onBack,
    onProductClick,
    onAddToCart
}) => {
    // Filter products based on banner's productIds
    const productIds = banner.actionData?.productIds || [];
    const bannerProducts = allProducts.filter(p => productIds.includes(p.id));

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header with Banner Image */}
            <div className="relative">
                <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    className="w-full h-48 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />

                {/* Back Button */}
                <button
                    onClick={onBack}
                    className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-700" />
                </button>

                {/* Title Overlay */}
                <div className="absolute bottom-4 left-4 right-4">
                    <h1 className="text-white text-xl font-bold drop-shadow-lg">
                        {banner.title}
                    </h1>
                    <p className="text-white/80 text-sm mt-1">
                        {bannerProducts.length} produk tersedia
                    </p>
                </div>
            </div>

            {/* Product Grid */}
            <div className="px-4 py-6">
                {bannerProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="bg-gray-100 p-6 rounded-full mb-4">
                            <Package className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">
                            Tidak Ada Produk
                        </h3>
                        <p className="text-gray-500 text-sm max-w-xs">
                            Banner ini belum memiliki produk yang ditautkan
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {bannerProducts.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onProductClick={onProductClick}
                                onAddToCart={onAddToCart}
                                user={user}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Shopping CTA */}
            {bannerProducts.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 text-sm">Total produk</p>
                            <p className="text-lg font-bold text-[#D4AF37]">
                                {bannerProducts.length} item
                            </p>
                        </div>
                        <button
                            onClick={onBack}
                            className="bg-gradient-to-r from-[#D4AF37] to-[#B5952F] text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg"
                        >
                            <ShoppingBag className="w-5 h-5" />
                            Lihat Lainnya
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BannerProductsPage;
