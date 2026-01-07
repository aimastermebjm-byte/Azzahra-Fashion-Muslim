import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, ShoppingCart, Zap, X, Star } from 'lucide-react';
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
  const [showSearch, setShowSearch] = useState(false);

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
      {/* Header - NOOR Style: Centered Brand, Black BG, Gold Text */}
      <div className="sticky top-0 z-50 bg-brand-primary shadow-lg">
        <div className="px-3 sm:px-4 py-3">
          {/* Top Row - Chat Left, Centered Brand, Actions Right */}
          <div className="flex items-center justify-between">
            {/* Left - Menu/Chat Button */}
            <button
              onClick={() => window.open('https://wa.me/6281952989904?text=Halo%20Admin%20Azzahra%20Fashion%2C%20saya%20ingin%20bertanya', '_blank')}
              className="p-2.5 transition-all group active:scale-95"
              title="Hubungi Admin via WhatsApp"
            >
              <svg className="w-6 h-6 text-brand-accent/70 group-hover:text-brand-accent group-hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.6)] transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Centered Brand Name - Gold */}
            <div className="text-center">
              <h1 className="font-display text-lg sm:text-xl font-semibold text-brand-accent tracking-wide">
                AZZAHRA
              </h1>
              <p className="text-[9px] sm:text-[10px] text-white/70 tracking-widest -mt-0.5">
                FASHION MUSLIM
              </p>
            </div>

            {/* Right - Search & Cart */}
            <div className="flex items-center space-x-1">
              {/* Search Toggle Button */}
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2.5 transition-all group active:scale-95"
              >
                <Search className={`w-6 h-6 transition-all ${showSearch
                  ? 'text-brand-accent drop-shadow-[0_0_8px_rgba(212,175,55,0.8)]'
                  : 'text-brand-accent/70 group-hover:text-brand-accent group-hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]'
                  }`} />
              </button>

              {/* Cart Button */}
              <button
                onClick={onCartClick}
                className="relative p-2.5 transition-all group active:scale-95"
              >
                <ShoppingCart className="w-6 h-6 text-brand-accent/70 group-hover:text-brand-accent group-hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.6)] transition-all" />
                {cartCount > 0 && (
                  <span className="absolute top-1 right-1 bg-brand-accent text-brand-primary text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5 shadow-sm">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search Bar - Hidden by default, shows on toggle */}
          {showSearch && (
            <div className="mt-3 relative group animate-in slide-in-from-top-2 duration-300">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10">
                <Search className={`w-4 h-4 transition-all ${searchQuery ? 'text-brand-primary' : 'text-gray-400'}`} />
              </div>
              <input
                type="text"
                placeholder="Cari hijab, gamis, atau busana..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-brand-surfaceAlt border border-brand-border text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-accent/40 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Banner Carousel */}
      <div className="p-4">
        <BannerCarousel onBannerClick={handleBannerClick} />
      </div>

      {/* Flash Sale Section - ONLY show when products exist */}
      {flashSaleProducts.length > 0 && (
        <div className="px-3 sm:px-4 mb-4">
          <div className="bg-gradient-to-br from-brand-primary via-brand-primaryLight to-brand-accent rounded-2xl p-4 text-white shadow-elegant-lg relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/30 rounded-full -mr-20 -mt-20 blur-2xl"></div>
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-brand-accent/30 p-2 rounded-lg">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold text-white">Flash Sale</h2>
                    <p className="text-white/70 text-xs">Penawaran Terbatas!</p>
                  </div>
                </div>
                <button
                  onClick={onNavigateToFlashSale}
                  className="bg-white text-brand-primary px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-brand-surfaceAlt transition-all shadow-md"
                >
                  Lihat Semua
                </button>
              </div>

              {/* Flash Sale Products Grid */}
              <div className="grid grid-cols-2 gap-2">
                {flashSaleProducts.slice(0, 2).map((flashProduct) => {
                  const discountPercentage = Math.round(((flashProduct.originalRetailPrice || flashProduct.retailPrice) - flashProduct.flashSalePrice) / (flashProduct.originalRetailPrice || flashProduct.retailPrice) * 100);
                  return (
                    <div
                      key={`flash-${flashProduct.id}`}
                      onClick={() => onProductClick(flashProduct)}
                      className="bg-white/15 rounded-xl p-2.5 backdrop-blur-sm hover:bg-white/25 transition-all cursor-pointer group"
                    >
                      <div className="relative">
                        <img
                          src={flashProduct.image || flashProduct.images?.[0] || '/placeholder-product.jpg'}
                          alt={flashProduct.name}
                          className="w-full aspect-[3/4] object-contain bg-white/10 rounded-lg mb-2 group-hover:scale-[1.02] transition-transform"
                        />
                        <div className="absolute top-1 right-1 bg-white text-brand-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          -{discountPercentage}%
                        </div>
                      </div>
                      <h3 className="text-white font-medium text-xs mb-1 truncate">{flashProduct.name}</h3>
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-bold text-sm font-price">
                          Rp {flashProduct.flashSalePrice.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Banner - Show when NO Flash Sale - NOOR Style */}
      {flashSaleProducts.length === 0 && !loading && (
        <div className="px-3 sm:px-4 mb-4">
          <div
            className="rounded-2xl overflow-hidden shadow-elegant relative h-[180px] sm:h-[220px] cursor-pointer"
            onClick={() => setSelectedCategory('all')}
          >
            {/* Full Image Background */}
            <img
              src="/hero-model.png"
              alt="Azzahra Fashion Model"
              className="absolute inset-0 w-full h-full object-cover object-[60%_15%]"
            />

            {/* Text Directly on Image */}
            <div className="absolute bottom-0 left-0 p-4 sm:p-6">
              <h2 className="font-display text-xl sm:text-3xl font-semibold text-brand-primary leading-tight drop-shadow-sm">
                Elegance<br />
                <span className="text-brand-accent">in Modesty.</span>
              </h2>
              <p className="text-gray-700 text-[10px] sm:text-xs mt-1 drop-shadow-sm">Tap untuk lihat koleksi</p>
            </div>
          </div>
        </div>
      )}

      {/* Flash Sale Countdown Display removed - using top section only */}

      {/* Featured Products - Elegant Header */}
      <div className="px-3 sm:px-4 mb-4">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-8 h-8 bg-brand-accent/20 rounded-lg flex items-center justify-center">
            <Star className="w-4 h-4 text-brand-accent fill-current" />
          </div>
          <h2 className="font-display text-lg font-semibold text-gray-900">Produk Unggulan</h2>
        </div>

        {/* Loading skeleton for featured products */}
        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {[...Array(2)].map((_, index) => (
              <div key={`skeleton-${index}`} className="bg-white rounded-xl shadow-elegant overflow-hidden">
                <div className="w-full aspect-[3/4] bg-brand-border animate-pulse"></div>
                <div className="p-3">
                  <div className="h-4 bg-brand-border rounded animate-pulse mb-2"></div>
                  <div className="h-4 bg-brand-border rounded w-2/3 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : featuredProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
          <div className="text-center py-10 bg-white rounded-xl shadow-elegant">
            <div className="w-14 h-14 bg-brand-surfaceAlt rounded-full flex items-center justify-center mx-auto mb-3">
              <Star className="w-7 h-7 text-brand-border" />
            </div>
            <p className="text-gray-500 text-sm">Belum ada produk unggulan</p>
          </div>
        )}
      </div>

      {/* Categories - Sticky Glassmorphism Style */}
      <div className="sticky top-[60px] z-30 py-3 mb-4 -mx-2 sm:mx-0">
        <div className="absolute inset-0 bg-brand-surface/80 backdrop-blur-md border-b border-brand-border/30 shadow-sm"></div>
        <div className="relative px-4">
          <div
            className="flex space-x-2.5 overflow-x-auto pb-0.5 scrollbar-none [&::-webkit-scrollbar]:hidden"
            style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
          >
            {categories.map((category) => {
              const productCount = category.id === 'all'
                ? filteredProducts.length
                : filteredProducts.filter(p => p.category === category.id).length;

              const isSelected = selectedCategory === category.id;

              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setActiveTab(category.id === 'all' ? 'all' : 'terbaru');
                  }}
                  className={`
                    flex-shrink-0 
                    flex items-center space-x-2
                    px-5 py-2
                    rounded-full 
                    text-xs font-medium tracking-wide
                    transition-all duration-300 ease-out
                    border
                    ${isSelected
                      ? 'bg-brand-primary border-brand-primary text-brand-accent shadow-[0_4px_10px_rgba(0,0,0,0.2)] scale-105' // Active: Black + Gold Shadow
                      : 'bg-white/40 border-brand-accent/20 text-gray-600 hover:border-brand-accent/50 hover:bg-white/60' // Inactive: Glassy + Thin Gold Border
                    }
                  `}
                >
                  <span className={isSelected ? 'font-semibold' : ''}>{category.name}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-brand-accent/80' : 'text-gray-400'}`}>
                    {productCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filters & Sort - Compact Elegant */}
      <div className="px-3 sm:px-4 mb-4">
        <div className="flex flex-wrap gap-2">
          {/* Sort Options */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-gray-400 uppercase">Urut:</span>
            <button
              onClick={() => setSortBy('terbaru')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortBy === 'terbaru'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'bg-white text-gray-600 border border-brand-border hover:border-brand-accent'
                }`}
            >
              Terbaru
            </button>
            <button
              onClick={() => setSortBy('termurah')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortBy === 'termurah'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'bg-white text-gray-600 border border-brand-border hover:border-brand-accent'
                }`}
            >
              Termurah
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-gray-400 uppercase">Status:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === 'all'
                ? 'bg-gray-800 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-brand-border'
                }`}
            >
              Semua
            </button>
            <button
              onClick={() => setStatusFilter('ready')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === 'ready'
                ? 'bg-brand-success text-white shadow-sm'
                : 'bg-brand-successLight text-brand-success border border-brand-success/20'
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'ready' ? 'bg-white' : 'bg-brand-success'}`}></span>
              Ready
            </button>
            <button
              onClick={() => setStatusFilter('po')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === 'po'
                ? 'bg-brand-warning text-white shadow-sm'
                : 'bg-brand-warningLight text-brand-warning border border-brand-warning/20'
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'po' ? 'bg-white' : 'bg-brand-warning'}`}></span>
              PO
            </button>
          </div>
        </div>
      </div>

      {/* All Products - Elegant Section */}
      <div className="px-3 sm:px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold text-gray-900">
            {selectedCategory === 'all' ? 'Semua Koleksi' : categories.find(c => c.id === selectedCategory)?.name}
          </h2>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-surfaceAlt rounded-lg border border-brand-border">
            <div className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-brand-primary">{filteredProducts.length} produk</span>
          </div>
        </div>
        {/* Product Grid */}
        {isSearching ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-accent border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-500 text-sm">Mencari produk...</p>
          </div>
        ) : currentProducts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-elegant">
            <div className="w-16 h-16 bg-brand-surfaceAlt rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-brand-border" />
            </div>
            <h3 className="font-display text-lg text-gray-700 mb-1">
              {showSearchResults ? 'Tidak ada hasil' : 'Produk tidak ditemukan'}
            </h3>
            <p className="text-gray-400 text-sm">
              {showSearchResults ? 'Coba kata kunci lain' : 'Pilih kategori berbeda'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
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
                <div ref={loadMoreRef} className="inline-flex items-center justify-center p-4">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-accent border-t-transparent"></div>
                      <span className="text-gray-500 text-sm">Memuat...</span>
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

      {/* User Role Indicator - Subtle */}
      {user && (
        <div className="fixed bottom-20 right-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-elegant px-3 py-2 border border-brand-border">
          <span className="text-[10px] font-medium text-gray-400 uppercase">Login:</span>
          <span className="text-xs font-semibold text-brand-primary ml-1">
            {user.role === 'reseller' ? 'Reseller' : user.role === 'customer' ? 'Customer' : user.role}
          </span>
        </div>
      )}
    </div>
  );
};

export default HomePage;