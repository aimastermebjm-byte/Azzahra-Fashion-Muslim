import { useCallback } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  where,
  query
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { useFlashSaleContext } from '../contexts/FlashSaleContext';

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
  // Gunakan singleton context untuk mencegah multiple listeners
  const { flashSaleConfig, timeLeft, isFlashSaleActive, loading } = useFlashSaleContext();

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
      const batch: Promise<any>[] = [];
      querySnapshot.forEach((docSnapshot) => {
        batch.push(
          updateDoc(doc(db, 'products', docSnapshot.id), {
            isFlashSale: false,
            flashSalePrice: null,
            originalRetailPrice: null,
            originalResellerPrice: null,
            updatedAt: new Date().toISOString()
          })
        );
      });

      await Promise.all(batch);
      console.log('✅ Firebase Flash Sale: All flash sale products cleaned successfully');
    } catch (error) {
      console.error('❌ Firebase Flash Sale: Error cleaning flash sale products:', error);
      throw error;
    }
  };

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
      const flashSaleRef = doc(db, 'flashSales', FLASH_SALE_DOC_ID);
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

  const startFlashSale = async (config: {
    startTime: string;
    endTime: string;
    products: string[];
    flashSaleDiscount?: number;
  }) => {
    try {
      await createFlashSale({
        ...config,
        isActive: true
      });
      console.log('✅ Firebase Flash Sale: Flash sale started successfully');
    } catch (error) {
      console.error('❌ Firebase Flash Sale: Error starting flash sale:', error);
      throw error;
    }
  };

  const stopFlashSale = async () => {
    try {
      await updateFlashSale({ isActive: false });
      await clearFlashSaleFromProducts();
      console.log('✅ Firebase Flash Sale: Flash sale stopped successfully');
    } catch (error) {
      console.error('❌ Firebase Flash Sale: Error stopping flash sale:', error);
      throw error;
    }
  };

  // Check if a specific product is in the flash sale
  const isProductInFlashSale = useCallback((productId: string) => {
    if (!flashSaleConfig || !flashSaleConfig.isActive) {
      return false;
    }
    return flashSaleConfig.products.includes(productId) ||
           flashSaleConfig.productIds?.includes(productId);
  }, [flashSaleConfig]);

  // Get flash sale discount for a specific product
  const getProductFlashSaleDiscount = useCallback((productId: string) => {
    if (!isProductInFlashSale(productId)) {
      return 0;
    }
    return flashSaleConfig?.flashSaleDiscount || 0;
  }, [flashSaleConfig, isProductInFlashSale]);

  return {
    flashSaleConfig,
    timeLeft,
    isFlashSaleActive,
    loading,
    createFlashSale,
    updateFlashSale,
    startFlashSale,
    stopFlashSale,
    clearFlashSaleFromProducts,
    isProductInFlashSale,
    getProductFlashSaleDiscount
  };
};