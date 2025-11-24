import { useState, useEffect, useCallback, useRef } from 'react';
import { getFirestore, collection, getDoc, doc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
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

  // Calculate time left
  const calculateTimeLeft = useCallback(() => {
    if (!flashSaleConfig || !flashSaleConfig.isActive) {
      setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const now = new Date().getTime();
    const endTime = new Date(flashSaleConfig.endTime).getTime();
    const difference = endTime - now;

    if (difference > 0) {
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    } else {
      setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      // Flash sale ended
      setFlashSaleConfig(prev => prev ? { ...prev, isActive: false } : null);
    }
  }, [flashSaleConfig]);

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
  }, [loading, hasMore, currentBatchIndex, batches, loadBatch]);

  // Update timer every second
  useEffect(() => {
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  // 🔥 REAL-TIME LISTENER: Zero reads, only cache updates
  useEffect(() => {
    console.log('🔥 Starting real-time flash sale listener (0 reads expected)...');

    // Listen to batch_1 changes only (single batch system)
    const batchRef = doc(db, 'productBatches', 'batch_1');
    const unsubscribe = onSnapshot(batchRef, (snapshot) => {
      if (snapshot.exists()) {
        const batchData = snapshot.data();

        // Extract flash sale config from batch data
        const flashSaleConfigFromBatch = {
          isActive: batchData.flashSaleConfig?.isActive || false,
          endTime: batchData.flashSaleConfig?.endTime || null,
          flashSaleDiscount: batchData.flashSaleConfig?.flashSaleDiscount || 0,
          title: batchData.flashSaleConfig?.title || '',
          description: batchData.flashSaleConfig?.description || ''
        };

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