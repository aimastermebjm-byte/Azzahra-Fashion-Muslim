import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, orderBy, limit as limitCount, startAfter, where } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';
import { productCache, invalidateProductCache } from '../utils/productCache';
import { SearchCacheKey, CACHE_KEYS } from '../types/cache';

export const useFirebaseProductsRealTime = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(20); // Fixed 20 produk untuk infinite scroll seperti Shopee

  // Dedicated state for featured products
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  // Dedicated state for flash sale products (FUTURE-PROOF)
  const [flashSaleProducts, setFlashSaleProducts] = useState<Product[]>([]);
  const [flashSaleLoading, setFlashSaleLoading] = useState(true);

  // Dedicated state for Ready products with pagination
  const [readyProducts, setReadyProducts] = useState<Product[]>([]);
  const [readyLoading, setReadyLoading] = useState(true);
  const [readyLastVisible, setReadyLastVisible] = useState<any>(null);
  const [hasMoreReady, setHasMoreReady] = useState(true);

  // Dedicated state for PO products with pagination
  const [poProducts, setPoProducts] = useState<Product[]>([]);
  const [poLoading, setPoLoading] = useState(true);
  const [poLastVisible, setPoLastVisible] = useState<any>(null);
  const [hasMorePo, setHasMorePo] = useState(true);

  // Dedicated state for Cheapest products with pagination
  const [cheapestProducts, setCheapestProducts] = useState<Product[]>([]);
  const [cheapestLoading, setCheapestLoading] = useState(false);
  const [cheapestLastVisible, setCheapestLastVisible] = useState<any>(null);
  const [hasMoreCheapest, setHasMoreCheapest] = useState(true);

  // Cache sync debounce protection
  const lastSyncTimeRef = useRef<number>(0);
  const SYNC_DEBOUNCE_MS = 2000; // 2 seconds debounce

  useEffect(() => {
    console.log('🔄 Setting up SAFE event-based products system (HOME)...');

    // Load initial products dengan cache-first approach
    const loadInitialProducts = async () => {
      try {
        console.log('🔍 Trying cache first for home products...');

        // Coba dapatkan dari cache dulu
        const cachedData = productCache.getProductList(CACHE_KEYS.HOME, 1, 'customer');
        if (cachedData && !initialLoad) {
          console.log('✅ Using cached home products:', cachedData.products.length, 'products');
          setProducts(cachedData.products);
          setHasMore(cachedData.hasMore);
          setLastVisible(cachedData.lastVisible);
          setLoading(false);
          setInitialLoad(false);
          setError(null);
          return;
        }

        console.log('📦 Loading fresh products from Firebase (HOME)...');
        const { getDocs } = await import('firebase/firestore');
        const productsRef = collection(db, 'products');
        const q = query(
          productsRef,
          orderBy('createdAt', 'desc'),
          limitCount(productsPerPage)
        );

        const querySnapshot = await getDocs(q);
        console.log('📦 Fresh products loaded (HOME):', querySnapshot.docs.length, 'products');

        const loadedProducts: Product[] = [];
        let lastDoc: any = null;

        querySnapshot.forEach((doc) => {
          lastDoc = doc;
          const data = doc.data();

          // Calculate total stock from variants if available
          const stock = Number(data.stock || 0);
          const calculatedTotalStock = data.variants?.stock ?
            Object.values(data.variants.stock).reduce((total: number, sizeStock: any) => {
              return total + Object.values(sizeStock as any).reduce((sizeTotal: number, colorStock: any) => {
                return sizeTotal + Number(colorStock || 0);
              }, 0);
            }, 0) : stock;

          const variantsData = {
            sizes: data.variants?.sizes || data.sizes || [],
            colors: data.variants?.colors || data.colors || [],
            stock: data.variants?.stock && typeof data.variants?.stock === 'object' ? data.variants.stock : {}
          };

          loadedProducts.push({
            id: doc.id,
            name: data.name || '',
            description: data.description || '',
            category: data.category || 'uncategorized',
            retailPrice: Number(data.retailPrice || data.price || 0),
            resellerPrice: Number(data.resellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
            costPrice: Number(data.costPrice) || Number(data.retailPrice || data.price || 0) * 0.6,
            stock: calculatedTotalStock,
            images: (data.images || []),
            image: data.images?.[0] || '/placeholder-product.jpg',
            variants: variantsData,
            isFeatured: Boolean(data.isFeatured || data.featured),
            isFlashSale: Boolean(data.isFlashSale),
            flashSalePrice: Number(data.flashSalePrice) || Number(data.retailPrice || data.price || 0),
            originalRetailPrice: Number(data.originalRetailPrice) || Number(data.retailPrice || data.price || 0),
            originalResellerPrice: Number(data.originalResellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
            createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt?.toDate()) : new Date(),
            salesCount: Number(data.salesCount) || 0,
            featuredOrder: Number(data.featuredOrder) || 0,
            weight: Number(data.weight) || 0,
            unit: 'gram',
            status: data.status || (data.condition === 'baru' ? 'ready' : 'po') || 'ready',
            estimatedReady: data.estimatedReady ? new Date(data.estimatedReady) : undefined
          });
        });

        // Simpan ke cache
        const hasMoreProducts = querySnapshot.docs.length === productsPerPage;
        productCache.setProductList(CACHE_KEYS.HOME, {
          products: loadedProducts,
          hasMore: hasMoreProducts,
          lastVisible: lastDoc
        }, 1, 'customer');

        console.log('💾 Home products cached for faster loading');

        setProducts(loadedProducts);
        setLastVisible(lastDoc);
        setLoading(false);
        setInitialLoad(false);
        setError(null);
        setHasMore(hasMoreProducts);

      } catch (error) {
        console.error('❌ Failed to load initial products (HOME):', error);
        setError(error instanceof Error ? error.message : 'Failed to load products');
        setLoading(false);
        setInitialLoad(false);
      }
    };

    // Load featured products dengan cache-first approach
    const loadFeaturedProducts = async () => {
      try {
        console.log('🔍 Trying cache first for featured products...');

        // Coba dapatkan dari cache dulu
        const cachedFeatured = productCache.getFeaturedProducts();
        if (cachedFeatured && !initialLoad) {
          console.log('✅ Using cached featured products:', cachedFeatured.products.length, 'products');
          setFeaturedProducts(cachedFeatured.products);
          setFeaturedLoading(false);
          return;
        }

        console.log('⭐ Loading fresh featured products from Firebase...');
        const { getDocs, where } = await import('firebase/firestore');
        const productsRef = collection(db, 'products');
        let q;

        // Gunakan fallback query dulu karena index belum dibuat
        console.warn('⚠️ Menggunakan query fallback sambil menunggu index dibuat');
        q = query(
          productsRef,
          where('isFeatured', '==', true),
          limitCount(50) // Ambil lebih banyak untuk client sorting
        );

        // TODO: Aktifkan query ini setelah index dibuat di Firebase Console
        // q = query(
        //   productsRef,
        //   where('isFeatured', '==', true),
        //   orderBy('featuredOrder', 'asc'),
        //   limitCount(10)
        // );

        const querySnapshot = await getDocs(q);
        console.log('⭐ Fresh featured products loaded:', querySnapshot.docs.length, 'products');

        const loadedFeatured: Product[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();

          // Calculate total stock from variants if available
          const stock = Number(data.stock || 0);
          const calculatedTotalStock = data.variants?.stock ?
            Object.values(data.variants.stock).reduce((total: number, sizeStock: any) => {
              return total + Object.values(sizeStock as any).reduce((sizeTotal: number, colorStock: any) => {
                return sizeTotal + Number(colorStock || 0);
              }, 0);
            }, 0) : stock;

          const variantsData = {
            sizes: data.variants?.sizes || data.sizes || [],
            colors: data.variants?.colors || data.colors || [],
            stock: data.variants?.stock && typeof data.variants?.stock === 'object' ? data.variants.stock : {}
          };

          loadedFeatured.push({
            id: doc.id,
            name: data.name || '',
            description: data.description || '',
            category: data.category || 'uncategorized',
            retailPrice: Number(data.retailPrice || data.price || 0),
            resellerPrice: Number(data.resellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
            costPrice: Number(data.costPrice) || Number(data.retailPrice || data.price || 0) * 0.6,
            stock: calculatedTotalStock,
            images: (data.images || []),
            image: data.images?.[0] || '/placeholder-product.jpg',
            variants: variantsData,
            isFeatured: Boolean(data.isFeatured || data.featured),
            isFlashSale: Boolean(data.isFlashSale),
            flashSalePrice: Number(data.flashSalePrice) || Number(data.retailPrice || data.price || 0),
            originalRetailPrice: Number(data.originalRetailPrice) || Number(data.retailPrice || data.price || 0),
            originalResellerPrice: Number(data.originalResellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
            createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt?.toDate()) : new Date(),
            salesCount: Number(data.salesCount) || 0,
            featuredOrder: Number(data.featuredOrder) || 0,
            weight: Number(data.weight) || 0,
            unit: 'gram',
            status: data.status || (data.condition === 'baru' ? 'ready' : 'po') || 'ready',
            estimatedReady: data.estimatedReady ? new Date(data.estimatedReady) : undefined
          });
        });

        // Client-side sorting jika menggunakan fallback query
        const sortedFeatured = loadedFeatured.sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0));

        // Simpan ke cache
        productCache.setFeaturedProducts({
          products: sortedFeatured,
          lastUpdated: Date.now()
        });

        console.log('💾 Featured products cached for faster loading');

        setFeaturedProducts(sortedFeatured);
        setFeaturedLoading(false);

      } catch (error) {
        console.error('❌ Failed to load featured products:', error);
        setFeaturedProducts([]);
        setFeaturedLoading(false);
      }
    };

    // DISABLED: Flash sale sekarang menggunakan useFirebaseFlashSale hook sendiri
    // Ini untuk mencegah infinite loop dan multiple Firebase reads
    const loadFlashSaleProducts = async () => {
      console.log('🚫 Flash sale loading disabled - using useFirebaseFlashSale hook instead');
      setFlashSaleProducts([]);
      setFlashSaleLoading(false);
    };

    // DISABLED: Flash sale fresh loading - using useFirebaseFlashSale hook instead
    const loadFreshFlashSaleProducts = async () => {
      console.log('🚫 Fresh flash sale loading disabled - using useFirebaseFlashSale hook');
      setFlashSaleLoading(false);
      return;
    };

    // EVENT-BASED SYNC ONLY (COST-EFFECTIVE!)
    const setupEventBasedSync = () => {
      console.log('🔄 Setting up SAFE event-based sync with cache invalidation...');

      // Event listeners for cross-device sync (FREE)
      const handleStockChange = () => {
        console.log('📊 Stock change event received (HOME) - refreshing...');
        invalidateProductCache({
          type: 'stock_change',
          timestamp: Date.now(),
          triggerBy: 'system'
        });
        loadInitialProducts();
      };

      const handleAdminProductUpdate = () => {
        console.log('🛠️ Admin product update event received (HOME) - refreshing all...');
        invalidateProductCache({
          type: 'product_update',
          timestamp: Date.now(),
          triggerBy: 'admin'
        });
        loadInitialProducts();
        loadFeaturedProducts();
        loadFlashSaleProducts();
      };

      const handleFeaturedProductsUpdate = () => {
        console.log('⭐ Featured products update event received (HOME) - refreshing featured...');
        invalidateProductCache({
          type: 'featured_update',
          timestamp: Date.now(),
          triggerBy: 'admin'
        });
        loadFeaturedProducts();
      };

      const handleFlashSaleUpdate = () => {
        console.log('🔥 Flash sale update event received (HOME) - refreshing flash sale...');
        invalidateProductCache({
          type: 'flashsale_update',
          timestamp: Date.now(),
          triggerBy: 'admin'
        });
        // Hanya refresh jika tidak dalam proses loading
        if (!flashSaleLoading) {
          loadFlashSaleProducts();
        }
      };

      // Cache sync event listeners with debounce protection
      const handleCacheSync = (event: StorageEvent) => {
        if (event.key === 'cache_sync_trigger') {
          const now = Date.now();

          // Debounce protection - hanya proses sync jika sudah 2 detik sejak sync terakhir
          if (now - lastSyncTimeRef.current < SYNC_DEBOUNCE_MS) {
            console.log('🚫 Cache sync debounced, skipping to prevent infinite loop');
            return;
          }

          console.log('🔄 Cross-device cache sync detected (HOME)');
          lastSyncTimeRef.current = now;

          // Delay sedikit untuk memastikan tidak ada sync lain yang pending
          setTimeout(() => {
            loadInitialProducts();
            loadFeaturedProducts();
            loadFlashSaleProducts();
          }, 100);
        }
      };

      // Cache update events for same-tab sync
      const handleCacheUpdated = (event: CustomEvent) => {
        console.log('🔄 Cache updated in same tab (HOME)', event.detail);
        // Handle same-tab cache updates if needed
      };

      const handleStorageChange = (event: StorageEvent) => {
        // Hanya proses event dari device lain (bukan current tab)
        if (!event.newValue || event.newValue === 'ignore') return;

        if (event.key === 'stock_change_trigger' ||
            event.key === 'stock_depleted_trigger' ||
            event.key === 'stock_low_trigger') {
          console.log('📊 Cross-device stock sync detected (HOME)');
          handleStockChange();
        } else if (event.key === 'admin_product_updated') {
          console.log('🛠️ Admin product update detected (HOME)');
          handleAdminProductUpdate();
        } else if (event.key === 'featured_products_updated') {
          console.log('⭐ Featured products update detected (HOME)');
          handleFeaturedProductsUpdate();
        } else if (event.key === 'flash_sale_updated') {
          console.log('�� Flash sale update detected (HOME)');
          handleFlashSaleUpdate();
        }
      };

      window.addEventListener('stockChanged', handleStockChange);
      window.addEventListener('adminProductUpdated', handleAdminProductUpdate);
      window.addEventListener('featuredProductsChanged', handleFeaturedProductsUpdate); // Fixed event name
      window.addEventListener('flashSaleChanged', handleFlashSaleUpdate); // Fixed event name
      window.addEventListener('storage', handleStorageChange);

      // Add cache sync event listeners
      window.addEventListener('storage', handleCacheSync);
      window.addEventListener('cacheUpdated', handleCacheUpdated as EventListener);

      console.log('✅ Enhanced event-based sync with cache ready (COST: 0 reads per day!)');

      // Cleanup function
      return () => {
        window.removeEventListener('stockChanged', handleStockChange);
        window.removeEventListener('adminProductUpdated', handleAdminProductUpdate);
        window.removeEventListener('featuredProductsChanged', handleFeaturedProductsUpdate); // Fixed event name
        window.removeEventListener('flashSaleChanged', handleFlashSaleUpdate); // Fixed event name
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('storage', handleCacheSync);
        window.removeEventListener('cacheUpdated', handleCacheUpdated as EventListener);
        console.log('🔄 Enhanced event-based sync with cache cleaned up');
      };
    };

    const cleanup = setupEventBasedSync();

    // Load all product types (NORMAL + FEATURED + FLASH SALE)
    loadInitialProducts();
    loadFeaturedProducts();
    loadFlashSaleProducts();

    // Mobile timeout protection - INCREASED to 30 seconds
    const mobileTimeout = setTimeout(() => {
      if (loading && initialLoad) {
        console.warn('⏰ Products loading taking too long (HOME), triggering fallback');
        setLoading(false);
        setInitialLoad(false);
        // Don't set error immediately - allow more time for flash sale/featured queries
        // setError('Loading terlalu lama, silakan refresh halaman');
      }
    }, 30000); // Increased from 8s to 30s for slow connections

    return () => {
      // Cleanup smart real-time system
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }

      if (mobileTimeout) {
        clearTimeout(mobileTimeout);
      }
      console.log('🔄 Smart hybrid products system cleaned up (HOME)');
    };
  }, [productsPerPage]);

  // Load more products for infinite scroll (tetap menggunakan manual query karena onSnapshot tidak support pagination yang efisien)
  const loadMoreProducts = useCallback(async () => {
    if (!hasMore || loading || !lastVisible) return;

    setLoading(true);
    try {
      const { getDocs } = await import('firebase/firestore');
      const productsRef = collection(db, 'products');
      const q = query(
        productsRef,
        orderBy('createdAt', 'desc'),
        startAfter(lastVisible),
        limitCount(productsPerPage)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setHasMore(false);
        setLoading(false);
        return;
      }

      const newProducts: Product[] = [];
      let lastDoc: any = null;

      querySnapshot.forEach((doc) => {
        lastDoc = doc;
        const data = doc.data();

        // Calculate total stock from variants if available
        const stock = Number(data.stock || 0);
        const calculatedTotalStock = data.variants?.stock ?
          Object.values(data.variants.stock).reduce((total: number, sizeStock: any) => {
            return total + Object.values(sizeStock as any).reduce((sizeTotal: number, colorStock: any) => {
              return sizeTotal + Number(colorStock || 0);
            }, 0);
          }, 0) : stock;

        const variantsData = {
          sizes: data.variants?.sizes || data.sizes || [],
          colors: data.variants?.colors || data.colors || [],
          stock: data.variants?.stock && typeof data.variants?.stock === 'object' ? data.variants.stock : {}
        };

        newProducts.push({
          id: doc.id,
          name: data.name || '',
          description: data.description || '',
          category: data.category || 'uncategorized',
          retailPrice: Number(data.retailPrice || data.price || 0),
          resellerPrice: Number(data.resellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          costPrice: Number(data.costPrice) || Number(data.retailPrice || data.price || 0) * 0.6,
          stock: calculatedTotalStock,
          images: (data.images || []),
          image: data.images?.[0] || '/placeholder-product.jpg',
          variants: variantsData,
          isFeatured: Boolean(data.isFeatured || data.featured),
          isFlashSale: Boolean(data.isFlashSale),
          flashSalePrice: Number(data.flashSalePrice) || Number(data.retailPrice || data.price || 0),
          originalRetailPrice: Number(data.originalRetailPrice) || Number(data.retailPrice || data.price || 0),
          originalResellerPrice: Number(data.originalResellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt?.toDate()) : new Date(),
          salesCount: Number(data.salesCount) || 0,
          featuredOrder: Number(data.featuredOrder) || 0,
          weight: Number(data.weight) || 0,
          unit: 'gram',
          status: data.status || (data.condition === 'baru' ? 'ready' : 'po') || 'ready',
          estimatedReady: data.estimatedReady ? new Date(data.estimatedReady) : undefined
        });
      });

      setProducts(prev => [...prev, ...newProducts]);
      setLastVisible(lastDoc);
      setCurrentPage(prev => prev + 1);
      setHasMore(querySnapshot.docs.length === productsPerPage);
      setLoading(false);

    } catch (error) {
      console.error('❌ Error loading more products:', error);
      setLoading(false);
    }
  }, [hasMore, loading, lastVisible, productsPerPage]);

  // Search products with cache support
  const searchProducts = useCallback(async (params: SearchCacheKey): Promise<any> => {
    try {
      console.log('🔍 Searching products with cache support...', params);

      // Coba dapatkan dari cache dulu
      const cachedResults = productCache.getSearchResults(params);
      if (cachedResults) {
        console.log('✅ Using cached search results:', cachedResults.products.length, 'products');
        return cachedResults;
      }

      console.log('🔍 Searching products from Firebase...');
      const { getDocs, collection, query, orderBy, limit, where, startAfter } = await import('firebase/firestore');
      const productsRef = collection(db, 'products');

      let querySnapshot;

      try {
        // Try dengan composite index (jika sudah ada)
        // Build query based on search parameters
        let q = query(
          productsRef,
          limit(50) // Ambil lebih banyak untuk client-side filtering
        );

        // Add category filter
        if (params.category && params.category !== 'all') {
          q = query(q, where('category', '==', params.category));
        }

        // Add status filter
        if (params.status && params.status !== 'all') {
          q = query(q, where('status', '==', params.status));
        }

        // Add sorting
        switch (params.sortBy) {
          case 'termurah':
            q = query(q, orderBy('retailPrice', 'asc'));
            break;
          case 'terbaru':
          default:
            q = query(q, orderBy('createdAt', 'desc'));
            break;
        }

        querySnapshot = await getDocs(q);
        console.log('✅ Search: Menggunakan indexed query');
      } catch (indexError: any) {
        if (indexError.message.includes('requires an index')) {
          console.log('⚠️ Search: Index tidak ditemukan, menggunakan fallback query');

          // Fallback query tanpa orderBy, lalu client-side sorting
          let fallbackQuery = query(
            productsRef,
            limit(100) // Ambil lebih banyak untuk client-side processing
          );

          // Add filters tanpa orderBy
          if (params.category && params.category !== 'all') {
            fallbackQuery = query(fallbackQuery, where('category', '==', params.category));
          }
          if (params.status && params.status !== 'all') {
            fallbackQuery = query(fallbackQuery, where('status', '==', params.status));
          }

          const fallbackSnapshot = await getDocs(fallbackQuery);

          // Client-side sorting
          let sortedDocs = fallbackSnapshot.docs;
          switch (params.sortBy) {
            case 'termurah':
              sortedDocs = sortedDocs.sort((a, b) => {
                const priceA = Number(a.data().retailPrice || 0);
                const priceB = Number(b.data().retailPrice || 0);
                return priceA - priceB;
              });
              break;
            case 'terbaru':
            default:
              sortedDocs = sortedDocs.sort((a, b) => {
                const dateA = a.data().createdAt?.toMillis ? a.data().createdAt.toMillis() :
                             (typeof a.data().createdAt === 'string' ? new Date(a.data().createdAt).getTime() : 0);
                const dateB = b.data().createdAt?.toMillis ? b.data().createdAt.toMillis() :
                             (typeof b.data().createdAt === 'string' ? new Date(b.data().createdAt).getTime() : 0);
                return dateB - dateA;
              });
              break;
          }

          querySnapshot = {
            docs: sortedDocs,
            size: sortedDocs.length,
            empty: sortedDocs.length === 0,
            forEach: (callback: (doc: any) => void) => sortedDocs.forEach(callback)
          } as any;

          console.log('✅ Search: Menggunakan fallback query dengan client-side sorting');
        } else {
          throw indexError;
        }
      }

      console.log('🔍 Firebase search results:', querySnapshot.docs.length, 'products');

      const searchResults: any[] = [];
      let lastDoc: any = null;

      querySnapshot.forEach((doc) => {
        lastDoc = doc;
        const data = doc.data();

        // Client-side filtering for name search (since Firestore is limited)
        if (params.query && params.query.trim()) {
          const searchTerms = params.query.toLowerCase().split(' ');
          const productName = (data.name || '').toLowerCase();
          const productDescription = (data.description || '').toLowerCase();

          const matchesSearch = searchTerms.every(term =>
            productName.includes(term) || productDescription.includes(term)
          );

          if (!matchesSearch) return;
        }

        // Calculate total stock from variants if available
        const stock = Number(data.stock || 0);
        const calculatedTotalStock = data.variants?.stock ?
          Object.values(data.variants.stock).reduce((total: number, sizeStock: any) => {
            return total + Object.values(sizeStock as any).reduce((sizeTotal: number, colorStock: any) => {
              return sizeTotal + Number(colorStock || 0);
            }, 0);
          }, 0) : stock;

        const variantsData = {
          sizes: data.variants?.sizes || data.sizes || [],
          colors: data.variants?.colors || data.colors || [],
          stock: data.variants?.stock && typeof data.variants?.stock === 'object' ? data.variants.stock : {}
        };

        searchResults.push({
          id: doc.id,
          name: data.name || '',
          description: data.description || '',
          category: data.category || 'uncategorized',
          retailPrice: Number(data.retailPrice || data.price || 0),
          resellerPrice: Number(data.resellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          costPrice: Number(data.costPrice) || Number(data.retailPrice || data.price || 0) * 0.6,
          stock: calculatedTotalStock,
          images: (data.images || []),
          image: data.images?.[0] || '/placeholder-product.jpg',
          variants: variantsData,
          isFeatured: Boolean(data.isFeatured || data.featured),
          isFlashSale: Boolean(data.isFlashSale),
          flashSalePrice: Number(data.flashSalePrice) || Number(data.retailPrice || data.price || 0),
          originalRetailPrice: Number(data.originalRetailPrice) || Number(data.retailPrice || data.price || 0),
          originalResellerPrice: Number(data.originalResellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt?.toDate()) : new Date(),
          salesCount: Number(data.salesCount) || 0,
          featuredOrder: Number(data.featuredOrder) || 0,
          weight: Number(data.weight) || 0,
          unit: 'gram',
          status: data.status || (data.condition === 'baru' ? 'ready' : 'po') || 'ready',
          estimatedReady: data.estimatedReady ? new Date(data.estimatedReady) : undefined
        });
      });

      const results = {
        products: searchResults.slice(0, 20), // Ensure max 20 products
        hasMore: searchResults.length === 20,
        totalCount: searchResults.length,
        lastVisible: lastDoc
      };

      // Save to cache
      productCache.setSearchResults(params, results);
      console.log('💾 Search results cached for faster loading');

      return results;

    } catch (error) {
      console.error('❌ Error searching products:', error);
      return {
        products: [],
        hasMore: false,
        totalCount: 0
      };
    }
  }, []);

  return {
    products,
    loading: loading && initialLoad,
    error,
    hasMore,
    currentPage,
    productsPerPage,
    setCurrentPage,
    loadMoreProducts,
    featuredProducts,
    featuredLoading,
    flashSaleProducts,
    flashSaleLoading,
    searchProducts
  };
};