import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

console.log('🔄 Syncing Flash Sale Status from Batch to Admin...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function syncBatchToAdmin() {
  try {
    // 1. Get flash sale products from batch system
    console.log('\n📦 Reading flash sale products from batch system...');
    const batchRef = collection(db, 'productBatches');
    const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
    const batchSnapshot = await getDocs(batchQuery);

    if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
      const batchData = batchSnapshot.docs[0].data();
      const allProducts = batchData.products || [];

      const flashSaleProducts = allProducts.filter(product => product.isFlashSale);
      console.log(`✅ Found ${flashSaleProducts.length} flash sale products in batch system`);

      if (flashSaleProducts.length === 0) {
        console.log('❌ No flash sale products found in batch system');
        return;
      }

      // 2. Update individual products to match batch system
      console.log('\n🔄 Updating individual products to match batch system...');
      let updatedCount = 0;

      for (const batchProduct of flashSaleProducts) {
        try {
          const productRef = doc(db, 'products', batchProduct.id);

          await updateDoc(productRef, {
            isFlashSale: batchProduct.isFlashSale,
            flashSalePrice: batchProduct.flashSalePrice,
            originalRetailPrice: batchProduct.originalRetailPrice,
            flashSaleDiscount: batchProduct.flashSaleDiscount || 30
          });

          console.log(`✅ Updated admin product: ${batchProduct.name}`);
          console.log(`   💰 Flash Sale Price: Rp${batchProduct.flashSalePrice.toLocaleString('id-ID')}`);
          console.log(`   🏷️ Discount: ${batchProduct.flashSaleDiscount || 30}%`);

          updatedCount++;

        } catch (error) {
          console.error(`❌ Error updating product ${batchProduct.id}:`, error);
        }
      }

      // 3. Remove flash sale from products that shouldn't have it
      const nonFlashSaleProducts = allProducts.filter(product => !product.isFlashSale);
      console.log(`\n🧹 Removing flash sale from ${nonFlashSaleProducts.length} products...`);

      for (const batchProduct of nonFlashSaleProducts) {
        try {
          const productRef = doc(db, 'products', batchProduct.id);

          await updateDoc(productRef, {
            isFlashSale: false,
            flashSalePrice: null,
            originalRetailPrice: null,
            flashSaleDiscount: null
          });

          console.log(`❌ Removed flash sale from: ${batchProduct.name}`);

        } catch (error) {
          console.log(`⚠️ Product ${batchProduct.id} may not exist in individual collection`);
        }
      }

      console.log(`\n🎉 Sync Complete!`);
      console.log('==================================');
      console.log(`✅ Updated ${updatedCount} products with flash sale status`);
      console.log(`🧹 Cleaned flash sale from non-flash sale products`);
      console.log(`📊 Total products processed: ${allProducts.length}`);
      console.log('\n📝 Next Steps:');
      console.log('1. Refresh admin dashboard');
      console.log('2. Flash sale indicators should now appear');
      console.log('3. Admin can now see and manage flash sale products');

    } else {
      console.log('❌ Batch system not found');
    }

  } catch (error) {
    console.error('❌ Error syncing batch to admin:', error);
  }
}

syncBatchToAdmin();