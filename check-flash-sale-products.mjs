import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
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

console.log('🔍 Checking Flash Sale Products...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkFlashSaleProducts() {
  try {
    // 1. Check flash sale config
    console.log('\n📋 Flash Sale Config Status:');
    console.log('==============================');
    const flashSaleDoc = await getDoc(doc(db, 'flashSale', 'config'));

    if (flashSaleDoc.exists()) {
      const config = flashSaleDoc.data();
      const now = new Date().getTime();
      const endTime = new Date(config.endTime).getTime();
      const hasEnded = now > endTime;
      const isActive = config.isActive && !hasEnded;

      console.log(`🔥 Status: ${isActive ? 'ACTIVE' : 'INACTIVE'}`);
      console.log(`⏰ End Time: ${new Date(config.endTime).toLocaleString('id-ID')}`);
      console.log(`⏳ Time Left: ${hasEnded ? 'EXPIRED' : Math.floor((endTime - now) / 1000 / 60) + ' minutes'}`);
      console.log(`💰 Discount: ${config.flashSaleDiscount}%`);
    } else {
      console.log('❌ Flash sale config not found');
      return;
    }

    // 2. Check products in batch
    console.log('\n📦 Products in Batch System:');
    console.log('==============================');
    const batchRef = collection(db, 'productBatches');
    const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
    const batchSnapshot = await getDocs(batchQuery);

    if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
      const batchData = batchSnapshot.docs[0].data();
      const allProducts = batchData.products || [];

      console.log(`📊 Total Products: ${allProducts.length}`);

      // Find flash sale products
      const flashSaleProducts = allProducts.filter(product => product.isFlashSale);
      const featuredProducts = allProducts.filter(product => product.isFeatured);

      console.log(`🔥 Flash Sale Products: ${flashSaleProducts.length}`);
      console.log(`⭐ Featured Products: ${featuredProducts.length}`);

      if (flashSaleProducts.length > 0) {
        console.log('\n🔥 Flash Sale Products List:');
        flashSaleProducts.forEach((product, index) => {
          console.log(`   ${index + 1}. ${product.name}`);
          console.log(`      💰 Price: Rp${(product.flashSalePrice || product.price || 0).toLocaleString('id-ID')}`);
          console.log(`      📦 Stock: ${product.stock || 0}`);
          console.log(`      🖼️ Image: ${product.image ? '✅' : '❌'}`);
        });
      } else {
        console.log('\n❌ No flash sale products found!');
        console.log('💡 To add flash sale products:');
        console.log('   1. Set product.isFlashSale = true');
        console.log('   2. Set product.flashSalePrice (harga diskon)');
        console.log('   3. Update batch system');
      }

    } else {
      console.log('❌ Batch system not found');
    }

  } catch (error) {
    console.error('❌ Error checking flash sale products:', error);
  }
}

checkFlashSaleProducts();