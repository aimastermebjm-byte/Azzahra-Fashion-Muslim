import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
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

console.log('🔍 BANDINGKAN batch_1 vs globalIndex:');
console.log('====================================');

async function compareDocuments() {
  try {
    // Cek batch_1
    const batchDoc = await getDoc(doc(db, 'productBatches', 'batch_1'));
    console.log('\n📦 batch_1:');
    if (batchDoc.exists()) {
      const data = batchDoc.data();
      console.log(`   Fields: ${Object.keys(data).join(', ')}`);
      console.log(`   Products: ${data.products?.length || 0}`);
      if (data.products && data.products.length > 0) {
        const sample = data.products[0];
        console.log(`   Sample product: {id: ${sample.id}, name: ${sample.name}, price: ${sample.retailPrice}}`);
      }
      console.log(`   Document size: ${JSON.stringify(data).length} bytes`);
    }

    // Cek globalIndex
    const globalDoc = await getDoc(doc(db, 'productBatches', 'globalIndex'));
    console.log('\n🌐 globalIndex:');
    if (globalDoc.exists()) {
      const data = globalDoc.data();
      console.log(`   Fields: ${Object.keys(data).join(', ')}`);
      console.log(`   Products: ${data.products?.length || 0}`);
      if (data.products && data.products.length > 0) {
        const sample = data.products[0];
        console.log(`   Sample product: {id: ${sample.id}, name: ${sample.name}, price: ${sample.retailPrice}}`);
      }
      console.log(`   Document size: ${JSON.stringify(data).length} bytes`);
    }

    // Cek mana yang sedang digunakan oleh website
    console.log('\n🎯 ANALISIS PENGGUNAAN:');
    console.log('=======================');

    // Baca file hook untuk melihat mana yang digunakan
    const fs = await import('fs');
    try {
      const hookContent = fs.readFileSync('src/hooks/useFirebaseProductsRealTimeSimple.ts', 'utf8');
      const usesBatch1 = hookContent.includes('batch_1');
      const usesGlobalIndex = hookContent.includes('globalIndex');

      console.log(`Website menggunakan batch_1: ${usesBatch1 ? '✅ YES' : '❌ NO'}`);
      console.log(`Website menggunakan globalIndex: ${usesGlobalIndex ? '✅ YES' : '❌ NO'}`);

      if (hookContent.includes('productBatches')) {
        const match = hookContent.match(/doc\(db, ['"]productBatches['"], ['"]([^'"]+)['"]\)/g);
        if (match) {
          console.log(`Documents yang diakses: ${match.map(m => m.match(/['"]([^'"]+)['"]$/)[1]).join(', ')}`);
        }
      }
    } catch (e) {
      console.log('Tidak bisa membaca file hook');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

compareDocuments();