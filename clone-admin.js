// Node.js Clone Script - Cara Paling Ampuh
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
const serviceAccount = {
  "type": "service_account",
  "project_id": "azzahra-fashion-muslim",
  "private_key": process.env.FIREBASE_PRIVATE_KEY || "YOUR_PRIVATE_KEY_HERE",
  "client_email": "firebase-adminsdk-xxx@azzahra-fashion-muslim.iam.gserviceaccount.com"
};

// Initialize with service account (if available)
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'azzahra-fashion-muslim'
  });
} catch (error) {
  // Fallback to default config
  admin.initializeApp({
    projectId: 'azzahra-fashion-muslim'
  });
}

const db = admin.firestore();

async function cloneProductsAdmin() {
  try {
    console.log('🚀 Starting Firebase Admin product cloning...');

    // 1. Get all existing products
    const productsSnapshot = await db.collection('products').get();
    console.log(`📦 Found ${productsSnapshot.docs.length} existing products`);

    if (productsSnapshot.docs.length === 0) {
      console.log('⚠️ No products found to clone');
      return;
    }

    // 2. Prepare batch operation (max 500)
    const batch = db.batch();
    const productsRef = db.collection('products');

    productsSnapshot.docs.forEach((doc, index) => {
      const originalData = doc.data();

      const clonedProduct = {
        ...originalData,
        name: `${originalData.name || 'Product'} (Clone ${index + 1})`,
        description: `${originalData.description || ''} - Clone ${index + 1}`,
        salesCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isFeatured: false,
        isFlashSale: false,
        featuredOrder: 0
      };

      const newDocRef = productsRef.doc();
      batch.set(newDocRef, clonedProduct);

      console.log(`✅ Preparing clone: ${clonedProduct.name}`);
    });

    // 3. Execute batch
    await batch.commit();
    console.log('🎉 All products cloned successfully!');
    console.log(`📊 Total products now: ${productsSnapshot.docs.length * 2}`);

    // 4. Verify
    const verifySnapshot = await db.collection('products').get();
    console.log(`✅ Verification: ${verifySnapshot.docs.length} total products`);

  } catch (error) {
    console.error('❌ Error during admin cloning:', error);
  }
}

// RUN THE CLONE
cloneProductsAdmin().then(() => {
  console.log('✅ Clone process completed');
  process.exit(0);
});