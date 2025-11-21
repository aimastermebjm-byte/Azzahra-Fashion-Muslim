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

  
  // Define load function outside useEffect untuk bisa dipanggil dari mana saja
  const loadFlashSaleProducts = useCallback(async () => {
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

      console.log('✅ Flash sale products loaded (SINGLETON):', result.products.length, 'items');
    } catch (err) {
      console.error('❌ Error loading flash sale products:', err);
      setError(err instanceof Error ? err.message : 'Failed to load flash sale products');
    } finally {
      setLoading(false);
      isHookInitializing = false;
    }
  }, []);

  // Define stopFlashSale early untuk bisa digunakan di useEffect
  const stopFlashSale = useCallback(async () => {
    const deviceInfo = navigator.userAgent.includes('Mobile') ? 'MOBILE' : 'DESKTOP';
    console.log(`🛑 Starting flash sale cleanup on ${deviceInfo}...`);

    // Prevent multiple simultaneous stops
    if (globalFlashSaleInstance?.isStopping) {
      console.log(`⏸️ Flash sale already stopping on ${deviceInfo}, skipping...`);
      return;
    }

    // Mark as stopping
    if (globalFlashSaleInstance) {
      globalFlashSaleInstance.isStopping = true;
    }

    try {
      console.log(`🛑 ${deviceInfo}: Updating flash sale config to inactive...`);
      await updateFlashSale({ isActive: false });
      console.log(`🛑 ${deviceInfo}: Flash sale config updated successfully`);

      console.log(`🛑 ${deviceInfo}: Starting product cleanup...`);
      await clearFlashSaleFromProducts();
      console.log(`✅ ${deviceInfo}: Firebase Flash Sale: Flash sale stopped successfully`);

      // Clear cache immediately to prevent products from reappearing
      console.log(`🗑️ ${deviceInfo}: Clearing flash sale cache after cleanup...`);
      flashSaleCache.clearCache();

      // Reset global instance completely
      globalFlashSaleInstance = null;

      // Update local state
      setFlashSaleProducts([]);

      // Trigger real-time sync untuk update instant
      console.log(`🔄 ${deviceInfo}: Triggering real-time sync...`);
      flashSaleCache.triggerRealTimeSync();

      // Verifikasi cleanup setelah 2 detik
      setTimeout(async () => {
        console.log(`🔍 ${deviceInfo}: Verifying cleanup effectiveness...`);
        const cleanupSuccessful = await flashSaleCache.debugVerifyCleanup();
        console.log(`🔍 ${deviceInfo}: Cleanup verification result: ${cleanupSuccessful ? 'SUCCESS' : 'FAILED'}`);
      }, 2000);

      console.log(`✅ ${deviceInfo}: Complete flash sale cleanup finished at ${new Date().toISOString()}`);
    } catch (error) {
      console.error(`❌ ${deviceInfo}: Firebase Flash Sale: Error stopping flash sale:`, error);
      throw error;
    } finally {
      // Clear stopping flag
      if (globalFlashSaleInstance) {
        globalFlashSaleInstance.isStopping = false;
      }
    }
  }, []);

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
    loadFlashSaleProducts();

    // Setup real-time sync listener (hanya satu instance)
    const unsubscribeRealTime = flashSaleCache.onRealTimeSync(() => {
      console.log('🔄 Flash sale real-time update detected, refreshing...');

      // Force reset singleton to allow refresh
      globalFlashSaleInstance = null;
      isHookInitializing = false;

      // Reload data
      loadFlashSaleProducts();
    });

    return () => {
      unsubscribeRealTime();
    };
  }, [loadFlashSaleProducts, initialized]);

  // Listen untuk flash sale config (countdown timer)
  useEffect(() => {
    import('firebase/firestore').then(({ doc, onSnapshot }) => {
      const flashSaleRef = doc(db, 'flashSales', FLASH_SALE_DOC_ID);

      const unsubscribe = onSnapshot(flashSaleRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const config = { id: docSnapshot.id, ...docSnapshot.data() } as FlashSaleConfig;
          setFlashSaleConfig(config);
          setIsFlashSaleActive(config.isActive);
          console.log('🕐 Flash sale config loaded:', config.isActive);

          // Check if flash sale has ended
          const now = new Date().getTime();
          const endTime = new Date(config.endTime).getTime();
          const hasEnded = now > endTime;

          const deviceInfo = navigator.userAgent.includes('Mobile') ? 'MOBILE' : 'DESKTOP';
          console.log(`🕐 ${deviceInfo}: Config update - isActive=${config.isActive}, hasEnded=${hasEnded}, products=${flashSaleProducts.length}`);

          if (hasEnded && config.isActive) {
            console.log(`🕐 ${deviceInfo}: Flash sale expired, stopping automatically...`);
            console.log(`🕐 ${deviceInfo}: Time check: now=${new Date(now)}, endTime=${new Date(endTime)}`);
            // Auto-stop expired flash sale
            try {
              stopFlashSale();
            } catch (error) {
              console.error(`🕐 ${deviceInfo}: Error stopping expired flash sale:`, error);
            }
          } else if (config.isActive && globalFlashSaleInstance && !globalFlashSaleInstance.products.length) {
            console.log(`🔄 ${deviceInfo}: Flash sale activated, refreshing products...`);
            globalFlashSaleInstance = null;
            isHookInitializing = false;

            // Force refresh after short delay to ensure admin updates are saved
            setTimeout(() => {
              loadFlashSaleProducts();
            }, 1000);
          } else if (!config.isActive && flashSaleProducts.length > 0) {
            // Clear flash sale products when not active (HANYA jika ada produk)
            console.log(`🕐 ${deviceInfo}: Flash sale not active, clearing ${flashSaleProducts.length} products...`);

            // Clear cache and reset state
            flashSaleCache.clearCache();
            globalFlashSaleInstance = null;
            setFlashSaleProducts([]);
          }
        } else {
          const deviceInfo = navigator.userAgent.includes('Mobile') ? 'MOBILE' : 'DESKTOP';
          console.log(`🕐 ${deviceInfo}: No flash sale config found`);
          setFlashSaleConfig(null);
          setIsFlashSaleActive(false);
          setTimeLeft('');
          // Clear products when no config exists (HANYA jika ada produk)
          if (flashSaleProducts.length > 0) {
            console.log(`🕐 ${deviceInfo}: No flash sale config, clearing ${flashSaleProducts.length} cached products...`);
            flashSaleCache.clearCache();
            globalFlashSaleInstance = null;
            setFlashSaleProducts([]);
          }
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

    const deviceInfo = navigator.userAgent.includes('Mobile') ? 'MOBILE' : 'DESKTOP';
    console.log(`⏰ ${deviceInfo}: Starting countdown timer for flash sale ending at ${flashSaleConfig.endTime}`);

    let hasTriggeredStop = false; // Prevent multiple stops

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const endTime = new Date(flashSaleConfig.endTime).getTime();
      const difference = endTime - now;

      if (difference > 0) {
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);

        // Log countdown setiap 30 detik untuk debugging
        if (seconds % 30 === 0 && minutes === 0 && hours === 0) {
          console.log(`⏰ ${deviceInfo}: Flash sale ending in ${seconds} seconds`);
        }
      } else {
        setTimeLeft('Flash sale ended');
        setIsFlashSaleActive(false);

        // Auto-stop flash sale when time ends (prevent multiple calls)
        if (flashSaleConfig.isActive && !hasTriggeredStop) {
          hasTriggeredStop = true;
          console.log(`⏰ ${deviceInfo}: Flash sale timer ended, stopping flash sale automatically...`);
          console.log(`⏰ ${deviceInfo}: Time check: now=${now}, endTime=${endTime}, difference=${difference}`);
          console.log(`⏰ ${deviceInfo}: flashSaleConfig.isActive=${flashSaleConfig.isActive}, hasTriggeredStop=${hasTriggeredStop}`);

          try {
            stopFlashSale(); // This will clean up products and trigger refresh
          } catch (error) {
            console.error(`⏰ ${deviceInfo}: Error calling stopFlashSale:`, error);
          }
        } else if (hasTriggeredStop) {
          console.log(`⏰ ${deviceInfo}: Flash sale already stopped, skipping...`);
        }
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      console.log(`⏰ ${deviceInfo}: Countdown timer cleaned up`);
      hasTriggeredStop = false; // Reset on cleanup
    };
  }, [flashSaleConfig, stopFlashSale]);

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
      const deviceInfo = navigator.userAgent.includes('Mobile') ? 'MOBILE' : 'DESKTOP';
      console.log(`🧹 Firebase Flash Sale: Cleaning up flash sale products on ${deviceInfo}...`);
      console.log(`🧹 Firebase Flash Sale: User agent: ${navigator.userAgent.substring(0, 50)}...`);

      // Find all products with isFlashSale = true
      const productsQuery = query(
        collection(db, 'products'),
        where('isFlashSale', '==', true)
      );

      console.log('🧹 Firebase Flash Sale: Executing query to find flash sale products...');
      const querySnapshot = await getDocs(productsQuery);
      console.log(`🧹 Firebase Flash Sale: Found ${querySnapshot.docs.length} flash sale products to clean`);

      if (querySnapshot.docs.length === 0) {
        console.log('🧹 Firebase Flash Sale: No flash sale products found to clean');
        return;
      }

      // Update all flash sale products to remove flash sale status
      const batch: Promise<any>[] = [];
      querySnapshot.forEach((docSnapshot) => {
        const productData = docSnapshot.data();
        console.log(`🧹 Firebase Flash Sale: Cleaning product ${docSnapshot.id} - ${productData.name}`);

        batch.push(
          updateDoc(doc(db, 'products', docSnapshot.id), {
            isFlashSale: false,
            flashSalePrice: null,
            originalRetailPrice: null,
            originalResellerPrice: null,
            updatedAt: new Date().toISOString(),
            flashSaleCleanupDevice: deviceInfo,
            flashSaleCleanupAt: new Date().toISOString()
          })
        );
      });

      console.log(`🧹 Firebase Flash Sale: Executing batch update for ${batch.length} products...`);
      await Promise.all(batch);
      console.log('✅ Firebase Flash Sale: All flash sale products cleaned successfully');
      console.log(`✅ Firebase Flash Sale: Cleanup completed on ${deviceInfo} at ${new Date().toISOString()}`);
    } catch (error) {
      const deviceInfo = navigator.userAgent.includes('Mobile') ? 'MOBILE' : 'DESKTOP';
      console.error(`❌ Firebase Flash Sale: Error cleaning flash sale products on ${deviceInfo}:`, error);
      console.error('❌ Firebase Flash Sale: Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code || 'Unknown code',
        stack: error instanceof Error ? error.stack?.substring(0, 200) : 'No stack trace'
      });
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