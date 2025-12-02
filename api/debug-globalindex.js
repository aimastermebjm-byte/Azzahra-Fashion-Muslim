/**
 * Debug script to check globalindex collection
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

// Firebase config - use your actual config
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "azzahra-fashion-muslim-ab416.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "azzahra-fashion-muslim-ab416",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "azzahra-fashion-muslim-ab416.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.FIREBASE_APP_ID || "1:123456789:web:abcdef123"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkGlobalIndex() {
  try {
    console.log('🔍 Checking globalindex collection...');

    const globalIndexRef = collection(db, 'globalindex');
    const globalIndexSnapshot = await getDocs(globalIndexRef);

    console.log(`📊 Found ${globalIndexSnapshot.docs.length} documents in globalindex`);

    globalIndexSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n📦 Product ${index + 1}:`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  Name: ${data.name || 'No name'}`);
      console.log(`  Category: ${data.category || 'No category'}`);
      console.log(`  Price: ${data.retailPrice || data.price || 0}`);
      console.log(`  Stock: ${data.stock || 0}`);
      console.log(`  Status: ${data.status || 'unknown'}`);
      console.log(`  Created: ${data.createdAt || data.lastSyncedAt || 'unknown'}`);
      console.log(`  Image: ${data.image ? 'Yes' : 'No'}`);
    });

    // Check for specific product IDs from logs
    const productIds = [
      'product_1764662100866_88rm9rfa1',
      'product_1764660943231_jgmo9b9k4'
    ];

    console.log('\n🔍 Checking for specific products from logs:');
    productIds.forEach(productId => {
      const productDoc = doc(db, 'globalindex', productId);
      getDoc(productDoc).then(snapshot => {
        if (snapshot.exists()) {
          console.log(`✅ Found ${productId} in globalindex`);
        } else {
          console.log(`❌ Missing ${productId} in globalindex`);
        }
      }).catch(error => {
        console.log(`🚨 Error checking ${productId}:`, error.message);
      });
    });

  } catch (error) {
    console.error('🚨 Error checking globalindex:', error);
  }
}

async function checkProductBatches() {
  try {
    console.log('\n🔍 Checking productBatches collection...');

    const batchRef = doc(db, 'productBatches', 'batch_1');
    const batchSnapshot = await getDoc(batchRef);

    if (batchSnapshot.exists()) {
      const batchData = batchSnapshot.data();
      const products = batchData.products || [];
      const productIds = batchData.productIds || [];

      console.log(`📊 Batch products: ${products.length}`);
      console.log(`📊 Batch productIds: ${productIds.length}`);

      // Show last 3 products
      products.slice(-3).forEach((product, index) => {
        console.log(`\n📦 Batch Product ${index + 1} (recent):`);
        console.log(`  ID: ${product.id}`);
        console.log(`  Name: ${product.name || 'No name'}`);
        console.log(`  Price: ${product.retailPrice || product.price || 0}`);
        console.log(`  Status: ${product.status || 'unknown'}`);
      });
    } else {
      console.log('❌ Batch document not found');
    }
  } catch (error) {
    console.error('🚨 Error checking productBatches:', error);
  }
}

async function main() {
  console.log('🚀 Starting globalindex debug...');

  await checkGlobalIndex();
  await checkProductBatches();

  console.log('\n✅ Debug completed');
  process.exit(0);
}

main().catch(console.error);