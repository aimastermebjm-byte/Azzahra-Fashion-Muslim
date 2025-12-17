# 🔧 Payment Verification System - Setup Guide

## ✅ Status Update
- ✅ Code deployed to Vercel
- ✅ Firebase Rules deployed
- ✅ Collections structure ready
- ⏳ Need to add initial data (manual via Firebase Console)

---

## 📋 Firebase Collections Structure

```
✅ paymentDetectionSettings      (Settings for semi/full-auto mode)
✅ paymentDetectionsPending       (Unverified payment detections)
✅ paymentDetectionsVerified      (Confirmed payments)
✅ paymentDetectionsIgnored       (Non-customer transactions)
```

---

## 🚀 Setup Instructions (Manual via Firebase Console)

### Step 1: Open Firebase Console
1. Go to: https://console.firebase.google.com/
2. Select project: `azzahra-fashion-muslim-ab416`
3. Navigate to **Firestore Database**

---

### Step 2: Create Settings Document

**Collection**: `paymentDetectionSettings`  
**Document ID**: `config`

**Fields**:
```javascript
{
  "mode": "semi-auto",
  "enabled": true,
  "autoConfirmThreshold": 90,
  "autoConfirmRules": {
    "exactAmountMatch": true,
    "nameSimilarity": 80,
    "maxOrderAge": 7200
  },
  "createdAt": <timestamp>,
  "lastModified": <timestamp>
}
```

**How to add**:
1. Click **"Start collection"**
2. Collection ID: `paymentDetectionSettings`
3. Document ID: `config`
4. Add fields:
   - Field: `mode`, Type: `string`, Value: `semi-auto`
   - Field: `enabled`, Type: `boolean`, Value: `true`
   - Field: `autoConfirmThreshold`, Type: `number`, Value: `90`
   - Field: `autoConfirmRules`, Type: `map`:
     - `exactAmountMatch`: `boolean` → `true`
     - `nameSimilarity`: `number` → `80`
     - `maxOrderAge`: `number` → `7200`
   - Field: `createdAt`, Type: `timestamp` → Click **"Set to current time"**
   - Field: `lastModified`, Type: `timestamp` → Click **"Set to current time"**
5. Click **"Save"**

---

### Step 3: Add Mock Payment Detection (Testing)

**Collection**: `paymentDetectionsPending`  
**Document ID**: Auto-generate

**Sample Data 1**:
```javascript
{
  "amount": 250000,
  "senderName": "SITI NURHALIZA",
  "bank": "BRI",
  "timestamp": "2025-12-11T10:00:00.000Z",
  "rawText": "BRIMo\nTransfer Masuk\nRp250.000,00\ndari SITI NURHALIZA",
  "screenshotUrl": null,
  "matchedOrderId": null,
  "confidence": null,
  "status": "pending",
  "createdAt": <timestamp>
}
```

**How to add**:
1. Click **"Start collection"** (if first) or **"Add document"**
2. Collection ID: `paymentDetectionsPending`
3. Document ID: Leave blank (auto-generate)
4. Add fields:
   - `amount`: `number` → `250000`
   - `senderName`: `string` → `SITI NURHALIZA`
   - `bank`: `string` → `BRI`
   - `timestamp`: `string` → `2025-12-11T10:00:00.000Z` (update to current time)
   - `rawText`: `string` → `BRIMo\nTransfer Masuk\nRp250.000,00\ndari SITI NURHALIZA`
   - `screenshotUrl`: `null` → Leave as null
   - `matchedOrderId`: `null` → Leave as null
   - `confidence`: `null` → Leave as null
   - `status`: `string` → `pending`
   - `createdAt`: `timestamp` → **"Set to current time"**
5. Click **"Save"**

**Sample Data 2** (Optional):
```javascript
{
  "amount": 180000,
  "senderName": "AHMAD DHANI",
  "bank": "Mandiri",
  "timestamp": "2025-12-11T09:55:00.000Z",
  "rawText": "Livin' by Mandiri\nTransaksi Berhasil\nTransfer Diterima Rp 180.000\nDari: AHMAD DHANI",
  "screenshotUrl": null,
  "matchedOrderId": null,
  "confidence": null,
  "status": "pending",
  "createdAt": <timestamp>
}
```

Repeat the same steps with different values.

---

### Step 4: Create Empty Collections (Optional - for cleaner structure)

These will be created automatically when first used, but you can create them now:

1. **paymentDetectionsVerified** - Leave empty (will be filled when admin verifies payments)
2. **paymentDetectionsIgnored** - Leave empty (will be filled when admin ignores detections)

---

## 🎯 Testing in App

### After setup Firebase:

