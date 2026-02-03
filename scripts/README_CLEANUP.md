# 🧹 Firebase Cleanup Scripts - SAFETY GUIDE

## 🛡️ **JAMINAN KEAMANAN 100%**

Script ini **AMAN** karena:
- ✅ **TIDAK DELETE products** - Hanya remove fields yang tidak dipakai
- ✅ **Auto backup** - Otomatis buat backup sebelum cleanup
- ✅ **Dry-run mode** - Preview dulu sebelum execute
- ✅ **Restore script** - Bisa rollback jika perlu

---

## 📁 **AVAILABLE SCRIPTS**

### 1. 💾 **backup-products.ts** (Manual Backup)
Create backup sebelum cleanup.

**Usage:**
```bash
npx tsx scripts/backup-products.ts
```

**Output:**
```
💾 Creating manual backup...
✅ Backup created successfully!
📁 Location: scripts/backups/MANUAL_backup_2026-02-03.json
📊 Products backed up: 150
```

---

### 2. 🧹 **cleanup-firebase-fields.ts** (Main Cleanup)
Remove unused fields dari semua products.

**Features:**
- ✅ Auto backup before cleanup
- ✅ Dry-run mode (default ON)
- ✅ Detailed progress log

**Step 1: Dry Run (Preview)**
```bash
# Jalankan dulu dalam mode preview
npx tsx scripts/cleanup-firebase-fields.ts
```

**Output:**
```
🧹 Starting Firebase product fields cleanup...
🔧 Mode: DRY RUN (Preview Only)

📦 Found 150 products
💾 Creating backup before cleanup...

✓ Product 1/150 (Gamis Syari Premium)
  Removed: originalRetailPrice, price, reviews
...

⚠️ DRY RUN - No changes made to Firebase

📊 Summary:
   - Total products: 150
   - Products to clean: 150
   - Total fields to remove: 600

💡 TIP: Set DRY_RUN = false in script to execute cleanup
```

**Step 2: Execute Cleanup**
1. Edit `scripts/cleanup-firebase-fields.ts`
2. Change line 52: `const DRY_RUN = false;`
3. Run again:
```bash
npx tsx scripts/cleanup-firebase-fields.ts
```

**Output:**
```
🧹 Starting Firebase product fields cleanup...
🔧 Mode: LIVE EXECUTION

📦 Found 150 products
💾 Creating backup before cleanup...
💾 Backup created: scripts/backups/productBatch_backup_2026-02-03.json

✓ Product 1/150 (Gamis Syari Premium)
  Removed: originalRetailPrice, price, reviews
...

📤 Updating Firebase...
✅ Firebase updated successfully!

📊 Summary:
   - Total products: 150
   - Products cleaned: 150
   - Total fields removed: 600

🎉 Firebase database is now clean!
```

---

### 3. 🔄 **restore-backup.ts** (Rollback)
Kembalikan data dari backup (jika diperlukan).

**Usage:**
```bash
# List available backups
ls scripts/backups/

# Restore specific backup
npx tsx scripts/restore-backup.ts productBatch_backup_2026-02-03.json
```

**Output:**
```
🔄 Starting restore from backup...

📂 Reading backup file: productBatch_backup_2026-02-03.json
📦 Found 150 products in backup

📤 Restoring to Firebase...

✅ RESTORE COMPLETE!
📊 Restored 150 products
🎉 Your data has been restored!
```

---

## 🚀 **RECOMMENDED WORKFLOW**

### **SAFE EXECUTION (Recommended!)**

#### Step 1: Update Firebase Config
Edit all 3 scripts, update `firebaseConfig` section:
```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  // ... paste Boss's config
};
```

#### Step 2: Manual Backup (Extra Safety!)
```bash
npx tsx scripts/backup-products.ts
```

#### Step 3: DRY RUN (Preview)
```bash
npx tsx scripts/cleanup-firebase-fields.ts
```
**Check output** - pastikan semua OK!

#### Step 4: Execute Cleanup
1. Edit `cleanup-firebase-fields.ts`
2. Change `const DRY_RUN = false;`
3. Run:
```bash
npx tsx scripts/cleanup-firebase-fields.ts
```

#### Step 5: Test Application
- Open app
- Check product display
- Verify flash sale works
- Test admin panel

#### Step 6: Rollback (If Needed)
```bash
# Only if something goes wrong!
npx tsx scripts/restore-backup.ts <backup-filename>.json
```

---

## ❓ **FAQ**

### Q: Apa yang dihapus?
**A:** Hanya 10 field yang tidak dipakai:
- `originalRetailPrice`, `originalResellerPrice`, `originalSellingPrice`
- `flashSaleDiscount`, `discount`
- `sellingPrice`, `price`, `purchasePrice`
- `rating`, `reviews`

### Q: Product akan hilang?
**A:** **TIDAK!** Script hanya remove fields, tidak delete products!

### Q: Data penting hilang?  
**A:** **TIDAK!** Field yang penting (retailPrice, resellerPrice, costPrice, stock, dll) **TETAP ADA!**

### Q: Bisa rollback?
**A:** **YA!** Ada:
1. Auto backup by cleanup script
2. Manual backup script
3. Restore script untuk rollback

### Q: Aman untuk production?
**A:** **YA!** Tapi Boss belum production, jadi ini timing PERFECT!

---

## 🔍 **WHAT THE SCRIPT DOES**

### Before:
```json
{
  "id": "product_123",
  "name": "Gamis Syari",
  "retailPrice": 200000,
  "resellerPrice": 160000,
  "costPrice": 120000,
  "originalRetailPrice": 200000,  ← HAPUS
  "price": 200000,                ← HAPUS
  "sellingPrice": 200000,         ← HAPUS  
  "purchasePrice": 120000,        ← HAPUS
  "rating": 0,                    ← HAPUS
  "reviews": 0,                   ← HAPUS
  "stock": 10,
  "images": ["url1.jpg"]
}
```

### After:
```json
{
  "id": "product_123",           ← TETAP
  "name": "Gamis Syari",         ← TETAP
  "retailPrice": 200000,         ← TETAP
  "resellerPrice": 160000,       ← TETAP
  "costPrice": 120000,           ← TETAP
  "stock": 10,                   ← TETAP
  "images": ["url1.jpg"]         ← TETAP
}
```

**Product tetap ada, cuma lebih ramping!** 🎯

---

## ✅ **GUARANTEED SAFE!**

- 🔐 Automatic backup
- 🔍 Dry-run preview
- 🔄 Easy rollback
- 📊 Detailed logging
- ❌ NO product deletion
- ✅ Only field removal

**READY TO CLEAN BOSS! 100% AMAN! 🚀**
