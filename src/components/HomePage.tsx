import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, User, Filter, ChevronLeft, ChevronRight, Star, ArrowUpDown } from 'lucide-react';
import ProductCard from './ProductCard';
import BannerCarousel from './BannerCarousel';
import { Product } from '../types';
import { validateProducts } from '../utils/productUtils';
import { AppStorage } from '../utils/appStorage';

interface HomePageProps {
  user: any;
  cartItems: any[];
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
  cartItems,
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
  const [sortBy, setSortBy] = useState<'terbaru' | 'terlaris' | 'termurah' | 'termahal' | 'terlama'>('terbaru');
  const [currentPage, setCurrentPage] = useState(1);
  const [featuredUpdateTrigger, setFeaturedUpdateTrigger] = useState(0); // Force re-render
  const productsPerPage = 8;

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

  // Get featured products directly from AppStorage for consistency
  const featuredProducts = React.useMemo(() => {
    // Validate and sync featured products before returning
    AppStorage.validateAndSyncFeaturedProducts();
    return AppStorage.getFeaturedProducts();
  }, [products, featuredUpdateTrigger]); // Depend on products and trigger for re-render

  // Regular products (excluding featured products) - BULLETPROOF VERSION
  const regularProducts = React.useMemo(() => {
    try {
      if (!Array.isArray(sortedProducts) || !Array.isArray(featuredProducts)) {
        console.warn('⚠️ Invalid product arrays for regular products calculation');
        return sortedProducts || [];
      }

      const featuredIds = new Set(featuredProducts.map(p => p.id).filter(Boolean));
      return sortedProducts.filter(p => p && p.id && !featuredIds.has(p.id));
    } catch (error) {
      console.error('🚨 Error in regularProducts calculation:', error);
      return sortedProducts || [];
    }
  }, [sortedProducts, featuredProducts]);

  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = regularProducts.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(regularProducts.length / productsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, statusFilter, sortBy]);

  // Listen for featured products updates from admin
  useEffect(() => {
    const handleFeaturedProductsUpdated = (event: any) => {
      console.log('Featured products updated in HomePage:', event.detail);
      // Force re-render to get updated featured products from ProductStorage
      setFeaturedUpdateTrigger(prev => prev + 1);
    };

    window.addEventListener('featuredProductsUpdated', handleFeaturedProductsUpdated);

    return () => {
      window.removeEventListener('featuredProductsUpdated', handleFeaturedProductsUpdated);
    };
  }, []);

  // Listen for products updates from admin
  useEffect(() => {
    const handleProductsUpdated = (event: any) => {
      console.log('Products updated in HomePage:', event.detail);
      // Force re-render to get updated products
      setFeaturedUpdateTrigger(prev => prev + 1);
    };

    window.addEventListener('productsUpdated', handleProductsUpdated);

    return () => {
      window.removeEventListener('productsUpdated', handleProductsUpdated);
    };
  }, []);

  // ENHANCED Listen for flash sale ended events with debouncing
  useEffect(() => {
    const handleFlashSaleEnded = (event: any) => {
      console.log('🔥 Flash sale ended detected in HomePage:', event.detail);

      // Force immediate re-render to get updated products
      setFeaturedUpdateTrigger(prev => prev + 1);

      // Force refresh featured products cache
      AppStorage.refreshFeaturedProductsCache();

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products...</p>
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
            {cartItems.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cartItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Banner Carousel */}
      <div className="p-4">
        <BannerCarousel onBannerClick={handleBannerClick} />
      </div>

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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col items-center mt-8 space-y-4">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Sebelumnya</span>
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center space-x-1">
                    {[...Array(totalPages)].map((_, index) => {
                      const pageNumber = index + 1;
                      const isActive = currentPage === pageNumber;

                      if (
                        pageNumber === 1 ||
                        pageNumber === totalPages ||
                        (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={pageNumber}
                            onClick={() => setCurrentPage(pageNumber)}
                            className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                              isActive
                                ? 'bg-pink-500 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                            }`}
                          >
                            {pageNumber}
                          </button>
                        );
                      }

                      if (
                        (pageNumber === 2 && currentPage > 3) ||
                        (pageNumber === totalPages - 1 && currentPage < totalPages - 2)
                      ) {
                        return <span key={pageNumber} className="px-2 text-gray-400">...</span>;
                      }

                      return null;
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                    }`}
                  >
                    <span>Selanjutnya</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-sm text-gray-600">
                  Menampilkan {indexOfFirstProduct + 1}-{Math.min(indexOfLastProduct, regularProducts.length)} dari {regularProducts.length} produk
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