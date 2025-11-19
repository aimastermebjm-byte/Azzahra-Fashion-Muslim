import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyB6kH2pY3H8HvXKo0q3A8SdZFnY0QYrD8Q",
  authDomain: "azzahra-fashion-muslim-ab416.firebaseapp.com",
  projectId: "azzahra-fashion-muslim-ab416",
  storageBucket: "azzahra-fashion-muslim-ab416.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789012345678"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

function isBase64(str) {
  const base64Patterns = [
    /^data:image\/[a-zA-Z]+;base64,/,
    /^data:application\/octet-stream;base64,/
  ];
  return base64Patterns.some(pattern => pattern.test(str));
}

async function cleanupRemainingBase64() {
  console.log('🧹 Cleaning up remaining base64 images...');

  try {
    const productsRef = collection(db, 'products');
    const querySnapshot = await getDocs(productsRef);

    let cleanedCount = 0;
    let checkedCount = 0;

    for (const productDoc of querySnapshot.docs) {
      const productId = productDoc.id;
      const productData = productDoc.data();
      checkedCount++;

      console.log(`\n📋 Checking product ${checkedCount}: ${productData.name || 'No name'}`);

      const updates = {};
      let needsUpdate = false;

      // Check main image field
      if (productData.image && isBase64(productData.image)) {
        console.log(`  🧹 Cleaning main image (base64 detected)`);
        updates.image = '/placeholder-product.jpg';
        needsUpdate = true;
      }

      // Check images array
      if (productData.images && Array.isArray(productData.images)) {
        const cleanedImages = productData.images.filter(img => !isBase64(img));
        if (cleanedImages.length !== productData.images.length) {
          console.log(`  🧹 Cleaning images array: ${productData.images.length} → ${cleanedImages.length}`);
          updates.images = cleanedImages;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        console.log(`  💾 Updating product ${productId}...`);
        await updateDoc(doc(db, 'products', productId), updates);
        cleanedCount++;
        console.log(`  ✅ Updated successfully`);
      } else {
        console.log(`  ✅ Product clean - no updates needed`);
      }
    }

    console.log(`\n🎉 Cleanup Complete!`);
    console.log(`📊 Total products checked: ${checkedCount}`);
    console.log(`🧹 Products cleaned: ${cleanedCount}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

cleanupRemainingBase64();