1. **Open your app**: https://azzahra-fashion-muslim.vercel.app
2. **Login** as admin/owner
3. Navigate to: **Account** → **Verifikasi Pembayaran** 💳
4. You should see:
   - ✅ Settings loaded (Semi-Auto mode)
   - ✅ Mock detections displayed
   - ✅ Auto-matching with pending orders (if any exist)
   - ✅ Buttons: "Mark Paid", "Ignore", "View Screenshot"

---

## 🧪 Full Testing Workflow

### Test Scenario 1: Create Order → Detect Payment → Verify

1. **Create Test Order**:
   - Login as customer
   - Add product to cart
   - Checkout (amount: Rp 250.000)
   - Order created (status: pending)

2. **Simulate Payment Detection**:
   - Add payment detection in Firebase (amount: Rp 250.000, name matches customer)

3. **Verify Payment**:
   - Login as admin
   - Go to Verifikasi Pembayaran
   - See HIGH MATCH (95% confidence) with the order
   - Click "Mark Paid"
   - Order status changes to "paid" ✅

---

### Test Scenario 2: No Match (Unrecognized Payment)

1. **Add Payment Detection** (amount: Rp 95.000 - no matching order)
2. **Check Dashboard**:
   - Should show "No Match" warning
   - Option to "Ignore" or "Create Order"

---

## 📊 Expected Results

After setup, you should see in Firebase:

```
paymentDetectionSettings/config
  ├─ mode: "semi-auto"
  ├─ enabled: true
  └─ threshold: 90

paymentDetectionsPending/
  ├─ {auto-id-1}
  │  ├─ amount: 250000
  │  ├─ senderName: "SITI NURHALIZA"
  │  └─ status: "pending"
  └─ {auto-id-2}
     ├─ amount: 180000
     └─ ...
```

In App Dashboard:
```
┌─────────────────────────────────┐
│ Verifikasi Pembayaran           │
├─────────────────────────────────┤
│ Pending: 2                      │
│ Verified: 0                     │
│ Accuracy: -                     │
├─────────────────────────────────┤
│ ✨ HIGH MATCH (95%)              │
│ Rp 250.000                      │
│ dari: SITI NURHALIZA            │
│ BRI - Just now                  │
│                                 │
│ → Matched Order: AZF12345       │
│                                 │
│ [Mark Paid] [Ignore]            │
└─────────────────────────────────┘
```

---

## ⚠️ Troubleshooting

### Error: "Missing or insufficient permissions"
**Solution**: Make sure you're logged in as admin/owner in the app.

### Error: "Settings not found"
**Solution**: Check `paymentDetectionSettings/config` exists in Firebase Console.

### No detections showing
**Solution**: 
1. Check `paymentDetectionsPending` collection has documents
2. Hard refresh browser (Ctrl+Shift+R)
3. Check browser console for errors

### Auto-matching not working
**Solution**:
1. Create a test order first (same amount as detection)
2. Customer name should be similar to senderName
3. Check confidence score calculation

---

## 🎉 Success Checklist

- [ ] Firebase Console accessible
- [ ] `paymentDetectionSettings/config` created with correct fields
- [ ] `paymentDetectionsPending` has at least 1 mock detection
- [ ] App loads Verifikasi Pembayaran page without errors
- [ ] Mock detections visible in dashboard
- [ ] Can click "Mark Paid" (even if no matching order)
- [ ] Settings modal opens correctly
- [ ] Can switch between Semi-Auto and Full-Auto modes

---

## 🚀 Next Steps After Setup

1. **Test with real orders** - Create actual orders, add matching detections
2. **Verify accuracy** - Check if auto-matching works well (aim for 90%+)
3. **Adjust threshold** - If too many false positives, increase threshold
4. **Monitor for 1 week** - Cross-check with bank mutations daily
5. **Consider Full-Auto** - If accuracy >95%, enable auto-confirm mode
6. **Develop Mobile App** - Android app for true auto-screenshot (Phase 1)

---

## 📝 Notes

- **Manual entry** is temporary - Eventually will be automated via mobile app
- **Collections auto-created** when first document added
- **Rules already deployed** - No additional Firebase configuration needed
- **Safe to test** - Won't affect existing orders/products
- **Standalone system** - Can disable anytime without affecting business

---

## 🆘 Need Help?

If you encounter issues:
1. Check Firebase Console → Firestore → Check collections exist
2. Check browser console (F12) for JavaScript errors
3. Verify user role is admin/owner in `users` collection
4. Try hard refresh (Ctrl+Shift+R)
5. Check Firebase Rules are deployed (should see the 4 new rules)

---

**Last Updated**: 2025-12-11  
**Version**: Phase 2 - Admin Dashboard  
**Status**: Ready for manual testing
