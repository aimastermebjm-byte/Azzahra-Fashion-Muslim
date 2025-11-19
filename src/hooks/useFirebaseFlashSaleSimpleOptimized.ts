import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  getDoc,
  query,
  where,
  collection,
  getDocs
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

interface FlashSaleConfig {
  id: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
  products: string[];
  flashSaleDiscount?: number;
}

export const useFirebaseFlashSaleSimpleOptimized = () => {
  const [flashSaleProducts, setFlashSaleProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFlashSaleActive, setIsFlashSaleActive] = useState(false);
  const [cachedEndTime, setCachedEndTime] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // 🚀 OPTIMIZED: Load flash sale config ONCE only (1 read)
  useEffect(() => {
    const loadFlashSaleConfig = async () => {
      try {
        console.log('⚡ Loading flash sale config (1 read total)...');
        const flashSaleRef = doc(db, 'flashSale', 'config');
        const docSnapshot = await getDoc(flashSaleRef);

        if (docSnapshot.exists()) {
          const config = docSnapshot.data() as FlashSaleConfig;

          // Check if flash sale has ended (client-side calculation - 0 reads!)
          const now = new Date().getTime();
          const endTime = new Date(config.endTime).getTime();
          const hasEnded = now > endTime;

          // Cache the endTime for timer use (no more Firebase reads!)
          setCachedEndTime(endTime);

          // Set initial state based on config and time
          const isActive = !hasEnded && config.isActive;
          setIsFlashSaleActive(isActive);

          console.log(`✅ Flash sale loaded (1 read total): isActive=${isActive}, hasEnded=${hasEnded}`);
          console.log(`⏰ Flash sale ${isActive ? 'ACTIVE' : 'INACTIVE'} - ${hasEnded ? 'EXPIRED' : 'VALID'}`);

        } else {
          setIsFlashSaleActive(false);
          console.log('ℹ️ No flash sale config found - flash sale inactive');
        }
      } catch (error) {
        console.error('❌ Error loading flash sale config:', error);
        setIsFlashSaleActive(false);
      }
    };

    loadFlashSaleConfig();
  }, []); // Empty dependency - run once only

  // ⏰ Client-side countdown timer (0 reads - all client calculation!)
  useEffect(() => {
    const calculateTimeLeft = () => {
      // NO FIREBASE CALLS - Use cached endTime from initial config load
      // This prevents infinite loop and extra reads
      if (!isFlashSaleActive || !cachedEndTime) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const now = new Date().getTime();
      const difference = cachedEndTime - now;

      if (difference > 0) {
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ hours, minutes, seconds });
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        setIsFlashSaleActive(false);
      }
    };

    // Update timer setiap detik (100% client-side, 0 reads)
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [isFlashSaleActive, cachedEndTime]);

  // Load flash sale products from batch (only once)
  const loadFlashSaleProducts = useCallback(async () => {
    if (loading || initialized) return;

    setLoading(true);
    setError(null);
    setInitialized(true);
    console.log('🔥 Loading flash sale products from BATCH SYSTEM...');

    try {
      // 🚀 BATCH SYSTEM: Load from productBatches
      const batchRef = collection(db, 'productBatches');
      const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
      const batchSnapshot = await getDocs(batchQuery);

      if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
        const batchData = batchSnapshot.docs[0].data();
        const allProducts = batchData.products || [];

        // Filter flash sale products from batch
        const allFlashSaleProducts = allProducts
          .filter((product: any) => product.isFlashSale && product.stock > 0);

        setFlashSaleProducts(allFlashSaleProducts);
        console.log(`✅ Flash sale products loaded from batch: ${allFlashSaleProducts.length} products`);
      }

      setLoading(false);
      return flashSaleProducts;

    } catch (err) {
      console.error('❌ Error loading flash sale products:', err);
      setError('Gagal memuat produk flash sale');
      setLoading(false);
      return [];
    }
  }, [loading, initialized]);

  // Load flash sale products when hook initializes - REMOVE DEPENDENCY TO PREVENT LOOP
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      loadFlashSaleProducts();
    }
  }, [initialized]);

  return {
    flashSaleProducts,
    loading,
    error,
    timeLeft,
    isFlashSaleActive,
    loadFlashSaleProducts,
    // Debug info
    debug: {
      totalLoaded: flashSaleProducts.length,
      reads: '1 read total (batch + flash sale config)'
    }
  };
};

export default useFirebaseFlashSaleSimpleOptimized;