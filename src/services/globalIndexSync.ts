/**
 * Sync Service for Global Index Collection
 * Ensures globalindex collection stays in sync with productBatches
 */

import { doc, collection, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';

/**
 * Sync product to globalindex collection
 * This ensures globalindex always has the latest product data
 */
export const syncProductToGlobalIndex = async (product: Product): Promise<boolean> => {
  try {
    console.log('🔄 Syncing product to globalindex:', product.id);

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
      syncSource: 'productBatches'
    };

    await setDoc(globalIndexRef, globalIndexData);
    console.log('✅ Product synced to globalindex:', product.id);

    return true;
  } catch (error) {
    console.error('❌ Error syncing product to globalindex:', error);
    return false;
  }
};

/**
 * Delete product from globalindex collection
 */
export const deleteProductFromGlobalIndex = async (productId: string): Promise<boolean> => {
  try {
    console.log('🗑️ Deleting product from globalindex:', productId);

    const globalIndexRef = doc(db, 'globalindex', productId);
    await deleteDoc(globalIndexRef);

    console.log('✅ Product deleted from globalindex:', productId);
    return true;
  } catch (error) {
    console.error('❌ Error deleting product from globalindex:', error);
    return false;
  }
};

/**
 * Batch sync all products from batch_1 to globalindex
 * Useful for initial setup or resync
 */
export const syncAllProductsToGlobalIndex = async (): Promise<number> => {
  try {
    console.log('🔄 Starting full batch sync to globalindex...');

    const batchRef = doc(db, 'productBatches', 'batch_1');
    const batchSnapshot = await getDoc(batchRef);

    if (!batchSnapshot.exists()) {
      console.error('❌ Batch document not found for full sync');
      return 0;
    }

    const batchData = batchSnapshot.data();
    const products = batchData.products || [];

    let syncCount = 0;
    for (const product of products) {
      const success = await syncProductToGlobalIndex(product);
      if (success) syncCount++;
    }

    console.log(`✅ Full sync completed: ${syncCount}/${products.length} products synced to globalindex`);
    return syncCount;
  } catch (error) {
    console.error('❌ Error in full batch sync:', error);
    return 0;
  }
};