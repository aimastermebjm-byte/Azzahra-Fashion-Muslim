import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
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

async function checkFeaturedProducts() {
  console.log('🔍 Checking featured products in Firestore...\n');

  try {
    // Check batch_1
    console.log('📦 Checking batch_1...');
    const batchRef = doc(db, 'productBatches', 'batch_1');
    const batchDoc = await getDoc(batchRef);

    if (batchDoc.exists()) {
      const batchData = batchDoc.data();
      const products = batchData.products || [];

      console.log(`✅ Found ${products.length} products in batch_1\n`);

      // Check for featured products
      const featuredProducts = products.filter(product =>
        product.isFeatured === true || product.featured === true
      );

      console.log(`⭐ Featured products found: ${featuredProducts.length}\n`);

      if (featuredProducts.length > 0) {
        console.log('📋 Featured Products Details:');
        featuredProducts.forEach((product, index) => {
          console.log(`${index + 1}. ID: ${product.id}`);
          console.log(`   Name: ${product.name || 'No name'}`);
          console.log(`   isFeatured: ${product.isFeatured}`);
          console.log(`   featured: ${product.featured}`);
          console.log(`   Category: ${product.category || 'No category'}`);
          console.log(`   Price: ${product.retailPrice || product.price || 'No price'}`);
          console.log('---');
        });
      } else {
        console.log('❌ No featured products found in batch_1');
      }

      // Also check individual fields
      console.log('\n🔍 Detailed product analysis:');
      products.forEach((product, index) => {
        const hasAnyFeaturedFlag = product.isFeatured === true || product.featured === true;
        if (hasAnyFeaturedFlag) {
          console.log(`⭐ Product ${index + 1}: ${product.name} - Featured flags: isFeatured=${product.isFeatured}, featured=${product.featured}`);
        }
      });

    } else {
      console.log('❌ batch_1 document not found');
    }

    // Check if there's a globalIndex
    console.log('\n📊 Checking globalIndex...');
    const globalIndexRef = doc(db, 'productBatches', 'globalIndex');
    const globalIndexDoc = await getDoc(globalIndexRef);

    if (globalIndexDoc.exists()) {
      const globalData = globalIndexDoc.data();
      console.log('✅ Global index found');
      console.log('Featured products in globalIndex:', globalData.featuredProducts || 'None');
    } else {
      console.log('❌ Global index not found');
    }

  } catch (error) {
    console.error('❌ Error checking Firestore:', error);
  }
}

checkFeaturedProducts();