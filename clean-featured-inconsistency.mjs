import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanFeaturedInconsistency() {
  console.log('🧹 Cleaning featured products inconsistency in Firestore...\n');

  try {
    // Get batch_1
    const batchRef = doc(db, 'productBatches', 'batch_1');
    const batchDoc = await getDoc(batchRef);

    if (batchDoc.exists()) {
      const batchData = batchDoc.data();
      let products = batchData.products || [];

      console.log(`📦 Found ${products.length} products in batch_1`);

      // Find and fix inconsistent featured flags
      let updatedCount = 0;
      products = products.map((product) => {
        const isFeaturedNew = Boolean(product.isFeatured);
        const featuredOld = Boolean(product.featured);

        // If there's inconsistency, prioritize isFeatured and remove old featured field
        if (isFeaturedNew !== featuredOld) {
          console.log(`🔧 Fixing inconsistency for: ${product.name}`);
          console.log(`   Before: isFeatured=${product.isFeatured}, featured=${product.featured}`);

          // Remove old featured field and keep only isFeatured
          const updatedProduct = { ...product };
          delete updatedProduct.featured;

          console.log(`   After: isFeatured=${updatedProduct.isFeatured}, featured=REMOVED`);
          console.log('---');

          updatedCount++;
          return updatedProduct;
        }

        return product;
      });

      if (updatedCount > 0) {
        // Update batch with cleaned data
        await setDoc(doc(db, 'productBatches', 'batch_1'), {
          ...batchData,
          products: products,
          totalProducts: products.length,
          updatedAt: new Date().toISOString(),
          lastCleaned: new Date().toISOString()
        });

        console.log(`✅ Updated ${updatedCount} products with inconsistent featured flags`);
      } else {
        console.log('✅ No inconsistencies found - all products have consistent featured flags');
      }

    } else {
      console.log('❌ batch_1 document not found');
    }

  } catch (error) {
    console.error('❌ Error cleaning Firestore:', error);
  }
}

cleanFeaturedInconsistency();