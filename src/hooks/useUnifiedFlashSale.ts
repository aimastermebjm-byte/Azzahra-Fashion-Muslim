// 🔥 UNIFIED FLASH SALE HOOK - Truly Global State
// Single listener untuk semua components

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
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

// 🔥 TRULY GLOBAL STATE: Bukan class, tapi global variables
let globalConfig: FlashSaleConfig | null = null;
let globalUnsubscribe: (() => void) | null = null;
let globalSubscribers: Array<(config: FlashSaleConfig | null) => void> = [];
let globalSubscriberId = 0;

// 🔥 GLOBAL FUNCTIONS: Di luar hook scope
const subscribeToFlashSale = (callback: (config: FlashSaleConfig | null) => void) => {
  // Generate unique ID untuk tracking
  const subscriberId = globalSubscriberId++;

  console.log(`🔥 [${subscriberId}] Subscribing to flash sale...`);

  // Tambah subscriber
  const subscriberWrapper = (config: FlashSaleConfig | null) => {
    callback(config);
  };

  globalSubscribers.push(subscriberWrapper);

  // Create global listener jika belum ada
  if (!globalUnsubscribe) {
    console.log('🔥 Creating GLOBAL flash sale listener (SINGLE INSTANCE)...');

    const flashSaleRef = doc(db, 'flashSale', 'config');
    globalUnsubscribe = onSnapshot(flashSaleRef,
      (snapshot) => {
        if (snapshot.exists()) {
          globalConfig = snapshot.data() as FlashSaleConfig;
          console.log('🚀 GLOBAL flash sale config updated:', {
            isActive: globalConfig.isActive,
            endTime: globalConfig.endTime,
            subscriberCount: globalSubscribers.length
          });
        } else {
          console.log('❌ No flash sale config found');
          globalConfig = null;
        }

        // Broadcast ke semua subscribers
        globalSubscribers.forEach(sub => sub(globalConfig));
      },
      (error) => {
        console.error('❌ GLOBAL flash sale listener error:', error);
        globalConfig = null;
        globalSubscribers.forEach(sub => sub(null));
      }
    );
  } else {
    console.log(`🔄 [${subscriberId}] Reusing existing GLOBAL flash sale listener`);
  }

  // Initial call
  subscriberWrapper(globalConfig);

  // Return unsubscribe function
  return () => {
    console.log(`🔄 [${subscriberId}] Unsubscribing from flash sale...`);

    // Remove specific subscriber
    globalSubscribers = globalSubscribers.filter(sub => sub !== subscriberWrapper);

    // Cleanup global listener jika tidak ada subscribers lagi
    // TAPI jangan cleanup terlalu cepat - tunggu 5 detik untuk mencegah cleanup saat pindah halaman
    if (globalSubscribers.length === 0 && globalUnsubscribe) {
      setTimeout(() => {
        if (globalSubscribers.length === 0 && globalUnsubscribe) {
          console.log('🔄 Cleaning up GLOBAL flash sale listener (delayed)');
          globalUnsubscribe();
          globalUnsubscribe = null;
        }
      }, 5000); // 5 detik delay
    }
  };
};

