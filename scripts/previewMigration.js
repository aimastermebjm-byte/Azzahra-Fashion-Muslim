// READ-ONLY PREVIEW SCRIPT - TIDAK MENGUBAH DATA
// Script ini hanya untuk melihat data produk yang ada dan memprediksi perubahan

import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Load environment variables
dotenv.config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TARGET_CONFIG = {
  sizes: ['Ukuran 1', 'Ukuran 2'],
  colors: ['A', 'B', 'C', 'D'],
  stockPerVariant: 5
};

async function previewMigration() {
  console.log('🔍 PREVIEW MODE - TIDAK MENGUBAH DATA');
  console.log('=====================================');

  try {
    // Get all products
    const productsRef = collection(db, 'products');
    const querySnapshot = await getDocs(productsRef);

    const totalProducts = querySnapshot.docs.length;
    console.log(`📊 Total produk ditemukan: ${totalProducts}`);
    console.log('');

    // Analyze each product
    let hasVariantProducts = 0;
    let hasFeaturedProducts = 0;
    let hasFlashSaleProducts = 0;
    let needsMigrationProducts = 0;

    console.log('📋 Analisis Produk:');
    console.log('==================');

    querySnapshot.forEach((docSnapshot, index) => {
      const productData = docSnapshot.data();
      const productId = docSnapshot.id;

      // Check critical fields
      const hasVariants = productData.variants;
      const hasSizes = hasVariants && productData.variants.sizes && productData.variants.sizes.length > 0;
      const hasColors = hasVariants && productData.variants.colors && productData.variants.colors.length > 0;
      const hasVariantStock = hasVariants && productData.variants.stock && Object.keys(productData.variants.stock).length > 0;
      const isFeatured = productData.isFeatured || productData.featured;
      const isFlashSale = productData.isFlashSale;

      if (isFeatured) hasFeaturedProducts++;
      if (isFlashSale) hasFlashSaleProducts++;
      if (hasSizes) hasVariantProducts++;

      // Check if migration needed
      const needsMigration = !hasVariantStock ||
        (hasSizes && productData.variants.sizes.length !== TARGET_CONFIG.sizes.length) ||
        (hasColors && productData.variants.colors.length !== TARGET_CONFIG.colors.length);

      if (needsMigration) needsMigrationProducts++;

      console.log(`${index + 1}. ${productData.name || 'Unnamed Product'}`);
      console.log(`   ID: ${productId}`);
      console.log(`   Status: ${isFeatured ? '⭐ FEATURED' : ''} ${isFlashSale ? '🔥 FLASH SALE' : ''}`);
      console.log(`   Current variants: ${hasSizes ? productData.variants.sizes.join(', ') : 'None'} | Colors: ${hasColors ? productData.variants.colors.join(', ') : 'None'}`);
      console.log(`   Has variant stock: ${hasVariantStock ? '✅' : '❌'}`);
      console.log(`   Current stock: ${productData.stock || 0}`);

      if (needsMigration) {
        const currentStock = productData.stock || 0;
        const newTotalStock = TARGET_CONFIG.sizes.length * TARGET_CONFIG.colors.length * TARGET_CONFIG.stockPerVariant;
        console.log(`   ⚠️  NEEDS MIGRATION`);
        console.log(`   📊 Stock akan berubah: ${currentStock} → ${newTotalStock}`);
      }
      console.log('');
    });

    // Summary
    console.log('📊 SUMMARY:');
    console.log('============');
    console.log(`Total produk: ${totalProducts}`);
    console.log(`Produk dengan variants: ${hasVariantProducts}`);
    console.log(`Produk FEATURED: ${hasFeaturedProducts}`);
    console.log(`Produk FLASH SALE: ${hasFlashSaleProducts}`);
    console.log(`Produk perlu migration: ${needsMigrationProducts}`);
    console.log('');
    console.log('⚠️  PERHATIAN:');
    console.log('- Script ini TIDAK mengubah data apapun');
    console.log('- Ini hanya preview untuk analisis');
    console.log('- Featured products dan Flash Sale akan DIPERTAHANKAN');
    console.log('');
    console.log('📋 RENCANA MIGRATION:');
    console.log(`- Semua produk akan memiliki: ${TARGET_CONFIG.sizes.join(', ')}`);
    console.log(`- Semua produk akan memiliki: ${TARGET_CONFIG.colors.join(', ')}`);
    console.log(`- Stok per varian: ${TARGET_CONFIG.stockPerVariant}`);
    console.log(`- Total stok per produk: ${TARGET_CONFIG.sizes.length * TARGET_CONFIG.colors.length * TARGET_CONFIG.stockPerVariant}`);

  } catch (error) {
    console.error('❌ Preview failed:', error);
    process.exit(1);
  }
}

// Run preview
previewMigration().then(() => {
  console.log('');
  console.log('✨ Preview completed');
  console.log('Jika Anda yakin, jalankan migration script yang sebenarnya');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Preview error:', error);
  process.exit(1);
});