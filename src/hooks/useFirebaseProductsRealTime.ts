import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit as limitCount, startAfter } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';

export const useFirebaseProductsRealTime = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(20); // Fixed 20 produk untuk infinite scroll seperti Shopee
  
  useEffect(() => {
    console.log('🔄 Setting up SAFE event-based products system (HOME)...');

    // Load initial products sekali saja (SAFE)
    const loadInitialProducts = async () => {
      try {
        const { getDocs } = await import('firebase/firestore');
        const productsRef = collection(db, 'products');
        const q = query(
          productsRef,
          orderBy('createdAt', 'desc'),
          limitCount(productsPerPage)
        );

        const querySnapshot = await getDocs(q);
        console.log('📦 Initial products loaded (HOME):', querySnapshot.docs.length, 'products');

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

        setProducts(loadedProducts);
        setLastVisible(lastDoc);
        setLoading(false);
        setInitialLoad(false);
        setError(null);
        setHasMore(querySnapshot.docs.length === productsPerPage);

      } catch (error) {
        console.error('❌ Failed to load initial products (HOME):', error);
        setError(error instanceof Error ? error.message : 'Failed to load products');
        setLoading(false);
        setInitialLoad(false);
      }
    };

    // EVENT-BASED SYNC ONLY (COST-EFFECTIVE!)
    const setupEventBasedSync = () => {
      console.log('🔄 Setting up SAFE event-based sync (ZERO Firebase reads)...');

      // Event listeners for cross-device sync (FREE)
      const handleStockChange = () => {
        console.log('📊 Stock change event received (HOME) - refreshing...');
        loadInitialProducts();
      };

      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'stock_change_trigger' ||
            event.key === 'stock_depleted_trigger' ||
            event.key === 'stock_low_trigger') {
          console.log('📊 Cross-device stock sync detected (HOME)');
          loadInitialProducts();
        }
      };

      window.addEventListener('stockChanged', handleStockChange);
      window.addEventListener('storage', handleStorageChange);

      console.log('✅ Event-based sync ready (COST: 0 reads per day!)');

      // Cleanup function
      return () => {
        window.removeEventListener('stockChanged', handleStockChange);
        window.removeEventListener('storage', handleStorageChange);
        console.log('🔄 Event-based sync cleaned up');
      };
    };

    const cleanup = setupEventBasedSync();

    // Load initial products
    loadInitialProducts();

    // Mobile timeout protection
    const mobileTimeout = setTimeout(() => {
      if (loading && initialLoad) {
        console.warn('⏰ Products loading taking too long (HOME), triggering fallback');
        setLoading(false);
        setInitialLoad(false);
        setError('Loading terlalu lama, silakan refresh halaman');
      }
    }, 8000);

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

  return {
    products,
    loading: loading && initialLoad,
    error,
    hasMore,
    currentPage,
    productsPerPage,
    setCurrentPage,
    loadMoreProducts
  };
};