# 🚀 Setup CORS untuk Firebase Storage - Step by Step

## ⚠️ Problem
AI Auto Upload tidak bisa fetch gambar produk karena CORS error.

## ✅ Solution: Install Google Cloud SDK → Apply CORS

---

## 📥 **STEP 1: Download Google Cloud SDK**

### Download Link:
**https://cloud.google.com/sdk/docs/install-sdk#windows**

Atau download langsung:
**https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe**

---

## 💿 **STEP 2: Install Google Cloud SDK**

1. **Run installer** (GoogleCloudSDKInstaller.exe)
2. **Follow wizard:**
   - ✅ Install for: **Just me** (atau All users)
   - ✅ Install location: Default (C:\Users\...\AppData\Local\Google\Cloud SDK)
   - ✅ Click **Install**
3. **Wait...** (sekitar 2-3 menit)
4. **Finish wizard:**
   - ✅ Check: **Start Google Cloud SDK Shell**
   - ✅ Check: **Run 'gcloud init'**
   - Click **Finish**

---

## 🔐 **STEP 3: Login ke Google Cloud**

Setelah install selesai, akan otomatis buka **Google Cloud SDK Shell**.

### Di Cloud SDK Shell, jalankan:

```bash
# 1. Login ke Google account
gcloud auth login
```

**Browser akan terbuka:**
- ✅ Pilih akun Google yang dipakai untuk Firebase
- ✅ Click **Allow** untuk izinkan akses
- ✅ Kembali ke terminal

```bash
# 2. Set project
gcloud config set project azzahra-fashion-muslim-ab416
```

**Output expected:**
```
Updated property [core/project].
```

---

## 📝 **STEP 4: Apply CORS Configuration**

### Pastikan ada file `cors.json` di folder project:

**Location:** `D:\My Project\Azzahra Fashion Muslim\project\cors.json`

**Content:**
```json
[
  {
    "origin": ["*"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]
```

### Apply CORS dengan gsutil:

```bash
# Navigate ke project folder
cd "D:\My Project\Azzahra Fashion Muslim\project"

# Apply CORS
gsutil cors set cors.json gs://azzahra-fashion-muslim-ab416.firebasestorage.app
```

**Output expected:**
```
Setting CORS on gs://azzahra-fashion-muslim-ab416.firebasestorage.app/...
```

✅ **DONE!** CORS sudah di-apply.

---

## ✔️ **STEP 5: Verify CORS Applied**

```bash
gsutil cors get gs://azzahra-fashion-muslim-ab416.firebasestorage.app
```

**Expected output:**
```json
[{"maxAgeSeconds": 3600, "method": ["GET"], "origin": ["*"]}]
```

---

## 🧪 **STEP 6: Test AI Auto Upload**

1. **Clear browser cache:**
   - Press `Ctrl + Shift + Delete`
   - Clear: Cached images and files
   - Time range: Last hour

2. **Reload app:**
   - Go to: https://azzahra-fashion-muslim.vercel.app
   - Login as admin

3. **Open AI Auto Upload:**
   - Upload 3+ gambar produk
   - Click "Analyze with AI"

4. **Check Console:**
   ```
   ✓ Fetched image: 125456 bytes, type: image/jpeg
   ✓ baju 5: 96% (Model: 98%, Motif: 95%)
   ✅ RECOMMENDED FOR UPLOAD
   ```

---

## 🎯 **Expected Result:**

### Before CORS:
```
❌ Failed to fetch
❌ Error: CORS error
📊 Similarity: 0%
```

### After CORS:
```
✓ Fetched image successfully
✓ Hash similarity: 98%
✓ AI similarity: 96%
📊 Overall: 96% (Model: 98%, Motif: 95%)
✅ RECOMMENDED FOR UPLOAD
```

---

## 🆘 **Troubleshooting**

### Error: "gcloud: command not found"
**Solution:**
- Restart terminal/CMD
- Atau buka **Google Cloud SDK Shell** dari Start Menu

### Error: "gsutil: command not found"
**Solution:**
```bash
gcloud components install gsutil
```

### Error: "AccessDeniedException: 403"
**Solution:**
```bash
# Re-login
gcloud auth login

# Make sure correct account
gcloud auth list

# Set project again
gcloud config set project azzahra-fashion-muslim-ab416
```

### Error: "BucketNotFoundException"
**Solution:**
- Check bucket name spelling
- Bucket: `azzahra-fashion-muslim-ab416.firebasestorage.app`
- Use `.firebasestorage.app` (bukan `.appspot.com`)

---

## 📚 **References**

- Google Cloud SDK: https://cloud.google.com/sdk/docs/install
- Firebase Storage CORS: https://firebase.google.com/docs/storage/web/download-files#cors_configuration
- gsutil cors command: https://cloud.google.com/storage/docs/gsutil/commands/cors

---

## ✨ **After CORS is Applied**

AI Auto Upload akan bisa:
- ✅ Fetch product images dari Firebase Storage
- ✅ Generate image hash untuk consistency
- ✅ Compare dengan Gemini AI (model + motif)
- ✅ Memberikan score 95%+ untuk gambar yang sama
- ✅ Recommendation: RECOMMENDED FOR UPLOAD

**Selamat! AI Auto Upload siap digunakan!** 🎉