export const useUnifiedFlashSale = () => {
  const [flashSaleConfig, setFlashSaleConfig] = useState<FlashSaleConfig | null>(null);
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔥 SUBSCRIBE TO GLOBAL STATE
  useEffect(() => {
    console.log('🔥 useUnifiedFlashSale: Setting up subscription...');

    const unsubscribe = subscribeToFlashSale((config) => {
      console.log('🔥 useUnifiedFlashSale: Config received:', config?.isActive);
      setLoading(false);
      setFlashSaleConfig(config);
      if (config) {
        setError(null);
      } else {
        setError('No flash sale configuration found');
      }
    });

    return unsubscribe;
  }, []);

  // 🔥 CLIENT-SIDE TIMER: 0 Firebase reads, pure client calculation
  useEffect(() => {
    let timerRef: NodeJS.Timeout | null = null;

    // Start timer if active
    if (flashSaleConfig?.isActive && flashSaleConfig.endTime) {
      console.log('🕐 Starting timer with endTime:', flashSaleConfig.endTime);

      timerRef = setInterval(() => {
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

          if (timerRef) {
            clearInterval(timerRef);
            timerRef = null;
          }

          console.log('⏰ Flash sale expired - triggering auto cleanup...');
          endFlashSale();
        }
      }, 1000);
    } else {
      // Reset timer if not active
      setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
    }

    return () => {
      if (timerRef) {
        clearInterval(timerRef);
      }
    };
  }, [flashSaleConfig]);

  // 🔥 START FLASH SALE: 1 write only
  const startFlashSale = useCallback(async (
    durationMinutes: number,
    title?: string,
    description?: string,
    discountPercentage?: number,
    selectedProductIds?: string[]
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

      // Update produk flags di batch (hanya produk yang dipilih)
      await updateProductFlashSaleFlags(true, discountPercentage || 20, selectedProductIds);

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

  // 🔥 UPDATE PRODUK FLAGS: Read all batches real-time for flash sale, 1 write per batch
  const updateProductFlashSaleFlags = useCallback(async (isActive: boolean, discountPercentage: number, selectedProductIds?: string[]) => {
    try {
      console.log('🔥 FLASH SALE: Reading ALL batches real-time for data accuracy...');

      // 🔥 SMART BATCH DETECTION - Read only EXISTING batches from Firestore
      console.log('🔍 Detecting available batches in Firestore...');
      const validBatches: any[] = [];

      // 🚀 ULTRA-SMART BATCH DETECTION - Stop at first non-existing batch
      console.log('🔍 Starting SMART batch detection...');

      // Ultra-efficient: Check batch_1 first, then continue ONLY if it exists
      const batchRef = doc(db, 'productBatches', 'batch_1');
      const batchSnap = await getDoc(batchRef);

      if (batchSnap.exists()) {
        const batchData = batchSnap.data();
        if (batchData.products && batchData.products.length > 0) {
          console.log(`✅ batch_1: ${batchData.products.length} products found`);
          validBatches.push({ batchId: 'batch_1', data: batchData, exists: true });

          // Only continue checking if batch_1 exists (for future scalability)
          for (let i = 2; i <= 10; i++) {
            const nextBatchId = `batch_${i}`;
            const nextBatchRef = doc(db, 'productBatches', nextBatchId);
            const nextBatchSnap = await getDoc(nextBatchRef);

            if (nextBatchSnap.exists()) {
              const nextBatchData = nextBatchSnap.data();
              if (nextBatchData.products && nextBatchData.products.length > 0) {
                console.log(`✅ ${nextBatchId}: ${nextBatchData.products.length} products found`);
                validBatches.push({ batchId: nextBatchId, data: nextBatchData, exists: true });
              } else {
                console.log(`⚠️ ${nextBatchId}: No products - STOP checking further`);
                break;
              }
            } else {
              console.log(`⚠️ ${nextBatchId}: No batch data - STOP checking further`);
              break;
            }
          }
        } else {
          console.log(`⚠️ batch_1: No products - No batches to process`);
        }
      } else {
        console.log(`⚠️ batch_1: No batch data - No batches to process`);
      }

      if (validBatches.length === 0) {
        throw new Error('No valid product batches found for flash sale');
      }

      console.log(`🚀 Found ${validBatches.length} valid batches for flash sale`);

      if (validBatches.length === 0) {
        throw new Error('No valid product batches found for flash sale');
      }

      // 🔥 Process all batches for flash sale updates
      const updatePromises = validBatches.map(async ({ batchId, data: batchData }) => {
        console.log(`🔄 Processing ${batchId} for flash sale updates...`);

        const updatedProducts = batchData.products.map((product: any) => {
          const shouldUpdate = selectedProductIds
            ? selectedProductIds.includes(product.id)  // Only selected products
            : isActive; // If no specific IDs, use global logic

          if (shouldUpdate && isActive) {
            // 🔥 FIX: originalRetailPrice HARUS immutable - jangan pernah overwrite!
            // Flash sale SELALU dihitung dari harga asli pertama
            const basePrice = product.originalRetailPrice || product.retailPrice;

            // Apply flash sale to selected products
            // discountPercentage is in RUPIAH, not percentage
            const flashSalePrice = Math.max(basePrice - discountPercentage, 1000); // Minimum 1000

            // 🔒 TRIPLE SAFETY LOCK untuk originalRetailPrice:
            // 1. Jika sudah ada originalRetailPrice → JANGAN UBAH! (preserve)
            // 2. Jika belum ada → Set dari retailPrice SAAT INI (first time only)
            // 3. JANGAN PERNAH overwrite originalRetailPrice yang sudah ada
            const safeOriginalRetailPrice = product.originalRetailPrice
              ? product.originalRetailPrice  // Lock #1: Preserve existing value
              : product.retailPrice;         // Lock #2: First time only

            return {
              ...product,
              isFlashSale: true,
              flashSalePrice: flashSalePrice,
              // 🔒 CRITICAL: originalRetailPrice is IMMUTABLE after first set
              originalRetailPrice: safeOriginalRetailPrice
            };
          } else {
            // Reset flash sale flags (if not active or not selected)
            const updatedProduct = {
              ...product,
              isFlashSale: false,
              flashSalePrice: undefined
            };

            // Remove undefined fields
            delete updatedProduct.flashSalePrice;

            return updatedProduct;
          }
        });

        // Update this batch with flash sale changes
        const batchRef = doc(db, 'productBatches', batchId);
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

        const affectedCount = updatedProducts.filter((p: any) => p.isFlashSale === isActive).length;
        console.log(`✅ ${batchId}: Flash sale flags updated for ${affectedCount} products`);

        return { batchId, affectedCount, totalProducts: updatedProducts.length };
      });

      // Execute all batch updates in parallel
      const updateResults = await Promise.all(updatePromises);

      // Summary
      const totalAffected = updateResults.reduce((sum, result) => sum + result.affectedCount, 0);
      const totalProducts = updateResults.reduce((sum, result) => sum + result.totalProducts, 0);
      console.log(`🎉 FLASH SALE COMPLETE: ${totalAffected}/${totalProducts} products updated across ${validBatches.length} batches`);
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
      endTime: flashSaleConfig?.endTime || null,
      subscriberCount: globalSubscribers.length
    }
  };
};