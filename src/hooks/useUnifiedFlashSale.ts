// 🔥 UNIFIED FLASH SALE HOOK - Single Source of Truth
// Real-time timer dengan 0 reads setelah initial cache

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

interface FlashSaleConfig {
  isActive: boolean;
  startTime: string;
  endTime: string;
  duration: number; // dalam detik
  title?: string;
  description?: string;
  discountPercentage?: number;
}

export const useUnifiedFlashSale = () => {
  const [flashSaleConfig, setFlashSaleConfig] = useState<FlashSaleConfig | null>(null);
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔥 REAL-TIME LISTENER: 1x read awal, lalu 0 reads (cache only)
  useEffect(() => {
    console.log('🔥 Starting unified flash sale listener...');

    const flashSaleRef = doc(db, 'flashSale', 'config');
    const unsubscribe = onSnapshot(flashSaleRef,
      (snapshot) => {
        setLoading(false);

        if (snapshot.exists()) {
          const config = snapshot.data() as FlashSaleConfig;
          console.log('🚀 Flash sale config updated:', {
            isActive: config.isActive,
            endTime: config.endTime
          });
          setFlashSaleConfig(config);
          setError(null);
        } else {
          console.log('❌ No flash sale config found');
          setFlashSaleConfig(null);
          setError('No flash sale configuration found');
        }
      },
      (error) => {
        console.error('❌ Flash sale listener error:', error);
        setError('Failed to load flash sale config');
        setLoading(false);
      }
    );

    return () => {
      console.log('🔄 Cleaning up flash sale listener');
      unsubscribe();
    };
  }, []);

  // 🔥 CLIENT-SIDE TIMER: 0 Firebase reads, pure client calculation
  useEffect(() => {
    const timer = setInterval(() => {
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

        // 🔥 AUTO-CLEANUP: Timer expired
        if (flashSaleConfig.isActive) {
          console.log('⏰ Flash sale expired - triggering auto cleanup...');
          endFlashSale();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [flashSaleConfig]);

  // 🔥 START FLASH SALE: 1 write only
  const startFlashSale = useCallback(async (
    durationMinutes: number,
    title?: string,
    description?: string,
    discountPercentage?: number
  ) => {
    try {
      console.log('🚀 Starting flash sale...');

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      const flashSaleConfig: FlashSaleConfig = {
        isActive: true,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: durationMinutes * 60,
        title: title || '⚡ Flash Sale',
        description: description || 'Diskon spesial terbatas!',
        discountPercentage: discountPercentage || 20
      };

      // Write ke Firebase (1 write)
      await setDoc(doc(db, 'flashSale', 'config'), flashSaleConfig);

      // Update produk flags di batch
      await updateProductFlashSaleFlags(true, discountPercentage || 20);

      console.log('✅ Flash sale started successfully!');
      return true;
    } catch (error) {
      console.error('❌ Failed to start flash sale:', error);
      setError('Failed to start flash sale');
      return false;
    }
  }, []);

  // 🔥 END FLASH SALE: 1 write only
  const endFlashSale = useCallback(async () => {
    try {
      console.log('🛑 Ending flash sale...');

      // Update flash sale config (1 write)
      await setDoc(doc(db, 'flashSale', 'config'), {
        isActive: false,
        endTime: new Date().toISOString(),
        duration: 0
      }, { merge: true });

      // Reset produk flags di batch
      await updateProductFlashSaleFlags(false, 0);

      console.log('✅ Flash sale ended successfully!');
      return true;
    } catch (error) {
      console.error('❌ Failed to end flash sale:', error);
      setError('Failed to end flash sale');
      return false;
    }
  }, []);

  // 🔥 UPDATE PRODUK FLAGS: 1 write only (di batch)
  const updateProductFlashSaleFlags = useCallback(async (isActive: boolean, discountPercentage: number) => {
    try {
      const batchRef = doc(db, 'productBatches', 'batch_1');
      const batchSnap = await getDoc(batchRef);

      if (!batchSnap.exists()) {
        throw new Error('Batch data not found');
      }

      const batchData = batchSnap.data();
      const updatedProducts = batchData.products.map((product: any) => {
        if (isActive) {
          // Set flash sale untuk produk yang ada (bisa disesuaikan)
          return {
            ...product,
            isFlashSale: true,
            flashSalePrice: Math.round(product.retailPrice * (1 - discountPercentage / 100)),
            originalRetailPrice: product.originalRetailPrice || product.retailPrice
          };
        } else {
          // Reset flash sale flags
          return {
            ...product,
            isFlashSale: false,
            flashSalePrice: undefined
          };
        }
      });

      // Update batch (1 write)
      await setDoc(batchRef, {
        ...batchData,
        products: updatedProducts,
        flashSaleConfig: {
          ...(batchData.flashSaleConfig || {}),
          isActive,
          discountPercentage,
          lastUpdated: new Date().toISOString()
        }
      }, { merge: true });

      console.log(`✅ Flash sale flags ${isActive ? 'applied' : 'removed'} for ${updatedProducts.length} products`);
    } catch (error) {
      console.error('❌ Failed to update product flash sale flags:', error);
      throw error;
    }
  }, []);

  return {
    // Data
    flashSaleConfig,
    timeLeft,
    isFlashSaleActive: flashSaleConfig?.isActive || false,
    loading,
    error,

    // Actions
    startFlashSale,
    endFlashSale,
    updateProductFlashSaleFlags,

    // Debug info
    debug: {
      hasConfig: !!flashSaleConfig,
      isActive: flashSaleConfig?.isActive || false,
      endTime: flashSaleConfig?.endTime || null
    }
  };
};