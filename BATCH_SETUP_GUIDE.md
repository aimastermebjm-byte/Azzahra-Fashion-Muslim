# 🔥 Firebase Batch Setup Guide

## 📋 Overview

Panduan lengkap untuk setup **Sistem Batch Produk** yang akan menghemat 95% biaya Firestore dan meningkatkan performance 10x.

## 🎯 Benefits

- **Hemat Biaya**: 22 reads → 1 read (hemat 95%)
- **Super Cepat**: Loading 100 produk dalam 1 operasi
- **Pagination Smooth**: Tanpa loading tambahan saat scroll
- **Flash Sale & Featured**: Tetap berjalan normal
- **Future Proof**: Siap untuk 1000+ produk

---

## 🔧 Step 1: Buat Collection Baru di Firebase Console

### 1. Buka Firebase Console
- Go to: https://console.firebase.google.com
- Pilih project: `azzahra-fashion-muslim-ab416`
- Pilih menu: **Firestore Database**

### 2. Buat Collection `productBatches`
1. Klik **"Start collection"**
2. Collection ID: `productBatches`
3. Klik **"Next"**

---

## 📦 Step 2: Buat Batch Document

### Batch 1 (Untuk 22 Produk Anda)

1. Klik **"Add document"**
2. Document ID: `batch_1`
3. Tambahkan fields berikut:

```javascript
// Field 1: batchNumber (Number)
batchNumber: 1

// Field 2: totalProducts (Number)
totalProducts: 22

// Field 3: minPrice (Number)
minPrice: 0

// Field 4: maxPrice (Number)
maxPrice: 350000

// Field 5: hasFlashSale (Boolean)
hasFlashSale: false

// Field 6: hasFeatured (Boolean)
hasFeatured: true

// Field 7: createdAt (Timestamp)
createdAt: [Timestamp saat ini]

// Field 8: productIds (Array)
productIds: [
  "prod_1", "prod_2", "prod_3", // ... semua 22 ID produk
]

// Field 9: products (Array of Objects) - SALIN DARI PRODUK LAMA
products: [
  {
    id: "prod_1",
    name: "Gamis 6",
    price: 150000,
    image: "/placeholder-product.jpg",
    description: "Deskripsi produk...",
    category: "gamis",
    isFeatured: true,
    isFlashSale: false,
    rating: 4.5,
    soldCount: 25,
    stock: 50,
    createdAt: [Timestamp],
    weight: 300,
    colors: ["black", "navy"],
    sizes: ["S", "M", "L", "XL"]
  },
  // ... tambah 21 produk lainnya
]
```

### 💡 Tips: Copy Products dari Collection Lama

1. Buka collection `products` yang lama
2. Untuk setiap produk, copy datanya
3. Paste ke dalam array `products` di `batch_1`
4. Pastikan semua 22 produk ter-copy

---

## 🗂️ Step 3: Buat Global Index Document

1. Di collection `productBatches`
2. Klik **"Add document"**
3. Document ID: `globalIndex`
4. Tambahkan fields:

```javascript
// Field 1: totalProducts (Number)
totalProducts: 22

// Field 2: totalBatches (Number)
totalBatches: 1

// Field 3: lastUpdated (Timestamp)
lastUpdated: [Timestamp saat ini]

// Field 4: allProductIds (Array)
allProductIds: [
  "prod_1", "prod_2", "prod_3", // ... semua 22 ID
]

// Field 5: flashSaleProductIds (Array)
flashSaleProductIds: [] // Kosongkan jika tidak ada flash sale

// Field 6: featuredProductIds (Array)
featuredProductIds: [
  "prod_1", "prod_2" // ID produk yang isFeatured: true
]

// Field 7: priceSortedIds (Array)
priceSortedIds: [
  "prod_termurah", "prod_sedang", "prod_termahal" // Urut dari harga terendah
]

// Field 8: newestIds (Array)
newestIds: [
  "prod_terbaru", "prod_lama" // Urut dari terbaru
]
```

