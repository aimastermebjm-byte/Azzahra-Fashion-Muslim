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
      console.log('🧹 Firebase Flash Sale: Cleaning up flash sale products...');

      // Find all products with isFlashSale = true
      const productsQuery = query(
        collection(db, 'products'),
        where('isFlashSale', '==', true)
      );

      const querySnapshot = await getDocs(productsQuery);
      console.log(`🧹 Firebase Flash Sale: Found ${querySnapshot.docs.length} flash sale products to clean`);

      // Update all flash sale products to remove flash sale status
      const updatePromises = querySnapshot.docs.map(async (docSnapshot) => {
        const productRef = doc(db, 'products', docSnapshot.id);
        await updateDoc(productRef, {
          isFlashSale: false,
          flashSalePrice: null
        });
        console.log(`🧹 Firebase Flash Sale: Cleared flash sale from product ${docSnapshot.id}`);
      });

      await Promise.all(updatePromises);
      console.log('✅ Firebase Flash Sale: All flash sale products cleaned successfully');
    } catch (error) {
      console.error('❌ Firebase Flash Sale: Error cleaning flash sale products:', error);
      throw error;
    }
  };

  // Listen to flash sale config changes in real-time
  useEffect(() => {
    setLoading(true);
    console.log('🔥 Firebase Flash Sale: Initializing real-time listener');

    const flashSaleRef = doc(db, 'flashSales', FLASH_SALE_DOC_ID);

    const unsubscribe = onSnapshot(flashSaleRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const config = { id: docSnapshot.id, ...docSnapshot.data() } as FlashSaleConfig;
        setFlashSaleConfig(config);
        console.log('✅ Firebase Flash Sale: Config loaded from Firebase');
        console.log('📅 Flash sale ends at:', config.endTime);
        console.log('⏰ Current time:', new Date().toISOString());
        console.log('🔥 Firebase Flash Sale: Active status:', config.isActive);
      } else {
        console.log('📝 Firebase Flash Sale: No active flash sale found');
        setFlashSaleConfig(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('❌ Firebase Flash Sale: Error listening to config:', error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      console.log('🔥 Firebase Flash Sale: Listener disconnected');
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
        console.log('⏰ Firebase Flash Sale: Flash sale has ended!');

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
      console.log('✅ Firebase Flash Sale: Flash sale created successfully');
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

      console.log('✅ Firebase Flash Sale: Flash sale updated successfully');
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
      console.log('✅ Firebase Flash Sale: Flash sale started successfully');
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
      console.log('✅ Firebase Flash Sale: Flash sale stopped successfully');
    } catch (error) {
      console.error('❌ Firebase Flash Sale: Error stopping flash sale:', error);
      throw error;
    }
  };

  const isProductInFlashSale = (productId: string) => {
    if (!flashSaleConfig?.isActive) return false;

    // Check both products and productIds arrays for backward compatibility
    const inProducts = flashSaleConfig.products.includes(productId);
    const inProductIds = flashSaleConfig.productIds?.includes(productId) || false;

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