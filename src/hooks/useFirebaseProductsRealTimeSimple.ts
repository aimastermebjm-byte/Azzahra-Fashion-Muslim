import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';
import { BATCH_CONFIG } from '../constants/batchConfig';
import CacheUtils from '../utils/cacheUtils';
import CacheInvalidationManager from '../utils/cacheInvalidation';

export const useFirebaseProductsRealTimeSimple = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [allCachedProducts, setAllCachedProducts] = useState<Product[]>([]);

  // 🔥 OPTIMIZED: Try cache first, then Firestore with persistence
  const loadProducts = useCallback(async (loadMore = false) => {
    try {
      // Set loading state differently for loadMore
      if (!loadMore) {
        setLoading(true);
        setError(null);
        setProducts([]);
        setAllCachedProducts([]);
      }

      console.log('🔄 Loading products (CACHE + FIRESTORE PERSISTENCE)...');

      // 🔥 STEP 1: Try Local Cache First (Instant)
      if (!loadMore && CacheUtils.isCacheValid('products')) {
        const cachedData = CacheUtils.loadCache('products');

        if (cachedData && cachedData.length > 0) {
          console.log(`✅ CACHE HIT: ${cachedData.length} products from cache (0 Firebase reads)`);
          console.log(`💾 Cache size: ${CacheUtils.getCacheSize()}`);
          console.log(`📶 Network: ${CacheUtils.isOnline() ? 'Online' : 'Offline'}`);

          // Sort by createdAt (terbaru dulu)
          const allProducts = cachedData.sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
          });

          setAllCachedProducts(allProducts);

          // Pagination
          const pageSize = BATCH_CONFIG.LOAD_MORE_SIZE;
          const startIndex = loadMore ? products.length : 0;
          const endIndex = startIndex + pageSize;
          const pageProducts = allProducts.slice(startIndex, endIndex);

          setProducts(prev => loadMore ? [...prev, ...pageProducts] : pageProducts);
          setHasMore(endIndex < allProducts.length);
          setLoading(false);

          // Background sync only if cache is old (more than 1 minute)
          const lastUpdate = CacheUtils.getLastUpdateTime('products');
          const now = Date.now();
          const cacheAge = lastUpdate ? now - lastUpdate : Infinity;
          const oneMinute = 60 * 1000;

          if (CacheUtils.isOnline() && cacheAge > oneMinute) {
            console.log('🔄 Cache is old, background syncing...');
            CacheUtils.syncCache('products').catch(console.error);
          } else {
            console.log('✅ Cache is fresh, no background sync needed');
          }

          return; // ✅ Cache success - exit
        }
      }

      // 🔥 STEP 2: Load from Firestore (with persistence)
      console.log('📡 Cache miss/expired - loading from Firestore with persistence...');

      const batchRef = collection(db, 'productBatches');
      const q = query(batchRef, where('__name__', '==', 'batch_1'));
      const batchSnapshot = await getDocs(q);

      if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
        const batchData = batchSnapshot.docs[0].data();
        const allProducts = batchData.products || [];

        if (allProducts.length > 0) {
          console.log(`✅ FIRESTORE LOAD: ${allProducts.length} products from batch (1 read vs ${allProducts.length} reads)`);
          console.log(`💰 Cost savings: ${allProducts.length - 1} reads saved (${Math.round((allProducts.length - 1) / allProducts.length * 100)}%)`);
          console.log(`🔥 Persistence: Data cached for offline use`);

          // Sort by createdAt (terbaru dulu)
          allProducts.sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
          });

          // Cache the data for future use
          if (!loadMore) {
            CacheUtils.saveCache(allProducts, 'products');
            setAllCachedProducts(allProducts);
          }

          // Pagination
          const pageSize = BATCH_CONFIG.LOAD_MORE_SIZE;
          const startIndex = loadMore ? products.length : 0;
          const endIndex = startIndex + pageSize;
          const pageProducts = allProducts.slice(startIndex, endIndex);

          setProducts(prev => loadMore ? [...prev, ...pageProducts] : pageProducts);
          setHasMore(endIndex < allProducts.length);
          setLoading(false);

          console.log(`📦 Performance: 1 read + ${CacheUtils.getCacheSize()} cached`);
          return; // ✅ Firestore success - exit
        }
      }

      throw new Error('No products found in Firestore');

    } catch (error) {
      console.error('❌ Error loading products:', error);

      // 🔥 STEP 3: Fallback to cached data if available
      if (!loadMore) {
        const fallbackData = CacheUtils.loadCache('products');
        if (fallbackData && fallbackData.length > 0) {
          console.log('🔄 FALLBACK: Using expired cache due to network error');

          const allProducts = fallbackData.sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
          });

          setAllCachedProducts(allProducts);
          setProducts(allProducts.slice(0, BATCH_CONFIG.LOAD_MORE_SIZE));
          setHasMore(allProducts.length > BATCH_CONFIG.LOAD_MORE_SIZE);
          setLoading(false);
          CacheUtils.setOfflineMode(true);
          return;
        }
      }

      setError('Failed to load products. Please check your connection.');
      setLoading(false);
    }
  }, [products]);

  // Load more function
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;

    // Load more from cached data
    if (allCachedProducts.length > products.length) {
      const nextPageStart = products.length;
      const nextPageEnd = nextPageStart + BATCH_CONFIG.LOAD_MORE_SIZE;
      const nextPageProducts = allCachedProducts.slice(nextPageStart, nextPageEnd);

      setProducts(prev => [...prev, ...nextPageProducts]);
      setHasMore(nextPageEnd < allCachedProducts.length);
      console.log(`✅ LOAD MORE: ${nextPageProducts.length} products from cache (0 reads)`);
    } else {
      console.log('📭 No more products to load');
      setHasMore(false);
    }
  }, [loading, hasMore, products.length, allCachedProducts]);

  // Search products (cache-first)
  const searchProducts = useCallback(async (searchParams: any): Promise<Product[]> => {
    try {
      console.log('🔍 Searching products (CACHE-FIRST)...', searchParams);

      // Try cache first
      const cachedData = CacheUtils.loadCache('products');
      if (cachedData && cachedData.length > 0) {
        console.log('🔍 Searching in cached data...');

        let results = cachedData;

        // Apply filters
        if (searchParams.category && searchParams.category !== 'all') {
          results = results.filter(product => product.category === searchParams.category);
        }

        if (searchParams.minPrice) {
          results = results.filter(product => product.retailPrice >= parseInt(searchParams.minPrice));
        }

        if (searchParams.maxPrice) {
          results = results.filter(product => product.retailPrice <= parseInt(searchParams.maxPrice));
        }

        if (searchParams.search) {
          const searchTerm = searchParams.search.toLowerCase();
          results = results.filter(product =>
            product.name?.toLowerCase().includes(searchTerm) ||
            product.description?.toLowerCase().includes(searchTerm)
          );
        }

        console.log(`✅ Search results from cache: ${results.length} products`);
        return results;
      }

      // Fallback to Firestore if no cache
      console.log('⚠️ No cache available, searching Firestore...');
      const productsRef = collection(db, 'products');
      let q = query(productsRef, limit(50));

      if (searchParams.category && searchParams.category !== 'all') {
        q = query(q, where('category', '==', searchParams.category));
      }

      const snapshot = await getDocs(q);
      const firestoreResults = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Product));

      console.log(`✅ Search results from Firestore: ${firestoreResults.length} products`);
      return firestoreResults;

    } catch (error) {
      console.error('❌ Search failed:', error);
      return [];
    }
  }, []);

  // Refresh function
  const refresh = useCallback(() => {
    console.log('🔄 Refreshing products...');
    CacheUtils.clearCache('products');
    loadProducts(false);
  }, [loadProducts]);

  // Initialize load and setup cache invalidation
  useEffect(() => {
    loadProducts(false);

    // Setup cache invalidation listener
    const unsubscribe = CacheInvalidationManager.setupProductUpdatesListener();

    // Cleanup
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      console.log('📶 Network: Online - checking cache sync needs...');
      CacheUtils.setOfflineMode(false);

      // Only sync if cache is old or invalid
      const isCacheValid = CacheUtils.isCacheValid('products');
      if (!isCacheValid) {
        console.log('🔄 Cache invalid, syncing...');
        CacheUtils.syncCache('products').catch(console.error);
      } else {
        console.log('✅ Cache is valid, no sync needed');
      }
    };

    const handleOffline = () => {
      console.log('📶 Network: Offline - using cache only');
      CacheUtils.setOfflineMode(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    products,
    loading,
    error,
    hasMore,
    loadMore,
    searchProducts,
    refresh,
    isOffline: CacheUtils.isOfflineMode(),
    cacheSize: CacheUtils.getCacheSize()
  };
};