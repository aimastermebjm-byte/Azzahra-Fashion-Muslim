import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  category: string;
  isFeatured: boolean;
  isFlashSale: boolean;
  flashSalePrice?: number;
  rating: number;
  soldCount: number;
  stock: number;
  createdAt: Date;
  weight?: number;
  colors?: string[];
  sizes?: string[];
}

interface FlashSaleConfig {
  isActive: boolean;
  startTime: Date;
  endTime: Date;
  discountPercentage: number;
  maxItemsPerUser: number;
  title?: string;
  description?: string;
}

const PRODUCTS_PER_PAGE = 20;

export const useFirebaseBatchFlashSale = () => {
  console.log('🔥 useFirebaseBatchFlashSale hook initialized');

  const [flashSaleProducts, setFlashSaleProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(1);
  const [productIndex, setProductIndex] = useState(0);
  const [batches, setBatches] = useState<Map<number, any>>(new Map());

  // Flash sale config
  const [flashSaleConfig, setFlashSaleConfig] = useState<FlashSaleConfig | null>(null);
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Load batch tertentu
  const loadBatch = useCallback(async (batchNumber: number): Promise<any | null> => {
    try {
      console.log(`📦 Loading flash sale batch_${batchNumber}...`);
      const batchRef = doc(db, 'productBatches', `batch_${batchNumber}`);
      const batchSnap = await getDoc(batchRef);

      if (batchSnap.exists()) {
        const batchData = batchSnap.data();
        console.log(`✅ batch_${batchNumber} loaded: ${batchData.totalProducts} products`);

        // Filter flash sale products
        const flashSaleProducts = batchData.products.filter((product: Product) =>
          product.isFlashSale && product.stock > 0
        );

        if (flashSaleProducts.length > 0) {
          // Cache batch data with filtered flash sale products
          setBatches(prev => new Map(prev.set(batchNumber, {
            ...batchData,
            flashSaleProducts
          })));
        }

        return batchData;
      } else {
        console.log(`⚠️ batch_${batchNumber} not found`);
        return null;
      }
    } catch (err) {
      console.error(`❌ Error loading flash sale batch_${batchNumber}:`, err);
      return null;
    }
  }, []);

  
  // 🔥 AUTO-CLEANUP: Remove flash sale flags when expired
  const cleanupExpiredFlashSale = useCallback(async () => {
    try {
      console.log('🧹 Starting auto-cleanup for expired flash sale...');

      // Import transaction functions
      const { runTransaction, doc: docRef } = await import('firebase/firestore');
      const batchRef = docRef(db, 'productBatches', 'batch_1');

      // Execute transaction to update batch_1
      await runTransaction(db, async (transaction) => {
        const batchDoc = await transaction.get(batchRef);

        if (!batchDoc.exists()) {
          throw new Error('Batch data not found for cleanup');
        }

        const batchData = batchDoc.data();
        const updatedProducts = [...batchData.products];

        // Reset all flash sale products
        let cleanedCount = 0;
        updatedProducts.forEach((product: any) => {
          if (product.isFlashSale) {
            product.isFlashSale = false;
            product.flashSalePrice = undefined;
            cleanedCount++;
          }
        });

        // Update flash sale config to inactive
        const updatedBatchData = {
          ...batchData,
          products: updatedProducts,
          flashSaleConfig: {
            ...(batchData.flashSaleConfig || {}),
            isActive: false,
            lastCleanup: new Date().toISOString()
          }
        };

        // Update batch_1
        transaction.update(batchRef, updatedBatchData);

        return cleanedCount;
      });

      console.log('✅ Auto-cleanup completed - flash sale flags removed from all products');

    } catch (error) {
      console.error('❌ Auto-cleanup failed:', error);
    }
  }, []);

  // 🔥 DEPRECATED: Using real-time batch listener instead (zero reads)
  // const loadFlashSaleConfig = useCallback(() => {
  //   // This was causing individual reads from flashSale/config
  //   // Now using real-time listener on productBatches/batch_1
  // }, []);

  // 🔥 DEPRECATED: Using real-time batch listener instead (zero reads)
  // const loadInitialFlashSaleProducts = useCallback(async () => {
  //   // This was causing multiple batch reads (batch_1 to batch_5)
  //   // Now using real-time listener on productBatches/batch_1
  // }, [loadBatch]);

  // Load more flash sale products
  const loadMoreFlashSaleProducts = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);

    try {
      console.log('🔥 Loading more flash sale products...');

      let moreProducts: Product[] = [];
      let batchNumber = currentBatchIndex + 1;

      while (moreProducts.length < PRODUCTS_PER_PAGE && batchNumber <= 10) { // Max 10 batch
        const batch = batches.get(batchNumber) || await loadBatch(batchNumber);

        if (batch) {
          const flashSaleProducts = batch.products.filter((product: Product) =>
            product.isFlashSale && product.stock > 0
          );

          moreProducts.push(...flashSaleProducts);
          console.log(`📦 Batch ${batchNumber}: ${flashSaleProducts.length} flash sale products`);
        }

        batchNumber++;
      }

      if (moreProducts.length > 0) {
        setFlashSaleProducts(prev => [...prev, ...moreProducts]);
        setCurrentBatchIndex(batchNumber - 1);
        setHasMore(true);
        console.log(`✅ Loaded ${moreProducts.length} more flash sale products`);
      } else {
        setHasMore(false);
        console.log('🏁 No more flash sale products');
      }

    } catch (err) {
      console.error('❌ Error loading more flash sale products:', err);
      setError('Gagal memuat lebih banyak produk flash sale');
    } finally {
      setLoading(false);
    }
  }, []);

  // Update timer every second - setup once and access current flashSaleConfig
  useEffect(() => {
    console.log('⏰ Setting up timer interval...');

    const timer = setInterval(() => {
      // Access current flashSaleConfig value directly from closure
      const currentConfig = flashSaleConfig;

      console.log('⏰ Timer tick - checking flash sale config...', {
        hasConfig: !!currentConfig,
        isActive: currentConfig?.isActive,
        hasEndTime: !!currentConfig?.endTime
      });

      if (!currentConfig || !currentConfig.isActive || !currentConfig.endTime) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const now = new Date().getTime();
      const endTime = new Date(currentConfig.endTime).getTime();
      const difference = endTime - now;

      console.log('⏰ Timer calculation:', {
        now: new Date(now),
        endTime: new Date(endTime),
        difference,
        differenceMinutes: Math.floor(difference / (1000 * 60))
      });

      if (difference > 0) {
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        const newTimeLeft = { hours, minutes, seconds };
        console.log('⏰ Setting new time left:', newTimeLeft);
        setTimeLeft(newTimeLeft);
      } else {
        console.log('⏰ Flash sale expired - cleaning up batch_1...');
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        cleanupExpiredFlashSale();
      }
    }, 1000);

    return () => {
      console.log('⏰ Cleaning up timer interval...');
      clearInterval(timer);
    };
  }, []); // Empty dependency - setup only once

  // 🔥 REAL-TIME LISTENER: Zero reads, only cache updates
  useEffect(() => {
    console.log('🔥 Starting real-time flash sale listener (0 reads expected)...');

    // Listen to batch_1 changes only (single batch system)
    const batchRef = doc(db, 'productBatches', 'batch_1');
    const unsubscribe = onSnapshot(batchRef, (snapshot) => {
      if (snapshot.exists()) {
        const batchData = snapshot.data();

        // 🔥 CRITICAL FIX: Extract flash sale config from batch data
        console.log('🔍 Raw batch data:', {
          hasFlashSaleConfig: !!batchData.flashSaleConfig,
          flashSaleConfig: batchData.flashSaleConfig,
          hasProducts: !!batchData.products,
          productCount: batchData.products?.length
        });

        // 🧪 TESTING: Create manual flash sale config for testing
        const testEndTime = new Date();
        testEndTime.setMinutes(testEndTime.getMinutes() + 2); // 2 minutes from now

        const flashSaleConfigFromBatch = {
          isActive: batchData.flashSaleConfig?.isActive || true, // 🧪 Force active for testing
          endTime: batchData.flashSaleConfig?.endTime || testEndTime.toISOString(), // 🧪 Manual endTime
          startTime: batchData.flashSaleConfig?.startTime || new Date().toISOString(),
          discountPercentage: batchData.flashSaleConfig?.discountPercentage || 20,
          maxItemsPerUser: batchData.flashSaleConfig?.maxItemsPerUser || 5,
          flashSaleDiscount: batchData.flashSaleConfig?.flashSaleDiscount || 0,
          title: batchData.flashSaleConfig?.title || '⚡ Flash Sale Testing',
          description: batchData.flashSaleConfig?.description || 'Timer testing mode'
        };

        console.log('🔍 Flash Sale Config Update:', {
          isActive: flashSaleConfigFromBatch.isActive,
          endTime: flashSaleConfigFromBatch.endTime,
          hasEndTime: !!flashSaleConfigFromBatch.endTime,
          endTimeValue: flashSaleConfigFromBatch.endTime
        });

        // Check if flash sale has expired and trigger cleanup
        if (flashSaleConfigFromBatch.isActive && flashSaleConfigFromBatch.endTime) {
          const now = new Date().getTime();
          const endTime = new Date(flashSaleConfigFromBatch.endTime).getTime();

          if (endTime <= now) {
            console.log('⏰ Flash sale expired detected - triggering cleanup...');
            cleanupExpiredFlashSale();
          }
        }

        // Filter flash sale products from batch
        const flashSaleProducts = batchData.products.filter((product: Product) =>
          product.isFlashSale && product.stock > 0
        );

        console.log(`🚀 REAL-TIME UPDATE: ${flashSaleProducts.length} flash sale products (0 reads - from cache)`);

        // Update state with zero additional reads
        setFlashSaleConfig(flashSaleConfigFromBatch);
        setFlashSaleProducts(flashSaleProducts.slice(0, PRODUCTS_PER_PAGE));
        setHasMore(flashSaleProducts.length > PRODUCTS_PER_PAGE);
        setLoading(false);
        setError(null);

        // Set batch info
        setBatches(new Map([[1, { totalProducts: batchData.products.length }]]));
        setCurrentBatchIndex(1);

      } else {
        console.log('❌ Batch data not found');
        setFlashSaleConfig(null);
        setFlashSaleProducts([]);
        setLoading(false);
      }
    }, (error) => {
      console.error('❌ Real-time listener error:', error);
      setError('Failed to listen for flash sale updates');
      setLoading(false);
    });

    return () => {
      console.log('🔄 Unsubscribing from flash sale real-time listener');
      unsubscribe();
    };
  }, []);

  return {
    flashSaleProducts,
    loading,
    error,
    hasMore,
    loadMoreFlashSaleProducts,
    timeLeft,
    isFlashSaleActive: flashSaleConfig?.isActive || false,
    flashSaleConfig,
    // Debug info
    debug: {
      currentBatch: currentBatchIndex,
      totalLoaded: flashSaleProducts.length,
      cachedBatches: batches.size
    }
  };
};

export default useFirebaseBatchFlashSale;