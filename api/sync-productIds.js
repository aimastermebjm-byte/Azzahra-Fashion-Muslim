/**
 * Force sync productIds array to match products array
 * Run this script to fix the mismatch
 */
import { initializeApp, cert } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import fs from 'fs';

// This script would need service account credentials to run
// For now, let's create a client-side solution

async function fixProductIdsSync() {
  console.log('🔧 Starting productIds sync fix...');

  // This should be called from your AdminProductsPage
  // Add this function call after successful product addition

  return `
To fix the productIds mismatch, you need to:

1. Go to AdminProductsPage in your app
2. Find the handleAddProduct function
3. Add this code after successful addProduct:

const syncProductIds = async () => {
  try {
    const batchRef = doc(db, 'productBatches', 'batch_1');
    const batchSnapshot = await getDoc(batchRef);

    if (batchSnapshot.exists()) {
      const batchData = batchSnapshot.data();
      const products = batchData.products || [];

      // Extract all product IDs from products array
      const productIdsFromProducts = products.map(p => p.id);

      console.log('🔍 Current products length:', products.length);
      console.log('🔍 Current productIds length:', (batchData.productIds || []).length);
      console.log('🔍 Product IDs from products:', productIdsFromProducts);

      // Update batch with sync'd productIds
      await setDoc(batchRef, {
        ...batchData,
        productIds: productIdsFromProducts,
        totalProducts: products.length,
        updatedAt: new Date().toISOString()
      });

      console.log('✅ productIds sync completed!');
      console.log(\`✅ Updated productIds count: \${productIdsFromProducts.length}\`);
    } else {
      console.error('❌ Batch document not found');
    }
  } catch (error) {
    console.error('❌ Error syncing productIds:', error);
  }
};

// Call this function manually from browser console:
// await syncProductIds();
  `;
}

console.log(fixProductIdsSync());