import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, query, where, orderBy, limit } from 'firebase/firestore';
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

console.log('🔍 MONITORING FIRESTORE READ PATTERNS...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let readCount = 0;
const logRead = (operation, description) => {
  readCount++;
  console.log(`📖 READ ${readCount}: ${operation} - ${description}`);
};

async function monitorReads() {
  try {
    console.log('\n🎯 TESTING BATCH SYSTEM (What should happen):');
    console.log('='.repeat(50));

    logRead('BATCH_READ', 'productBatches/batch_1');
    const batchRef = collection(db, 'productBatches');
    const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
    await getDocs(batchQuery);

    console.log(`\n✅ BATCH SYSTEM: ${readCount} reads total`);

    // Reset counter
    readCount = 0;

    console.log('\n⚠️ TESTING LEGACY SYSTEM (What might be happening):');
    console.log('='.repeat(55));

    logRead('LEGACY_1', 'products collection query');
    const productsRef = collection(db, 'products');
    const q = query(productsRef, orderBy('createdAt', 'desc'), limit(20));
    await getDocs(q);

    logRead('LEGACY_2', 'flashSale config');
    const flashSaleRef = doc(db, 'flashSale', 'config');
    await getDoc(flashSaleRef);

    logRead('LEGACY_3', 'another hook maybe');
    await getDoc(flashSaleRef);

    logRead('LEGACY_4', 'featured products query');
    await getDocs(q);

    // Simulate multiple hooks
    for (let i = 5; i <= 16; i++) {
      logRead(`LEGACY_${i}`, 'Additional hook read');
      await getDocs(productsRef);
    }

    console.log(`\n❌ LEGACY SYSTEM: ${readCount} reads total`);

    console.log('\n📊 COMPARISON:');
    console.log('='.repeat(20));
    console.log(`🎯 Batch System: 1 read (ideal)`);
    console.log(`⚠️ Legacy System: ${readCount} reads (current?)`);
    console.log(`💰 Cost Difference: ${readCount - 1} extra reads`);

    console.log('\n🔍 DEBUGGING TIPS:');
    console.log('='.repeat(20));
    console.log('1. Check browser console for:');
    console.log('   ✅ "✅ BATCH SUCCESS: Loaded 22 products from batch"');
    console.log('   ❌ "🔄 Using legacy product system..."');
    console.log('');
    console.log('2. Check if multiple hooks are running:');
    console.log('   - useFirebaseProductsRealTimeSimple');
    console.log('   - useFirebaseProducts');
    console.log('   - useFirebaseFlashSaleSimple');
    console.log('');
    console.log('3. Expected console output for batch system:');
    console.log('   🔄 Loading products from Firestore (BATCH SYSTEM)...');
    console.log('   ✅ BATCH SUCCESS: Loaded 22 products from batch');
    console.log('   💰 Cost savings: 21 reads saved (95%)');

  } catch (error) {
    console.error('❌ Monitoring error:', error);
  }
}

monitorReads();