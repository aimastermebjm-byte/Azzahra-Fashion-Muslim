import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, User, Filter, Star, ArrowUpDown, Clock } from 'lucide-react';
import ProductCard from './ProductCard';
import BannerCarousel from './BannerCarousel';
import { Product } from '../types';
import { validateProducts } from '../utils/productUtils';
import { useFirebaseFlashSale } from '../hooks/useFirebaseFlashSale';
import { cartService } from '../services/cartService';

interface HomePageProps {
  user: any;
  products: Product[];
  loading: boolean;
  onProductClick: (product: Product) => void;
  onLoginRequired: () => void;
  onCartClick: () => void;
  onAddToCart: (product: Product) => void;
  onNavigateToFlashSale?: () => void;
}

const HomePage: React.FC<HomePageProps> = ({
  user,
  products,
  loading,
  onProductClick,
  onLoginRequired,
  onCartClick,
  onAddToCart,
  onNavigateToFlashSale
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'po'>('all');
  const [cartCount, setCartCount] = useState(0);
  const [sortBy, setSortBy] = useState<'terbaru' | 'terlaris' | 'termurah' | 'termahal' | 'terlama'>('terbaru');
  const [featuredUpdateTrigger, setFeaturedUpdateTrigger] = useState(0); // Force re-render
  const [flashSaleUpdateTrigger, setFlashSaleUpdateTrigger] = useState(0); // Force re-render

  // Flash sale hook for countdown timer
  const { timeLeft, isFlashSaleActive, flashSaleConfig } = useFirebaseFlashSale();

  // Force refresh timer to handle potential sync issues
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Load cart count from backend
  const loadCartCount = async () => {
    if (!user?.uid) return;

    try {
      const cartItems = await cartService.getCart(user.uid);
      setCartCount(cartItems.length);
    } catch (error) {
      console.error('❌ Failed to load cart count:', error);
      setCartCount(0);
    }
  };

  // Load cart count when user changes
  useEffect(() => {
    if (user?.uid) {
      loadCartCount();
    } else {
      setCartCount(0);
    }
  }, [user]);

  // Periodic refresh timer to ensure data stays synchronized - OPTIMIZED for faster loading
  useEffect(() => {
    console.log('⚡ FAST HomePage: Starting optimized refresh timer');

    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
      setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
      loadCartCount(); // Refresh cart count too
    }, 10000); // Reduced to 10 seconds for faster updates

    // Initial sync time
    setLastSyncTime(new Date().toLocaleTimeString('id-ID'));

    return () => {
      clearInterval(interval);
      console.log('⚡ FAST HomePage: Optimized refresh timer stopped');
    };
  }, [user]);

  const handleBannerClick = (banner: any) => {
    console.log('Banner clicked:', banner);
    if (banner.type === 'flashsale') {
      console.log('Flash sale banner clicked, navigating...');
      if (onNavigateToFlashSale) {
        onNavigateToFlashSale();
      }
    }
  };

  const categories = [
    { id: 'all', name: 'Semua', icon: '🛍️' },
    { id: 'hijab', name: 'Hijab', icon: '🧕' },
    { id: 'gamis', name: 'Gamis', icon: '👗' },
    { id: 'khimar', name: 'Khimar', icon: '🧕' },
    { id: 'tunik', name: 'Tunik', icon: '👚' },
    { id: 'abaya', name: 'Abaya', icon: '🥻' }
  ];

  const handleAddToCart = (product: Product) => {
    onAddToCart(product);
  };

  // Validate and process products using utility functions
  const safeProducts = React.useMemo(() => {
    const validated = validateProducts(products);
    // Ensure all required fields have default values
    return validated.map(p => ({
      ...p,
      description: p.description || '',
      category: p.category || 'other',
      images: p.images || [],
      variants: p.variants || { sizes: [], colors: [] },
      retailPrice: p.retailPrice || 0,
      resellerPrice: p.resellerPrice || 0,
      costPrice: p.costPrice || 0,
      stock: p.stock || 0,
      status: p.status || 'ready',
      isFlashSale: p.isFlashSale || false,
      flashSalePrice: p.flashSalePrice || 0,
      createdAt: p.createdAt || new Date(),
      salesCount: p.salesCount || 0,
      isFeatured: p.isFeatured || false
    })) as Product[];
  }, [products]);

  const filteredProducts = safeProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'terbaru':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'terlama':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'terlaris':
        return (b.salesCount || 0) - (a.salesCount || 0);
      case 'termurah':
        const priceA = user?.role === 'reseller' ? a.resellerPrice : a.retailPrice;
        const priceB = user?.role === 'reseller' ? b.resellerPrice : b.retailPrice;
        return priceA - priceB;
      case 'termahal':
        const priceA2 = user?.role === 'reseller' ? a.resellerPrice : a.retailPrice;
        const priceB2 = user?.role === 'reseller' ? b.resellerPrice : b.retailPrice;
        return priceB2 - priceA2;
      default:
        return 0;
    }
  });

  // Get featured products from current products
  const featuredProducts = React.useMemo(() => {
    // Use products from props instead of AppStorage
    const featured = safeProducts.filter(p => p.isFeatured);
    // Return only actual featured products (no fallback)
    return featured;
  }, [safeProducts, featuredUpdateTrigger]); // Depend on safeProducts and trigger for re-render

  // Regular products (ALL PRODUCTS - show all at once for faster loading)
  const regularProducts = React.useMemo(() => {
    try {
      if (!Array.isArray(sortedProducts)) {
        return safeProducts || [];
      }
      return sortedProducts;
    } catch (error) {
      return safeProducts || [];
    }
  }, [sortedProducts, safeProducts]);

  // Show ALL products at once - no pagination for better UX and faster loading
  const currentProducts = regularProducts; // Show all products

  // Reset search filters trigger for instant refresh
  useEffect(() => {
    console.log('⚡ FAST HomePage: Products filtered/updated - showing all products instantly');
  }, [searchQuery, selectedCategory, statusFilter, sortBy]);

  // Listen for featured products updates from admin
  useEffect(() => {
    const handleFeaturedProductsUpdated = (event: any) => {
      // Force re-render to get updated featured products
      setFeaturedUpdateTrigger(prev => prev + 1);
      // Also trigger general refresh to ensure data consistency
      setTimeout(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 100);
    };

    const handleProductsUpdated = (event: any) => {
      // Force a complete re-fetch of all products
      setRefreshTrigger(prev => prev + 1);
    };

    const handleFlashSaleUpdated = (event: any) => {
      // Force immediate re-render for flash sale products
      setFlashSaleUpdateTrigger(prev => prev + 1);
      // Also trigger general refresh to ensure data consistency
      setTimeout(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 100);
    };

    // Listen for various product update events
    window.addEventListener('featuredProductsUpdated', handleFeaturedProductsUpdated);
    window.addEventListener('productsUpdated', handleProductsUpdated);
    window.addEventListener('flashSaleUpdated', handleFlashSaleUpdated);

    // Also listen for any other relevant events
    window.addEventListener('productAdded', handleProductsUpdated);
    window.addEventListener('productUpdated', handleProductsUpdated);
    window.addEventListener('productDeleted', handleProductsUpdated);

    return () => {
      window.removeEventListener('featuredProductsUpdated', handleFeaturedProductsUpdated);
      window.removeEventListener('productsUpdated', handleProductsUpdated);
      window.removeEventListener('flashSaleUpdated', handleFlashSaleUpdated);
      window.removeEventListener('productAdded', handleProductsUpdated);
      window.removeEventListener('productUpdated', handleProductsUpdated);
      window.removeEventListener('productDeleted', handleProductsUpdated);
    };
  }, []);

  // ENHANCED Listen for flash sale ended events with debouncing
  useEffect(() => {
    const handleFlashSaleEnded = (event: any) => {
      console.log('🔥 Flash sale ended detected in HomePage:', event.detail);

      // Force immediate re-render to get updated products
      setFeaturedUpdateTrigger(prev => prev + 1);

      // Force refresh featured products cache - DISABLED for Supabase only
      // AppStorage.refreshFeaturedProductsCache();

      // If flash sale ended due to time expiry, trigger debounced page reload
      if (event.detail?.reason === 'time_expired') {
        // Clear existing timer if any
        if (window.flashSaleRefreshTimer) {
          clearTimeout(window.flashSaleRefreshTimer);
        }

        // Set new debounced timer for HomePage
        window.flashSaleRefreshTimer = setTimeout(() => {
          console.log('🔄 Auto-refreshing HomePage after flash sale time expired');
          window.location.reload();
        }, 4000);
      }
    };

    window.addEventListener('flashSaleEnded', handleFlashSaleEnded);

    return () => {
      window.removeEventListener('flashSaleEnded', handleFlashSaleEnded);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">⚡ Memuat produk secara real-time...</p>
          <p className="text-gray-500 text-sm mt-1">Akan muncul semua produk dalam 1 halaman</p>
        </div>
      </div>
    );
  }

  
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">Azzahra Fashion</h1>
            <p className="text-pink-100 text-sm">Muslim Fashion Store</p>
          </div>
          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span className="text-sm">{user.name}</span>
              </div>
            ) : (
              <button
                onClick={onLoginRequired}
                className="bg-white/20 px-3 py-1 rounded-full text-sm hover:bg-white/30 transition-colors"
              >
                Login
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
          <button
            onClick={onCartClick}
            className="relative p-2 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow"
          >
            <ShoppingCart className="w-6 h-6 text-gray-600" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Banner Carousel */}
      <div className="p-4">
        <BannerCarousel onBannerClick={handleBannerClick} />
      </div>

      {/* Flash Sale Section */}
      <div className="px-4 mb-6">
        <div className="bg-gradient-to-br from-red-600 via-red-500 to-orange-500 rounded-xl p-5 text-white shadow-xl relative overflow-hidden">
          {/* Premium animated background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12 animate-pulse delay-75"></div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full shadow-lg">
                  <span className="text-3xl">⚡</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-yellow-200 to-white bg-clip-text text-transparent">
                    Flash Sale
                  </h2>
                  <p className="text-red-100 text-sm font-medium">
                    {isFlashSaleActive ? 'Diskon Terbatas!' : 'Nantikan Flash Sale Kami Selanjutnya'}
                  </p>
                  {isFlashSaleActive && timeLeft && (
                    <div className="flex items-center space-x-2 mt-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                      <Clock className="w-4 h-4 text-yellow-200" />
                      <span className="text-sm font-bold text-yellow-200">{timeLeft}</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={onNavigateToFlashSale}
                className="bg-white text-red-500 px-4 py-2 rounded-full text-sm font-bold hover:bg-red-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {isFlashSaleActive ? 'Lihat Semua' : 'Lihat Produk'}
              </button>
            </div>
          </div>

          {/* Flash Sale Products */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(2)].map((_, index) => (
                <div key={`flash-skeleton-${index}`} className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                  <div className="w-full h-24 bg-white/20 rounded animate-pulse mb-2"></div>
                  <div className="h-3 bg-white/20 rounded animate-pulse mb-1"></div>
                  <div className="h-3 bg-white/20 rounded w-3/4 animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {safeProducts
                .filter(product => product.isFlashSale && isFlashSaleActive)
                .slice(0, 2)
                .map((product) => (
                  <div
                    key={`flash-${product.id}`}
                    onClick={() => onProductClick(product)}
                    className="bg-white/10 rounded-lg p-3 backdrop-blur-sm hover:bg-white/20 transition-colors cursor-pointer"
                  >
                    <div className="relative">
                      <img
                        src={product.images?.[0] || '/placeholder-product.jpg'}
                        alt={product.name}
                        className="w-full h-24 object-cover rounded mb-2"
                      />
                      <div className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                        -{Math.round(((product.retailPrice - product.flashSalePrice) / product.retailPrice) * 100)}%
                      </div>
                    </div>
                    <h3 className="text-white font-medium text-sm mb-1 truncate">{product.name}</h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-bold text-sm">
                        Rp {product.flashSalePrice.toLocaleString('id-ID')}
                      </span>
                      <span className="text-red-200 line-through text-xs">
                        Rp {product.retailPrice.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {safeProducts.filter(product => product.isFlashSale && isFlashSaleActive).length === 0 && !loading && (
            <div className="text-center py-4 text-red-100">
              <span className="text-3xl">🚫</span>
              <p className="text-sm mt-1">Tidak ada Flash Sale saat ini</p>
            </div>
          )}
        </div>
      </div>

          {/* Flash Sale Countdown Display removed - using top section only */}

      {/* Featured Products */}
      <div className="px-4 mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Star className="w-5 h-5 text-yellow-500 fill-current" />
          <h2 className="text-lg font-bold text-gray-800">Produk Unggulan</h2>
        </div>

        {/* Loading skeleton for featured products */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(2)].map((_, index) => (
              <div key={`skeleton-${index}`} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="w-full h-48 bg-gray-200 animate-pulse"></div>
                <div className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded mb-3 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : featuredProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {featuredProducts.map((product) => (
              <ProductCard
                key={`featured-${product.id}`}
                product={product}
                onProductClick={onProductClick}
                onAddToCart={handleAddToCart}
                user={user}
                isFeatured={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 bg-white rounded-lg">
            <Star className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Belum ada produk unggulan</p>
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="px-4">
        <div className="flex flex-col space-y-3">
          {/* Product Categories */}
          <div className="flex space-x-3 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex-shrink-0 flex items-center space-x-2 px-4 py-2 rounded-full transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-pink-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{category.icon}</span>
                <span className="text-sm font-medium">{category.name}</span>
              </button>
            ))}
          </div>

          {/* Status Filters */}
          <div className="flex space-x-3 overflow-x-auto pb-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-shrink-0 flex items-center space-x-2 px-4 py-2 rounded-full transition-colors ${
                statusFilter === 'all'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="text-sm font-medium">Semua Status</span>
            </button>
            <button
              onClick={() => setStatusFilter('ready')}
              className={`flex-shrink-0 flex items-center space-x-2 px-4 py-2 rounded-full transition-colors ${
                statusFilter === 'ready'
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-green-300'
              }`}
            >
              <span className="w-2 h-2 bg-current rounded-full"></span>
              <span className="text-sm font-medium">Ready</span>
            </button>
            <button
              onClick={() => setStatusFilter('po')}
              className={`flex-shrink-0 flex items-center space-x-2 px-4 py-2 rounded-full transition-colors ${
                statusFilter === 'po'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-orange-300'
              }`}
            >
              <span className="w-2 h-2 bg-current rounded-full"></span>
              <span className="text-sm font-medium">PO</span>
            </button>
          </div>
        </div>
      </div>

      {/* All Products */}
      <div className="px-4">
        <div className="flex flex-col space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">
              {selectedCategory === 'all' ? 'Semua Produk' : categories.find(c => c.id === selectedCategory)?.name}
            </h2>
            <div className="flex items-center text-sm text-gray-600">
              <Filter className="w-4 h-4 mr-1" />
              {filteredProducts.length} produk
            </div>
          </div>

          {/* Sorting Buttons */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            <div className="flex items-center text-sm text-gray-600 mr-2">
              <ArrowUpDown className="w-4 h-4 mr-1" />
              Urutkan:
            </div>
            <button
              onClick={() => setSortBy('terbaru')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                sortBy === 'terbaru'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Terbaru
            </button>
            <button
              onClick={() => setSortBy('terlaris')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                sortBy === 'terlaris'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Terlaris
            </button>
            <button
              onClick={() => setSortBy('termurah')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                sortBy === 'termurah'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Termurah
            </button>
            <button
              onClick={() => setSortBy('termahal')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                sortBy === 'termahal'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Termahal
            </button>
            <button
              onClick={() => setSortBy('terlama')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                sortBy === 'terlama'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Terlama
            </button>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Produk tidak ditemukan</h3>
            <p className="text-gray-500">Coba kata kunci lain atau pilih kategori berbeda</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {currentProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onProductClick={onProductClick}
                  onAddToCart={handleAddToCart}
                  user={user}
                />
              ))}
            </div>

            {/* Products Summary - No Pagination for Better UX */}
            <div className="mt-6 text-center text-sm text-gray-600">
              <p>🚀 Menampilkan {regularProducts.length} produk secara real-time</p>
            </div>
          </>
        )}
      </div>

      {/* User Role Info */}
      {user && (
        <div className="fixed bottom-24 right-4 bg-white rounded-lg shadow-lg p-3 border-l-4 border-pink-500">
          <div className="text-xs text-gray-600">
            {user.role === 'reseller' ? (
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>Harga Reseller Aktif</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Harga Retail</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;