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

console.log('🔥 FINAL CLEAN: Removing stubborn flash sale flags...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function finalizeCleanFlashSale() {
  try {
    // 1. Get and completely clean the batch system
    console.log('\n📦 Final cleaning batch system...');
    const batchRef = collection(db, 'productBatches');
    const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
    const batchSnapshot = await getDocs(batchQuery);

    if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
      const batchDoc = batchSnapshot.docs[0];
      const batchData = batchDoc.data();
      let products = batchData.products || [];

      console.log(`📦 Current batch has ${products.length} products`);

      // AGGRESSIVE: Remove ANY flash sale traces
      let updatedCount = 0;
      products = products.map(product => {
        // Check for ANY flash sale related properties
        const hasFlashSale = product.isFlashSale || product.flashSalePrice || product.flashSaleDiscount || product.originalRetailPrice;

        if (hasFlashSale) {
          updatedCount++;
          console.log(`🔥 Removing ALL flash sale traces from: ${product.name}`);
          console.log(`   Before: isFlashSale=${product.isFlashSale}, flashSalePrice=${product.flashSalePrice}, flashSaleDiscount=${product.flashSaleDiscount}`);

          // Return completely clean product
          const cleanProduct = {
            id: product.id,
            name: product.name,
            description: product.description || '',
            category: product.category || 'uncategorized',
            retailPrice: Number(product.retailPrice || product.price || 0),
            resellerPrice: Number(product.resellerPrice || 0) || Number(product.retailPrice || product.price || 0) * 0.8,
            costPrice: Number(product.costPrice || 0) || Number(product.retailPrice || product.price || 0) * 0.6,
            stock: Number(product.stock || 0),
            images: product.images || [],
            image: product.images?.[0] || '/placeholder-product.jpg',
            variants: product.variants || {},
            isFeatured: Boolean(product.isFeatured || product.featured),
            // ALL flash sale properties removed
            createdAt: product.createdAt ? new Date(product.createdAt) : new Date(),
            salesCount: Number(product.salesCount) || 0,
            featuredOrder: Number(product.featuredOrder) || 0,
            weight: Number(product.weight || 0),
            unit: product.unit || 'gram',
            status: product.status || 'ready',
            estimatedReady: product.estimatedReady ? new Date(product.estimatedReady) : null
          };

          console.log(`   After: Flash sale properties completely removed`);
          return cleanProduct;
        }
        return product;
      });

      // Update batch with completely clean products
      await setDoc(doc(db, 'productBatches', 'batch_1'), {
        ...batchData,
        products: products,
        hasFlashSale: false, // Explicitly false
        totalProducts: products.length,
        updatedAt: new Date().toISOString()
      });

      console.log(`\n✅ Batch system completely cleaned!`);
      console.log('====================================');
      console.log(`🔥 Removed flash sale from ${updatedCount} products`);
      console.log(`📦 Total products: ${products.length}`);
      console.log(`❌ hasFlashSale flag: ${products.filter(p => p.isFlashSale || p.flashSalePrice || p.flashSaleDiscount).length} products`);

    } else {
      console.log('❌ Batch system not found');
    }

    // 2. Force deactivate flash sale config
    console.log('\n🔥 Final flash sale config cleanup...');
    await setDoc(doc(db, 'flashSale', 'config'), {
      id: 'config',
      isActive: false,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(), // Same time = immediately expired
      products: [],
      flashSaleDiscount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log(`✅ Flash sale config completely deactivated!`);

    console.log('\n🎉 FLASH SALE CLEANUP COMPLETE!');
    console.log('====================================');
    console.log('✅ All flash sale traces removed from batch system');
    console.log('✅ Flash sale config deactivated');
    console.log('✅ Website should no longer show flash sale products');
    console.log('\n📝 Ready for fresh flash sale setup from admin dashboard!');

  } catch (error) {
    console.error('❌ Error during final cleanup:', error);
  }
}

finalizeCleanFlashSale();