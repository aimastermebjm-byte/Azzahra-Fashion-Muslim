import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  where,
  query,
  onSnapshot,
  orderBy,
  limit,
  startAfter
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

interface FlashSaleConfig {
  id: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
  products: string[];
  productIds?: string[];
  flashSaleDiscount?: number;
  createdAt: string;
  updatedAt: string;
}

const FLASH_SALE_DOC_ID = 'current-flash-sale';

export const useFirebaseFlashSaleSimple = () => {
  const [flashSaleProducts, setFlashSaleProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashSaleConfig, setFlashSaleConfig] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [isFlashSaleActive, setIsFlashSaleActive] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);

  // Load flash sale products with pagination
  const loadFlashSaleProducts = useCallback(async (loadMore = false) => {
    try {
      if (!loadMore) {
        setLoading(true);
        setError(null);
        setFlashSaleProducts([]);
        setLastVisible(null);
      }

      const productsRef = collection(db, 'products');

      // Query with pagination
      let q;
      try {
        if (loadMore && lastVisible) {
          // Load next page
          q = query(
            productsRef,
            where('isFlashSale', '==', true),
            orderBy('createdAt', 'desc'),
            startAfter(lastVisible),
            limit(20)
          );
          console.log('✅ Flash Sale: Loading next page');
        } else {
          // Load first page
          q = query(
            productsRef,
            where('isFlashSale', '==', true),
            orderBy('createdAt', 'desc'),
            limit(20)
          );
          console.log('✅ Flash Sale: Loading first page');
        }
      } catch (indexError: any) {
        if (indexError.message.includes('requires an index')) {
          console.log('⚠️ Flash Sale: Index tidak ditemukan, menggunakan fallback query');
          if (loadMore && lastVisible) {
            q = query(
              productsRef,
              where('isFlashSale', '==', true),
              startAfter(lastVisible),
              limit(20)
            );
          } else {
            q = query(
              productsRef,
              where('isFlashSale', '==', true),
              limit(20)
            );
          }
        } else {
          throw indexError;
        }
      }

      const querySnapshot = await getDocs(q);
      const products: any[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        products.push({
          id: doc.id,
          name: data.name || '',
          price: Number(data.price || 0),
          retailPrice: Number(data.retailPrice || data.price || 0),
          resellerPrice: Number(data.resellerPrice || data.price * 0.8),
          costPrice: Number(data.costPrice || data.price * 0.6),
          stock: Number(data.stock || 0),
          images: Array.isArray(data.images) ? data.images : [],
          image: data.images?.[0] || data.image || '/placeholder-product.jpg',
          category: data.category || '',
          status: data.status || 'ready',
          isFlashSale: data.isFlashSale || false,
          flashSalePrice: data.flashSalePrice || data.price * 0.8,
          originalRetailPrice: data.originalRetailPrice || data.retailPrice,
          originalResellerPrice: data.originalResellerPrice || data.resellerPrice,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          featuredOrder: Number(data.featuredOrder || 0),
          variants: data.variants || []
        });
      });

      // Update state with pagination
      if (loadMore) {
        setFlashSaleProducts(prev => {
          const combined = [...prev, ...products];
          console.log(`📄 Flash Sale: Added ${products.length} products. Total: ${combined.length}`);
          return combined;
        });
      } else {
        setFlashSaleProducts(products);
        console.log(`📄 Flash Sale: Loaded ${products.length} products (first page)`);
      }

      // Update pagination state
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc || null);
      setHasMore(products.length === 20);

      // Client-side sorting untuk fallback query
      if (querySnapshot.metadata.fromCache && !loadMore) {
        setFlashSaleProducts(prev => [...prev].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
      }
      console.log(`✅ Loaded ${products.length} flash sale products`);
    } catch (error) {
      console.error('❌ Error loading flash sale products:', error);
      setError(error instanceof Error ? error.message : 'Failed to load flash sale products');
    } finally {
      setLoading(false);
    }
  }, [lastVisible]);

  // Load more function for flash sale
  const loadMoreFlashSaleProducts = useCallback(() => {
    if (loading || !hasMore) return;
    console.log('🔄 Loading more flash sale products...');
    loadFlashSaleProducts(true);
  }, [loading, hasMore, loadFlashSaleProducts]);

  // Listen untuk flash sale config
  useEffect(() => {
    const flashSaleRef = doc(db, 'flashSales', FLASH_SALE_DOC_ID);

    const unsubscribe = onSnapshot(flashSaleRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const config = { id: docSnapshot.id, ...docSnapshot.data() } as FlashSaleConfig;
        setFlashSaleConfig(config);
        setIsFlashSaleActive(config.isActive);

        // Check if flash sale has ended
        const now = new Date().getTime();
        const endTime = new Date(config.endTime).getTime();
        const hasEnded = now > endTime;

        if (hasEnded && config.isActive) {
          console.log('🕐 Flash sale expired, stopping automatically...');
          stopFlashSale();
        } else if (config.isActive) {
          // Load products if flash sale is active
          loadFlashSaleProducts();
        } else {
          // Clear products if not active
          setFlashSaleProducts([]);
        }
      } else {
        setFlashSaleConfig(null);
        setIsFlashSaleActive(false);
        setTimeLeft('');
        setFlashSaleProducts([]);
      }
    });

    return () => unsubscribe();
  }, [loadFlashSaleProducts]);

  // Countdown timer
  useEffect(() => {
    if (!flashSaleConfig?.isActive) {
      setTimeLeft('');
      return;
    }

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const endTime = new Date(flashSaleConfig.endTime).getTime();
      const difference = endTime - now;

      if (difference > 0) {
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft('Flash sale ended');
        setIsFlashSaleActive(false);
        if (flashSaleConfig.isActive) {
          stopFlashSale();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [flashSaleConfig]);

  // Helper function to clean flash sale from products
  const clearFlashSaleFromProducts = async () => {
    try {
      console.log('🧹 Cleaning up flash sale products...');

      const productsQuery = query(
        collection(db, 'products'),
        where('isFlashSale', '==', true)
      );

      const querySnapshot = await getDocs(productsQuery);
      console.log(`🧹 Found ${querySnapshot.docs.length} flash sale products to clean`);

      if (querySnapshot.docs.length === 0) {
        console.log('🧹 No flash sale products found to clean');
        return;
      }

      // Update all flash sale products
      const batch: Promise<any>[] = [];
      querySnapshot.forEach((docSnapshot) => {
        batch.push(
          updateDoc(doc(db, 'products', docSnapshot.id), {
            isFlashSale: false,
            flashSalePrice: null,
            originalRetailPrice: null,
            originalResellerPrice: null,
            updatedAt: new Date().toISOString()
          })
        );
      });

      await Promise.all(batch);
      console.log('✅ All flash sale products cleaned successfully');
    } catch (error) {
      console.error('❌ Error cleaning flash sale products:', error);
      throw error;
    }
  };

  const createFlashSale = async (config: Omit<FlashSaleConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const flashSaleRef = doc(db, 'flashSales', FLASH_SALE_DOC_ID);
      const newConfig: FlashSaleConfig = {
        id: FLASH_SALE_DOC_ID,
        ...config,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(flashSaleRef, newConfig);
      console.log('✅ Flash sale created successfully');
      return newConfig;
    } catch (error) {
      console.error('❌ Error creating flash sale:', error);
      throw error;
    }
  };

  const updateFlashSale = async (updates: Partial<FlashSaleConfig>) => {
    try {
      const flashSaleRef = doc(db, 'flashSales', FLASH_SALE_DOC_ID);
      await updateDoc(flashSaleRef, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Flash sale updated successfully');
    } catch (error) {
      console.error('❌ Error updating flash sale:', error);
      throw error;
    }
  };

  const startFlashSale = async (config: {
    startTime: string;
    endTime: string;
    products: string[];
    flashSaleDiscount?: number;
  }) => {
    try {
      await createFlashSale({
        ...config,
        isActive: true
      });
      console.log('✅ Flash sale started successfully');
    } catch (error) {
      console.error('❌ Error starting flash sale:', error);
      throw error;
    }
  };

  const stopFlashSale = async () => {
    try {
      console.log('🛑 Stopping flash sale...');
      await updateFlashSale({ isActive: false });
      await clearFlashSaleFromProducts();
      setFlashSaleProducts([]);
      console.log('✅ Flash sale stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping flash sale:', error);
      throw error;
    }
  };

  // Check if a specific product is in the flash sale
  const isProductInFlashSale = useCallback((productId: string) => {
    return flashSaleProducts.some(product => product.id === productId && product.isFlashSale);
  }, [flashSaleProducts]);

  // Get flash sale discount for a specific product
  const getProductFlashSaleDiscount = useCallback((productId: string) => {
    const product = flashSaleProducts.find(p => p.id === productId);
    if (!product || !product.isFlashSale) return 0;

    const originalPrice = product.originalRetailPrice || product.retailPrice || 0;
    const flashSalePrice = product.flashSalePrice || 0;
    if (originalPrice === 0) return 0;

    return Math.round(((originalPrice - flashSalePrice) / originalPrice) * 100);
  }, [flashSaleProducts]);

  return {
    flashSaleProducts,
    loading,
    error,
    flashSaleConfig,
    timeLeft,
    isFlashSaleActive,
    hasMore,
    loadMoreFlashSaleProducts,
    createFlashSale,
    updateFlashSale,
    startFlashSale,
    stopFlashSale,
    clearFlashSaleFromProducts,
    isProductInFlashSale,
    getProductFlashSaleDiscount,
    loadFlashSaleProducts
  };
};