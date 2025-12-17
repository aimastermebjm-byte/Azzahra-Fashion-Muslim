# 🚀 Cara Force Sync GlobalIndex

## **CARA TERMUDAH - Dari Browser Console**

### **STEP 1: Buka Website Anda**
1. Jalankan dev server: `npm run dev`
2. Buka browser ke `http://localhost:5173`
3. **Login sebagai admin**

### **STEP 2: Buka Developer Console**
- **Windows/Linux**: Tekan `F12` atau `Ctrl + Shift + I`
- **Mac**: Tekan `Cmd + Option + I`

### **STEP 3: Jalankan Fungsi Sync**
Ketik command ini di console, lalu tekan Enter:

```javascript
window.forceSyncGlobalIndex()
```

### **STEP 4: Tunggu Sampai Selesai**
Script akan:
- ✅ Ambil semua produk dari `batch_1`
- ✅ Sync ke collection `globalindex`
- ✅ Tampilkan progress setiap produk
- ✅ Tampilkan summary di akhir

---

## **Contoh Output:**

```
🚀 FORCE SYNC GLOBALINDEX - STARTING...
============================================================
📦 Fetching batch_1 document...
📊 Found 24 products in batch_1

📊 Current globalindex has 23 documents

============================================================
🔄 SYNCING PRODUCTS...
============================================================
✅ [1/24] product_abc123 - Gamis Syari
✅ [2/24] product_def456 - Hijab Polos
🆕 [3/24] product_xyz789 - Khimar Instan
...
✅ [24/24] product_last - Product Name

============================================================
📊 SYNC SUMMARY:
============================================================
✅ Successfully synced: 24 products
❌ Errors: 0 products
📦 Total in batch_1: 24 products
============================================================

🔍 VERIFYING...
✅ GlobalIndex now has 24 documents

✅ ✅ ✅ ALL PRODUCTS SYNCED SUCCESSFULLY! ✅ ✅ ✅
```

---

## **Troubleshooting:**

### ❌ Error: "window.forceSyncGlobalIndex is not a function"
**Solusi:** Refresh halaman dulu, fungsi belum loaded.

### ❌ Error: "Permission denied"
**Solusi:** 
1. Pastikan Anda login sebagai admin
2. Cek Firebase rules - pastikan admin bisa write ke `globalindex`

### ❌ Error: "Batch document not found"
**Solusi:** Cek Firebase Console apakah `productBatches/batch_1` ada.

---

## **Kapan Harus Jalankan Force Sync?**

Jalankan force sync ketika:
1. ✅ Produk baru tidak muncul di globalindex
2. ✅ Setelah migrasi data
3. ✅ Setelah manual edit di Firebase Console
4. ✅ Jumlah produk di batch_1 ≠ globalindex

---

## **Verifikasi Hasil:**

Setelah sync selesai, cek di **Firebase Console**:

1. **Collection: `productBatches`**
   - Buka dokumen `batch_1`
   - Cek field `products` → count total produk

2. **Collection: `globalindex`**
   - Count total documents
   - Harusnya **SAMA** dengan jumlah produk di batch_1

---

**✅ DONE! Semua produk sekarang sinkron antara batch_1 dan globalindex!**
