/**
 * Debug utility for globalindex collection
 * Add this to your AdminProductsPage to debug
 */
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { db } from './firebaseClient';

// Export debug functions for AdminProductsPage
export const debugGlobalIndex = async () => {
  console.log('🔍 DEBUG: Checking globalindex collection...');

  try {
    const globalIndexRef = collection(db, 'globalindex');
    const globalIndexSnapshot = await getDocs(globalIndexRef);

    console.log(`📊 GlobalIndex Total Documents: ${globalIndexSnapshot.docs.length}`);

    // Show all products
    globalIndexSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n📦 Product ${index + 1}:`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  Name: ${data.name || 'No name'}`);
      console.log(`  Price: ${data.retailPrice || data.price || 0}`);
      console.log(`  Stock: ${data.stock || 0}`);
      console.log(`  Created: ${data.createdAt || data.lastSyncedAt || 'unknown'}`);
      console.log(`  Image: ${data.image ? 'Yes' : 'No'}`);
    });

    // Check for specific products from add logs
    const expectedProducts = [
      'product_1764662100866_88rm9rfa1', // The one that shows "synced successfully"
      'product_1764660943231_jgmo9b9k4'  // The one that was deleted
    ];

    console.log('\n🔍 CHECKING EXPECTED PRODUCTS:');
    expectedProducts.forEach(productId => {
      const exists = globalIndexSnapshot.docs.some(doc => doc.id === productId);
      console.log(`${exists ? '✅' : '❌'} ${productId}`);
    });

    return {
      total: globalIndexSnapshot.docs.length,
      found: expectedProducts.filter(pid =>
        globalIndexSnapshot.docs.some(doc => doc.id === pid)
      ).length
    };

  } catch (error) {
    console.error('❌ DEBUG: Error checking globalindex:', error);
    return { total: 0, found: 0 };
  }
};

export const debugBatch = async () => {
  console.log('🔍 DEBUG: Checking batch_1 collection...');

  try {
    const batchDocRef = doc(db, 'productBatches', 'batch_1');
    const batchSnapshot = await getDoc(batchDocRef);

    if (batchSnapshot.exists()) {
      const batchData = batchSnapshot.data();
      const products = batchData.products || [];
      const productIds = batchData.productIds || [];

      console.log(`📊 Batch Total Products: ${products.length}`);
      console.log(`📊 Batch ProductIds: ${productIds.length}`);
      console.log(`📊 Match: ${products.length === productIds.length ? '✅ YES' : '❌ NO'}`);

      // Check mismatch
      if (products.length !== productIds.length) {
        console.log('\n❌ MISMATCH DETECTED:');
        console.log('Products from last 3:');
        products.slice(-3).forEach((product, index) => {
          console.log(`  ${index + 1}. ${product.id} - ${product.name}`);
        });

        console.log('\nProductIds from last 3:');
        productIds.slice(-3).forEach((productId, index) => {
          console.log(`  ${index + 1}. ${productId}`);
        });
      }

      return {
        products: products.length,
        productIds: productIds.length,
        match: products.length === productIds.length
      };
    } else {
      console.error('❌ Batch document not found');
      return { products: 0, productIds: 0, match: false };
    }
  } catch (error) {
    console.error('❌ DEBUG: Error checking batch:', error);
    return { products: 0, productIds: 0, match: false };
  }
};