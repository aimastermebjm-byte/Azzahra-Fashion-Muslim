import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
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

console.log('🕒 Checking flash sale time-based cleanup...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkFlashSaleTimeout() {
  try {
    // 1. Check flash sale config
    console.log('\n🔥 Checking flash sale config...');
    const configRef = doc(db, 'flashSale', 'config');
    const configSnapshot = await getDoc(configRef);

    if (!configSnapshot.exists()) {
      console.log('❌ Flash sale config not found');
      return;
    }

    const config = configSnapshot.data();
    const now = new Date();
    const endTime = new Date(config.endTime);

    console.log('⏰ Time Analysis:');
    console.log('   Current time:', now.toISOString());
    console.log('   End time:', endTime.toISOString());
    console.log('   Is active:', config.isActive);
    console.log('   Is expired:', now > endTime);

    // 2. If flash sale is expired, clean up products
    if (config.isActive && now > endTime) {
      console.log('\n🧹 Flash sale EXPIRED - Starting automatic cleanup...');

      // Get batch system
      const batchRef = collection(db, 'productBatches');
      const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
      const batchSnapshot = await getDocs(batchQuery);

      if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
        const batchDoc = batchSnapshot.docs[0];
        const batchData = batchDoc.data();
        let products = batchData.products || [];

        console.log(`📦 Processing ${products.length} products...`);

        // Clean up flash sale flags from expired products
        let cleanedCount = 0;
        products = products.map(product => {
          if (product.isFlashSale || product.flashSalePrice || product.flashSaleDiscount) {
            cleanedCount++;
            console.log(`🔧 Cleaning flash sale from: ${product.name}`);

            // Remove flash sale properties, keep everything else
            const { isFlashSale, flashSalePrice, flashSaleDiscount, originalRetailPrice, originalResellerPrice, ...cleanProduct } = product;
            return cleanProduct;
          }
          return product;
        });

        // Update batch
        await setDoc(doc(db, 'productBatches', 'batch_1'), {
          ...batchData,
          products: products,
          totalProducts: products.length,
          updatedAt: new Date().toISOString()
        });

        console.log(`✅ Cleaned ${cleanedCount} products from flash sale`);

        // Deactivate flash sale config
        await setDoc(doc(db, 'flashSale', 'config'), {
          ...config,
          isActive: false,
          updatedAt: new Date().toISOString()
        });

        console.log('✅ Flash sale config deactivated');
        console.log('🎉 Automatic cleanup completed!');

      } else {
        console.log('❌ Batch system not found');
      }
    } else if (!config.isActive) {
      console.log('ℹ️ Flash sale already inactive');
    } else {
      console.log('⏳ Flash sale still active');
    }

  } catch (error) {
    console.error('❌ Error during flash sale timeout check:', error);
  }
}

checkFlashSaleTimeout();