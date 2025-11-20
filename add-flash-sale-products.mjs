import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, setDoc } from 'firebase/firestore';
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

console.log('🔥 Adding Flash Sale Products...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addFlashSaleProducts() {
  try {
    // Get current batch data
    const batchRef = collection(db, 'productBatches');
    const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
    const batchSnapshot = await getDocs(batchQuery);

    if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
      const batchDoc = batchSnapshot.docs[0];
      const batchData = batchDoc.data();
      let products = batchData.products || [];

      console.log(`📦 Current products: ${products.length}`);

      // Add flash sale to first 3 products with discount
      const flashSaleUpdates = [
        { index: 0, name: 'Gamis Muslimah Elegant', discount: 0.3 }, // 30% discount
        { index: 1, name: 'Koko Premium Modern', discount: 0.25 }, // 25% discount
        { index: 2, name: 'Hijab Syari Premium', discount: 0.35 } // 35% discount
      ];

      let updatedCount = 0;
      flashSaleUpdates.forEach(({ index, name, discount }) => {
        if (products[index]) {
          const originalPrice = products[index].retailPrice || products[index].price || 0;
          const flashSalePrice = Math.round(originalPrice * (1 - discount));

          products[index] = {
            ...products[index],
            isFlashSale: true,
            flashSalePrice: flashSalePrice,
            originalRetailPrice: originalPrice,
            flashSaleDiscount: Math.round(discount * 100)
          };

          console.log(`✅ Added flash sale for: ${name}`);
          console.log(`   💰 Original: Rp${originalPrice.toLocaleString('id-ID')}`);
          console.log(`   🔥 Flash Sale: Rp${flashSalePrice.toLocaleString('id-ID')}`);
          console.log(`   💵 Discount: ${Math.round(discount * 100)}%`);

          updatedCount++;
        }
      });

      // Update the batch
      await setDoc(doc(db, 'productBatches', 'batch_1'), {
        ...batchData,
        products: products,
        hasFlashSale: true,
        totalProducts: products.length,
        updatedAt: new Date().toISOString()
      });

      console.log(`\n🎉 Flash Sale Products Added!`);
      console.log('==================================');
      console.log(`✅ Updated ${updatedCount} products to flash sale`);
      console.log(`🔥 Flash sale status: ACTIVE`);
      console.log(`⏰ Duration: 24 hours`);
      console.log('\n📝 Next Steps:');
      console.log('1. Refresh browser kamu');
      console.log('2. Flash sale products akan muncul di home & flash sale page');
      console.log('3. Timer countdown akan berjalan');
      console.log('4. Produk akan hilang otomatis saat waktu berakhir');

    } else {
      console.log('❌ Batch system not found');
    }

  } catch (error) {
    console.error('❌ Error adding flash sale products:', error);
  }
}

addFlashSaleProducts();