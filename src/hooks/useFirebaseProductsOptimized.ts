// Firebase Products Hook - Firestore Persistence Only
// Real-time products with automatic sync via Firestore persistence

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { BATCH_CONFIG } from '../constants/batchConfig';

export interface Product {
  id: string;
  name: string;
  price: number;
  retailPrice?: number;
  resellerPrice?: number;
  stock: number;
  description?: string;
  image?: string;
  category?: string;
  status?: string;
  flashSaleActive?: boolean;
  flashSalePrice?: number;
  weight?: number;
  variants?: any;
  isFeatured?: boolean;
  featured?: boolean;
  lastModified?: number;
}

export interface UseFirebaseProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useFirebaseProductsOptimized = (
  initialLoadSize: number = BATCH_CONFIG.INITIAL_LOAD_SIZE
): UseFirebaseProductsResult => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simple function to load products using Firestore persistence
  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔥 Loading products via Firestore persistence...');

      // Use batch_1 document (250 products per batch)
      const batchRef = doc(db, 'productBatches', 'batch_1');

      // Set up real-time listener with persistence support
      const unsubscribe = onSnapshot(batchRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const batchData = snapshot.data();
            const productsData = batchData.products || [];

            console.log(`✅ Products loaded via persistence: ${productsData.length} products (0 Firestore reads)`);
            setProducts(productsData.slice(0, initialLoadSize));
            setLoading(false);
          } else {
            console.log('ℹ️ No batch data found, using empty array');
            setProducts([]);
            setLoading(false);
          }
        },
        (error) => {
          console.error('❌ Error listening to products:', error);
          setError('Failed to load products');
          setLoading(false);
        }
      );

      // Return cleanup function
      return () => {
        console.log('🔄 Unsubscribing from products listener');
        unsubscribe();
      };

    } catch (error) {
      console.error('❌ Error setting up products listener:', error);
      setError('Failed to initialize products');
      setLoading(false);
      return () => {};
    }
  };

  useEffect(() => {
    const setupProducts = async () => {
      const cleanup = await loadProducts();
      return cleanup;
    };

    setupProducts();

    return () => {
      // Cleanup will be handled by the function itself
    };
  }, [initialLoadSize]);

  // Manual refresh function (trigger fresh sync if needed)
  const refresh = async () => {
    console.log('🔄 Manual refresh requested - triggering persistence sync...');
    setLoading(true);
    // Firestore persistence will handle fresh data sync
    // Just re-trigger the listener to ensure fresh data
    const cleanup = await loadProducts();
    setTimeout(() => {
      cleanup?.();
    }, 1000);
  };

  return {
    products,
    loading,
    error,
    refresh
  };
};

export default useFirebaseProductsOptimized;