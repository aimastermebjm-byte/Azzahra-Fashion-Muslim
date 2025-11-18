import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  where,
  query
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { flashSaleCache } from '../utils/flashSaleCache';
import type { FlashSaleProduct } from '../utils/flashSaleCache';

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

// Singleton pattern untuk mencegah multiple initializations
let globalFlashSaleInstance: any = null;
let isHookInitializing = false;

export const useFirebaseFlashSale = () => {
  // State untuk flash sale products dengan pagination
  const [flashSaleProducts, setFlashSaleProducts] = useState<FlashSaleProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Flash sale config (legacy support) - restore countdown timer
  const [flashSaleConfig, setFlashSaleConfig] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [isFlashSaleActive, setIsFlashSaleActive] = useState(false);

  // Load flash sale products dengan SINGLETON protection
  useEffect(() => {
    // GLOBAL SINGLETON: Ceg multiple component instances
    if (globalFlashSaleInstance) {
      console.log('🚫 Flash sale singleton exists, reusing data...');
      setFlashSaleProducts(globalFlashSaleInstance.products);
      setHasMore(globalFlashSaleInstance.hasMore);
      setLoading(globalFlashSaleInstance.loading);
      return;
    }

    // Prevent concurrent initialization
    if (isHookInitializing) {
      console.log('⏳ Flash sale initializing, please wait...');
      return;
    }

    isHookInitializing = true;

    const loadFlashSaleProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        setInitialized(true); // Mark as initialized immediately
        console.log('🔍 Loading flash sale products (SINGLETON)...');

        const result = await flashSaleCache.getProducts(10);

        // Save to global instance
        globalFlashSaleInstance = {
          products: result.products,
          hasMore: result.hasMore,
          loading: false,
          error: null
        };

        setFlashSaleProducts(result.products);
        setHasMore(result.hasMore);

        // Update global instance di real-time sync
        const updateGlobalInstance = () => {
          if (globalFlashSaleInstance) {
            setFlashSaleProducts(globalFlashSaleInstance.products);
            setHasMore(globalFlashSaleInstance.hasMore);
          }
        };

        console.log('✅ Flash sale products loaded (SINGLETON):', result.products.length, 'items');
      } catch (err) {
        console.error('❌ Error loading flash sale products:', err);
        setError(err instanceof Error ? err.message : 'Failed to load flash sale products');
      } finally {
        setLoading(false);
        isHookInitializing = false;
      }
    };

    loadFlashSaleProducts();

    // Setup real-time sync listener (hanya satu instance)
    const unsubscribeRealTime = flashSaleCache.onRealTimeSync(() => {
      console.log('🔄 Flash sale real-time update detected, refreshing...');
      loadFlashSaleProducts();
    });

    return () => {
      unsubscribeRealTime();
    };
  }, [initialized]);

  // Listen untuk flash sale config (countdown timer)
  useEffect(() => {
    import('firebase/firestore').then(({ doc, onSnapshot }) => {
      const flashSaleRef = doc(db, 'flashSales', FLASH_SALE_DOC_ID);

      const unsubscribe = onSnapshot(flashSaleRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const config = { id: docSnapshot.id, ...docSnapshot.data() };
          setFlashSaleConfig(config);
          setIsFlashSaleActive(config.isActive);
          console.log('🕐 Flash sale config loaded:', config.isActive);
        } else {
          setFlashSaleConfig(null);
          setIsFlashSaleActive(false);
          setTimeLeft('');
        }
      });

      return () => unsubscribe();
    });
  }, []);

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
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [flashSaleConfig]);

  // Load more products function
  const loadMoreProducts = useCallback(async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);
      console.log('🔄 Loading more flash sale products...');

      const result = await flashSaleCache.loadMoreProducts(flashSaleProducts.length, 10);
      setFlashSaleProducts(prev => [...prev, ...result.products]);
      setHasMore(result.hasMore);

      console.log('✅ More flash sale products loaded:', result.products.length, 'new items');
    } catch (err) {
      console.error('❌ Error loading more flash sale products:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, flashSaleProducts.length]);

  // Helper function to clean flash sale from products
  const clearFlashSaleFromProducts = async () => {
    try {
      console.log('🧹 Firebase Flash Sale: Cleaning up flash sale products...');

      // Find all products with isFlashSale = true
      const productsQuery = query(
        collection(db, 'products'),
        where('isFlashSale', '==', true)
      );

      const querySnapshot = await getDocs(productsQuery);
      console.log(`🧹 Firebase Flash Sale: Found ${querySnapshot.docs.length} flash sale products to clean`);

      // Update all flash sale products to remove flash sale status
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
      console.log('✅ Firebase Flash Sale: All flash sale products cleaned successfully');
    } catch (error) {
      console.error('❌ Firebase Flash Sale: Error cleaning flash sale products:', error);
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
      console.log('✅ Firebase Flash Sale: Flash sale created successfully');
      return newConfig;
    } catch (error) {
      console.error('❌ Firebase Flash Sale: Error creating flash sale:', error);
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
      console.log('✅ Firebase Flash Sale: Flash sale updated successfully');
    } catch (error) {
      console.error('❌ Firebase Flash Sale: Error updating flash sale:', error);
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
      console.log('✅ Firebase Flash Sale: Flash sale started successfully');

      // Trigger real-time sync untuk update instant
      flashSaleCache.triggerRealTimeSync();
    } catch (error) {
      console.error('❌ Firebase Flash Sale: Error starting flash sale:', error);
      throw error;
    }
  };

  const stopFlashSale = async () => {
    try {
      await updateFlashSale({ isActive: false });
      await clearFlashSaleFromProducts();
      console.log('✅ Firebase Flash Sale: Flash sale stopped successfully');

      // Trigger real-time sync untuk update instant
      flashSaleCache.triggerRealTimeSync();
    } catch (error) {
      console.error('❌ Firebase Flash Sale: Error stopping flash sale:', error);
      throw error;
    }
  };

  // Check if a specific product is in the flash sale
  const isProductInFlashSale = useCallback((productId: string) => {
    // Check dari cache products
    return flashSaleProducts.some(product => product.id === productId && product.isFlashSale);
  }, [flashSaleProducts]);

  // Get flash sale discount for a specific product
  const getProductFlashSaleDiscount = useCallback((productId: string) => {
    const product = flashSaleProducts.find(p => p.id === productId);
    if (!product || !product.isFlashSale) return 0;

    // Calculate discount percentage
    const originalPrice = product.originalRetailPrice || product.retailPrice || 0;
    const flashSalePrice = product.flashSalePrice || 0;
    if (originalPrice === 0) return 0;

    return Math.round(((originalPrice - flashSalePrice) / originalPrice) * 100);
  }, [flashSaleProducts]);

  return {
    // New cache-based values
    flashSaleProducts,
    hasMore,
    error,
    loadMoreProducts,

    // Flash sale config values
    flashSaleConfig,
    timeLeft,
    isFlashSaleActive,
    loading,
    createFlashSale,
    updateFlashSale,
    startFlashSale,
    stopFlashSale,
    clearFlashSaleFromProducts,
    isProductInFlashSale,
    getProductFlashSaleDiscount
  };
};