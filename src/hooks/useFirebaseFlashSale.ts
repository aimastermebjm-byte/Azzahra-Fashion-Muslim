import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
  where
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

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

export const useFirebaseFlashSale = () => {
  const [flashSaleConfig, setFlashSaleConfig] = useState<FlashSaleConfig | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Helper function to clean flash sale from products
  const clearFlashSaleFromProducts = async () => {
    try {
      
      // Find all products with isFlashSale = true
      const productsQuery = query(
        collection(db, 'products'),
        where('isFlashSale', '==', true)
      );

      const querySnapshot = await getDocs(productsQuery);
    
      // Update all flash sale products to remove flash sale status
      const updatePromises = querySnapshot.docs.map(async (docSnapshot) => {
        const productRef = doc(db, 'products', docSnapshot.id);
        await updateDoc(productRef, {
          isFlashSale: false,
          flashSalePrice: null
        });
            });

      await Promise.all(updatePromises);
        } catch (error) {
      console.error('❌ Firebase Flash Sale: Error cleaning flash sale products:', error);
      throw error;
    }
  };

  // Listen to flash sale config changes in real-time
  useEffect(() => {
    // 🚨 EMERGENCY: DISABLED to prevent Firestore quota exhaustion
    console.error('🚨 EMERGENCY: Flash Sale listener DISABLED');
    setLoading(false);
    setFlashSaleConfig(null);
    return () => {};
      if (docSnapshot.exists()) {
        const config = { id: docSnapshot.id, ...docSnapshot.data() } as FlashSaleConfig;
        setFlashSaleConfig(config);
              } else {
                setFlashSaleConfig(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('❌ Firebase Flash Sale: Error listening to config:', error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
          };
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (!flashSaleConfig || !flashSaleConfig.isActive) {
      setTimeLeft('');
      return;
    }

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const endTime = new Date(flashSaleConfig.endTime).getTime();
      const difference = endTime - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft(
          days > 0
            ? `${days} hari ${hours} jam ${minutes} menit`
            : hours > 0
              ? `${hours} jam ${minutes} menit ${seconds} detik`
              : `${minutes} menit ${seconds} detik`
        );
      } else {
        // Flash sale ended

        // Update Firebase to mark as inactive AND clean up products
        if (flashSaleConfig.id) {
          updateFlashSale({ isActive: false });
          clearFlashSaleFromProducts(); // Clean up products automatically
        }

        // Trigger end event
        window.dispatchEvent(new CustomEvent('flashSaleEnded', {
          detail: {
            timestamp: new Date().toISOString(),
            reason: 'time_expired',
            configId: flashSaleConfig.id
          }
        }));

        setTimeLeft('Flash Sale Berakhir');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [flashSaleConfig, clearFlashSaleFromProducts]);

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
          return newConfig;
    } catch (error) {
      console.error('❌ Firebase Flash Sale: Error creating flash sale:', error);
      throw error;
    }
  };

  const updateFlashSale = async (updates: Partial<FlashSaleConfig>) => {
    try {
      if (!flashSaleConfig?.id) return;

      const flashSaleRef = doc(db, 'flashSales', flashSaleConfig.id);
      await updateDoc(flashSaleRef, {
        ...updates,
        updatedAt: new Date().toISOString()
      });

          } catch (error) {
      console.error('❌ Firebase Flash Sale: Error updating flash sale:', error);
      throw error;
    }
  };

  const startFlashSale = async (config: Omit<FlashSaleConfig, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newConfig: Omit<FlashSaleConfig, 'id' | 'createdAt' | 'updatedAt'> = {
        ...config,
        isActive: true
      };

      await createFlashSale(newConfig);
          } catch (error) {
      console.error('❌ Firebase Flash Sale: Error starting flash sale:', error);
      throw error;
    }
  };

  const stopFlashSale = async () => {
    try {
      if (!flashSaleConfig?.id) return;

      await updateFlashSale({ isActive: false });
      await clearFlashSaleFromProducts(); // Also clean up products
          } catch (error) {
      console.error('❌ Firebase Flash Sale: Error stopping flash sale:', error);
      throw error;
    }
  };

  const isProductInFlashSale = (productId: string) => {
    if (!flashSaleConfig?.isActive || !productId) return false;

    // Check both products and productIds arrays for backward compatibility
    // Add safety checks for undefined arrays
    const products = flashSaleConfig.products || [];
    const productIds = flashSaleConfig.productIds || [];

    const inProducts = products.includes(productId);
    const inProductIds = productIds.includes(productId);

    return inProducts || inProductIds;
  };

  return {
    flashSaleConfig,
    timeLeft,
    loading,
    isFlashSaleActive: flashSaleConfig?.isActive || false,
    createFlashSale,
    updateFlashSale,
    startFlashSale,
    stopFlashSale,
    isProductInFlashSale
  };
};