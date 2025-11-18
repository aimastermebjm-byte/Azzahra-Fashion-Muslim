import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ShoppingCart, User, Filter, Star, ArrowUpDown, Clock, RefreshCw } from 'lucide-react';
import ProductCard from './ProductCard';
import BannerCarousel from './BannerCarousel';
import { Product } from '../types';
import { validateProducts } from '../utils/productUtils';
import { useFirebaseFlashSaleSimple } from '../hooks/useFirebaseFlashSaleSimple';
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
  onLoadMore?: () => void;
  hasMore?: boolean;
  onRefreshProducts?: () => void;
  searchProducts?: (params: any) => Promise<any>;
}

const HomePage: React.FC<HomePageProps> = ({
  user,
  products,
  loading,
  onProductClick,
  onLoginRequired,
  onCartClick,
  onAddToCart,
  onNavigateToFlashSale,
  onLoadMore,
  hasMore = true,
  onRefreshProducts,
  searchProducts
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'po'>('all');
  const [cartCount, setCartCount] = useState(0);
  const [sortBy, setSortBy] = useState<'terbaru' | 'termurah'>('terbaru');

  // Filter featured products from the products array
  const featuredProducts = products.filter(product => product.isFeatured);

  // Search states for cache functionality
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Infinite scroll with Intersection Observer
  const observer = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Flash sale hook for countdown timer AND products (NO CACHE)
  const {
    timeLeft,
    isFlashSaleActive,
    flashSaleProducts: hookFlashSaleProducts,
    loading: flashSaleLoading
  } = useFirebaseFlashSaleSimple();

  // Load cart count from backend
  const loadCartCount = async () => {
    if (!user?.uid) return;

    try {
      const cartItems = await cartService.getCart();
      setCartCount(cartItems.length);
    } catch (error) {
      console.error('Failed to load cart count:', error);
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

  // Infinite scroll with Intersection Observer
  useEffect(() => {
    if (!onLoadMore || !hasMore) return;

    const currentObserver = observer.current;
    if (currentObserver) {
      currentObserver.disconnect();
    }

    const handleObserver = (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && hasMore && !loading) {
        onLoadMore();
      }
    };

    observer.current = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
      rootMargin: '100px'
    });

    if (loadMoreRef.current) {
      observer.current.observe(loadMoreRef.current);
    }

    return () => {
      if (currentObserver) {
        currentObserver.disconnect();
      }
    };
  }, [onLoadMore, hasMore, loading]);

  // Optimized refresh timer for cart count only - ULTRA FAST
  useEffect(() => {
    const interval = setInterval(() => {
      loadCartCount(); // Refresh cart count only
    }, 15000); // Optimized to 15 seconds

    return () => {
      clearInterval(interval);
    };
  }, [user]);

  // Debounced search with cache support
  useEffect(() => {
    if (!searchQuery || !searchProducts) {
      setShowSearchResults(false);
      setSearchResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        console.log('🔍 Searching with cache support:', searchQuery);

        const searchParams: SearchCacheKey = {
          query: searchQuery,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          sortBy: sortBy,
          userRole: user?.role || 'customer',
          page: 1
        };

        const results = await searchProducts(searchParams);
        setSearchResults(results.products || []);
        setShowSearchResults(true);
        console.log('✅ Search completed:', results.products?.length, 'results');
      } catch (error) {
        console.error('❌ Search error:', error);
        setSearchResults([]);
        setShowSearchResults(true);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, selectedCategory, statusFilter, sortBy, user?.role, searchProducts]);

  const handleBannerClick = (banner: any) => {
    if (banner.type === 'flashsale') {
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
      // FIXED: Preserve the complete variants object including stock data
      variants: {
        sizes: p.variants?.sizes || [],
        colors: p.variants?.colors || [],
        stock: p.variants?.stock || {}
      },
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
      case 'termurah':
        const priceA = user?.role === 'reseller' ? a.resellerPrice : a.retailPrice;
        const priceB = user?.role === 'reseller' ? b.resellerPrice : b.retailPrice;
        return priceA - priceB;
      default:
        return 0;
    }
  });

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

  // Show search results when searching, otherwise show regular products
  const currentProducts = showSearchResults ? searchResults : regularProducts;

  
  // Listen for featured products updates from admin
  useEffect(() => {
    const handleFeaturedProductsUpdated = (event: any) => {
      // Force re-render to get updated featured products
      // Featured products update - handled by Firebase real-time updates
    };

    const handleProductsUpdated = (event: any) => {
      // Products update - handled by Firebase real-time updates
    };

    const handleFlashSaleUpdated = (event: any) => {
      // Flash sale update - handled by Firebase real-time updates
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

      // Flash sale ended - handled by Firebase real-time updates

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Memuat produk...</p>
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
          {/* Tombol Refresh untuk force update cross-device sync */}
          <button
            onClick={onRefreshProducts}
            className="p-2 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow"
            title="Refresh produk"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
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
          {flashSaleLoading ? (
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
              {hookFlashSaleProducts
                .slice(0, 2)
                .map((flashProduct) => {
                  // Convert FlashSaleProduct to Product type
                  const product: Product = {
                    id: flashProduct.id,
                    name: flashProduct.name,
                    description: '',
                    category: flashProduct.category,
                    price: flashProduct.price,
                    retailPrice: flashProduct.retailPrice || flashProduct.price,
                    resellerPrice: flashProduct.resellerPrice,
                    costPrice: flashProduct.costPrice,
                    stock: flashProduct.stock,
                    images: flashProduct.images,
                    image: flashProduct.image,
                    variants: flashProduct.variants,
                    status: flashProduct.status,
                    isFlashSale: flashProduct.isFlashSale,
                    flashSalePrice: flashProduct.flashSalePrice,
                    originalRetailPrice: flashProduct.originalRetailPrice,
                    originalResellerPrice: flashProduct.originalResellerPrice,
                    createdAt: flashProduct.createdAt,
                    salesCount: 0,
                    isFeatured: flashProduct.isFeatured || false,
                    featuredOrder: flashProduct.featuredOrder || 0,
                    weight: 0,
                    unit: 'gram',
                    estimatedReady: undefined
                  };

                  const discountPercentage = Math.round(((flashProduct.originalRetailPrice || flashProduct.retailPrice) - flashProduct.flashSalePrice) / (flashProduct.originalRetailPrice || flashProduct.retailPrice) * 100);

                  return (
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
                          -{discountPercentage}%
                        </div>
                      </div>
                      <h3 className="text-white font-medium text-sm mb-1 truncate">{product.name}</h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-bold text-sm">
                          Rp {product.flashSalePrice.toLocaleString('id-ID')}
                        </span>
                        <span className="text-red-200 line-through text-xs">
                          Rp {(product.originalRetailPrice || product.retailPrice).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {hookFlashSaleProducts.length === 0 && !flashSaleLoading && isFlashSaleActive && (
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
              onClick={() => setSortBy('termurah')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                sortBy === 'termurah'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Termurah
            </button>
                      </div>
        </div>

        {isSearching ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Mencari produk...</h3>
            <p className="text-gray-500">Mohon tunggu sebentar</p>
          </div>
        ) : currentProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {showSearchResults ? 'Tidak ada hasil pencarian' : 'Produk tidak ditemukan'}
            </h3>
            <p className="text-gray-500">
              {showSearchResults
                ? 'Coba kata kunci pencarian lain atau filter berbeda'
                : 'Coba kata kunci lain atau pilih kategori berbeda'
              }
            </p>
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

            {/* Infinite Scroll Trigger */}
            {hasMore && (
              <div className="mt-6 text-center">
                <div
                  ref={loadMoreRef}
                  className="inline-flex items-center justify-center p-4"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500"></div>
                      <span className="text-gray-600 text-sm">Memuat lebih banyak produk...</span>
                    </div>
                  ) : (
                    <div className="h-1"></div>
                  )}
                </div>
              </div>
            )}
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