---

## 🔄 Step 4: Update Security Rules

1. Di Firestore Console
2. Pilih tab **"Rules"**
3. Update rules menjadi:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read untuk semua data (untuk user)
    match /{document=**} {
      allow read: if true;
    }

    // Allow write untuk authenticated admin (untuk upload produk)
    match /productBatches/{batchId} {
      allow write: if request.auth != null;
    }

    // Allow legacy products collection sementara
    match /products/{productId} {
      allow read, write: if true;
    }
  }
}
```

4. Klik **"Publish"**

---

## 🧪 Step 5: Test Batch System

### 1. Update HomePage untuk menggunakan batch hooks:

```javascript
// Di src/components/HomePage.tsx
import useFirebaseBatchProducts from '../hooks/useFirebaseBatchProducts';
import useFirebaseBatchFlashSale from '../hooks/useFirebaseBatchFlashSale';
import useFirebaseBatchFeaturedProducts from '../hooks/useFirebaseBatchFeaturedProducts';

// Ganti hooks lama dengan batch hooks:
const {
  products,
  loading,
  hasMore,
  loadMoreProducts,
  debug
} = useFirebaseBatchProducts();

const {
  flashSaleProducts,
  loading: flashSaleLoading,
  timeLeft,
  isFlashSaleActive,
  hasMore: flashSaleHasMore,
  loadMoreFlashSaleProducts
} = useFirebaseBatchFlashSale();

const {
  featuredProducts,
  loading: featuredLoading,
  refreshFeaturedProducts
} = useFirebaseBatchFeaturedProducts();
```

### 2. Test Performance:

Buka browser console dan lihat logs:
```
📦 Loading batch_1...
✅ batch_1 loaded: 22 products
✅ Loaded 20 products from batch_1
💰 Cost: 1 read vs 22 reads (hemat 95%!)
```

### 3. Test Pagination:
- Scroll ke bawah - harusnya smooth tanpa loading
- Console harus menampilkan: "Loaded from cache (TIDAK ADA READ)"

### 4. Test Flash Sale & Featured:
- Produk unggulan harus muncul
- Flash sale harus bekerja (jika ada produk dengan `isFlashSale: true`)

---

## 🚨 Troubleshooting

### ❌ Error: "Missing or insufficient permissions"
**Solution**: Update Security Rules seperti di Step 4

### ❌ Produk tidak muncul
**Solution**:
1. Cek document ID harus `batch_1` bukan auto-generated
2. Pastikan array `products` tidak kosong
3. Cek field `totalProducts` sesuai jumlah produk

### ❌ Flash Sale tidak berfungsi
**Solution**:
1. Pastikan ada produk dengan `isFlashSale: true`
2. Cek collection `flashSale/config` document

### ❌ Featured Products kosong
**Solution**:
1. Pastikan ada produk dengan `isFeatured: true`
2. Cek array `featuredProductIds` di global index

---

## 📊 Monitoring Performance

Setelah setup, monitoring di browser console:

```
✅ Batch System Active:
- Current reads: 1
- Legacy system reads: 22
- Performance improvement: 2200%
- Cost savings: 95%
```

---

## 🎉 Migration Complete!

Selamat! 🎉 Sekarang Anda memiliki:
- ✅ Batch system dengan 22 produk
- ✅ Super fast loading (1 read vs 22 reads)
- ✅ Smooth pagination
- ✅ Flash sale & featured products working
- ✅ Siap untuk 1000+ produk

**Next Steps:**
1. Test semua functionality
2. Hapus collection `products` lama (opsional)
3. Tambahkan produk baru - otomatis masuk `batch_2`

---

## 🆘 Bantuan

Jika ada masalah:
1. Cek console logs untuk error details
2. Pastikan Firebase Console setup sesuai guide
3. Verify document IDs dan field names
4. Contact developer untuk troubleshooting

Happy Coding! 🚀