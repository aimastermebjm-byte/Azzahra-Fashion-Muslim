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

console.log('🔍 Checking batch system for remaining flash sale flags...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkBatchFlags() {
  try {
    const batchRef = collection(db, 'productBatches');
    const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
    const batchSnapshot = await getDocs(batchQuery);

    if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
      const batchData = batchSnapshot.docs[0].data();
      const allProducts = batchData.products || [];

      console.log(`📦 Total products in batch: ${allProducts.length}`);

      // Check for any remaining flash sale flags
      const problematicProducts = allProducts.filter(product =>
        product.isFlashSale === true ||
        product.flashSalePrice > 0 ||
        product.flashSaleDiscount > 0
      );

      if (problematicProducts.length > 0) {
        console.log(`❌ FOUND ${problematicProducts.length} PRODUCTS WITH FLASH SALE FLAGS:`);
        problematicProducts.forEach((product, index) => {
          console.log(`   ${index + 1}. ${product.name}`);
          console.log(`      isFlashSale: ${product.isFlashSale}`);
          console.log(`      flashSalePrice: ${product.flashSalePrice}`);
          console.log(`      flashSaleDiscount: ${product.flashSaleDiscount}`);
        });
      } else {
        console.log('✅ No flash sale flags found in batch system');
      }

    } else {
      console.log('❌ Batch system not found');
    }

  } catch (error) {
    console.error('❌ Error checking batch flags:', error);
  }
}

checkBatchFlags();