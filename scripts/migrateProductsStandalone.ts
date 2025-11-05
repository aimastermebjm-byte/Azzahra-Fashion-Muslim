/**
 * STANDALONE PRODUCT MIGRATION SCRIPT
 *
 * Script ini untuk normalisasi data produk di Firestore
 * tanpa dependency dari src/ folder
 */

import { initializeApp } from 'firebase/app';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

// Initialize Firebase dengan hardcoded config
const firebaseConfig = {
  apiKey: "AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs",
  authDomain: "azzahra-fashion-muslim-ab416.firebaseapp.com",
  projectId: "azzahra-fashion-muslim-ab416",
  storageBucket: "azzahra-fashion-muslim-ab416.firebasestorage.app",
  messagingSenderId: "822661485961",
  appId: "1:822661485961:web:4603488d8bef0119f3fd58"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Normalisasi data produk untuk consistency dengan interface Product
 */
const normalizeProductData = (data: any) => {
  const retailPrice = Number(data.retailPrice || data.price || 0);
  const stock = Number(data.stock || 0);

  return {
    // Standardize field names
    retailPrice: retailPrice,
    // Remove: price (gunakan retailPrice)
    price: null,

    // Fix variants structure
    variants: {
      sizes: data.sizes || data.variants?.sizes || [],
      colors: data.colors || data.variants?.colors || [],
      stock: data.variants?.stock || {}
    },
    // Remove: separate sizes & colors arrays
    sizes: null,
    colors: null,

    // Standardize status field
    status: data.status ||
      (data.condition === 'baru' ? 'ready' : 'po') ||
      (stock > 0 ? 'ready' : 'po'),
    // Remove: condition field
    condition: null,

    // Ensure required fields
    weight: Number(data.weight) || 1000,
    unit: data.unit || 'gram',
    createdAt: data.createdAt || new Date(),

    // Keep both featured fields for consistency
    featured: Boolean(data.isFeatured || data.featured),
    isFeatured: Boolean(data.isFeatured || data.featured),

    // Other fields remain unchanged
    name: data.name || '',
    description: data.description || '',
    category: data.category || 'uncategorized',
    images: data.images || [],
    resellerPrice: Number(data.resellerPrice) || retailPrice * 0.8,
    costPrice: Number(data.costPrice) || retailPrice * 0.6,
    isFlashSale: Boolean(data.isFlashSale),
    flashSalePrice: Number(data.flashSalePrice) || retailPrice,
    originalRetailPrice: Number(data.originalRetailPrice) || retailPrice,
    originalResellerPrice: Number(data.originalResellerPrice) || retailPrice * 0.8,
    salesCount: Number(data.salesCount) || 0,
    featuredOrder: Number(data.featuredOrder) || 0,
    estimatedReady: data.estimatedReady || null
  };
};

/**
 * Main migration function
 */
export const migrateAllProducts = async () => {
  console.log('🚀 Starting product data migration...');

  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);

    let migratedCount = 0;
    let errorCount = 0;

    console.log(`📊 Found ${snapshot.docs.length} products to migrate`);

    for (const docSnapshot of snapshot.docs) {
      try {
        const data = docSnapshot.data();
        const normalizedData = normalizeProductData(data);

        await updateDoc(doc(db, 'products', docSnapshot.id), normalizedData);

        migratedCount++;
        console.log(`✅ Migrated product: ${data.name} (${docSnapshot.id})`);

      } catch (error) {
        errorCount++;
        console.error(`❌ Error migrating product ${docSnapshot.id}:`, error);
      }
    }

    console.log(`\n🎉 Migration complete!`);
    console.log(`✅ Successfully migrated: ${migratedCount} products`);
    console.log(`❌ Failed migrations: ${errorCount} products`);

    return { migratedCount, errorCount };

  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
};

/**
 * Preview migration changes without applying
 */
export const previewMigration = async () => {
  console.log('🔍 Previewing migration changes...');

  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);

    const changes = [];

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();

      const changesNeeded = [];

      // Check what needs to be changed
      if (data.price && !data.retailPrice) {
        changesNeeded.push(`price(${data.price}) → retailPrice`);
      }
      if (data.sizes && !data.variants?.sizes) {
        changesNeeded.push(`sizes → variants.sizes`);
      }
      if (data.colors && !data.variants?.colors) {
        changesNeeded.push(`colors → variants.colors`);
      }
      if (data.condition && !data.status) {
        changesNeeded.push(`condition(${data.condition}) → status`);
      }

      if (changesNeeded.length > 0) {
        changes.push({
          id: docSnapshot.id,
          name: data.name,
          changes: changesNeeded
        });
      }
    }

    console.log(`📋 Products that need migration: ${changes.length}`);
    changes.forEach(change => {
      console.log(`  • ${change.name}: ${change.changes.join(', ')}`);
    });

    return changes;

  } catch (error) {
    console.error('❌ Preview failed:', error);
    throw error;
  }
};