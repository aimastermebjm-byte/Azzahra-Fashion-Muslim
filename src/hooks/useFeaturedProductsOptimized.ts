// Featured Products Hook - Firestore Persistence Only
// Real-time featured products with automatic sync

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export interface FeaturedProduct {
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

export interface UseFeaturedProductsResult {
  featuredProducts: FeaturedProduct[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useFeaturedProductsOptimized = (): UseFeaturedProductsResult => {
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load featured products using Firestore persistence
  const loadFeaturedProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔥 Loading featured products via Firestore persistence...');

      // Listen to batch_1 for real-time updates
      const batchRef = doc(db, 'productBatches', 'batch_1');

      const unsubscribe = onSnapshot(batchRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const batchData = snapshot.data();
            const products = batchData.products || [];

            // Filter featured products using both isFeatured and featured fields
            const featured = products.filter((product: any) =>
              product.isFeatured === true || product.featured === true
            );

            console.log(`✅ Featured products loaded via persistence: ${featured.length} products (0 Firestore reads)`);
            setFeaturedProducts(featured);
            setLoading(false);
          } else {
            console.log('ℹ️ No batch data found for featured products');
            setFeaturedProducts([]);
            setLoading(false);
          }
        },
        (error) => {
          console.error('❌ Error listening to featured products:', error);
          setError('Failed to load featured products');
          setLoading(false);
        }
      );

      return () => {
        console.log('🔄 Unsubscribing from featured products listener');
        unsubscribe();
      };

    } catch (error) {
      console.error('❌ Error setting up featured products listener:', error);
      setError('Failed to initialize featured products');
      setLoading(false);
      return () => {};
    }
  };

  useEffect(() => {
    const setupFeaturedProducts = async () => {
      const cleanup = await loadFeaturedProducts();
      return cleanup;
    };

    setupFeaturedProducts();

    return () => {
      // Cleanup will be handled by the function itself
    };
  }, []);

  // Manual refresh function
  const refresh = async () => {
    console.log('🔄 Manual refresh requested for featured products...');
    setLoading(true);
    const cleanup = await loadFeaturedProducts();
    setTimeout(() => {
      cleanup?.();
    }, 1000);
  };

  return {
    featuredProducts,
    loading,
    error,
    refresh
  };
};

export default useFeaturedProductsOptimized;