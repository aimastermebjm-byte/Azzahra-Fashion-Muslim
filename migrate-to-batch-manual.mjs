import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';

// Load environment variables
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

console.log('🔧 Firebase Config:');
console.log('   Project ID:', firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('\n🚀 MIGRASI MANUAL SISTEM BATCH');

// Fungsi untuk generate contoh batch data (jika migration gagal)
function generateSampleBatchData() {
  const sampleProducts = [
    {
      id: "prod_1",
      name: "Gamis Premium Muslimah",
      price: 150000,
      image: "/placeholder-product.jpg",
      description: "Gamis premium dengan bahan berkualitas tinggi",
      category: "gamis",
      isFeatured: true,
      isFlashSale: false,
      rating: 4.5,
      soldCount: 25,
      stock: 50,
      createdAt: new Date(),
      weight: 300,
      colors: ["black", "navy", "maroon"],
      sizes: ["S", "M", "L", "XL"]
    },
    {
      id: "prod_2",
      name: "Koko Lengan Pendek Modern",
      price: 100000,
      image: "/placeholder-product.jpg",
      description: "Koko modern dengan desain trendy",
      category: "koko",
      isFeatured: true,
      isFlashSale: true,
      flashSalePrice: 75000,
      rating: 4.2,
      soldCount: 15,
      stock: 30,
      createdAt: new Date(),
      weight: 200,
      colors: ["white", "blue", "black"],
      sizes: ["S", "M", "L", "XL"]
    },
    {
      id: "prod_3",
      name: "Hijab Syari Premium",
      price: 75000,
      image: "/placeholder-product.jpg",
      description: "Hijab syari dengan bahan adem dan nyaman",
      category: "hijab",
      isFeatured: false,
      isFlashSale: true,
      flashSalePrice: 50000,
      rating: 4.8,
      soldCount: 50,
      stock: 100,
      createdAt: new Date(),
      weight: 100,
      colors: ["pastel", "dusty", "army"],
      sizes: ["one-size"]
    }
  ];

  return {
    batchNumber: 1,
    totalProducts: sampleProducts.length,
    createdAt: new Date(),
    products: sampleProducts,
    minPrice: Math.min(...sampleProducts.map(p => p.price)),
    maxPrice: Math.max(...sampleProducts.map(p => p.price)),
    hasFlashSale: sampleProducts.some(p => p.isFlashSale),
    hasFeatured: sampleProducts.some(p => p.isFeatured),
    productIds: sampleProducts.map(p => p.id)
  };
}

async function migrateWithSampleData() {
  try {
    console.log('\n📦 Membuat batch dengan sample data untuk testing...');

    const batchData = generateSampleBatchData();

    console.log('\n📊 Sample Batch Data:');
    console.log(`   - Total Produk: ${batchData.totalProducts}`);
    console.log(`   - Flash Sale: ${batchData.hasFlashSale ? '✅' : '❌'}`);
    console.log(`   - Featured: ${batchData.hasFeatured ? '✅' : '❌'}`);
    console.log(`   - Price Range: Rp${batchData.minPrice.toLocaleString('id-ID')} - Rp${batchData.maxPrice.toLocaleString('id-ID')}`);

    console.log('\n💾 Mencoba menulis batch document...');

    // Coba tulis ke Firestore
    await setDoc(doc(db, 'productBatches', 'batch_1'), batchData);

    console.log('✅ Batch 1 berhasil dibuat!');

    // Buat global index
    const globalIndexData = {
      totalProducts: batchData.totalProducts,
      totalBatches: 1,
      lastUpdated: new Date(),
      allProductIds: batchData.productIds,
      flashSaleProductIds: batchData.products.filter(p => p.isFlashSale).map(p => p.id),
      featuredProductIds: batchData.products.filter(p => p.isFeatured).map(p => p.id),
      priceSortedIds: batchData.products.sort((a, b) => a.price - b.price).map(p => p.id),
      newestIds: batchData.products.map(p => p.id)
    };

    await setDoc(doc(db, 'productBatches', 'globalIndex'), globalIndexData);
    console.log('✅ Global Index berhasil dibuat!');

    console.log('\n🎉 MIGRASI BERHASIL!');
    console.log('\n📋 Next Steps:');
    console.log('1. Update hooks untuk baca dari collection "productBatches"');
    console.log('2. Test pagination dengan batch system');
    console.log('3. Verifikasi flash sale & featured products');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Alternative Solution:');
    console.log('1. Coba migration melalui Firebase Console langsung');
    console.log('2. Atau lanjut dengan update hooks menggunakan sample data di atas');
  }
}

// Jalankan migrasi
migrateWithSampleData();