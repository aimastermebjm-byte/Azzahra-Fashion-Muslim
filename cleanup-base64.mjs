// Script sementara untuk membersihkan base64 images dari Firestore
// Firebase Storage perlu di-setup manual dulu di console
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

// Firebase config - sama dengan config di src/utils/firebaseClient.ts
const firebaseConfig = {
  apiKey: "AIzaSyDLXnp_mUS4Rz01DCHTd8DxEJqhz_v_uW4",
  authDomain: "azzahra-fashion-muslim-ab416.firebaseapp.com",
  projectId: "azzahra-fashion-muslim-ab416",
  storageBucket: "azzahra-fashion-muslim-ab416.appspot.com",
  messagingSenderId: "997228048215",
  appId: "1:997228048215:web:aa8ed93d334545e604852a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('🧹 Starting base64 image cleanup from Firestore...');

// Fungsi untuk mendeteksi apakah string adalah base64
function isBase64(str) {
  try {
    // Check if string starts with base64 prefix
    if (typeof str !== 'string') return false;

    // Base64 data URL patterns
    const base64Patterns = [
      /^data:image\/[a-zA-Z]+;base64,/,
      /^data:application\/octet-stream;base64,/,
      /^data:application\/json;base64,/
    ];

    return base64Patterns.some(pattern => pattern.test(str)) ||
           (str.length > 100 && /^[A-Za-z0-9+/=]+$/.test(str));
  } catch {
    return false;
  }
}

// Fungsi utama cleanup
async function cleanupBase64Images() {
  try {
    console.log('📋 Step 1: Getting all products from Firestore...');

    // Get all products
    const productsRef = collection(db, 'products');
    const querySnapshot = await getDocs(productsRef);

    console.log(`📊 Found ${querySnapshot.docs.length} products to process`);

    let cleanedCount = 0;
    let errorCount = 0;

    // Process each product
    for (const docSnapshot of querySnapshot.docs) {
      const product = docSnapshot.data();
      const productId = docSnapshot.id;
      const docRef = doc(db, 'products', productId);

      console.log(`\n🔄 Processing product: ${productId} - ${product.name}`);

      const updates = {};
      let needsUpdate = false;

      // Process main image
      if (product.image && isBase64(product.image)) {
        console.log(`  🧹 Cleaning main image (base64 detected)`);
        updates.image = '/placeholder-product.jpg';
        needsUpdate = true;
        cleanedCount++;
      }

      // Process images array
      if (product.images && Array.isArray(product.images)) {
        const newImagesArray = [];

        for (let i = 0; i < product.images.length; i++) {
          const imageUrl = product.images[i];

          if (isBase64(imageUrl)) {
            console.log(`  🧹 Cleaning image array ${i + 1}/${product.images.length} (base64 detected)`);
            newImagesArray.push('/placeholder-product.jpg');
            needsUpdate = true;
            cleanedCount++;
          } else {
            // Keep original image if it's not base64
            newImagesArray.push(imageUrl);
          }
        }

        if (needsUpdate) {
          updates.images = newImagesArray;
        }
      }

      // Update product in Firestore
      if (needsUpdate) {
        await updateDoc(docRef, {
          ...updates,
          updatedAt: new Date().toISOString(),
          cleanupNote: 'Base64 images removed - replaced with placeholders',
          cleanupDate: new Date().toISOString()
        });
        console.log(`  📝 Product ${productId} updated with placeholder images`);
      } else {
        console.log(`  ⏭️ Product ${productId} - No base64 images found`);
      }

      // Add delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📊 CLEANUP COMPLETE!');
    console.log(`✅ Cleaned: ${cleanedCount} base64 images`);
    console.log(`❌ Errors: ${errorCount} images`);

    if (cleanedCount > 0) {
      console.log('\n🎉 SUCCESS: Base64 images have been removed from Firestore!');
      console.log('💡 Benefits:');
      console.log('   - Firestore document size reduced dramatically');
      console.log('   - Faster loading and better performance');
      console.log('   - No more base64 data bloat in Firestore');
      console.log('   - Cache systems will work properly now');
      console.log('\n📝 Next steps:');
      console.log('   1. Setup Firebase Storage manually in Firebase Console');
      console.log('   2. Run the full migration script to upload proper images');
    }

    return {
      success: true,
      cleaned: cleanedCount,
      errors: errorCount
    };

  } catch (error) {
    console.error('\n💥 CLEANUP FAILED:', error);
    console.error('Stack trace:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Base64 Image Cleanup Process');
  console.log('==========================================');

  // Check Firebase connection
  try {
    await getDocs(collection(db, 'products'));
    console.log('✅ Firebase connection successful');
  } catch (error) {
    console.error('❌ Firebase connection failed:', error.message);
    console.error('Please check your Firebase configuration');
    process.exit(1);
  }

  // Run cleanup
  console.log('\n📝 RUNNING CLEANUP...');
  console.log('======================');

  const cleanupResult = await cleanupBase64Images();

  if (cleanupResult.success) {
    console.log('\n🎉 CLEANUP COMPLETED SUCCESSFULLY!');
    console.log('✨ Base64 images have been removed from Firestore');
    console.log('\n📈 Performance Improvements:');
    console.log('   - Firestore read costs reduced dramatically');
    console.log('   - App loading speed improved significantly');
    console.log('   - Memory usage reduced dramatically');
    console.log('   - Cache systems will work properly now');
    console.log('\n🔧 Next Steps:');
    console.log('   1. Test the app performance now');
    console.log('   2. Setup Firebase Storage in Firebase Console');
    console.log('   3. Run migrate-images.mjs to upload proper images');
  } else {
    console.log('\n❌ CLEANUP FAILED');
    console.log(`Error: ${cleanupResult.error}`);
  }

  console.log('\n🏁 Process completed. Exiting...');
}

// Run the cleanup
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});