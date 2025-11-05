// Script untuk mengecek produk unggulan di Firestore
// Run dengan: node check-featured-products.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy } from 'firebase/firestore';

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

async function checkFeaturedProducts() {
  try {
    console.log('🔥 Mengecek produk unggulan di Firestore...\n');

    // Get all products first
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);

    if (snapshot.empty) {
      console.log('❌ Tidak ada produk ditemukan di Firestore');
      return;
    }

    const allProducts = [];
    snapshot.forEach(doc => {
      allProducts.push({ id: doc.id, ...doc.data() });
    });

    console.log(`📦 Total produk ditemukan: ${allProducts.length}\n`);

    // Check for products with isFeatured: true
    const featuredProducts = allProducts.filter(p => p.isFeatured === true);
    console.log(`🌟 Produk dengan isFeatured: true -> ${featuredProducts.length} produk`);

    if (featuredProducts.length > 0) {
      console.log('\n📋 Daftar produk unggulan (isFeatured: true):');
      featuredProducts
        .sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0))
        .forEach((product, index) => {
          console.log(`  ${index + 1}. ${product.name}`);
          console.log(`     - ID: ${product.id}`);
          console.log(`     - featuredOrder: ${product.featuredOrder || 'tidak ada'}`);
          console.log(`     - Harga: Rp${(product.retailPrice || product.price || 0).toLocaleString()}`);
          console.log(`     - Stok: ${product.stock || 0}`);
          console.log('');
        });
    }

    // Check for products with featured: true (alternative field name)
    const altFeaturedProducts = allProducts.filter(p => p.featured === true);
    if (altFeaturedProducts.length > 0) {
      console.log(`\n🌟 Produk dengan featured: true -> ${altFeaturedProducts.length} produk`);
      altFeaturedProducts.forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.name} (ID: ${product.id})`);
      });
    }

    // Check for products with any featured-related field
    const anyFeaturedProducts = allProducts.filter(p =>
      p.isFeatured === true ||
      p.featured === true ||
      (p.featuredOrder && p.featuredOrder > 0)
    );
    console.log(`\n🎯 Total produk dengan field unggulan apapun -> ${anyFeaturedProducts.length} produk`);

    // Always show structure of featured products for analysis
    if (anyFeaturedProducts.length > 0) {
      console.log('\n📝 Struktur lengkap produk unggulan:');
      anyFeaturedProducts.forEach((product, index) => {
        console.log(`\n  Produk ${index + 1}: ${product.name}`);
        console.log(`  - ID: ${product.id}`);
        console.log(`  - isFeatured: ${product.isFeatured}`);
        console.log(`  - featured: ${product.featured}`);
        console.log(`  - featuredOrder: ${product.featuredOrder || 'tidak ada'}`);
        console.log(`  - Fields lengkap: ${Object.keys(product).join(', ')}`);
      });
    } else {
      // If no featured products found, check first few products structure
      console.log('\n📝 Struktur 3 produk pertama (untuk analisis):');
      allProducts.slice(0, 3).forEach((product, index) => {
        console.log(`\n  Produk ${index + 1}: ${product.name}`);
        console.log(`  - isFeatured: ${product.isFeatured}`);
        console.log(`  - featured: ${product.featured}`);
        console.log(`  - featuredOrder: ${product.featuredOrder}`);
        console.log(`  - Fields: ${Object.keys(product).join(', ')}`);
      });
    }

    console.log('\n✅ Analisis selesai!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
checkFeaturedProducts();