/**
 * Force Sync Global Index - Browser Console Helper
 * 
 * This function will be available in browser console as:
 * window.forceSyncGlobalIndex()
 */

import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db } from './firebaseClient';

export const forceSyncGlobalIndex = async (): Promise<void> => {
  console.log('%c🚀 FORCE SYNC GLOBALINDEX - STARTING...', 'color: blue; font-size: 16px; font-weight: bold;');
  console.log('%c' + '='.repeat(60), 'color: gray;');
  
  try {
    // Get batch_1 document
    console.log('📦 Fetching batch_1 document...');
    const batchRef = doc(db, 'productBatches', 'batch_1');
    const batchSnapshot = await getDoc(batchRef);

    if (!batchSnapshot.exists()) {
      console.error('❌ Batch document not found!');
      return;
    }

    const batchData = batchSnapshot.data();
    const products = batchData.products || [];

    console.log(`📊 Found ${products.length} products in batch_1\n`);

    // Get current globalindex count
    const globalIndexSnapshot = await getDocs(collection(db, 'globalindex'));
    const existingIds = new Set(globalIndexSnapshot.docs.map(doc => doc.id));

    console.log(`📊 Current globalindex has ${existingIds.size} documents\n`);
    console.log('%c' + '='.repeat(60), 'color: gray;');
    console.log('%c🔄 SYNCING PRODUCTS...', 'color: orange; font-size: 14px; font-weight: bold;');
    console.log('%c' + '='.repeat(60), 'color: gray;');

    let syncCount = 0;
    let errorCount = 0;
    const errors: Array<{ product: string; error: string }> = [];

    // Sync each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      try {
        const globalIndexRef = doc(db, 'globalindex', product.id);
        
        // Prepare simplified data for globalindex
        const globalIndexData = {
          id: product.id,
          name: product.name || '',
          description: product.description || '',
          category: product.category || 'uncategorized',
          
          // Pricing
          price: Number(product.price) || 0,
          retailPrice: Number(product.retailPrice) || 0,
          resellerPrice: Number(product.resellerPrice) || 0,
          costPrice: Number(product.costPrice) || 0,
          
          // Stock and status
          stock: Number(product.stock) || 0,
          status: product.status || 'ready',
          
          // Images
          image: product.image || '/placeholder-product.jpg',
          images: Array.isArray(product.images) ? product.images : [],
          
          // Metadata
          isFeatured: Boolean(product.isFeatured || product.featured),
          isFlashSale: Boolean(product.isFlashSale),
          flashSalePrice: Number(product.flashSalePrice) || Number(product.retailPrice) || 0,
          createdAt: product.createdAt || new Date(),
          salesCount: Number(product.salesCount) || 0,
          reviews: Number(product.reviews) || 0,
          rating: Number(product.rating) || 0,
          
          // Physical properties
          weight: Number(product.weight) || 0,
          unit: product.unit || 'pcs',
          
          // Sync tracking
          lastSyncedAt: new Date().toISOString(),
          syncSource: 'force-sync-console',
          syncedFrom: 'batch_1'
        };

        // Write to globalindex
        await setDoc(globalIndexRef, globalIndexData, { merge: true });
        
        syncCount++;
        const wasNew = !existingIds.has(product.id);
        const emoji = wasNew ? '🆕' : '✅';
        
        console.log(`${emoji} [${i + 1}/${products.length}] ${product.id} - ${product.name}`);

      } catch (error: any) {
        errorCount++;
        errors.push({ product: product.id, error: error.message });
        console.error(`❌ [${i + 1}/${products.length}] Failed: ${product.id} - ${error.message}`);
      }
    }

    // Summary
    console.log('\n' + '%c' + '='.repeat(60), 'color: gray;');
    console.log('%c📊 SYNC SUMMARY:', 'color: green; font-size: 16px; font-weight: bold;');
    console.log('%c' + '='.repeat(60), 'color: gray;');
    console.log(`%c✅ Successfully synced: ${syncCount} products`, 'color: green; font-weight: bold;');
    console.log(`%c❌ Errors: ${errorCount} products`, errorCount > 0 ? 'color: red; font-weight: bold;' : 'color: gray;');
    console.log(`%c📦 Total in batch_1: ${products.length} products`, 'color: blue; font-weight: bold;');
    console.log('%c' + '='.repeat(60), 'color: gray;');

    if (errors.length > 0) {
      console.log('\n%c⚠️ ERRORS DETAIL:', 'color: red; font-weight: bold;');
      errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. Product: ${err.product}`);
        console.log(`     Error: ${err.error}`);
      });
    }

    // Verify final count
    console.log('\n%c🔍 VERIFYING...', 'color: blue; font-weight: bold;');
    const finalSnapshot = await getDocs(collection(db, 'globalindex'));
    console.log(`%c✅ GlobalIndex now has ${finalSnapshot.docs.length} documents`, 'color: green; font-weight: bold;');

    if (syncCount === products.length && errorCount === 0) {
      console.log('\n%c✅ ✅ ✅ ALL PRODUCTS SYNCED SUCCESSFULLY! ✅ ✅ ✅', 'color: green; font-size: 18px; font-weight: bold; background: #e0ffe0; padding: 10px;');
    } else {
      console.log('\n%c⚠️ SYNC COMPLETED WITH SOME ERRORS', 'color: orange; font-size: 16px; font-weight: bold;');
      console.log('Check errors above for details.');
    }

  } catch (error: any) {
    console.error('%c❌ FATAL ERROR:', 'color: red; font-size: 16px; font-weight: bold;');
    console.error(error);
  }
};

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).forceSyncGlobalIndex = forceSyncGlobalIndex;
  console.log('✅ Force sync function loaded! Run: window.forceSyncGlobalIndex()');
}
