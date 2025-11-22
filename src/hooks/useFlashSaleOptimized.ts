// Flash Sale Hook - Firestore Persistence Only
// Real-time flash sale products with automatic sync

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export interface FlashSaleProduct {
  id: string;
  name: string;
  price: number;
  retailPrice?: number;
  resellerPrice?: number;
  stock: number;
  flashSalePrice?: number;
  flashSaleActive?: boolean;
  description?: string;
  image?: string;
  category?: string;
  status?: string;
  weight?: number;
  variants?: any;
  isFeatured?: boolean;
  featured?: boolean;
  lastModified?: number;
}

export interface FlashSaleConfig {
  active: boolean;
  startTime?: Date;
  endTime?: Date;
  message?: string;
  backgroundColor?: string;
  textColor?: string;
}

export interface UseFlashSaleResult {
  flashSaleProducts: FlashSaleProduct[];
  config: FlashSaleConfig;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useFlashSaleOptimized = (): UseFlashSaleResult => {
  const [flashSaleProducts, setFlashSaleProducts] = useState<FlashSaleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<FlashSaleConfig>({
    active: false,
    backgroundColor: '#ff6b6b',
    textColor: '#ffffff'
  });

  // Load flash sale data using Firestore persistence
  const loadFlashSale = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔥 Loading flash sale data via Firestore persistence...');

      // Listen to batch_1 for real-time flash sale products
      const batchRef = doc(db, 'productBatches', 'batch_1');

      const unsubscribe = onSnapshot(batchRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const batchData = snapshot.data();
            const products = batchData.products || [];

            // Filter flash sale products
            const flashSale = products.filter((product: any) =>
              product.flashSaleActive === true && product.stock > 0
            );

            console.log(`✅ Flash sale products loaded via persistence: ${flashSale.length} products (0 Firestore reads)`);
            setFlashSaleProducts(flashSale);

            // Update config based on flash sale availability
            setConfig({
              active: flashSale.length > 0,
              backgroundColor: '#ff6b6b',
              textColor: '#ffffff',
              message: flashSale.length > 0 ? 'Flash Sale Aktif!' : 'Flash Sale Tidak Aktif'
            });

            setLoading(false);
          } else {
            console.log('ℹ️ No batch data found for flash sale');
            setFlashSaleProducts([]);
            setConfig(prev => ({ ...prev, active: false }));
            setLoading(false);
          }
        },
        (error) => {
          console.error('❌ Error listening to flash sale:', error);
          setError('Failed to load flash sale products');
          setLoading(false);
        }
      );

      return () => {
        console.log('🔄 Unsubscribing from flash sale listener');
        unsubscribe();
      };

    } catch (error) {
      console.error('❌ Error setting up flash sale listener:', error);
      setError('Failed to initialize flash sale');
      setLoading(false);
      return () => {};
    }
  };

  useEffect(() => {
    const setupFlashSale = async () => {
      const cleanup = await loadFlashSale();
      return cleanup;
    };

    setupFlashSale();

    return () => {
      // Cleanup will be handled by the function itself
    };
  }, []);

  // Manual refresh function
  const refresh = async () => {
    console.log('🔄 Manual refresh requested for flash sale...');
    setLoading(true);
    const cleanup = await loadFlashSale();
    setTimeout(() => {
      cleanup?.();
    }, 1000);
  };

  return {
    flashSaleProducts,
    config,
    loading,
    error,
    refresh
  };
};

export default useFlashSaleOptimized;