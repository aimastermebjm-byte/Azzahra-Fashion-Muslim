import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingCart, Zap, Flame, Percent } from 'lucide-react';
import ProductCard from './ProductCard';
import { useFlashSale } from '../hooks/useFlashSale';

interface FlashSalePageProps {
  user: any;
  cartItems: any[];
  products: any[];
  loading: boolean;
  onProductClick: (product: any) => void;
  onCartClick: () => void;
  onAddToCart: (product: any) => void;
}

const FlashSalePage: React.FC<FlashSalePageProps> = ({
  user,
  cartItems,
  products,
  loading,
  onProductClick,
  onCartClick,
  onAddToCart
}) => {
  const { timeLeft, isFlashSaleActive } = useFlashSale();
  const [forceUpdate, setForceUpdate] = useState(0);

  // ENHANCED Flash Sale Event Handling
  useEffect(() => {
    const handleFlashSaleEnded = (event: any) => {
      console.log('🔄 Flash sale ended event received:', event.detail);
      console.log('🔄 Updating FlashSalePage...');

      // Force immediate re-render
      setForceUpdate(prev => prev + 1);

      // DEBOUNCED Additional auto-refresh if event indicates time expired
      if (event.detail?.reason === 'time_expired') {
        // Clear existing timer if any
        if (window.flashSaleRefreshTimer) {
          clearTimeout(window.flashSaleRefreshTimer);
        }

        // Set new debounced timer
        window.flashSaleRefreshTimer = setTimeout(() => {
          console.log('🔄 Auto-refreshing FlashSalePage after time expired');
          window.location.reload();
        }, 3000);
      }
    };

    // Listen for multiple events
    window.addEventListener('flashSaleEnded', handleFlashSaleEnded);

    // Also listen for flash sale start/update events
    const handleFlashSaleUpdated = () => {
      console.log('🔄 Flash sale updated event received');
      setForceUpdate(prev => prev + 1);
    };

    window.addEventListener('flashSaleUpdated', handleFlashSaleUpdated);

    return () => {
      window.removeEventListener('flashSaleEnded', handleFlashSaleEnded);
      window.removeEventListener('flashSaleUpdated', handleFlashSaleUpdated);
    };
  }, []);

  // ENHANCED Real-time Flash Sale Status Check
  useEffect(() => {
    const checkFlashSaleStatus = () => {
      try {
        const savedConfig = localStorage.getItem('azzahra-flashsale');
        if (savedConfig) {
          const config = JSON.parse(savedConfig);

          if (config && config.isActive) {
            const now = new Date().getTime();
            const endTime = new Date(config.endTime).getTime();

            // If flash sale has ended, trigger immediate cleanup
            if (now >= endTime) {
              console.log('⏰ FlashSalePage: Flash sale ended, triggering cleanup');

              // Trigger flash sale ended event
              window.dispatchEvent(new CustomEvent('flashSaleEnded', {
                detail: {
                  timestamp: new Date().toISOString(),
                  reason: 'time_expired_page_check',
                  source: 'FlashSalePage'
                }
              }));

              // Remove flash sale config immediately
              localStorage.removeItem('azzahra-flashsale');
              config.isActive = false;

              // Force update to refresh UI
              setForceUpdate(prev => prev + 1);
            }
          }
        }
      } catch (e) {
        console.error('Error in FlashSalePage real-time check:', e);
      }
    };

    // Check every 2 seconds for immediate response
    checkFlashSaleStatus(); // Check immediately
    const intervalId = setInterval(checkFlashSaleStatus, 2000);

    return () => clearInterval(intervalId);
  }, []);

  // Listen for products updates from admin
  useEffect(() => {
    const handleProductsUpdated = (event: any) => {
      console.log('Products updated in FlashSalePage:', event.detail);
      // Force re-render to get updated products
      setForceUpdate(prev => prev + 1);
    };

    window.addEventListener('productsUpdated', handleProductsUpdated);

    return () => {
      window.removeEventListener('productsUpdated', handleProductsUpdated);
    };
  }, []);

  const handleAddToCart = (product: any) => {
    onAddToCart(product);
  };

  // Filter flash sale products - ENHANCED BULLETPROOF VERSION
  const flashSaleProducts = useMemo(() => {
    try {
      // Safety check: ensure products is an array
      if (!Array.isArray(products) || products.length === 0) {
        console.warn('⚠️ FlashSale: Products array is empty or invalid');
        return [];
      }

      // Safety check: filter out invalid products
      const validProducts = products.filter(p => p && p.id && p.name);

      // Check active flash sale config with comprehensive validation
      let flashSaleConfig;
      try {
        const savedConfig = localStorage.getItem('azzahra-flashsale');
        flashSaleConfig = savedConfig ? JSON.parse(savedConfig) : null;

        if (flashSaleConfig && flashSaleConfig.isActive) {
          // Enhanced time validation
          const now = new Date().getTime();
          const endTime = new Date(flashSaleConfig.endTime).getTime();
          const startTime = new Date(flashSaleConfig.startTime).getTime();

          // Check if flash sale is actually still active by time
          if (now < startTime) {
            console.log('⏰ Flash sale has not started yet');
            flashSaleConfig.isActive = false;
          } else if (now >= endTime) {
            console.log('⏰ Flash sale has ended! Deactivating...');
            flashSaleConfig.isActive = false;
            // Remove from localStorage immediately
            localStorage.removeItem('azzahra-flashsale');
          }
        }
      } catch (e) {
        console.warn('⚠️ Error parsing flash sale config:', e);
        flashSaleConfig = null;
      }

      // Filter flash sale products with enhanced logic
      return validProducts.filter(product => {
        try {
          // Multiple validation layers
          if (!product || !product.id) {
            console.warn('⚠️ Invalid product found:', product);
            return false;
          }

          // Check if product is in active flash sale
          let isInFlashSale = false;

          // Method 1: Product flag check
          if (product.isFlashSale === true) {
            isInFlashSale = true;
          }

          // Method 2: Flash sale config check
          if (flashSaleConfig && flashSaleConfig.isActive === true) {
            // Check both products and productIds arrays
            const inProducts = Array.isArray(flashSaleConfig.products) && flashSaleConfig.products.includes(product.id);
            const inProductIds = Array.isArray(flashSaleConfig.productIds) && flashSaleConfig.productIds.includes(product.id);

            if (inProducts || inProductIds) {
              isInFlashSale = true;
            }
          }

          // Log filtered products for debugging
          if (isInFlashSale) {
            console.log(`✅ Product ${product.name} (${product.id}) is in flash sale`);
          }

          return isInFlashSale;
        } catch (e) {
          console.warn('⚠️ Error checking flash sale for product:', product.id, e);
          return false;
        }
      });
    } catch (error) {
      console.error('🚨 Error in flashSaleProducts calculation:', error);
      return [];
    }
  }, [products, forceUpdate, timeLeft]);

  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading flash sale products...</div>
      </div>
    );
  }

  // Show banner if no flash sale products
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

          {/* Banner */}
          <div className="text-center py-20">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 max-w-2xl mx-auto">
              <div className="text-6xl mb-6">⚡</div>
              <h2 className="text-4xl font-bold text-white mb-4">
                Flash Sale Segera Hadir!
              </h2>
              <p className="text-xl text-white/80 mb-8">
                Tunggu flash sale kami selanjutnya dengan diskon hingga 70%
              </p>
              <div className="bg-yellow-400 text-gray-800 px-8 py-4 rounded-full inline-block font-bold text-lg">
                🔥 Coming Soon 🔥
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
          {flashSaleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onProductClick={onProductClick}
              onAddToCart={handleAddToCart}
              isFlashSale={true}
              user={user}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FlashSalePage;