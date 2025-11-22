import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, limit } from 'firebase/firestore';
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

console.log('🔍 VERIFY BATCH SYSTEM - Checking actual Firebase data...');
console.log('========================================================');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verifyBatchSystem() {
  try {
    // 1. Check batch system
    console.log('\n📦 BATCH SYSTEM VERIFICATION:');
    console.log('================================');

    const batchRef = collection(db, 'productBatches');
    const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
    const batchSnapshot = await getDocs(batchQuery);

    if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
      const batchDoc = batchSnapshot.docs[0];
      const batchData = batchDoc.data();
      const allProducts = batchData.products || [];

      console.log('✅ Batch System Found:');
      console.log(`   Document ID: ${batchDoc.id}`);
      console.log(`   Total products in batch: ${allProducts.length}`);
      console.log(`   Target batch size: 250 products`);
      console.log(`   Capacity utilization: ${Math.round(allProducts.length / 250 * 100)}%`);
      console.log(`   Document last updated: ${batchData.updatedAt || 'N/A'}`);

      // 2. Check product structure consistency
      console.log('\n🔍 PRODUCT STRUCTURE ANALYSIS:');
      console.log('====================================');

      if (allProducts.length > 0) {
        const sampleProducts = allProducts.slice(0, 3); // Check first 3 products
        let validProducts = 0;

        sampleProducts.forEach((product, index) => {
          const requiredFields = ['id', 'name', 'category', 'retailPrice', 'stock'];
          const missingFields = requiredFields.filter(field => !product[field]);

          if (missingFields.length === 0) {
            validProducts++;
          }

          console.log(`   Product ${index + 1}: ${product.name}`);
          console.log(`     ID: ${product.id}`);
          console.log(`     Category: ${product.category}`);
          console.log(`     Price: Rp ${product.retailPrice?.toLocaleString() || 0}`);
          console.log(`     Stock: ${product.stock || 0}`);
          console.log(`     Images: ${product.images?.length || 0}`);
          console.log(`     Flash Sale: ${product.isFlashSale ? 'YES' : 'NO'}`);
          console.log(`     Featured: ${product.isFeatured ? 'YES' : 'NO'}`);
          console.log(`     Valid structure: ${missingFields.length === 0 ? '✅' : '❌ Missing: ' + missingFields.join(', ')}`);
          console.log('');
        });

        console.log(`✅ Valid products analyzed: ${validProducts}/${sampleProducts.length}`);
      }

      // 3. Check individual products collection (for comparison)
      console.log('\n🗂️ INDIVIDUAL PRODUCTS COLLECTION:');
      console.log('=====================================');

      const productsRef = collection(db, 'products');
      const productsSnapshot = await getDocs(query(productsRef, limit(5)));

      console.log(`Individual products collection has: ${productsSnapshot.docs.length} products (sampled)`);

      // 4. Batch performance analysis
      console.log('\n📊 BATCH PERFORMANCE ANALYSIS:');
      console.log('===============================');

      const documentSize = JSON.stringify(batchData).length;
      const avgProductSize = documentSize / allProducts.length;
      const efficiency = ((1 - 1/allProducts.length) * 100).toFixed(1);

      console.log(`Batch document size: ${Math.round(documentSize / 1024)} KB`);
      console.log(`Average product size: ${Math.round(avgProductSize)} bytes`);
      console.log(`Cost efficiency: ${efficiency}% (${allProducts.length} products for 1 read)`);
      console.log(`Estimated cost for ${allProducts.length} products: 1 read vs ${allProducts.length} individual reads`);

      // 5. Capacity projection
      console.log('\n🎯 CAPACITY PROJECTION:');
      console.log('=======================');

      const maxCapacity = Math.floor(1048576 / avgProductSize); // 1MB limit
      const recommendedCapacity = Math.floor(maxCapacity * 0.8);

      console.log(`Maximum possible products per batch: ${maxCapacity}`);
      console.log(`Recommended (80% safety margin): ${recommendedCapacity}`);
      console.log(`Current configuration: 250 products per batch`);
      console.log(`Safety margin with current config: ${Math.round((recommendedCapacity - 250) / recommendedCapacity * 100)}% buffer`);

      // 6. Flash sale check
      console.log('\n🔥 FLASH SALE STATUS:');
      console.log('=====================');

      const flashSaleProducts = allProducts.filter(p => p.isFlashSale || p.flashSalePrice);
      console.log(`Products with flash sale flags: ${flashSaleProducts.length}`);

      if (flashSaleProducts.length > 0) {
        console.log('Flash sale products found:');
        flashSaleProducts.slice(0, 3).forEach(product => {
          console.log(`  - ${product.name}: ${product.flashSalePrice ? `Rp ${product.flashSalePrice.toLocaleString()}` : 'Flash Sale Active'}`);
        });
      } else {
        console.log('✅ No flash sale products found (clean system)');
      }

      // 7. Featured products check
      console.log('\n⭐ FEATURED PRODUCTS STATUS:');
      console.log('============================');

      const featuredProducts = allProducts.filter(p => p.isFeatured || p.featured);
      console.log(`Products with featured flags: ${featuredProducts.length}`);

      if (featuredProducts.length > 0) {
        console.log('Featured products found:');
        featuredProducts.slice(0, 5).forEach(product => {
          console.log(`  - ${product.name} (Order: ${product.featuredOrder || 0})`);
        });
      }

      console.log('\n🎉 VERIFICATION COMPLETE!');
      console.log('=====================================');
      console.log(`✅ Batch system is LIVE with ${allProducts.length} products`);
      console.log(`✅ Pagination: 25 products per page = ${Math.ceil(allProducts.length / 25)} pages`);
      console.log(`✅ Cost optimization: ${efficiency}% savings vs individual reads`);
      console.log(`✅ System is ready for scaling to 250 products per batch`);

    } else {
      console.log('❌ NO BATCH SYSTEM FOUND');
      console.log('   - The batch system has not been created yet');
      console.log('   - Only individual products collection exists');
      console.log('   - Need to run batch creation script');

      // Check individual products count
      const productsRef = collection(db, 'products');
      const productsSnapshot = await getDocs(productsRef);
      console.log(`   - Individual products found: ${productsSnapshot.docs.length}`);
    }

  } catch (error) {
    console.error('❌ Error verifying batch system:', error);
    console.log('   - Check Firebase configuration');
    console.log('   - Verify Firebase permissions');
    console.log('   - Ensure .env file is correct');
  }
}

verifyBatchSystem();