/**
 * Enhanced Sync Service for Global Index Collection
 * Ensures globalindex always stays in sync with productBatches
 * Includes retry logic and verification
 */

import { doc, collection, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';

/**
 * Sync product to globalindex collection with retry logic
 * This ensures globalindex always has the latest product data
 */
export const syncProductToGlobalIndex = async (product: Product): Promise<boolean> => {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      console.log(`🔄 Syncing product to globalindex (attempt ${retryCount + 1}):`, product.id);

      const globalIndexRef = doc(db, 'globalindex', product.id);

      // Prepare data for globalindex (simplified structure)
      const globalIndexData = {
        id: product.id,
        name: product.name,
        description: product.description || '',
        category: product.category || 'uncategorized',

        // Pricing
        price: product.price || 0,
        retailPrice: product.retailPrice || 0,
        resellerPrice: product.resellerPrice || 0,
        costPrice: product.costPrice || 0,

        // Stock and status
        stock: product.stock || 0,
        status: product.status || 'ready',

        // Images
        image: product.image || '/placeholder-product.jpg',
        images: Array.isArray(product.images) ? product.images : [],

        // Metadata
        isFeatured: Boolean(product.isFeatured || product.featured),
        isFlashSale: Boolean(product.isFlashSale),
        flashSalePrice: product.flashSalePrice || product.retailPrice || 0,
        createdAt: product.createdAt || new Date(),
        salesCount: product.salesCount || 0,
        reviews: product.reviews || 0,
        rating: product.rating || 0,

        // Physical properties
        weight: product.weight || 0,
        unit: product.unit || 'pcs',

        // Sync tracking
        lastSyncedAt: new Date().toISOString(),
        syncSource: 'productBatches',
        syncAttempt: retryCount + 1
      };

      await setDoc(globalIndexRef, globalIndexData);

      // VERIFY: Check if document was actually written
      const verifyRef = doc(db, 'globalindex', product.id);
      const verifySnapshot = await getDoc(verifyRef);

      if (verifySnapshot.exists()) {
        const writtenData = verifySnapshot.data();
        console.log('✅ Product synced to globalindex:', product.id);
        console.log('✅ VERIFICATION: Document exists in globalindex');
        console.log('✅ VERIFICATION: Written data matches:', writtenData.name === product.name);
        return true;
      } else {
        console.error('❌ VERIFICATION FAILED: Document not found after write');
        throw new Error('Write verification failed');
      }

    } catch (error) {
      console.error(`❌ Error syncing product to globalindex (attempt ${retryCount + 1}):`, error);
      retryCount++;

      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying sync (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      }
    }
  }

  console.error(`❌ Failed to sync product to globalindex after ${maxRetries} attempts:`, product.id);
  return false;
};

/**
 * Delete product from globalindex collection with retry logic
 */
export const deleteProductFromGlobalIndex = async (productId: string): Promise<boolean> => {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      console.log(`🗑️ Deleting product from globalindex (attempt ${retryCount + 1}):`, productId);

      const globalIndexRef = doc(db, 'globalindex', productId);
      await deleteDoc(globalIndexRef);

      // VERIFY: Check if document was actually deleted
      const verifyRef = doc(db, 'globalindex', productId);
      const verifySnapshot = await getDoc(verifyRef);

      if (!verifySnapshot.exists()) {
        console.log('✅ Product deleted from globalindex:', productId);
        console.log('✅ VERIFICATION: Document confirmed deleted in globalindex');
        return true;
      } else {
        console.error('❌ VERIFICATION FAILED: Document still exists after delete');
        throw new Error('Delete verification failed');
      }

    } catch (error) {
      console.error(`❌ Error deleting product from globalindex (attempt ${retryCount + 1}):`, error);
      retryCount++;

      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying delete (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      }
    }
  }

  console.error(`❌ Failed to delete product from globalindex after ${maxRetries} attempts:`, productId);
  return false;
};

/**
 * Force sync all products from batch_1 to globalindex
 * Useful for fixing sync issues
 */
export const forceSyncAllProducts = async (): Promise<number> => {
  try {
    console.log('🔄 Starting force sync from batch_1 to globalindex...');

    const batchRef = doc(db, 'productBatches', 'batch_1');
    const batchSnapshot = await getDoc(batchRef);

    if (!batchSnapshot.exists()) {
      console.error('❌ Batch document not found for force sync');
      return 0;
    }

    const batchData = batchSnapshot.data();
    const products = batchData.products || [];

    console.log(`📊 Found ${products.length} products in batch_1`);

    let syncCount = 0;
    for (const product of products) {
      const success = await syncProductToGlobalIndex(product);
      if (success) {
        syncCount++;
        console.log(`✅ Synced product ${syncCount}/${products.length}: ${product.id} - ${product.name}`);
      } else {
        console.error(`❌ Failed to sync product ${syncCount}/${products.length}: ${product.id} - ${product.name}`);
      }
    }

    console.log(`✅ Force sync completed: ${syncCount}/${products.length} products synced`);
    return syncCount;

  } catch (error) {
    console.error('❌ Error in force sync:', error);
    return 0;
  }
};