# 🔥 Firebase Usage Monitoring Guide

## 📊 Cara Memantau Penggunaan Firebase

### 1. **Firebase Console (Resmi)**

**Cara Akses:**
1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Login dengan akun Google Anda
3. Pilih project "azzahra-fashion-muslim"
4. Klik menu **Usage and billing** di sidebar kiri

**Yang Ditampilkan:**
- **Firestore Usage**:
  - Document reads/writes/deletes per hari
  - Storage usage (GB)
  - Bandwidth usage
- **Storage Usage**:
  - Total files dan size
  - Download/upload bandwidth
- **Authentication**:
  - Monthly active users (MAU)
  - Total registered users
- **Hosting**:
  - Bandwidth dan requests

### 2. **Admin Panel Dashboard (Built-in)**

**Cara Akses:**
1. Login sebagai admin di aplikasi
2. Masuk ke Admin Panel
3. Klik **Manajemen Cache**
4. Pilih tab **🔥 Firebase Usage**

**Fitur Dashboard:**
- Real-time usage monitoring
- Visual progress bars vs limits
- Firestore document count
- User count tracking
- Quick refresh capabilities
- Console report export

### 3. **Spark Plan Limits (Free Tier)**

## 📋 Firestore Limits
- **Storage**: 1 GiB total
- **Reads**: 50,000 document reads/hari
- **Writes**: 20,000 document writes/hari
- **Deletes**: 20,000 document deletes/hari

## 💾 Storage Limits
- **Total Storage**: 1 GB
- **Download**: 10 GB/hari
- **Upload**: 20 GB/hari

## 👥 Authentication Limits
- **Monthly Active Users**: 10,000 MAU

### 4. **Monitoring Otomatis via Code**

**Console Usage Report:**
```javascript
import { FirebaseUsageMonitor } from './src/utils/FirebaseUsageMonitor';

// Print usage report ke console
FirebaseUsageMonitor.printUsageReport();

// Get usage data untuk custom processing
const usage = await FirebaseUsageMonitor.getCurrentUsage();
const limits = FirebaseUsageMonitor.getSparkPlanLimits();
```

**Custom Monitoring:**
```javascript
// Cek jika mendekati limit
const usage = await FirebaseUsageMonitor.getCurrentUsage();
const limits = FirebaseUsageMonitor.getSparkPlanLimits();

const readPercentage = (usage.firestore.estimatedReads / limits.firestore.readsPerDay) * 100;
if (readPercentage > 80) {
  console.warn('⚠️ Firestore reads approaching limit:', readPercentage.toFixed(1) + '%');
}
```

### 5. **Alerts & Notifications**

**Recommended Setup:**
1. **Firebase Console Alerts**:
   - Setup email alerts di Firebase Console
   - Configure billing alerts (meskipun free plan)

2. **Custom Dashboard Alerts**:
   - Built-in warning di admin panel
   - Color-coded progress bars (green/yellow/red)
   - Automatic console warnings

3. **Manual Checks**:
   - Weekly usage review di dashboard
   - Monthly billing cycle review
   - After major feature launches

### 6. **Optimizing Usage**

**Firestore Optimization:**
```javascript
// Batch operations untuk menghemat writes
const batch = writeBatch(db);
products.forEach(product => {
  batch.set(doc(db, 'products', product.id), product);
});
await batch.commit();

// Efficient queries dengan limits
const snapshot = await getDocs(
  query(collection(db, 'products'), limit(20))
);
```

**Storage Optimization:**
- Compress images sebelum upload
- Use appropriate image formats (WebP > JPEG > PNG)
- Implement caching strategies
- Clean up unused files

**Authentication Optimization:**
- Monitor inactive users
- Implement user cleanup for test accounts
- Use email verification sparingly

### 7. **Emergency Procedures**

**If Approaching Limits:**
1. **Immediate Actions**:
   - Check admin dashboard for exact usage
   - Identify high-usage operations
   - Implement temporary rate limiting

2. **Code Changes**:
   - Add caching to reduce reads
   - Batch write operations
   - Optimize queries

3. **Upgrade Plan**:
   - Consider upgrading to Blaze plan if consistently hitting limits
   - Compare costs vs benefits

**Monitoring Schedule:**
- **Daily**: Quick check di admin dashboard
- **Weekly**: Detailed Firebase Console review
- **Monthly**: Full usage analysis and optimization

### 8. **Usage Tracking Best Practices**

**Do's:**
✅ Monitor usage regularly
✅ Set up alerts and notifications
✅ Optimize queries and operations
✅ Clean up unused data
✅ Document usage patterns

**Don'ts:**
❌ Ignore approaching limits
❌ Use inefficient queries
❌ Store large files unnecessarily
❌ Forget to clean up test data
❌ Exceed free tier without monitoring

---

## 🎯 Quick Access Links

- **Firebase Console**: https://console.firebase.google.com/
- **Admin Panel**: /admin (login required)
- **Usage Dashboard**: Admin → Manajemen Cache → Firebase Usage

**📞 Support**: Jika ada masalah dengan monitoring, check console logs dan Firebase Help Center.

---
**📅 Last Updated**: 2025-11-01
**🔥 Generated with Claude Code**