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

console.log('🔄 Quick Sync Flash Sale to Batch...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function quickSync() {
  try {
    // Get individual flash sale products
    const productsRef = collection(db, 'products');
    const productsQuery = query(productsRef, where('isFlashSale', '==', true));
    const productsSnapshot = await getDocs(productsQuery);

    const flashSaleProducts = [];
    productsSnapshot.forEach((doc) => {
      const data = doc.data();
      flashSaleProducts.push({ id: doc.id, ...data });
    });

    console.log(`Found ${flashSaleProducts.length} flash sale products in individual collection`);

    if (flashSaleProducts.length === 0) {
      console.log('❌ No flash sale products found');
      return;
    }

    // Get batch and update
    const batchRef = collection(db, 'productBatches');
    const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
    const batchSnapshot = await getDocs(batchQuery);

    if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
      const batchDoc = batchSnapshot.docs[0];
      const batchData = batchDoc.data();
      let allProducts = batchData.products || [];

      console.log(`Current batch has ${allProducts.length} products`);

      // Update batch products with flash sale info
      let updatedCount = 0;
      allProducts = allProducts.map(product => {
        const flashSaleInfo = flashSaleProducts.find(fp => fp.id === product.id);

        if (flashSaleInfo) {
          updatedCount++;
          console.log(`🔥 Updating: ${product.name}`);
          return {
            ...product,
            isFlashSale: true,
            flashSalePrice: flashSaleInfo.flashSalePrice,
            originalRetailPrice: flashSaleInfo.originalRetailPrice || product.retailPrice,
            flashSaleDiscount: flashSaleInfo.flashSaleDiscount || 30
          };
        }
        return product;
      });

      // Update batch
      await setDoc(doc(db, 'productBatches', 'batch_1'), {
        ...batchData,
        products: allProducts,
        hasFlashSale: true,
        totalProducts: allProducts.length,
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ Updated ${updatedCount} products in batch system!`);
      console.log('🔥 Flash sale should now appear on website');
      console.log('\n📝 Next Steps:');
      console.log('1. Refresh browser kamu');
      console.log('2. Flash sale products should now appear');
      console.log('3. Check homepage and flash sale page');

    } else {
      console.log('❌ Batch system not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

quickSync();