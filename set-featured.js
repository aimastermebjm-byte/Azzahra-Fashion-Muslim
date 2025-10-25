// Script untuk menambahkan field isFeatured ke produk di Firebase
// Run dengan: node set-featured.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs",
  authDomain: "azzahra-fashion-muslim-ab416.firebaseapp.com",
  projectId: "azzahra-fashion-muslim-ab416",
  storageBucket: "azzahra-fashion-muslim-ab416.firebasestorage.app",
  messagingSenderId: "822661485961",
  appId: "1:822661485961:web:4603488d8bef0119f3fd58"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setFeaturedProducts() {
  try {
    console.log('🔥 Mengambil data produk dari Firebase...');

    // Get all products
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);

    if (snapshot.empty) {
      console.log('❌ Tidak ada produk ditemukan di Firebase');
      return;
    }

    const products = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });

    console.log(`📦 Total produk ditemukan: ${products.length}`);

    // Set first 5 products as featured
    const featuredProducts = products.slice(0, 5);
    console.log('🌟 Menjadikan 5 produk pertama sebagai produk unggulan:');

    for (let i = 0; i < featuredProducts.length; i++) {
      const product = featuredProducts[i];
      const productRef = doc(db, 'products', product.id);

      // Update with isFeatured: true and featuredOrder
      await updateDoc(productRef, {
        isFeatured: true,
        featuredOrder: i + 1
      });

      console.log(`✅ ${i + 1}. ${product.name} - isFeatured: true, featuredOrder: ${i + 1}`);
    }

    console.log('\n🎉 Berhasil menambahkan field isFeatured ke 5 produk pertama!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
setFeaturedProducts();