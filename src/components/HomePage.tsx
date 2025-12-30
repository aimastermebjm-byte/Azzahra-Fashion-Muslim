import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, ShoppingCart, User, Filter, Star, ArrowUpDown, MessageCircle, X } from 'lucide-react';
import ProductCard from './ProductCard';
import BannerCarousel from './BannerCarousel';
import { Product } from '../types';
import { validateProducts } from '../utils/productUtils';
import { cartServiceOptimized } from '../services/cartServiceOptimized';
import { useGlobalProducts } from '../hooks/useGlobalProducts';
import { SearchCacheKey } from '../types/cache';
import { productCategoryService, ProductCategory } from '../services/productCategoryService';

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
  const [activeTab, setActiveTab] = useState<'all' | 'terbaru' | 'termurah'>('terbaru');
  const [cartCount, setCartCount] = useState(0);
  const [sortBy, setSortBy] = useState<'terbaru' | 'termurah'>('terbaru');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'po'>('all');

  // Search states for cache functionality
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Dynamic categories from master
  const [categories, setCategories] = useState<Array<{ id: string; name: string; icon: string }>>([
    { id: 'all', name: 'Semua', icon: '🛍️' }
  ]);

  // Infinite scroll with Intersection Observer
  const observer = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // 🚀 Product data from GLOBAL state (0 reads - single listener)
  const { allProducts } = useGlobalProducts();

  // 🔥 MEMOIZED FILTERING: Filter produk tanpa read tambahan
  const featuredProducts = useMemo(() => {
    return allProducts.filter(product => product.isFeatured === true);
  }, [allProducts]);

  const flashSaleProducts = useMemo(() => {
    return allProducts.filter(product => product.isFlashSale === true);
  }, [allProducts]);

  // Load cart count from backend
  const loadCartCount = async () => {
    if (!user?.uid) return;

    try {
      const cartItems = await cartServiceOptimized.getCart();
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

  // Load categories from master data
  useEffect(() => {
    const loadCategories = async () => {
      try {
        console.log('🔄 Loading categories from master...');

        // Initialize default categories first time
        await productCategoryService.initializeDefaultCategories();

        // Load categories from master
        const masterCategories = await productCategoryService.listCategories();
        console.log('✅ Loaded categories:', masterCategories);

        // Category icon mapping
        const getCategoryIcon = (name: string): string => {
          const icons: Record<string, string> = {
            'hijab': '🧕',
            'gamis': '👗',
            'khimar': '🧕',
            'tunik': '👚',
            'aksesoris': '✨',
            'abaya': '🥻',
            'outer': '🧥',
            'dress': '👗',
            'default': '📦'
          };
          return icons[name.toLowerCase()] || icons['default'];
        };

        // Map to HomePage format
        const mappedCategories = masterCategories.map(cat => ({
          id: cat.name.toLowerCase(),
          name: cat.name,
          icon: getCategoryIcon(cat.name)
        }));

        setCategories([
          { id: 'all', name: 'Semua', icon: '🛍️' },
          ...mappedCategories
        ]);

        console.log('✅ Categories set:', mappedCategories.length);
      } catch (error) {
        console.error('❌ Failed to load categories:', error);
        // Fallback to default if error
        setCategories([
          { id: 'all', name: 'Semua', icon: '🛍️' },
          { id: 'hijab', name: 'Hijab', icon: '🧕' },
          { id: 'gamis', name: 'Gamis', icon: '👗' },
          { id: 'khimar', name: 'Khimar', icon: '🧕' },
          { id: 'tunik', name: 'Tunik', icon: '👚' }
        ]);
      }
    };

    loadCategories();
  }, []);

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
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-accent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Memuat produk...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-brand-surface pb-20">
      {/* Header - Sticky - Modern Solid Blue */}
      <div className="sticky top-0 z-50 bg-brand-primary shadow-lg">
        <div className="px-3 sm:px-4 py-3">
          {/* Top Bar: Brand & Search */}
          <div className="flex items-center gap-3">
            {/* Search Input - Clean White */}
            <div className="flex-1 relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Cari di Azzahra Fashion..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 
                           rounded-lg
                           bg-white 
                           text-gray-900 text-sm
                           placeholder:text-gray-400 
                           focus:outline-none focus:ring-2 focus:ring-brand-accent/30
                           shadow-sm"
              />
              {/* Clear Button */}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Icons Group - White Clean */}
            <div className="flex items-center gap-2">
              {/* Chat Icon - White */}
              <button
                onClick={() => window.open('https://wa.me/6281952989904', '_blank')}
                className="p-2 text-white hover:bg-white/10 rounded-full transition-colors relative"
              >
                <MessageCircle className="w-6 h-6" />
                {/* Dot notification */}
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-accent rounded-full border border-brand-primary"></span>
              </button>

              {/* Cart Icon - White */}
              <button
                onClick={onCartClick}
                className="p-2 text-white hover:bg-white/10 rounded-full transition-colors relative"
              >
                <ShoppingCart className="w-6 h-6" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 
                                    bg-brand-accent text-white 
                                    text-[10px] font-bold 
                                    px-1.5 py-0.5 rounded-full 
                                    border border-brand-primary">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>



      {/* Banner Carousel */}
      < div className="p-4" >
        <BannerCarousel onBannerClick={handleBannerClick} />
      </div >

      {/* Flash Sale Section */}
      < div className="px-1 sm:px-3 md:px-4 mb-3 sm:mb-6" >
        <div className="bg-brand-gradient rounded-2xl p-5 text-white shadow-brand-card relative overflow-hidden">
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
                  <h2 className="text-xl font-bold text-white">
                    Flash Sale
                  </h2>
                  <p className="text-brand-accent text-sm font-medium">
                    {flashSaleProducts.length > 0 ? 'Diskon Terbatas!' : 'Nantikan Flash Sale Kami Selanjutnya'}
                  </p>
                </div>
              </div>
              <button
                onClick={onNavigateToFlashSale}
                className="bg-white text-red-500 px-4 py-2 rounded-full text-sm font-bold hover:bg-red-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {flashSaleProducts.length > 0 ? 'Lihat Semua' : 'Lihat Produk'}
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
              {flashSaleProducts
                .slice(0, 2)
                .map((flashProduct) => {
                  const discountPercentage = Math.round(((flashProduct.originalRetailPrice || flashProduct.retailPrice) - flashProduct.flashSalePrice) / (flashProduct.originalRetailPrice || flashProduct.retailPrice) * 100);

                  return (
                    <div
                      key={`flash-${flashProduct.id}`}
                      onClick={() => onProductClick(flashProduct)}
                      className="bg-white/10 rounded-lg p-3 backdrop-blur-sm hover:bg-white/20 transition-colors cursor-pointer"
                    >
                      <div className="relative">
                        <img
                          src={flashProduct.image || flashProduct.images?.[0] || '/placeholder-product.jpg'}
                          alt={flashProduct.name}
                          className="w-full aspect-[3/4] object-contain bg-white/10 rounded mb-2"
                        />
                        <div className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                          -{discountPercentage}%
                        </div>
                      </div>
                      <h3 className="text-white font-medium text-sm mb-1 truncate">{flashProduct.name}</h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-bold text-sm">
                          Rp {flashProduct.flashSalePrice.toLocaleString('id-ID')}
                        </span>
                        <span className="text-red-200 line-through text-xs">
                          Rp {(flashProduct.originalRetailPrice || flashProduct.retailPrice).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {flashSaleProducts.length === 0 && !loading && (
            <div className="text-center py-4 text-red-100">
              <span className="text-3xl">🚫</span>
              <p className="text-sm mt-1">Tidak ada Flash Sale saat ini</p>
            </div>
          )}
        </div>
      </div >

      {/* Flash Sale Countdown Display removed - using top section only */}

      {/* Featured Products */}
      <div className="px-1 sm:px-3 md:px-4 mb-3 sm:mb-6">
        <div className="flex items-center space-x-2 mb-2 px-1 sm:px-0">
          <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 fill-current" />
          <h2 className="text-base sm:text-lg font-bold text-gray-800">Produk Unggulan</h2>
        </div>

        {/* Loading skeleton for featured products */}
        {loading ? (
          <div className="grid grid-cols-2 gap-0.5 sm:gap-2 md:gap-3">
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
          <div className="grid grid-cols-2 gap-0.5 sm:gap-2 md:gap-3">
            {featuredProducts.map((product) => (
              <ProductCard
                key={`featured-${product.id}`}
                product={product}
                onProductClick={onProductClick}
                onAddToCart={handleAddToCart}
                user={user}
                isFeatured={true}
                isFlashSale={product.isFlashSale}
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

      {/* Categories - Modern Circle Grid */}
      <div className="px-4 mb-4">
        <div className="flex space-x-4 overflow-x-auto scrollbar-hide pb-2 pt-2">
          {categories.map((category, index) => {
            // Generate dynamic pastel colors for circle background
            const bgColors = ['bg-blue-100', 'bg-pink-100', 'bg-purple-100', 'bg-orange-100', 'bg-green-100', 'bg-teal-100'];
            const textColors = ['text-blue-600', 'text-pink-600', 'text-purple-600', 'text-orange-600', 'text-green-600', 'text-teal-600'];
            const colorIndex = index % bgColors.length;

            return (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setActiveTab(category.id === 'all' ? 'all' : 'terbaru');
                }}
                className="flex flex-col items-center flex-shrink-0 w-16 group"
              >
                <div className={`
              w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-1.5
              transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:-translate-y-1
              ${selectedCategory === category.id
                    ? 'bg-brand-primary text-white ring-2 ring-offset-2 ring-brand-primary shadow-lg scale-110'
                    : `${bgColors[colorIndex]} ${textColors[colorIndex]}`}
            `}>
                  {category.icon}
                </div>
                <span className={`
              text-xs font-medium text-center truncate w-full transition-colors
              ${selectedCategory === category.id ? 'text-brand-primary font-bold' : 'text-gray-600'}
            `}>
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters & Sort - Clean Horizontal Scroll */}
      <div className="sticky top-[60px] z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm mb-4">
        <div className="px-4 py-3 flex items-center space-x-3 overflow-x-auto scrollbar-hide">
          {/* Sort Filter - Minimalist Dropdown feel */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            >
              <option value="terbaru">🆕 Terbaru</option>
              <option value="termurah">💰 Termurah</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              <ArrowUpDown className="h-3 w-3" />
            </div>
          </div>

          <div className="w-px h-6 bg-gray-200 flex-shrink-0 mx-1"></div>

          {/* Chip Filters */}
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
                  ${statusFilter === 'all'
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            Semua
          </button>

          <button
            onClick={() => setStatusFilter('ready')}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5
                  ${statusFilter === 'ready'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-500 font-semibold'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-emerald-50'}`}
          >
            <div className={`w-2 h-2 rounded-full ${statusFilter === 'ready' ? 'bg-emerald-500' : 'bg-emerald-400'}`}></div>
            Ready Stock
          </button>

          <button
            onClick={() => setStatusFilter('po')}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5
                  ${statusFilter === 'po'
                ? 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-500 font-semibold'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-amber-50'}`}
          >
            <div className={`w-2 h-2 rounded-full ${statusFilter === 'po' ? 'bg-amber-500' : 'bg-amber-400'}`}></div>
            Pre Order
          </button>
        </div>
      </div>

      {/* All Products - Premium Header */}
      <div className="px-1 sm:px-3 md:px-4">
        <div className="flex flex-col space-y-2 mb-3 sm:mb-4">
          <div className="flex items-center justify-between px-1 sm:px-0 flex-wrap gap-2">
            <h2 className="text-xl font-bold text-gray-900">
              {selectedCategory === 'all' ? 'Semua Produk' : categories.find(c => c.id === selectedCategory)?.name}
            </h2>

            {/* Premium Product Count Badge */}
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-brand-primary/10 to-brand-accent/10 rounded-xl border border-brand-accent/20">
              <div className="w-2 h-2 bg-brand-accent rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-brand-primary">
                {filteredProducts.length} produk tersedia
              </span>
            </div>
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
            <div className="grid grid-cols-2 gap-3 px-2 sm:gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-4 lg:gap-6">
              {currentProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onProductClick={onProductClick}
                  onAddToCart={handleAddToCart}
                  user={user}
                  isFlashSale={product.isFlashSale}
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
      {
        user && (
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
        )
      }
    </div >
  );
};

export default HomePage;