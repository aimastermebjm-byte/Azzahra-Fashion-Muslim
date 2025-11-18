import React from 'react';
import { ShoppingCart, Zap, Flame, Percent } from 'lucide-react';
import ProductCard from './ProductCard';
import { useFirebaseFlashSaleSimple } from '../hooks/useFirebaseFlashSaleSimple';
import { useRealTimeCart } from '../hooks/useRealTimeCart';

interface FlashSalePageProps {
  user: any;
  onProductClick: (product: any) => void;
  onCartClick: () => void;
  onAddToCart: (product: any) => void;
}

const FlashSalePage: React.FC<FlashSalePageProps> = ({
  user,
  onProductClick,
  onCartClick,
  onAddToCart
}) => {
  // Use the same hook as HomePage for consistency (NO CACHE)
  const {
    timeLeft,
    isFlashSaleActive,
    flashSaleProducts,
    loading: flashSaleLoading
  } = useFirebaseFlashSaleSimple();
  const { cartItems } = useRealTimeCart();

  const handleAddToCart = (product: any) => {
    onAddToCart(product);
  };


  if (flashSaleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading flash sale products...</div>
      </div>
    );
  }

  // Show simple message if no flash sale products
  if (flashSaleProducts.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-xl font-bold text-white">Flash Sale ⚡</h1>
            <button
              onClick={onCartClick}
              className="relative p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
            >
              <ShoppingCart className="w-6 h-6 text-white" />
              {cartItems.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-yellow-400 text-gray-800 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {cartItems.length}
                </span>
              )}
            </button>
          </div>

          {/* Premium Flash Sale Coming Soon Banner */}
          <div className="bg-gradient-to-br from-gray-700 via-gray-600 to-gray-500 rounded-2xl p-8 text-center max-w-3xl mx-auto shadow-2xl relative overflow-hidden">
            {/* Premium animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 left-4 w-32 h-32 bg-white rounded-full -ml-16 -mt-16 animate-pulse"></div>
              <div className="absolute bottom-4 right-4 w-24 h-24 bg-white rounded-full -mr-12 -mb-12 animate-pulse delay-100"></div>
            </div>

            <div className="relative z-10">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-20 h-20 mx-auto mb-6 shadow-lg">
                <span className="text-4xl">⏰</span>
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-200 to-white bg-clip-text text-transparent mb-4">
                Flash Sale Sedang Disiapkan
              </h2>
              <p className="text-gray-200 text-lg mb-2">
                Nantikan Flash Sale Kami Selanjutnya!
              </p>
              <p className="text-gray-300 text-sm mb-8">
                Diskon spesial dan penawaran terbatas akan segera hadir. Pastikan Anda tidak ketinggalan!
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => window.history.back()}
                  className="bg-white text-gray-700 px-6 py-3 rounded-full font-bold hover:bg-gray-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Kembali
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="bg-purple-600 text-white px-6 py-3 rounded-full font-bold hover:bg-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Lihat Produk Lainnya
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 pb-20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Flash Sale ⚡</h1>
          <button
            onClick={onCartClick}
            className="relative p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
          >
            <ShoppingCart className="w-6 h-6 text-white" />
            {cartItems.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-400 text-gray-800 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {cartItems.length}
              </span>
            )}
          </button>
        </div>

        
        {/* Flash Sale Banner */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-8 mb-6 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400 rounded-full -mr-16 -mt-16 opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-yellow-400 rounded-full -ml-20 -mb-20 opacity-20"></div>

          <div className="relative z-10">
            <div className="flex items-center justify-center mb-4">
              <Flame className="w-12 h-12 text-yellow-300 mr-3" />
              <h1 className="text-4xl font-bold text-white">FLASH SALE</h1>
              <Flame className="w-12 h-12 text-yellow-300 ml-3" />
            </div>
            <p className="text-xl text-white/90 mb-6">Diskon Hingga 70%</p>

            {/* Countdown Timer */}
            {timeLeft && (
              <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 mb-4">
                <p className="text-yellow-300 text-sm mb-2">⏰ Flash Sale Berakhir Dalam</p>
                <div className="text-3xl font-bold text-white tracking-wider">
                  {timeLeft}
                </div>
              </div>
            )}

            <div className="flex items-center justify-center space-x-4 text-white/80">
              <div className="flex items-center">
                <Zap className="w-5 h-5 mr-1" />
                <span className="text-sm">Terbatas</span>
              </div>
              <div className="flex items-center">
                <Percent className="w-5 h-5 mr-1" />
                <span className="text-sm">Diskon Spesial</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center text-white/60 text-sm mb-6">
          {flashSaleProducts.length} produk flash sale tersedia
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 gap-4">
          {flashSaleProducts.map((flashProduct) => {
            // Convert FlashSaleProduct to Product type
            const product = {
              id: flashProduct.id,
              name: flashProduct.name,
              price: flashProduct.price,
              retailPrice: flashProduct.retailPrice || flashProduct.price,
              resellerPrice: flashProduct.resellerPrice || flashProduct.price * 0.8,
              costPrice: flashProduct.price * 0.6, // Estimate cost price
              description: flashProduct.name, // Use name as description
              stock: flashProduct.stock,
              images: flashProduct.images,
              image: flashProduct.image,
              category: flashProduct.category,
              status: flashProduct.status as "ready" | "po",
              createdAt: flashProduct.createdAt,
              featuredOrder: flashProduct.featuredOrder,
              variants: flashProduct.variants,
              isFlashSale: flashProduct.isFlashSale,
              flashSalePrice: flashProduct.flashSalePrice || flashProduct.price * 0.8
            };
            return (
              <ProductCard
                key={`flash-${product.id}`}
                product={product}
                onProductClick={onProductClick}
                onAddToCart={handleAddToCart}
                isFlashSale={true}
                user={user}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FlashSalePage;