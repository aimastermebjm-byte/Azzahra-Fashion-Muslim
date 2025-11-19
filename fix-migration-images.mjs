import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
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

console.log('🔧 Fixing Migration: Add Images to Batch...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getPublicImageUrl(imageUrl) {
  if (!imageUrl) return '/placeholder-product.jpg';

  // If it's already a full URL, return as is
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }

  // If it's a Firebase Storage path, convert to public URL
  if (imageUrl.startsWith('gs://') || imageUrl.startsWith('product-images/')) {
    const bucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET;
    const baseUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/`;
    const encodedPath = encodeURIComponent(imageUrl);
    return `${baseUrl}${encodedPath}?alt=media`;
  }

  // If it's a relative path starting with /, assume it's from public folder
  if (imageUrl.startsWith('/')) {
    return imageUrl;
  }

  return imageUrl;
}

async function fixMigrationImages() {
  try {
    console.log('\n📥 Step 1: Reading original products...');
    const productsRef = collection(db, 'products');
    const querySnapshot = await getDocs(productsRef);

    const allProducts = [];
    querySnapshot.forEach((doc) => {
      const productData = {
        id: doc.id,
        ...doc.data()
      };

      // 🔥 FIX: Handle both 'image' and 'images' fields
      if (productData.images && Array.isArray(productData.images) && productData.images.length > 0) {
        // Use first image from images array
        productData.image = getPublicImageUrl(productData.images[0]);
        console.log(`✅ ${productData.name}: Using first image from array`);
      } else if (productData.image) {
        // Use existing image field
        productData.image = getPublicImageUrl(productData.image);
        console.log(`✅ ${productData.name}: Using existing image field`);
      } else {
        // Use placeholder
        productData.image = '/placeholder-product.jpg';
        console.log(`⚠️ ${productData.name}: No image found, using placeholder`);
      }

      allProducts.push(productData);
    });

    console.log(`\n📊 Processed ${allProducts.length} products`);

    // Sort by createdAt (terbaru dulu)
    allProducts.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });

    console.log('\n📦 Step 2: Updating batch_1 with corrected images...');

    const batchData = {
      batchNumber: 1,
      totalProducts: allProducts.length,
      createdAt: new Date(),
      products: allProducts,
      minPrice: Math.min(...allProducts.map(p => p.price || p.retailPrice || 0)),
      maxPrice: Math.max(...allProducts.map(p => p.price || p.retailPrice || 0)),
      hasFlashSale: allProducts.some(p => p.isFlashSale),
      hasFeatured: allProducts.some(p => p.isFeatured),
      productIds: allProducts.map(p => p.id)
    };

    console.log(`\n📊 Batch Data Summary:`);
    console.log(`   - Total Products: ${batchData.totalProducts}`);
    console.log(`   - Price Range: Rp${batchData.minPrice.toLocaleString('id-ID')} - Rp${batchData.maxPrice.toLocaleString('id-ID')}`);
    console.log(`   - Flash Sale: ${batchData.hasFlashSale ? '✅' : '❌'}`);
    console.log(`   - Featured: ${batchData.hasFeatured ? '✅' : '❌'}`);

    // Check image statistics
    const withImages = allProducts.filter(p => p.image && p.image !== '/placeholder-product.jpg').length;
    const withPlaceholders = allProducts.filter(p => p.image === '/placeholder-product.jpg').length;

    console.log(`\n🖼️ Image Statistics:`);
    console.log(`   - With images: ${withImages}/${allProducts.length}`);
    console.log(`   - Using placeholders: ${withPlaceholders}/${allProducts.length}`);

    // Write to Firestore
    await setDoc(doc(db, 'productBatches', 'batch_1'), batchData);

    console.log('\n🎉 Batch Migration Fixed!');
    console.log('\n✅ Next Steps:');
    console.log('1. Refresh your browser (http://localhost:5002)');
    console.log('2. Check console for: "✅ BATCH SUCCESS"');
    console.log('3. Products should now display images correctly');

  } catch (error) {
    console.error('❌ Error fixing migration:', error);
  }
}

fixMigrationImages();