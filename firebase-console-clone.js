// FIREBASE CONSOLE SAFE CLONE SCRIPT
// 1. Buka Firebase Console → Firestore Database
// 2. Klik "Run Query"
// 3. Paste script ini

async function cloneProductsSafely() {
  console.log('🔄 Starting SAFE product cloning...');

  try {
    // 1. Get all existing products
    const productsSnapshot = await db.collection('products').get();
    console.log(`📦 Found ${productsSnapshot.docs.length} existing products`);

    // 2. Create temporary array for batch
    const batch = db.batch();
    const productsRef = db.collection('products');

    // 3. Clone each product safely
    productsSnapshot.docs.forEach((doc, index) => {
      const originalData = doc.data();

      // Create cloned product with modifications
      const clonedProduct = {
        // Copy all fields
        ...originalData,

        // Override for clone identification
        name: `${originalData.name || 'Product'} (Clone ${index + 1})`,
        description: `${originalData.description || ''} - Clone ${index + 1}`,

        // Reset fields for clean testing
        salesCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),

        // Flags
        isFeatured: false,
        isFlashSale: false,
        featuredOrder: 0
      };

      // Add to batch
      const newDocRef = productsRef.doc();
      batch.set(newDocRef, clonedProduct);

      console.log(`✅ Preparing clone: ${clonedProduct.name}`);
    });

    // 4. Execute batch (max 500 operations)
    await batch.commit();
    console.log('🎉 All products cloned successfully!');
    console.log(`📊 Total products now: ${productsSnapshot.docs.length * 2}`);

    // 5. Verify results
    const verifySnapshot = await db.collection('products').get();
    console.log(`✅ Verification: ${verifySnapshot.docs.length} total products`);

  } catch (error) {
    console.error('❌ Error during cloning:', error);
  }
}

// RUN THE SAFE CLONE
cloneProductsSafely();