import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  getDoc,
  getDocs,
  where,
  query,
  collection
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

const FLASH_SALE_DOC_ID = 'config';

// Singleton pattern untuk mencegah multiple initializations
let globalFlashSaleInstance: any = null;

export const useFirebaseFlashSaleOptimized = () => {
  const [flashSaleProducts, setFlashSaleProducts] = useState<FlashSaleProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [flashSaleConfig, setFlashSaleConfig] = useState<FlashSaleConfig | null>(null);
  const [isFlashSaleActive, setIsFlashSaleActive] = useState(false);
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
        const flashSaleRef = doc(db, 'flashSale', FLASH_SALE_DOC_ID);
        const docSnapshot = await getDoc(flashSaleRef);

        if (docSnapshot.exists()) {
          const config = { id: docSnapshot.id, ...docSnapshot.data() } as FlashSaleConfig;
          setFlashSaleConfig(config);

          // Check if flash sale has ended (client-side calculation - 0 reads!)
          const now = new Date().getTime();
          const endTime = new Date(config.endTime).getTime();
          const hasEnded = now > endTime;

          // Set initial state based on config and time
          const isActive = !hasEnded && config.isActive;
          setIsFlashSaleActive(isActive);

          console.log(`✅ Flash sale loaded (1 read total): isActive=${isActive}, hasEnded=${hasEnded}`);
          console.log(`⏰ Flash sale ${isActive ? 'ACTIVE' : 'INACTIVE'} - ${hasEnded ? 'EXPIRED' : 'VALID'}`);

        } else {
          // Default config jika tidak ada document (0 reads!)
          const defaultConfig: FlashSaleConfig = {
            id: FLASH_SALE_DOC_ID,
            isActive: false,
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            products: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          setFlashSaleConfig(defaultConfig);
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
      if (!flashSaleConfig || !isFlashSaleActive) {
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
        setIsFlashSaleActive(false); // Auto-stop when expired
      }
    };

    // Update timer setiap detik (client-side only, 0 reads)
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [flashSaleConfig, isFlashSaleActive]);

  // Load flash sale products (using batch system!)
  const loadFlashSaleProducts = useCallback(async () => {
    if (globalFlashSaleInstance) {
      console.log('🚫 Flash sale singleton exists, reusing data...');
      return globalFlashSaleInstance;
    }

    setLoading(true);
    setError(null);
    console.log('🔥 Loading flash sale products from BATCH SYSTEM...');

    try {
      // 🚀 BATCH SYSTEM: Load from productBatches
      const batchRef = collection(db, 'productBatches');
      const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
      const batchSnapshot = await getDocs(batchQuery);

      let allFlashSaleProducts: FlashSaleProduct[] = [];

      if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
        const batchData = batchSnapshot.docs[0].data();
        const allProducts = batchData.products || [];

        // Filter flash sale products from batch
        allFlashSaleProducts = allProducts
          .filter((product: any) => product.isFlashSale && product.stock > 0)
          .map((product: any) => ({
            id: product.id,
            name: product.name,
            price: product.price || product.retailPrice || 0,
            originalPrice: product.retailPrice || product.price || 0,
            image: product.image || '/placeholder-product.jpg',
            flashSalePrice: product.flashSalePrice,
            discountPercentage: flashSaleConfig?.flashSaleDiscount || 0,
            costPrice: product.costPrice || 0,
            stock: product.stock || 0,
            rating: product.rating || 0,
            soldCount: product.soldCount || 0,
            description: product.description || '',
            category: product.category || '',
            weight: product.weight || 0,
            colors: product.colors || [],
            sizes: product.sizes || [],
            isFeatured: product.isFeatured || false,
            isFlashSale: product.isFlashSale || false,
            status: product.status || 'ready',
            unit: product.unit || 'pcs',
            createdAt: product.createdAt || new Date()
          }));

        console.log(`✅ Flash sale products loaded from batch: ${allFlashSaleProducts.length} products`);
      }

      setFlashSaleProducts(allFlashSaleProducts);
      setLoading(false);

      // Set cache
      await flashSaleCache.setProducts(allFlashSaleProducts);
      globalFlashSaleInstance = {
        products: allFlashSaleProducts,
        timestamp: Date.now(),
        count: allFlashSaleProducts.length
      };

      console.log(`💾 Flash sale cached: ${allFlashSaleProducts.length} products`);

      return allFlashSaleProducts;

    } catch (err) {
      console.error('❌ Error loading flash sale products:', err);
      setError('Gagal memuat produk flash sale');
      setLoading(false);
      return [];
    }
  }, [flashSaleConfig]);

  // Initialize flash sale products (only once)
  useEffect(() => {
    if (initialized) return;

    const initFlashSale = async () => {
      console.log('⏳ Flash sale initializing, please wait...');
      setInitialized(true);

      try {
        const cached = await flashSaleCache.getProducts();
        if (cached && cached.length > 0) {
          console.log('💾 Using cached flash sale products:', cached.length, 'products');
          setFlashSaleProducts(cached);
          globalFlashSaleInstance = {
            products: cached,
            timestamp: Date.now(),
            count: cached.length
          };
        } else {
          console.log('🔥 Flash sale cache expired - loading from batch...');
        }
        await loadFlashSaleProducts();
        console.log('✅ Fresh flash sale products loaded:', flashSaleProducts.length, 'items');
      } catch (error) {
        console.error('❌ Flash sale initialization error:', error);
        setError('Gagal menginisialisasi flash sale');
      }
    };

    initFlashSale();
  }, [initialized, loadFlashSaleProducts, flashSaleProducts.length]);

  return {
    flashSaleProducts,
    loading,
    error,
    timeLeft,
    isFlashSaleActive,
    flashSaleConfig,
    loadFlashSaleProducts,
    // Debug info
    debug: {
      initialized,
      hasConfig: !!flashSaleConfig,
      cached: !!globalFlashSaleInstance,
      totalLoaded: flashSaleProducts.length,
      reads: '1 read total (batch + flash sale config)'
    }
  };
};

export default useFirebaseFlashSaleOptimized;