// Bulk Migration Script for All Products
// This script will update all products in Firestore to have:
// - 2 sizes: "Ukuran 1", "Ukuran 2"
// - 4 colors: "A", "B", "C", "D"
// - Each variant: 5 stock
// - Total stock: 2 × 4 × 5 = 40

import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';

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

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Missing Firebase configuration. Please check your .env file.');
  console.log('Required environment variables:');
  console.log('- VITE_FIREBASE_API_KEY');
  console.log('- VITE_FIREBASE_AUTH_DOMAIN');
  console.log('- VITE_FIREBASE_PROJECT_ID');
  console.log('- VITE_FIREBASE_STORAGE_BUCKET');
  console.log('- VITE_FIREBASE_MESSAGING_SENDER_ID');
  console.log('- VITE_FIREBASE_APP_ID');
  console.log('- VITE_FIREBASE_MEASUREMENT_ID');
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const MIGRATION_CONFIG = {
  sizes: ['Ukuran 1', 'Ukuran 2'],
  colors: ['A', 'B', 'C', 'D'],
  stockPerVariant: 5
};

async function migrateAllProducts() {
  console.log('🚀 Starting bulk migration of all products...');

  try {
    // Get all products
    const productsRef = collection(db, 'products');
    const querySnapshot = await getDocs(productsRef);

    const totalProducts = querySnapshot.docs.length;
    console.log(`📊 Found ${totalProducts} products to migrate`);

    if (totalProducts === 0) {
      console.log('ℹ️ No products found to migrate');
      return;
    }

    // Process in batches of 500 (Firestore limit)
    const batchSize = 500;
    const batches = [];

    for (let i = 0; i < querySnapshot.docs.length; i += batchSize) {
      const batchDocs = querySnapshot.docs.slice(i, i + batchSize);
      const batch = writeBatch(db);

      batchDocs.forEach((docSnapshot) => {
        const productData = docSnapshot.data();
        const docRef = doc(db, 'products', docSnapshot.id);

        // Create variant stock structure
        const variantStock = {};
        MIGRATION_CONFIG.sizes.forEach(size => {
          variantStock[size] = {};
          MIGRATION_CONFIG.colors.forEach(color => {
            variantStock[size][color] = MIGRATION_CONFIG.stockPerVariant;
          });
        });

        // Calculate total stock
        const totalStock = MIGRATION_CONFIG.sizes.length *
                          MIGRATION_CONFIG.colors.length *
                          MIGRATION_CONFIG.stockPerVariant;

        // CRITICAL: HANYA update variants dan stock, PERTAHANKAN semua field lain
        const updatedData = {
          // Preserve ALL existing fields
          name: productData.name,
          description: productData.description,
          category: productData.category,
          retailPrice: productData.retailPrice,
          resellerPrice: productData.resellerPrice,
          costPrice: productData.costPrice,
          images: productData.images,
          status: productData.status,
          isFeatured: productData.isFeatured,
          featured: productData.featured, // Preserve both featured fields
          featuredOrder: productData.featuredOrder,
          isFlashSale: productData.isFlashSale,
          flashSalePrice: productData.flashSalePrice,
          originalRetailPrice: productData.originalRetailPrice,
          originalResellerPrice: productData.originalResellerPrice,
          salesCount: productData.salesCount,
          weight: productData.weight,
          unit: productData.unit,
          estimatedReady: productData.estimatedReady,
          createdAt: productData.createdAt,
          // ONLY UPDATE these fields
          variants: {
            sizes: MIGRATION_CONFIG.sizes,
            colors: MIGRATION_CONFIG.colors,
            stock: variantStock
          },
          stock: totalStock,
          updatedAt: new Date()
        };

        console.log(`📝 Queued update for product: ${productData.name || docSnapshot.id}`);
        console.log(`   ⭐ Featured: ${updatedData.isFeatured || updatedData.featured ? 'YES' : 'NO'}`);
        console.log(`   🔥 Flash Sale: ${updatedData.isFlashSale ? 'YES' : 'NO'}`);

        batch.update(docRef, updatedData);
      });

      batches.push(batch);
    }

    // Commit all batches
    console.log(`🔄 Processing ${batches.length} batches...`);

    for (let i = 0; i < batches.length; i++) {
      console.log(`📦 Committing batch ${i + 1}/${batches.length}...`);
      await batches[i].commit();
      console.log(`✅ Batch ${i + 1} completed`);
    }

    console.log('🎉 All products migrated successfully!');
    console.log(`📊 Migration Summary:`);
    console.log(`   - Products updated: ${totalProducts}`);
    console.log(`   - Sizes per product: ${MIGRATION_CONFIG.sizes.length} (${MIGRATION_CONFIG.sizes.join(', ')})`);
    console.log(`   - Colors per product: ${MIGRATION_CONFIG.colors.length} (${MIGRATION_CONFIG.colors.join(', ')})`);
    console.log(`   - Stock per variant: ${MIGRATION_CONFIG.stockPerVariant}`);
    console.log(`   - Total stock per product: ${MIGRATION_CONFIG.sizes.length * MIGRATION_CONFIG.colors.length * MIGRATION_CONFIG.stockPerVariant}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateAllProducts().then(() => {
  console.log('✨ Migration completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Migration error:', error);
  process.exit(1);
});