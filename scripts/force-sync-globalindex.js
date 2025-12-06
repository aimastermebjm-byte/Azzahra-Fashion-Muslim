/**
 * Force Sync Script - Sync all products from batch_1 to globalindex
 * Run this when products are missing from globalindex collection
 * 
 * Usage:
 *   node scripts/force-sync-globalindex.js
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  clientEmail: `firebase-adminsdk@${process.env.VITE_FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID
  });
}

const db = admin.firestore();

async function forceSyncAllProducts() {
  try {
    console.log('🔄 Starting force sync from batch_1 to globalindex...\n');

    // Get batch_1 document
    const batchRef = db.collection('productBatches').doc('batch_1');
    const batchSnapshot = await batchRef.get();

    if (!batchSnapshot.exists) {
      console.error('❌ Batch document not found!');
      process.exit(1);
    }

    const batchData = batchSnapshot.data();
    const products = batchData.products || [];

    console.log(`📊 Found ${products.length} products in batch_1\n`);

    // Get current globalindex documents
    const globalIndexSnapshot = await db.collection('globalindex').get();
    const existingIds = new Set(globalIndexSnapshot.docs.map(doc => doc.id));

    console.log(`📊 Current globalindex has ${existingIds.size} documents\n`);

    let syncCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Sync each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      try {
        const globalIndexRef = db.collection('globalindex').doc(product.id);
        
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
          createdAt: product.createdAt || admin.firestore.Timestamp.now(),
          salesCount: Number(product.salesCount) || 0,
          reviews: Number(product.reviews) || 0,
          rating: Number(product.rating) || 0,
          
          // Physical properties
          weight: Number(product.weight) || 0,
          unit: product.unit || 'pcs',
          
          // Sync tracking
          lastSyncedAt: admin.firestore.Timestamp.now(),
          syncSource: 'force-sync-script',
          syncedFrom: 'batch_1'
        };

        // Write to globalindex
        await globalIndexRef.set(globalIndexData, { merge: true });
        
        syncCount++;
        const wasNew = !existingIds.has(product.id);
        
        console.log(`${wasNew ? '🆕' : '✅'} [${i + 1}/${products.length}] ${product.id} - ${product.name}`);

      } catch (error) {
        errorCount++;
        console.error(`❌ [${i + 1}/${products.length}] Failed to sync ${product.id}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully synced: ${syncCount} products`);
    console.log(`❌ Errors: ${errorCount} products`);
    console.log(`📦 Total in batch_1: ${products.length} products`);
    console.log('='.repeat(60) + '\n');

    // Verify final count
    const finalSnapshot = await db.collection('globalindex').get();
    console.log(`🔍 VERIFICATION: GlobalIndex now has ${finalSnapshot.docs.length} documents\n`);

    if (syncCount === products.length && errorCount === 0) {
      console.log('✅ ✅ ✅ ALL PRODUCTS SYNCED SUCCESSFULLY! ✅ ✅ ✅\n');
    } else {
      console.log('⚠️ Some products failed to sync. Check errors above.\n');
    }

  } catch (error) {
    console.error('❌ Fatal error during force sync:', error);
    process.exit(1);
  }
}

// Run the sync
forceSyncAllProducts()
  .then(() => {
    console.log('✅ Force sync completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Force sync failed:', error);
    process.exit(1);
  });
