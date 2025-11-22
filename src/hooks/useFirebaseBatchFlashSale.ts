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

  // Load flash sale config
  const loadFlashSaleConfig = useCallback(() => {
    const configRef = doc(db, 'flashSale', 'config');

    const unsubscribe = onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const config = snapshot.data() as FlashSaleConfig;
        setFlashSaleConfig(config);
        console.log('✅ Flash sale config loaded:', config);
      } else {
        // Default config if not exists
        const defaultConfig: FlashSaleConfig = {
          isActive: false,
          startTime: new Date(),
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 jam dari sekarang
          discountPercentage: 20,
          maxItemsPerUser: 5,
          title: "Flash Sale!",
          description: "Diskon spesial untuk produk pilihan"
        };
        setFlashSaleConfig(defaultConfig);
        console.log('⚙️ Using default flash sale config');
      }
    }, (err) => {
      console.error('❌ Error loading flash sale config:', err);
    });

    return unsubscribe;
  }, []);

  // Load initial flash sale products
  const loadInitialFlashSaleProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🔥 Loading initial flash sale products from batches...');

      // Load beberapa batch pertama sampai dapat cukup flash sale products
      let allFlashSaleProducts: Product[] = [];
      let batchNumber = 1;

      while (allFlashSaleProducts.length < PRODUCTS_PER_PAGE && batchNumber <= 5) { // Max 5 batch
        const batch = await loadBatch(batchNumber);

        if (batch) {
          const flashSaleProducts = batch.products.filter((product: Product) =>
            product.isFlashSale && product.stock > 0
          );

          allFlashSaleProducts.push(...flashSaleProducts);
          console.log(`📦 Batch ${batchNumber}: ${flashSaleProducts.length} flash sale products`);
        }

        batchNumber++;
      }

      // Sort berdasarkan created date (terbaru dulu)
      allFlashSaleProducts.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Ambil jumlah yang dibutuhkan
      const initialProducts = allFlashSaleProducts.slice(0, PRODUCTS_PER_PAGE);

      setFlashSaleProducts(initialProducts);
      setHasMore(allFlashSaleProducts.length > PRODUCTS_PER_PAGE);

      console.log(`✅ Loaded ${initialProducts.length} flash sale products`);

    } catch (err) {
      console.error('❌ Error loading flash sale products:', err);
      setError('Gagal memuat produk flash sale');
    } finally {
      setLoading(false);
    }
  }, [loadBatch]);

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

  // Load config and initial products
  useEffect(() => {
    const unsubscribeConfig = loadFlashSaleConfig();
    loadInitialFlashSaleProducts();

    return () => {
      if (unsubscribeConfig) {
        unsubscribeConfig();
      }
    };
  }, [loadFlashSaleConfig, loadInitialFlashSaleProducts]);

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