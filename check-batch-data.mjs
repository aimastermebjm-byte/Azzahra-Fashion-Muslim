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

console.log('🔍 Checking Batch Data...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkBatchData() {
  try {
    const batchRef = collection(db, 'productBatches');
    const q = query(batchRef, where('__name__', '==', 'batch_1'));
    const batchSnapshot = await getDocs(q);

    if (!batchSnapshot.empty) {
      const batchData = batchSnapshot.docs[0].data();
      const products = batchData.products || [];

      console.log(`📦 Batch 1 Analysis:`);
      console.log(`   - Total Products: ${products.length}`);

      // Check first 3 products for image URLs
      console.log(`\n🖼️ Image URL Analysis (First 5 Products):`);
      products.slice(0, 5).forEach((product, index) => {
        console.log(`\n${index + 1}. ${product.name || 'No Name'}`);
        console.log(`   - Image URL: ${product.image || 'No Image'}`);
        console.log(`   - Image Type: ${typeof product.image}`);

        if (product.image) {
          if (product.image.startsWith('http')) {
            console.log(`   - ✅ Valid URL: ${product.image.substring(0, 50)}...`);
          } else if (product.image.startsWith('/')) {
            console.log(`   - ✅ Local Path: ${product.image}`);
          } else if (product.image.startsWith('gs://')) {
            console.log(`   - ⚠️ Firebase Storage Path: ${product.image}`);
            console.log(`   - 🔧 Needs conversion to public URL`);
          } else {
            console.log(`   - ❌ Invalid image format`);
          }
        } else {
          console.log(`   - ❌ No image field`);
        }
      });

      // Check for any base64 images
      const base64Count = products.filter(p =>
        p.image && p.image.startsWith('data:image')
      ).length;

      if (base64Count > 0) {
        console.log(`\n⚠️ Found ${base64Count} products with base64 images`);
      }

      // Check for Firebase Storage paths
      const storageCount = products.filter(p =>
        p.image && p.image.startsWith('gs://')
      ).length;

      if (storageCount > 0) {
        console.log(`\n⚠️ Found ${storageCount} products with Firebase Storage paths`);
        console.log(`🔧 These need to be converted to public URLs`);
      }

    } else {
      console.log('❌ Batch 1 not found');
    }

  } catch (error) {
    console.error('❌ Error checking batch data:', error);
  }
}

checkBatchData();