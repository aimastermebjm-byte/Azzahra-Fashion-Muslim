import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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

console.log('🔍 Checking Original Products...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkOriginalProducts() {
  try {
    const productsRef = collection(db, 'products');
    const productsSnapshot = await getDocs(productsRef);

    console.log(`📦 Original Products Analysis:`);
    console.log(`   - Total Products: ${productsSnapshot.size}`);

    // Check first 5 products for image URLs
    let count = 0;
    productsSnapshot.forEach((doc) => {
      if (count >= 5) return;

      const product = doc.data();
      console.log(`\n${count + 1}. ${product.name || 'No Name'} (ID: ${doc.id})`);
      console.log(`   - Image URL: ${product.image || 'No Image'}`);
      console.log(`   - Image Type: ${typeof product.image}`);
      console.log(`   - All Fields: ${Object.keys(product).join(', ')}`);

      if (product.image) {
        if (product.image.startsWith('http')) {
          console.log(`   - ✅ Valid URL`);
        } else if (product.image.startsWith('/')) {
          console.log(`   - ✅ Local Path`);
        } else if (product.image.startsWith('data:')) {
          console.log(`   - ⚠️ Base64 Image`);
        } else {
          console.log(`   - ❓ Unknown format: ${product.image.substring(0, 30)}...`);
        }
      } else {
        console.log(`   - ❌ No image field`);
      }

      count++;
    });

    // Count products with images
    const withImages = productsSnapshot.docs.filter(doc => doc.data().image).length;
    console.log(`\n📊 Summary:`);
    console.log(`   - Products with images: ${withImages}/${productsSnapshot.size}`);
    console.log(`   - Products without images: ${productsSnapshot.size - withImages}`);

  } catch (error) {
    console.error('❌ Error checking original products:', error);
  }
}

checkOriginalProducts();