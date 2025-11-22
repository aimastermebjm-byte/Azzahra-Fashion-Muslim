import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ShoppingCart, User, Filter, Star, ArrowUpDown, Clock, RefreshCw } from 'lucide-react';
import ProductCard from './ProductCard';
import BannerCarousel from './BannerCarousel';
import { Product } from '../types';
import { validateProducts } from '../utils/productUtils';
import useFirebaseBatchProducts from '../hooks/useFirebaseBatchProducts';
import useFirebaseBatchFlashSale from '../hooks/useFirebaseBatchFlashSale';
import useFirebaseBatchFeaturedProducts from '../hooks/useFirebaseBatchFeaturedProducts';
import { cartServiceOptimized } from '../services/cartServiceOptimized';

interface HomePageBatchProps {
  user: any;
  onProductClick: (product: Product) => void;
  onLoginRequired: () => void;
  onCartClick: () => void;
  onAddToCart: (product: Product) => void;
  onNavigateToFlashSale?: () => void;
  searchProducts?: (params: any) => Promise<any>;
}

const HomePageBatch: React.FC<HomePageBatchProps> = ({
  user,
  onProductClick,
  onLoginRequired,
  onCartClick,
  onAddToCart,
  onNavigateToFlashSale,
  searchProducts
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'po'>('all');
  const [cartCount, setCartCount] = useState(0);
  const [sortBy, setSortBy] = useState<'terbaru' | 'termurah'>('terbaru');

  // 🔥 BATCH HOOKS - Super Efficient Loading!
  const {
    products,
    loading,
    error,
    hasMore,
    loadMoreProducts,
    debug: productsDebug
  } = useFirebaseBatchProducts();

  const {
    flashSaleProducts,
    loading: flashSaleLoading,
    error: flashSaleError,
    hasMore: flashSaleHasMore,
    loadMoreFlashSaleProducts,
    timeLeft,
    isFlashSaleActive,
    flashSaleConfig,
    debug: flashSaleDebug
  } = useFirebaseBatchFlashSale();

  const {
    featuredProducts,
    loading: featuredLoading,
    error: featuredError,
    refreshFeaturedProducts,
    debug: featuredDebug
  } = useFirebaseBatchFeaturedProducts();

  // Search states
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Refs
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Load cart count
  const loadCartCount = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const cartItems = await cartServiceOptimized.getCart();
      setCartCount(cartItems.length);
    } catch (error) {
      console.error('Failed to load cart count:', error);
      setCartCount(0);
    }
  }, [user?.uid]);

  // Load cart count when user changes
  useEffect(() => {
    if (user?.uid) {
      loadCartCount();
    } else {
      setCartCount(0);
    }
  }, [user?.uid, loadCartCount]);

  // Filter products based on search and filters
  const filteredProducts = React.useMemo(() => {
    let filtered = [...products];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(product => {
        if (statusFilter === 'ready') {
          return product.stock > 0;
        }
        return product.stock === 0;
      });
    }

    // Sort products
    filtered.sort((a, b) => {
      if (sortBy === 'termurah') {
        return (a.price || 0) - (b.price || 0);
      } else {
        // Sort by newest (default)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [products, searchQuery, selectedCategory, statusFilter, sortBy]);

  // Handle product click
  const handleProductClick = useCallback((product: Product) => {
    onProductClick(product);
  }, [onProductClick]);

  // Handle add to cart
  const handleAddToCart = useCallback((product: Product) => {
    onAddToCart(product);
    loadCartCount(); // Refresh cart count
  }, [onAddToCart, loadCartCount]);

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      if (searchProducts) {
        const results = await searchProducts({
          query: searchQuery,
          category: selectedCategory,
          limit: 20
        });
        setSearchResults(results.products || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, selectedCategory, searchProducts]);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loading) {
          console.log('📱 Loading more products...');
          loadMoreProducts();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [hasMore, loading, loadMoreProducts]);

  // Display products (search results or filtered products)
  const displayProducts = searchQuery.trim() ? searchResults : filteredProducts;

  // Calculate stats
  const stats = React.useMemo(() => {
    return {
      totalProducts: products.length,
      flashSaleCount: flashSaleProducts.length,
      featuredCount: featuredProducts.length,
      searchResults: searchResults.length,
      filteredCount: filteredProducts.length
    };
  }, [products, flashSaleProducts, featuredProducts, searchResults, filteredProducts]);

  // Debug panel (development only)
  const DebugPanel = process.env.NODE_ENV === 'development' ? (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg text-xs max-w-sm z-50">
      <div className="font-bold mb-2">🔥 Batch System Debug:</div>
      <div>📦 Products: {stats.totalProducts} loaded</div>
      <div>🔥 Flash Sale: {stats.flashSaleCount}</div>
      <div>⭐ Featured: {stats.featuredCount}</div>
      <div>🔍 Search: {stats.searchResults}</div>
      <div>⚡ Cached Batches: {productsDebug.cachedBatches}</div>
      <div>💰 Current reads: ~1 (vs {stats.totalProducts})</div>
      <div>🎯 Performance: {stats.totalProducts > 0 ? Math.round((stats.totalProducts - 1) / stats.totalProducts * 100) : 0}% saved</div>
    </div>
  ) : null;

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-red-600 mb-4">❌ Error Loading Products</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Debug Panel - Development Only */}
      {DebugPanel}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Azzahra Fashion
              </h1>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                🔥 Batch System Active
              </span>
            </div>

            {/* Cart Button */}
            <button
              onClick={onCartClick}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ShoppingCart className="h-6 w-6 text-gray-600" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Search Bar */}
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">Semua Kategori</option>
              <option value="gamis">Gamis</option>
              <option value="koko">Koko</option>
              <option value="hijab">Hijab</option>
              <option value="mukena">Mukena</option>
              <option value="accessories">Aksesoris</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'terbaru' | 'termurah')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="terbaru">Terbaru</option>
              <option value="termurah">Termurah</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner Carousel */}
        <BannerCarousel />

        {/* Flash Sale Section */}
        {isFlashSaleActive && flashSaleProducts.length > 0 && (
          <div className="mb-12">
            <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    🔥 {flashSaleConfig?.title || 'Flash Sale'}
                  </h2>
                  <p className="text-white/90">
                    {flashSaleConfig?.description || 'Diskon spesial untuk produk pilihan'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-white text-sm mb-1">Berakhir dalam:</div>
                  <div className="flex space-x-2">
                    <div className="bg-white/20 backdrop-blur-sm rounded px-3 py-2">
                      <div className="text-white text-2xl font-bold">{String(timeLeft.hours).padStart(2, '0')}</div>
                      <div className="text-white/80 text-xs">Jam</div>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded px-3 py-2">
                      <div className="text-white text-2xl font-bold">{String(timeLeft.minutes).padStart(2, '0')}</div>
                      <div className="text-white/80 text-xs">Menit</div>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded px-3 py-2">
                      <div className="text-white text-2xl font-bold">{String(timeLeft.seconds).padStart(2, '0')}</div>
                      <div className="text-white/80 text-xs">Detik</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {flashSaleProducts.slice(0, 8).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => handleProductClick(product)}
                  onAddToCart={() => handleAddToCart(product)}
                  user={user}
                  onLoginRequired={onLoginRequired}
                  isFlashSale={true}
                />
              ))}
            </div>

            {flashSaleHasMore && (
              <div className="text-center mt-6">
                <button
                  onClick={() => loadMoreFlashSaleProducts()}
                  disabled={flashSaleLoading}
                  className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {flashSaleLoading ? 'Loading...' : 'Lihat Lebih Banyak'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Featured Products Section */}
        {featuredProducts.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">⭐ Produk Unggulan</h2>
              <button
                onClick={refreshFeaturedProducts}
                className="text-purple-600 hover:text-purple-700 flex items-center space-x-1"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => handleProductClick(product)}
                  onAddToCart={() => handleAddToCart(product)}
                  user={user}
                  onLoginRequired={onLoginRequired}
                  isFeatured={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Products Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            🛍️ Semua Produk
            {stats.filteredCount > 0 && (
              <span className="text-gray-500 text-base font-normal ml-2">
                ({stats.filteredCount} produk)
              </span>
            )}
          </h2>

          {loading && products.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
                  <div className="bg-gray-200 h-48 rounded-lg mb-4"></div>
                  <div className="bg-gray-200 h-4 rounded mb-2"></div>
                  <div className="bg-gray-200 h-4 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : displayProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {displayProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onClick={() => handleProductClick(product)}
                    onAddToCart={() => handleAddToCart(product)}
                    user={user}
                    onLoginRequired={onLoginRequired}
                  />
                ))}
              </div>

              {/* Load More Button / Intersection Observer */}
              {hasMore && (
                <div ref={loadMoreRef} className="text-center mt-8">
                  <button
                    onClick={loadMoreProducts}
                    disabled={loading}
                    className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load More Products'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📦</div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                {searchQuery.trim() ? 'Produk tidak ditemukan' : 'Belum ada produk'}
              </h3>
              <p className="text-gray-500">
                {searchQuery.trim()
                  ? 'Coba kata kunci pencarian lain'
                  : 'Setup batch products di Firebase Console terlebih dahulu'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePageBatch;