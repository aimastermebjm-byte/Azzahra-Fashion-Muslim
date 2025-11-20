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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const analyzeProductSize = async () => {
  try {
    console.log('📊 Product Size Analysis');
    console.log('================================');

    const batchRef = collection(db, 'productBatches');
    const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
    const batchSnapshot = await getDocs(batchQuery);

    if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
      const batchData = batchSnapshot.docs[0].data();
      const allProducts = batchData.products || [];

      console.log('📦 Current Batch Data:');
      console.log('Total products:', allProducts.length);

      // Calculate document size
      const batchJsonSize = JSON.stringify(batchData).length;
      const avgProductSize = batchJsonSize / allProducts.length;

      console.log('Batch document size:', Math.round(batchJsonSize / 1024), 'KB');
      console.log('Average product size:', Math.round(avgProductSize), 'bytes');
      console.log('Average product size (KB):', (avgProductSize / 1024).toFixed(2), 'KB');

      // Firebase limit: 1MB per document (1,048,576 bytes)
      const maxCapacity = Math.floor(1048576 / avgProductSize);
      console.log('\n🎯 Capacity Analysis:');
      console.log('Maximum products per batch:', maxCapacity);
      console.log('Recommended per batch:', Math.floor(maxCapacity * 0.8), '(80% safety margin)');

      console.log('\n📈 Size Projections:');
      console.log('50 products  ≈', Math.round(50 * avgProductSize / 1024), 'KB');
      console.log('100 products ≈', Math.round(100 * avgProductSize / 1024), 'KB');
      console.log('150 products ≈', Math.round(150 * avgProductSize / 1024), 'KB');
      console.log('200 products ≈', Math.round(200 * avgProductSize / 1024), 'KB');
      console.log('300 products ≈', Math.round(300 * avgProductSize / 1024), 'KB');
      console.log('500 products ≈', Math.round(500 * avgProductSize / 1024), 'KB');

      // Safety margin calculations
      console.log('\n🛡️ Safety Margin Analysis:');
      console.log('100 products (70% margin) ≈', Math.round(100 * avgProductSize / 1024 * 0.7), 'KB usage');
      console.log('150 products (60% margin) ≈', Math.round(150 * avgProductSize / 1024 * 0.6), 'KB usage');
      console.log('200 products (50% margin) ≈', Math.round(200 * avgProductSize / 1024 * 0.5), 'KB usage');

      // Check sample product structure
      if (allProducts.length > 0) {
        const sampleProduct = allProducts[0];
        console.log('\n🔍 Sample Product Structure:');
        console.log('Total fields:', Object.keys(sampleProduct).length);
        console.log('Images count:', sampleProduct.images ? sampleProduct.images.length : 0);
        console.log('Has variants:', Object.keys(sampleProduct.variants || {}).length > 0);
        console.log('Sample product size:', Math.round(JSON.stringify(sampleProduct).length), 'bytes');
      }

      console.log('\n💡 RECOMMENDATIONS:');
      if (avgProductSize < 2000) {
        console.log('✅ OPTIMAL: 200-300 products per batch');
        console.log('   Very efficient product structure');
      } else if (avgProductSize < 3500) {
        console.log('✅ GOOD: 150-200 products per batch');
        console.log('   Balanced size and performance');
      } else if (avgProductSize < 5000) {
        console.log('⚠️ MODERATE: 100-150 products per batch');
        console.log('   Consider optimizing product data');
      } else {
        console.log('❌ HEAVY: 50-100 products per batch');
        console.log('   Products are too large, needs optimization');
      }

    } else {
      console.log('❌ No batch data found');
    }
  } catch (error) {
    console.error('❌ Error analyzing product size:', error);
  }
};

analyzeProductSize();