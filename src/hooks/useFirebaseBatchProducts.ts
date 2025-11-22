import { useState, useEffect, useCallback, useRef } from 'react';
import { getFirestore, collection, getDoc, doc, query, orderBy, limit } from 'firebase/firestore';
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

interface BatchData {
  batchNumber: number;
  totalProducts: number;
  products: Product[];
  minPrice: number;
  maxPrice: number;
  hasFlashSale: boolean;
  hasFeatured: boolean;
  productIds: string[];
  createdAt: Date;
}

const PRODUCTS_PER_PAGE = 20;

export const useFirebaseBatchProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(1); // Mulai dari batch_1
  const [productIndex, setProductIndex] = useState(0);
  const [batches, setBatches] = useState<Map<number, BatchData>>(new Map());

  // Load batch tertentu
  const loadBatch = useCallback(async (batchNumber: number): Promise<BatchData | null> => {
    try {
      console.log(`📦 Loading batch_${batchNumber}...`);
      const batchRef = doc(db, 'productBatches', `batch_${batchNumber}`);
      const batchSnap = await getDoc(batchRef);

      if (batchSnap.exists()) {
        const batchData = batchSnap.data() as BatchData;
        console.log(`✅ batch_${batchNumber} loaded: ${batchData.totalProducts} products`);

        // Cache batch data
        setBatches(prev => new Map(prev.set(batchNumber, batchData)));
        return batchData;
      } else {
        console.log(`⚠️ batch_${batchNumber} not found`);
        return null;
      }
    } catch (err) {
      console.error(`❌ Error loading batch_${batchNumber}:`, err);
      return null;
    }
  }, []);

  // Load products dari batch yang sudah di-cache
  const loadProductsFromBatches = useCallback(() => {
    const newProducts: Product[] = [];
    let currentIndex = productIndex;
    let currentBatchNumber = currentBatchIndex;
    let productsLoaded = 0;

    while (productsLoaded < PRODUCTS_PER_PAGE) {
      const batchData = batches.get(currentBatchNumber);

      if (!batchData) {
        break; // Butuh load batch baru
      }

      const remainingInBatch = batchData.products.length - currentIndex;

      if (remainingInBatch > 0) {
        const takeFromBatch = Math.min(remainingInBatch, PRODUCTS_PER_PAGE - productsLoaded);
        const batchProducts = batchData.products.slice(currentIndex, currentIndex + takeFromBatch);
        newProducts.push(...batchProducts);

        currentIndex += takeFromBatch;
        productsLoaded += takeFromBatch;
      }

      // Pindah ke batch berikutnya jika batch ini habis
      if (currentIndex >= batchData.products.length) {
        currentBatchNumber++;
        currentIndex = 0;
      }

      if (productsLoaded >= PRODUCTS_PER_PAGE) {
        break;
      }
    }

    return { newProducts, nextBatchIndex: currentBatchNumber, nextProductIndex: currentIndex };
  }, [batches, currentBatchIndex, productIndex]);

  // Load produk pertama kali
  const loadInitialProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load batch pertama
      const firstBatch = await loadBatch(1);

      if (!firstBatch || firstBatch.products.length === 0) {
        // Fallback ke sistem lama
        console.log('🔄 Fallback to legacy system...');
        return loadLegacyProducts();
      }

      // Ambil 20 produk pertama
      const initialProducts = firstBatch.products.slice(0, PRODUCTS_PER_PAGE);

      setProducts(initialProducts);
      setProductIndex(PRODUCTS_PER_PAGE);
      setHasMore(firstBatch.products.length > PRODUCTS_PER_PAGE);

      console.log(`✅ Loaded ${initialProducts.length} products from batch_1`);

    } catch (err) {
      console.error('❌ Error loading initial products:', err);
      setError('Gagal memuat produk. Menggunakan sistem lama...');
      loadLegacyProducts();
    } finally {
      setLoading(false);
    }
  }, [loadBatch]);

  // Load lebih banyak produk (pagination)
  const loadMoreProducts = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);

    try {
      // Coba load dari batch yang sudah ada di cache
      const { newProducts, nextBatchIndex, nextProductIndex } = loadProductsFromBatches();

      if (newProducts.length > 0) {
        setProducts(prev => [...prev, ...newProducts]);
        setCurrentBatchIndex(nextBatchIndex);
        setProductIndex(nextProductIndex);

        console.log(`✅ Loaded ${newProducts.length} more products from cache`);
      } else {
        // Butuh load batch baru
        const nextBatch = await loadBatch(nextBatchIndex);

        if (nextBatch && nextBatch.products.length > 0) {
          const batchProducts = nextBatch.products.slice(0, PRODUCTS_PER_PAGE);
          setProducts(prev => [...prev, ...batchProducts]);
          setCurrentBatchIndex(nextBatchIndex);
          setProductIndex(batchProducts.length);
          setHasMore(true);

          console.log(`✅ Loaded ${batchProducts.length} products from batch_${nextBatchIndex}`);
        } else {
          setHasMore(false);
          console.log('🏁 No more products to load');
        }
      }

    } catch (err) {
      console.error('❌ Error loading more products:', err);
      setError('Gagal memuat lebih banyak produk');
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, loadProductsFromBatches, loadBatch]);

  // Fallback ke sistem lama
  const loadLegacyProducts = async () => {
    try {
      console.log('🔄 Using legacy product system...');
      const productsRef = collection(db, 'products');
      const q = query(productsRef, orderBy('createdAt', 'desc'), limit(PRODUCTS_PER_PAGE));
      const snapshot = await getDoc(q);
      // Implement legacy loading logic...
    } catch (err) {
      console.error('❌ Legacy system also failed:', err);
      setError('Tidak dapat memuat produk. Silakan refresh halaman.');
    }
  };

  // Initialize loading
  useEffect(() => {
    loadInitialProducts();
  }, [loadInitialProducts]);

  return {
    products,
    loading,
    error,
    hasMore,
    loadMoreProducts,
    // Debug info
    debug: {
      currentBatch: currentBatchIndex,
      productIndex,
      cachedBatches: batches.size,
      totalLoaded: products.length
    }
  };
};

export default useFirebaseBatchProducts;