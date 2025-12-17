# Firebase Storage CORS Setup untuk AI Auto Upload

## ⚠️ Problem
AI Auto Upload tidak bisa fetch gambar produk dari Firebase Storage karena CORS error:
```
Failed to fetch
net::ERR_FAILED
CORS error: Cannot fetch image from Firebase Storage
```

## ✅ Solution: Apply CORS Configuration

### Option 1: Using gsutil (Recommended)

#### Step 1: Install Google Cloud SDK
Download dan install dari: https://cloud.google.com/sdk/docs/install

#### Step 2: Authenticate
```bash
gcloud auth login
```

#### Step 3: Apply CORS
```bash
gsutil cors set cors.json gs://azzahra-fashion-muslim-ab416.firebasestorage.app
```

**Atau gunakan batch script:**
```bash
apply-storage-cors.bat
```

### Option 2: Using Firebase Console (Manual)

1. Buka Firebase Console: https://console.firebase.google.com/
2. Pilih project: Azzahra Fashion Muslim
3. Go to **Storage** → **Files**
4. Klik **Rules** tab
5. Update rules untuk allow CORS

### CORS Configuration (`cors.json`)

```json
[
  {
    "origin": ["*"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]
```

**Explanation:**
- `origin: ["*"]` - Allow requests from any domain (bisa diganti dengan domain spesifik untuk security)
- `method: ["GET"]` - Only allow GET requests
- `maxAgeSeconds: 3600` - Cache preflight request for 1 hour

### Security Best Practice

Untuk production, ganti `"*"` dengan domain spesifik:

```json
[
  {
    "origin": ["https://azzahra-fashion-muslim.vercel.app"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]
```

### Verify CORS is Applied

```bash
gsutil cors get gs://azzahra-fashion-muslim-ab416.firebasestorage.app
```

Expected output:
```json
[{"maxAgeSeconds": 3600, "method": ["GET"], "origin": ["*"]}]
```

### Test After Applying CORS

1. Clear browser cache: Ctrl+Shift+Delete
2. Reload app
3. Open AI Auto Upload modal
4. Upload 3+ images
5. Check console - should see:
   ```
   ✓ Fetched image: 123456 bytes, type: image/jpeg
   ✓ Product Name: 95% (Model: 98%, Motif: 92%)
   ```

## 📚 References

- Firebase Storage CORS: https://firebase.google.com/docs/storage/web/download-files#cors_configuration
- Google Cloud CORS: https://cloud.google.com/storage/docs/configuring-cors
- gsutil cors command: https://cloud.google.com/storage/docs/gsutil/commands/cors

## ✨ After CORS is Applied

AI Auto Upload akan bisa:
- ✅ Fetch product images dari Firebase Storage
- ✅ Generate image hash untuk consistency
- ✅ Compare dengan Gemini AI Image Understanding
- ✅ Memberikan recommendation berdasarkan similarity >80%

**Expected Result untuk gambar yang sama:**
```
✓ baju 5: 95%+ similarity (Model: 98%, Motif: 95%)
✅ RECOMMENDED FOR UPLOAD
```
