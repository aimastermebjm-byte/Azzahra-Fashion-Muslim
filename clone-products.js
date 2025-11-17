// Clone existing products - SAFE MODE
// Run di Firebase Console atau local development

// Import Firebase modules (sesuaikan dengan environment Anda)
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './src/utils/firebaseClient';

async function cloneProducts() {
  try {
    console.log('🔄 Starting product cloning...');

    // 1. Get all existing products
    const productsRef = collection(db, 'products');
    const querySnapshot = await getDocs(productsRef);

    console.log(`📦 Found ${querySnapshot.docs.length} existing products`);

    // 2. Clone each product dengan modifications
    for (let i = 0; i < querySnapshot.docs.length; i++) {
      const doc = querySnapshot.docs[i];
      const originalData = doc.data();

      // 3. Create cloned product
      const clonedProduct = {
        // Clone semua fields yang ada
        ...originalData,

        // Override untuk clone
        name: `${originalData.name || 'Product'} (Clone ${i + 1})`,
        description: `${originalData.description || ''} - Clone ${i + 1}`,

        // Reset fields yang perlu diubah
        salesCount: 0, // Reset sales count
        createdAt: serverTimestamp(), // New timestamp

        // Biarkan fields yang sama
        retailPrice: originalData.retailPrice || 0,
        resellerPrice: originalData.resellerPrice || 0,
        costPrice: originalData.costPrice || 0,
        stock: originalData.stock || 0,
        variants: originalData.variants || {},
        images: originalData.images || [],
        category: originalData.category || 'uncategorized',
        weight: originalData.weight || 0,
        unit: originalData.unit || 'gram',
        status: originalData.status || 'ready',

        // Flags (sesuaikan kebutuhan testing)
        isFeatured: false, // Set false dulu
        isFlashSale: false, // Set false dulu
        flashSalePrice: originalData.flashSalePrice || 0,
        featuredOrder: 0
      };

      // 4. Add cloned product
      const docRef = await addDoc(productsRef, clonedProduct);
      console.log(`✅ Cloned product created: ${docRef.id} - ${clonedProduct.name}`);
    }

    console.log('🎉 All products cloned successfully!');
    console.log(`📊 Total products now: ${querySnapshot.docs.length * 2}`);

  } catch (error) {
    console.error('❌ Error cloning products:', error);
  }
}

// RUN THE SCRIPT
cloneProducts();