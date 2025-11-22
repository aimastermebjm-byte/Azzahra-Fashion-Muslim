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

console.log('🧹 FORCE CLEAN: Complete Flash Sale Reset...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function forceCleanFlashSale() {
  try {
    // 1. Get current batch
    const batchRef = collection(db, 'productBatches');
    const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
    const batchSnapshot = await getDocs(batchQuery);

    if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
      const batchDoc = batchSnapshot.docs[0];
      const batchData = batchDoc.data();
      let products = batchData.products || [];

      console.log(`📦 Current batch has ${products.length} products`);

      // 2. AGGRESSIVE: Remove ALL flash sale properties from ALL products
      let updatedCount = 0;
      products = products.map(product => {
        if (product.isFlashSale || product.flashSalePrice || product.flashSaleDiscount) {
          updatedCount++;
          console.log(`🧹 Force cleaning flash sale from: ${product.name}`);

          // Remove ALL flash sale properties
          const { isFlashSale, flashSalePrice, flashSaleDiscount, originalRetailPrice, ...cleanProduct } = product;
          return cleanProduct;
        }
        return product;
      });

      // 3. Update the batch with aggressive cleanup
      await setDoc(doc(db, 'productBatches', 'batch_1'), {
        ...batchData,
        products: products,
        hasFlashSale: false, // Explicitly set to false
        totalProducts: products.length,
        updatedAt: new Date().toISOString()
      });

      console.log(`\n🧹 FORCE CLEAN Complete!`);
      console.log('====================================');
      console.log(`✅ Cleaned flash sale from ${updatedCount} products`);
      console.log(`🔥 Flash sale status: FORCE INACTIVE`);
      console.log(`📦 Total products: ${products.length}`);

    } else {
      console.log('❌ Batch system not found');
    }

    // 4. Also force clean individual collection (in case of dual system)
    console.log('\n🔄 Checking individual collection for cleanup...');
    const productsRef = collection(db, 'products');
    const productsSnapshot = await getDocs(productsRef);

    let individualCleanCount = 0;
    for (const doc of productsSnapshot.docs) {
      const data = doc.data();
      if (data.isFlashSale || data.flashSalePrice) {
        await setDoc(doc.ref, {
          ...data,
          isFlashSale: false,
          flashSalePrice: null,
          flashSaleDiscount: null,
          originalRetailPrice: null
        }, { merge: true });
        individualCleanCount++;
        console.log(`🧹 Cleaned individual product: ${data.name}`);
      }
    }

    if (individualCleanCount > 0) {
      console.log(`✅ Cleaned ${individualCleanCount} individual products`);
    }

    // 5. Force deactivate flash sale config
    console.log('\n🔥 Force deactivating flash sale config...');
    await setDoc(doc(db, 'flashSale', 'config'), {
      id: 'config',
      isActive: false,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      products: [],
      flashSaleDiscount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log(`\n✅ ALL SYSTEMS CLEAN!`);
    console.log('====================================');
    console.log(`🧹 Batch system: ${updatedCount} products cleaned`);
    console.log(`🧹 Individual collection: ${individualCleanCount} products cleaned`);
    console.log(`🔥 Flash sale config: FORCE INACTIVE`);
    console.log('\n📝 Admin Dashboard is now ready for fresh flash sale setup!');

  } catch (error) {
    console.error('❌ Error force cleaning flash sale:', error);
  }
}

forceCleanFlashSale();