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

console.log('🗑️ Removing Flash Sale Products...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function removeFlashSaleProducts() {
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

      // Remove flash sale from all products
      let updatedCount = 0;
      products = products.map(product => {
        if (product.isFlashSale) {
          updatedCount++;
          console.log(`❌ Removing flash sale from: ${product.name}`);

          // Remove flash sale properties
          const { isFlashSale, flashSalePrice, flashSaleDiscount, ...cleanProduct } = product;
          return cleanProduct;
        }
        return product;
      });

      // Update the batch
      await setDoc(doc(db, 'productBatches', 'batch_1'), {
        ...batchData,
        products: products,
        hasFlashSale: false, // Update flag
        totalProducts: products.length,
        updatedAt: new Date().toISOString()
      });

      console.log(`\n🗑️ Flash Sale Products Removed!`);
      console.log('====================================');
      console.log(`✅ Removed flash sale from ${updatedCount} products`);
      console.log(`🔥 Flash sale status: INACTIVE`);
      console.log(`📦 Total products: ${products.length}`);

      // Also set flash sale config to inactive
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

      console.log(`\n📝 Next Steps for Admin Dashboard:`);
      console.log('1. Login sebagai admin');
      console.log('2. Pilih produk yang mau dijadikan flash sale');
      console.log('3. Set isFlashSale = true');
      console.log('4. Set flashSalePrice (harga diskon)');
      console.log('5. Produk akan otomatis muncul di flash sale section');

    } else {
      console.log('❌ Batch system not found');
    }

  } catch (error) {
    console.error('❌ Error removing flash sale products:', error);
  }
}

removeFlashSaleProducts();