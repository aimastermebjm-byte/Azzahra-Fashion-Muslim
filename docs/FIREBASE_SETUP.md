# 🔥 Firebase Firestore Setup untuk Cart Sync

## 🎯 Masalah Saat Ini
```
❌ Error getting cart from Firebase: FirebaseError: Missing or insufficient permissions.
❌ Error saving cart to Firebase: FirebaseError: Missing or insufficient permissions.
```

## 📋 Langkah-Langkah Fix

### 1. Buka Firebase Console
- URL: https://console.firebase.google.com/
- Project: `azzahra-fashion-muslim-ab416`

### 2. Setup Firestore Security Rules
1. Klik **Firestore Database** di menu kiri
2. Klik tab **Rules**
3. **Publish** rules berikut:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User can only access their own cart
    match /user_carts/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Users can read/write their own orders
    match /orders/{orderId} {
      allow read, write: if request.auth != null &&
        request.auth.uid == resource.data.userId;
    }

    // Read access for products
    match /products/{productId} {
      allow read: if true;
    }

    // Read access for flash sale config
    match /flash_sale/{document} {
      allow read: if true;
    }
  }
}
```

### 3. Testing Setelah Setup Rules
1. **Clear browser cache** di hp dan laptop
2. **Tambah produk** dari laptop
3. **Cek cart** di hp - seharusnya muncul
4. **Lihat console** untuk 🔥 Firebase logs

## 🔍 Debug Logs
Setelah rules benar, Anda akan melihat:
```
✅ Cart loaded from Firebase: 2 items
✅ Cart saved to Firebase successfully
```

Bukan:
```
❌ Error getting cart from Firebase: Missing or insufficient permissions
```

## 📱 Cara Kerja Setelah Fix
- **Add Product**: Tersimpan ke Firebase Firestore
- **Load Cart**: Dibaca dari Firebase Firestore
- **Cross-device Sync**: Real-time sync antar device
- **User ID**: `mFMzpiBNbKZeuotZwc0jPPJwQfn2` (sama di semua device)

## ⚠️ Penting
- User harus **login dengan akun yang sama** di hp dan laptop
- Firebase rules harus **published** untuk aktif
- **Clear cache** browser setelah rules update

## 🆘 Jika Masih Error
1. Pastikan **Firebase project ID** benar: `azzahra-fashion-muslim-ab416`
2. Cek **Authentication** → Users → User ID harus sama
3. Pastikan **Firestore Database** sudah di-create
4. Cek **Environment Variables** di Vercel dashboard