import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
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

console.log('🔍 ANALYZING READING SYSTEM...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function analyzeReadingSystem() {
  try {
    console.log('\n📊 BATCH SYSTEM VERIFICATION:');
    console.log('================================');

    // 1. Check if batch_1 exists and has products
    console.log('\n1️⃣ Checking batch_1 data...');
    const batchRef = collection(db, 'productBatches');
    const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
    const batchSnapshot = await getDocs(batchQuery);

    if (!batchSnapshot.empty) {
      const batchData = batchSnapshot.docs[0].data();
      const products = batchData.products || [];

      console.log(`   ✅ batch_1 found with ${products.length} products`);

      // Check if products have image field
      const withImages = products.filter(p => p.image).length;
      console.log(`   🖼️ Products with images: ${withImages}/${products.length}`);

      // Check price range
      if (products.length > 0) {
        const prices = products.map(p => p.price || p.retailPrice || 0).filter(p => p > 0);
        if (prices.length > 0) {
          console.log(`   💰 Price range: Rp${Math.min(...prices).toLocaleString('id-ID')} - Rp${Math.max(...prices).toLocaleString('id-ID')}`);
        }
      }

      // Check for featured products
      const featuredCount = products.filter(p => p.isFeatured).length;
      console.log(`   ⭐ Featured products: ${featuredCount}`);

    } else {
      console.log('   ❌ batch_1 NOT FOUND - System using legacy!');
      return;
    }

    // 2. Simulate what the hook should read
    console.log('\n2️⃣ Simulating batch read...');
    const startTime = Date.now();

    // This is exactly what the hook does
    const batchRef2 = collection(db, 'productBatches');
    const batchQuery2 = query(batchRef2, where('__name__', '==', 'batch_1'));
    const batchSnapshot2 = await getDocs(batchQuery2);

    const endTime = Date.now();
    const readTime = endTime - startTime;

    if (!batchSnapshot2.empty && batchSnapshot2.docs[0].exists()) {
      const batchData = batchSnapshot2.docs[0].data();
      const allProducts = batchData.products || [];

      console.log(`   ✅ Batch read successful`);
      console.log(`   📦 Products loaded: ${allProducts.length}`);
      console.log(`   ⚡ Read time: ${readTime}ms`);
      console.log(`   💰 Firestore reads: 1 (vs ${allProducts.length} individual)`);
      console.log(`   🎯 Cost savings: ${Math.round((allProducts.length - 1) / allProducts.length * 100)}%`);

    } else {
      console.log('   ❌ Batch read failed');
    }

    // 3. Check if UI is actually using batch
    console.log('\n3️⃣ Checking Hook Implementation...');
    console.log('   📝 Hook: useFirebaseProductsRealTimeSimple.ts');
    console.log('   🔍 Check for console messages:');
    console.log('      - "🔄 Loading products from Firestore (BATCH SYSTEM)..."');
    console.log('      - "✅ BATCH SUCCESS: Loaded X products from batch"');
    console.log('      - "💰 Cost savings: X reads saved"');

    console.log('\n📊 EXPECTED BEHAVIOR:');
    console.log('================================');
    console.log('✅ Console should show: "✅ BATCH SUCCESS"');
    console.log('✅ Firestore reads: 1 (not 16!)');
    console.log('✅ All 22 products loaded');
    console.log('✅ Images should display (if URLs are accessible)');

    console.log('\n❌ IF STILL SEEING 16 READS:');
    console.log('================================');
    console.log('1. Hook fallback to legacy system');
    console.log('2. Batch query failed');
    console.log('3. Firebase rules blocking batch access');
    console.log('4. Network issues');

  } catch (error) {
    console.error('❌ Analysis error:', error);
  }
}

analyzeReadingSystem();