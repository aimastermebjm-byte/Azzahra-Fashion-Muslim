import React from 'react';
import { ArrowLeft, ShoppingBag, Package } from 'lucide-react';
import { Banner } from '../types/banner';
import { Product } from '../types';
import ProductCard from './ProductCard';
import { collectionService } from '../services/collectionService';
import { Collection } from '../types/collection';

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
    // State for products to display
    const [displayProducts, setDisplayProducts] = React.useState<Product[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [collectionInfo, setCollectionInfo] = React.useState<Collection | null>(null);

    // Fetch products based on banner action
    React.useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                if (banner.actionType === 'products' && banner.actionData?.productIds) {
                    const products = allProducts.filter(p => banner.actionData.productIds?.includes(p.id));
                    setDisplayProducts(products);
                    setCollectionInfo(null);
                } else if (banner.actionType === 'collection' && banner.actionData?.collectionId) {
                    // Check if we already have the collection info to avoid refetching if banner didn't change
                    const collection = await collectionService.getCollectionById(banner.actionData.collectionId);
                    if (collection) {
                        setCollectionInfo(collection);
                        const products = allProducts.filter(p => collection.productIds?.includes(p.id));
                        setDisplayProducts(products);
                    }
                } else {
                    setDisplayProducts([]);
                    setCollectionInfo(null);
                }
            } catch (error) {
                console.error('Error fetching banner products:', error);
                setDisplayProducts([]);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [banner, allProducts]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header with Banner Image */}
            <div className="relative">
                <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    className="w-full h-48 object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />

                {/* Back Button */}
                <button
                    onClick={onBack}
                    className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-700" />
                </button>

                {/* Title Overlay */}
                <div className="absolute bottom-4 left-4 right-4">
                    <h1 className="text-white text-xl font-bold drop-shadow-lg leading-tight">
                        {banner.title}
                    </h1>
                    {collectionInfo && (
                        <span className="inline-block bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-xs text-white mb-1 mt-1 font-medium border border-white/30">
                            Koleksi: {collectionInfo.name}
                        </span>
                    )}
                    <p className="text-white/80 text-sm mt-1 font-medium">
                        {displayProducts.length} produk tersedia
                    </p>
                </div>
            </div>

            {/* Product Grid */}
            <div className="px-4 py-6 mb-20">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]"></div>
                    </div>
                ) : displayProducts.length === 0 ? (
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
                        {displayProducts.map(product => (
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
            {displayProducts.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                    <div className="flex items-center justify-between max-w-md mx-auto">
                        <div>
                            <p className="text-gray-500 text-xs font-medium">Total produk</p>
                            <p className="text-lg font-bold text-[#D4AF37]">
                                {displayProducts.length} item
                            </p>
                        </div>
                        <button
                            onClick={onBack}
                            className="bg-gradient-to-r from-[#D4AF37] to-[#B5952F] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-200 active:scale-95 transition-transform"
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
