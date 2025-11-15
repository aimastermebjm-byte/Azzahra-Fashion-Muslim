import { useState, useEffect, useCallback } from 'react';
import { collection, query, onSnapshot, orderBy, limit as limitCount, startAfter } from 'firebase/firestore';
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
    let unsubscribe: (() => void) | null = null;

    const setupRealTimeProductsListener = async () => {
      try {
        console.log('🔄 Setting up real-time products listener (HOME)...');

        // Try real-time listener first
        try {
          const productsRef = collection(db, 'products');
          const q = query(
            productsRef,
            orderBy('createdAt', 'desc'),
            limitCount(productsPerPage)
          );

          unsubscribe = onSnapshot(
            q,
            (querySnapshot) => {
              console.log('📦 Real-time products update received (HOME):', querySnapshot.docs.length, 'products');

              const loadedProducts: Product[] = [];
              let lastDoc: any = null;

              querySnapshot.forEach((doc) => {
                lastDoc = doc;
                const data = doc.data();

                // Calculate total stock from variants if available - sama seperti di useFirebaseProducts
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

              // Check if there are more products
              setHasMore(querySnapshot.docs.length === productsPerPage);

              // Log stock update info untuk debugging
              const stockChangeCount = loadedProducts.filter(p => p.stock <= 5).length;
              console.log(`📊 Real-time sync complete (HOME): ${stockChangeCount} products with low stock (<=5)`);
            },
            async (error) => {
              console.error('❌ Error with real-time listener, falling back to manual query (HOME):', error);
              await fallbackToManualQuery();
            }
          );
        } catch (realTimeError) {
          console.error('❌ Failed to setup real-time listener, using manual query (HOME):', realTimeError);
          await fallbackToManualQuery();
        }
      } catch (error) {
        console.error('❌ Error setting up products listener (HOME):', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLoading(false);
        setInitialLoad(false);
      }
    };

    // Fallback manual query function
    const fallbackToManualQuery = async () => {
      try {
        const { getDocs } = await import('firebase/firestore');
        const productsRef = collection(db, 'products');
        const q = query(
          productsRef,
          orderBy('createdAt', 'desc'),
          limitCount(productsPerPage)
        );

        const querySnapshot = await getDocs(q);
        console.log('📦 Manual query completed (HOME):', querySnapshot.docs.length, 'products');

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

        // Setup polling untuk fallback sync (every 30 seconds)
        const pollInterval = setInterval(async () => {
          try {
            const refreshedSnapshot = await getDocs(q);
            const refreshedProducts: Product[] = [];
            let refreshedLastDoc: any = null;

            refreshedSnapshot.forEach((doc) => {
              refreshedLastDoc = doc;
              const data = doc.data();

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

              refreshedProducts.push({
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

            setProducts(refreshedProducts);
            setLastVisible(refreshedLastDoc);
            setHasMore(refreshedSnapshot.docs.length === productsPerPage);
            console.log('🔄 Polling refresh completed (HOME)');
          } catch (pollError) {
            console.error('❌ Error during polling refresh (HOME):', pollError);
          }
        }, 30000); // Poll every 30 seconds

        // Cleanup function
        return () => {
          if (pollInterval) clearInterval(pollInterval);
        };

      } catch (error) {
        console.error('❌ Manual query failed (HOME):', error);
        setError(error instanceof Error ? error.message : 'Failed to load products');
        setLoading(false);
        setInitialLoad(false);
      }
    };

    // Mobile timeout protection
    const mobileTimeout = setTimeout(() => {
      if (loading && initialLoad) {
        console.warn('⏰ Products loading taking too long (HOME), triggering fallback');
        setLoading(false);
        setInitialLoad(false);
        setError('Loading terlalu lama, silakan refresh halaman');
      }
    }, 8000);

    setupRealTimeProductsListener();

    return () => {
      if (unsubscribe) {
        console.log('🔄 Unsubscribing from real-time products listener (HOME)');
        unsubscribe();
      }
      if (mobileTimeout) {
        clearTimeout(mobileTimeout);
      }
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