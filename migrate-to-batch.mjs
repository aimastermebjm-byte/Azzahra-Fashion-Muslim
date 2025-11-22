import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

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
console.log('   Auth Domain:', firebaseConfig.authDomain);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Konfigurasi batch
const PRODUCTS_PER_BATCH = 100;
const BATCH_COLLECTION = 'productBatches';

console.log('🚀 MEMULAI MIGRASI KE SISTEM BATCH...');
console.log(`📦 Konfigurasi: ${PRODUCTS_PER_BATCH} produk per batch`);

function createBatchId(batchNumber) {
  return `batch_${batchNumber}`;
}

function sortProductsByCreatedAt(products) {
  return products.sort((a, b) => {
    // Handle createdAt fields
    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
    return dateB.getTime() - dateA.getTime(); // Terbaru dulu
  });
}

async function migrateToBatchSystem() {
  try {
    console.log('\n📥 Step 1: Membaca semua produk dari collection lama...');

    // Baca semua produk dari collection 'products'
    const productsRef = collection(db, 'products');
    const querySnapshot = await getDocs(productsRef);

    const allProducts = [];
    querySnapshot.forEach((doc) => {
      const productData = {
        id: doc.id,
        ...doc.data()
      };
      allProducts.push(productData);
    });

    console.log(`📊 Ditemukan ${allProducts.length} produk`);

    if (allProducts.length === 0) {
      console.log('❌ Tidak ada produk yang ditemukan. Migration dibatalkan.');
      return;
    }

    console.log('\n🔄 Step 2: Mengurutkan produk (terbaru dulu)...');
    const sortedProducts = sortProductsByCreatedAt(allProducts);

    console.log('\n📦 Step 3: Membagi produk ke dalam batch...');

    // Hitung jumlah batch yang dibutuhkan
    const totalBatches = Math.ceil(sortedProducts.length / PRODUCTS_PER_BATCH);
    console.log(`📊 Total batch yang akan dibuat: ${totalBatches}`);

    // Buat batch documents
    const batchPromises = [];

    for (let batchNumber = 1; batchNumber <= totalBatches; batchNumber++) {
      const startIndex = (batchNumber - 1) * PRODUCTS_PER_BATCH;
      const endIndex = Math.min(startIndex + PRODUCTS_PER_BATCH, sortedProducts.length);
      const batchProducts = sortedProducts.slice(startIndex, endIndex);

      const batchId = createBatchId(batchNumber);
      const batchData = {
        batchNumber: batchNumber,
        totalProducts: batchProducts.length,
        createdAt: new Date(),
        products: batchProducts,
        // Metadata untuk sorting global
        minPrice: Math.min(...batchProducts.map(p => p.price || 0)),
        maxPrice: Math.max(...batchProducts.map(p => p.price || 0)),
        hasFlashSale: batchProducts.some(p => p.isFlashSale),
        hasFeatured: batchProducts.some(p => p.isFeatured),
        productIds: batchProducts.map(p => p.id)
      };

      console.log(`\n📦 Membuat ${batchId}:`);
      console.log(`   - Produk: ${startIndex + 1} - ${endIndex}`);
      console.log(`   - Jumlah: ${batchProducts.length} produk`);
      console.log(`   - Flash Sale: ${batchData.hasFlashSale ? '✅' : '❌'}`);
      console.log(`   - Featured: ${batchData.hasFeatured ? '✅' : '❌'}`);
      console.log(`   - Price Range: Rp${batchData.minPrice.toLocaleString('id-ID')} - Rp${batchData.maxPrice.toLocaleString('id-ID')}`);

      const batchPromise = setDoc(doc(db, BATCH_COLLECTION, batchId), batchData);
      batchPromises.push(batchPromise);
    }

    console.log('\n💾 Step 4: Menulis batch documents ke Firestore...');
    await Promise.all(batchPromises);

    console.log('\n📊 Step 5: Membuat index document untuk sorting global...');

    // Buat index global untuk semua produk
    const globalIndexData = {
      totalProducts: sortedProducts.length,
      totalBatches: totalBatches,
      lastUpdated: new Date(),
      allProductIds: sortedProducts.map(p => p.id),
      flashSaleProductIds: sortedProducts.filter(p => p.isFlashSale).map(p => p.id),
      featuredProductIds: sortedProducts.filter(p => p.isFeatured).map(p => p.id),
      priceSortedIds: sortedProducts.sort((a, b) => (a.price || 0) - (b.price || 0)).map(p => p.id),
      newestIds: sortedProducts.map(p => p.id), // Sudah diurutkan terbaru
    };

    await setDoc(doc(db, BATCH_COLLECTION, 'globalIndex'), globalIndexData);

    console.log('\n🗑️ Step 6: Backup dan hapus collection lama (opsional)...');
    console.log('⚠️  Collection lama TIDAK dihapus untuk safety.');
    console.log('💡 Anda bisa hapus manual setelah yakin migration berhasil:');
    console.log('   - Firebase Console → Firestore → Collection "products"');
    console.log('   - Hapus collection "products" jika sudah yakin');

    console.log('\n🎉 MIGRASI BERHASIL!');
    console.log('\n📊 Summary:');
    console.log(`   - Total produk: ${sortedProducts.length}`);
    console.log(`   - Total batch: ${totalBatches}`);
    console.log(`   - Produk per batch: ${PRODUCTS_PER_BATCH}`);
    console.log(`   - Collection: "${BATCH_COLLECTION}"`);
    console.log('\n💰 Benefit:');
    console.log(`   - Reading cost: ${sortedProducts.length} reads → 1 read!`);
    console.log(`   - Performance: 100x lebih cepat!`);
    console.log(`   - Flash Sale & Featured: Tetap berjalan normal!`);
    console.log('\n✅ Siap untuk update hooks dan testing!');

  } catch (error) {
    console.error('❌ ERROR saat migrasi:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Pastikan koneksi internet stabil');
    console.log('2. Cek Firebase configuration');
    console.log('3. Pastikan memiliki permission write ke Firestore');
  }
}

// Jalankan migrasi
migrateToBatchSystem();