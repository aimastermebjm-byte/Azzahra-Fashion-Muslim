const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

// Load .env file from project root
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini AI for image analysis
// REQUIRED: Set environment variable GEMINI_API_KEY with your API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let visionModel = null;

if (GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  // Use Flash-Lite for faster & cheaper processing
  visionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  console.log('✅ Gemini AI initialized (gemini-2.0-flash-lite)');
} else {
  console.log('⚠️ GEMINI_API_KEY not set - AI features disabled');
}

// ============================================================
// CONFIGURATION - Centralized Settings (sesuai spec)
// ============================================================
const CONFIG = {
  // Bridge Settings
  BUNDLE_WINDOW_MS: 10000,        // 10 detik window untuk bundling (setelah pesan terakhir)

  // Whitelist (nomor yang diizinkan mengirim produk)
  ALLOWED_SENDERS: [
    '6287815990944@c.us',     // Nomor utama
    '6281977514100@c.us'      // Nomor supplier
  ],

  // AI Model
  GEMINI_MODEL: 'gemini-2.0-flash-lite',

  // Optional Features (toggle ON/OFF)
  ENABLE_FULL_BODY_CHECK: false,  // DISABLED - user sudah filter gambar sendiri
  ENABLE_AUTO_UPLOAD: false,       // Langsung upload ke katalog (future)

  // Defaults
  DEFAULT_STOCK: 1,
  DEFAULT_CATEGORY: 'Gamis',
};

console.log('⚙️ CONFIG loaded:', JSON.stringify({
  BUNDLE_WINDOW_MS: CONFIG.BUNDLE_WINDOW_MS,
  ENABLE_FULL_BODY_CHECK: CONFIG.ENABLE_FULL_BODY_CHECK,
  ENABLE_AUTO_UPLOAD: CONFIG.ENABLE_AUTO_UPLOAD
}, null, 2));

// ============================================================
// FAMILY KEYWORDS for conditional processing
// ============================================================
const FAMILY_KEYWORDS = [
  'keluarga', 'sarimbit', 'couple', 'family', 'serimbit',
  'ayah', 'abah', 'bapak', 'daddy', 'papa',
  'mom', 'ibu', 'bunda', 'mommy', 'mama',
  'anak', 'kids', 'junior', 'boy', 'girl'
];

function isFamilyProduct(caption) {
  const lower = caption.toLowerCase();
  return FAMILY_KEYWORDS.some(kw => lower.includes(kw));
}

// ============================================================
// AI CAPTION PARSER (Gemini Flash-Lite)
// ============================================================
async function parseWithAI(caption) {
  if (!visionModel || !caption) return null;

  try {
    const prompt = `Extract product data from this Indonesian fashion caption.
Return ONLY data that exists. Use null if not found.

Caption:
"${caption}"

Output JSON only (no markdown, no explanation):
{
  "nama": string | null,
  "deskripsi": string | null,
  "kategori": string | null,
  "warna": string[] | null,
  "sizes": string[] | null,
  "hargaRetail": number | null,
  "hargaReseller": number | null,
  "stokPerVarian": number | 1,
  "brand": string | null,
  "isFamily": boolean,
  "variants": [{ "nama": string, "size": string, "hargaRetail": number, "hargaReseller": number }] | null,
  "setTypes": [{ "type": string, "hargaRetail": number, "hargaReseller": number }] | null
}

Rules:
- FORMAT CAPTION: "[KATEGORI] [NAMA PRODUK] by [BRAND]"
  Contoh: "gamis delta set by irish label"
  
- kategori: Kata PERTAMA dari caption/nama produk. Harus match PERSIS salah satu:
  Gamis, Tunik, Dress, Hijab, Khimar, Setelan, Outer, Rok, Celana, Aksesoris, Mukena, Pashmina
  * Jika typo/mirip, pilih yang paling dekat (misal "gams" → "Gamis")
  * Jika tidak match → default "Gamis"
  
- nama: IDENTIFIKASI JUDUL UTAMA PRODUK.
  * Ambil baris kalimat SETELAH info "Open PO/Ready" dan SEBELUM baris "By ...".
  * TIDAK SELALU KAPITAL. Ambil teks apa adanya.
  * Format Output: "[JUDUL PRODUK] By [BRAND]"
  * Contoh caption:
    "Open PO
     Anggun Rayya Series
     By Eldeena"
    → nama = "Anggun Rayya Series By Eldeena"
  * JANGAN POTONG jadi cuma "By Eldeena". Harus ada judulnya!
  * Ambil sampai bertemu baris detail (Bahan, Harga, Size, dll).
  
- brand: Kata setelah "by", TAPI HAPUS suffix umum seperti:
  DAILY, OFFICIAL, COLLECTION, STORE, SHOP, LABEL, INDONESIA, ID
  Contoh: "by eR.Ha DAILY" → brand = "eR.Ha"
  Contoh: "by Irish Label Official" → brand = "Irish Label"
  
- kategori: Detect dari JUDUL PRODUK saja (baris nama/judul), BUKAN dari deskripsi detail.
  * Jika judul/nama mengandung kata: "gamis" → "Gamis"
  * "tunik" → "Tunik"
  * "dress" → "Dress"
  * "hijab"/"kerudung"/"jilbab" → "Hijab"
  * "khimar" → "Khimar"
  * "set"/"setelan"/"palazzo" → "Setelan"
  * "outer"/"cardigan"/"blazer" → "Outer"
  * "rok" → "Rok"
  * "celana" → "Celana"
  * "aksesoris"/"bros"/"kalung" → "Aksesoris"
  * "mukena" → "Mukena"
  * "pashmina" → "Pashmina"
  * JIKA TIDAK ADA kata kunci di judul → SELALU return "Gamis"
  * JANGAN ambil kategori dari baris detail seperti "Dress Bahan Lamora..." (itu bukan kategori!)
- sizes: 
  * Jika ada size chart (S, M, L, XL, XXL) → gunakan nama BERSIH. Contoh: ["S", "M", "L", "XL"]
  * Jika HANYA ada PJ/LD/Lingkar tanpa size chart → return ["All Size"]
- stokPerVarian: 
  * Default adalah 1
  * "1 seri" → 1, "3 seri" → 3
- harga: convert "895k" → 895000, "1.250.000" → 1250000
- isFamily: true if contains family/couple/ayah/ibu/anak keywords

- setTypes: PENTING! Jika caption berisi BEBERAPA TIPE PRODUK dengan HARGA BERBEDA, ekstrak ke array:
  * Contoh caption: "SET SCARF Retail 565k Reseller 515k, SET KHIMAR Retail 600k Reseller 550k"
  * → setTypes: [
      { "type": "SET SCARF", "hargaRetail": 565000, "hargaReseller": 515000 },
      { "type": "SET KHIMAR", "hargaRetail": 600000, "hargaReseller": 550000 }
    ]
  * Keywords untuk setTypes: "SET SCARF", "SET KHIMAR", "SET PASHMINA", "GAMIS ONLY", "KHIMAR ONLY", dll
  * Jika hanya ada 1 harga (tidak ada variasi tipe) → setTypes: null
  
- variants: WAJIB EKSTRAK jika ada harga berbeda per tipe/ukuran keluarga!
  Struktur deskripsi sering seperti ini:
  
  HARGA RESELLER:
  - Look l set scraf : 460.000
  - Anak cewe S : 400.000, M : 410.000
  - Daddy S dan M = 245.000, L dan XL = 260.000
  
  HARGA RETAIL:
  - Mom Look l set Scraf : 550.000
  - Anak Girls S = Rp 460.000
  - Size Chart Daddy S : Rp 310.000
  
  UNTUK SETIAP SIZE/TIPE, EKSTRAK KE ARRAY variants:
  [
    { "nama": "Look l set scraf", "size": "", "hargaRetail": 550000, "hargaReseller": 460000 },
    { "nama": "Anak cewe S", "size": "S", "hargaRetail": 460000, "hargaReseller": 400000 },
    { "nama": "Anak cewe M", "size": "M", "hargaRetail": 470000, "hargaReseller": 410000 },
    { "nama": "Daddy S", "size": "S", "hargaRetail": 310000, "hargaReseller": 245000 },
    { "nama": "Daddy M", "size": "M", "hargaRetail": 310000, "hargaReseller": 245000 },
    { "nama": "Boy L", "size": "L", "hargaRetail": 270000, "hargaReseller": 210000 }
  ]
  
  RULES:
  * MATCH nama produk antara Reseller & Retail walaupun sedikit beda (contoh: "Look l" ≈ "Mom Look l", "Anak cewe" ≈ "Size Chart Anak Girls")
  * PAIRING HARGA: Jika harga Retail ada tapi Reseller tidak ada (atau sebaliknya), gunakan estimasi (Reseller ≈ Retail * 0.85), tapi PRIORITY ambil dari teks!
  * STRICT HARGA: Ambil harga persis dari angka di teks. Hati-hati dengan "Rp480.000" (nempel).
  * COMPLEX FORMAT: "S : pb 90 / ld 72 (3-5 th) = Rp 460.000" → Ambil size "S" dan harga "460000" (abaikan pb/ld/th)
  * RANGE SIZE: "Boy L dan XL 210.000" → buat 2 item: Boy L (210rb) dan Boy XL (210rb)
  * HINDARI HALUSINASI: Jangan buat harga 564.000 jika di teks tertulis 470.000. Ambil angka yang tertulis!`;

    const result = await visionModel.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('🤖 AI Parse result:', JSON.stringify(parsed, null, 2));
      return parsed;
    }
  } catch (error) {
    console.error('⚠️ AI parse failed:', error.message);
  }
  return null;
}

// ============================================================
// 1. FIREBASE INITIALIZATION
// ============================================================
const serviceAccountPath = path.join(__dirname, '../service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Service account key tidak ditemukan di:', serviceAccountPath);
  console.error('Harap download dari Firebase Console -> Project Settings -> Service Accounts');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'azzahra-fashion-muslim-ab416.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

console.log('✅ Firebase initialized');
console.log('⏳ Starting WhatsApp client (this may take 30-60 seconds)...');
console.log('   Puppeteer is loading headless Chrome...');

// ============================================================
// 2. SMART BUNDLER (using CONFIG.BUNDLE_WINDOW_MS)
// ============================================================
const PAIRING_WINDOW = CONFIG.BUNDLE_WINDOW_MS; // From CONFIG (60 detik sesuai spec)
let messageBuffer = [];
let processingTimeout = null;

function addToBuffer(item) {
  messageBuffer.push(item);
  console.log(`📥 Buffer: ${messageBuffer.length} items (${item.type})`);

  // Reset timer setiap ada pesan baru
  clearTimeout(processingTimeout);

  // Set timer: proses setelah 15 detik tidak ada pesan baru
  processingTimeout = setTimeout(() => {
    processBundle();
  }, PAIRING_WINDOW);
}

async function processBundle() {
  if (messageBuffer.length === 0) return;

  console.log('⚙️ ===== PROCESSING BUNDLE =====');
  console.log(`📦 Total items: ${messageBuffer.length}`);

  const images = messageBuffer.filter(m => m.type === 'image');
  const texts = messageBuffer.filter(m => m.type === 'text');

  // Clear buffer immediately
  const currentBuffer = [...messageBuffer];
  messageBuffer = [];

  // Combine captions
  const combinedCaption = texts.map(t => t.content).join('\n');
  const imageCaption = images.find(i => i.caption)?.caption || '';
  const finalCaption = combinedCaption || imageCaption;

  console.log(`🖼️ Images: ${images.length}`);
  console.log(`📝 Caption: ${finalCaption.substring(0, 100)}...`);

  if (images.length === 0) {
    console.log('⚠️ No images in bundle, skipping...');
    return;
  }

  try {
    // PARALLEL PROCESSING for speed (target: <25 detik)
    console.log('🚀 Starting parallel processing...');
    const startTime = Date.now();

    // Task 1: AI Caption Parse (1-2 detik)
    const aiParsePromise = parseWithAI(finalCaption);

    // Task 2: Full Body Check (conditional via CONFIG)
    let selectedImages = images;
    let isPreMadeCollage = false;
    let collageVariantCount = 0;

    if (CONFIG.ENABLE_FULL_BODY_CHECK) {
      console.log('🔍 Running Full Body Check (CONFIG enabled)...');
      const selectionResult = await selectBestImages(images);
      selectedImages = selectionResult.images;
      isPreMadeCollage = selectionResult.isPreMadeCollage || false;
      collageVariantCount = selectionResult.collageVariantCount || 0;
    } else {
      console.log('⏩ Skipping Full Body Check (CONFIG disabled)');
    }

    // Task 3: SKIP Collage Generation on VPS - Cloud Function will handle it!
    // This prevents VPS crashes due to memory issues with large images
    console.log('☁️ Collage will be generated by Firebase Cloud Function...');

    // Just collect raw image URLs (already uploaded in message handler)
    const rawImageUrls = selectedImages.map(i => i.storageUrl).filter(Boolean);
    console.log(`📷 Raw images: ${rawImageUrls.length} URLs collected`);

    // Wait for AI parse only
    const aiParsed = await aiParsePromise;

    // Fallback to regex if AI fails
    const regexParsed = parseCaption(finalCaption);
    const parsed = aiParsed || regexParsed;

    // Merge AI result with regex fallback for missing fields
    if (aiParsed) {
      parsed.name = aiParsed.nama || regexParsed.name;
      parsed.description = aiParsed.deskripsi || regexParsed.description;
      parsed.category = aiParsed.kategori || regexParsed.category;
      parsed.retailPrice = aiParsed.hargaRetail || regexParsed.retailPrice;
      parsed.resellerPrice = aiParsed.hargaReseller || regexParsed.resellerPrice;
      parsed.sizes = aiParsed.sizes || regexParsed.sizes;
      parsed.colors = aiParsed.warna || regexParsed.colors;
      parsed.stockPerVariant = aiParsed.stokPerVarian || 1;
      parsed.isFamily = aiParsed.isFamily || isFamilyProduct(finalCaption);
      parsed.variants = aiParsed.variants || null;
      parsed.brand = aiParsed.brand || '';
      parsed.setTypes = aiParsed.setTypes || null; // NEW: Set types with prices (KHIMAR/SCARF)
    }

    console.log('📋 Final parsed data:', JSON.stringify(parsed, null, 2));
    console.log(`⏱️ Processing done in ${Date.now() - startTime}ms`);

    // 3. NO Collage upload on VPS - Cloud Function will handle it
    // Set placeholder URL - will be updated by Cloud Function
    const collageUrl = 'pending://cloud-function-will-generate';
    console.log('☁️ Collage generation delegated to Cloud Function');

    // 4. Save to productDrafts (matches Cloud Function trigger collection)
    const draftData = {
      // Basic info
      name: parsed.name || 'Produk Baru',
      description: finalCaption || '',  // USE ORIGINAL CAPTION as description
      category: parsed.category || CONFIG.DEFAULT_CATEGORY,
      brand: parsed.brand || '',

      // Pricing (default prices, setTypes override per variant)
      retailPrice: parsed.retailPrice || 0,
      resellerPrice: parsed.resellerPrice || 0,
      costPrice: parsed.costPrice || 0,

      // Variants & Stock
      sizes: parsed.sizes || ['All Size'],
      colors: parsed.colors || [],
      stockPerVariant: parsed.stockPerVariant || CONFIG.DEFAULT_STOCK,
      variantCount: isPreMadeCollage ? collageVariantCount : selectedImages.length,
      isPreMadeCollage: isPreMadeCollage,

      // Family product handling
      isFamily: parsed.isFamily || false,
      familyVariants: parsed.variants || null,

      // SET TYPES (KHIMAR/SCARF with individual prices)
      setTypes: parsed.setTypes || null,

      // Images - rawImages will trigger Cloud Function to generate collage
      collageUrl: collageUrl,  // Placeholder, Cloud Function will update
      rawImages: rawImageUrls, // Cloud Function will use these URLs to generate collage

      // Metadata
      source: 'whatsapp-bridge',
      aiParsed: !!aiParsed,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      collageStatus: 'pending',  // Will be 'generated' after Cloud Function

      // Data completeness check
      dataComplete: !!(parsed.name && parsed.retailPrice > 0)
    };

    // Save to product_drafts collection (Cloud Function will trigger on create)
    const docRef = await db.collection('product_drafts').add(draftData);
    console.log('✅ Draft SAVED! ID:', docRef.id);
    console.log('☁️ Cloud Function will generate collage automatically...');
    console.log(`📊 Draft: ${draftData.name} | Retail: ${draftData.retailPrice} | Family: ${draftData.isFamily}`);

  } catch (error) {
    console.error('❌ Bundle processing failed:', error);
  }
}

// ============================================================
// 2B. AI IMAGE ANALYSIS (Gemini Vision) - Enhanced with Hijab/Family Detection
// ============================================================
async function analyzeImageWithAI(imageBuffer) {
  try {
    const base64Image = imageBuffer.toString('base64');

    const prompt = `Analisis gambar fashion ini dengan TELITI:

1. FULL BODY: Apakah model tampil LENGKAP dari KEPALA sampai UJUNG KAKI?
   - Jawab "Ya" HANYA jika kepala + badan + kaki SEMUA terlihat jelas
   - Jawab "Tidak" jika: setengah badan, kepala terpotong, kaki tidak terlihat

2. JUMLAH MODEL: Ada berapa orang/model BERBEDA dalam gambar? (1, 2, 3, dst)

3. WARNA: Warna DOMINAN pakaian UTAMA/INNER (satu kata: Hitam, Abu, Cokelat, Pink, Putih, Cream, Navy)

4. MOTIF: Jenis OUTER atau pattern pakaian (PENTING - perhatikan baik-baik):
   - Jika model MEMAKAI outer/cardigan/blazer/jaket DI ATAS pakaian: jawab "Cardigan"
   - Jika pakaian ada MOTIF/PATTERN/PRINT: jawab "Bermotif"
   - Jika pakaian POLOS tanpa outer dan tanpa motif: jawab "Polos"
   - Jika bahan tile/brukat transparan: jawab "Tile" atau "Brukat"
   - PERHATIKAN: Outer berbeda warna dari dalam = "Cardigan"

5. COLLAGE: Apakah gambar ini adalah KOLASE (gabungan beberapa foto dalam 1 frame)?
   - Jawab "Ya" jika ada garis pemisah atau beberapa foto digabung
   - Jawab "Tidak" jika foto tunggal

6. VARIAN: Jika COLLAGE=Ya, ada berapa varian di dalam kolase? (2, 3, 4, dst)
   - Jika COLLAGE=Tidak, jawab 0

7. HIJAB TYPE: Jenis hijab/kerudung yang dipakai model (PENTING untuk produk SET):
   - "KHIMAR" = Hijab PANJANG yang menutupi dada (biasanya 1 layer, tanpa lipatan di dada)
   - "SCARF" = Hijab PERSEGI yang dilipat segitiga, tampak PENDEK atau ada lipatan di depan dada
   - "PASHMINA" = Hijab panjang rectangular dililit
   - "TANPA" = Tidak pakai hijab
   - PERHATIKAN BAIK-BAIK: Khimar lebih panjang, Scarf lebih pendek dengan lipatan

8. FAMILY TYPE: Siapa yang mengenakan pakaian ini (PENTING untuk busana keluarga):
   - "AYAH" = Model PRIA DEWASA (kemeja, baju koko, dll)
   - "IBU" = Model WANITA DEWASA dengan gamis/dress dewasa
   - "ANAK_LAKI" = Model ANAK LAKI-LAKI (baju koko anak, dll)
   - "ANAK_PEREMPUAN" = Model ANAK PEREMPUAN dengan gamis anak
   - "DEWASA" = Tidak bisa ditentukan (default untuk non-family)

Format jawaban HARUS PERSIS:
FULLBODY:Ya
JUMLAH:1
WARNA:Hitam
MOTIF:Polos
COLLAGE:Tidak
VARIAN:0
HIJAB:KHIMAR
FAMILY:DEWASA`;

    const result = await visionModel.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      }
    ]);

    const response = result.response.text();
    console.log('   🔍 AI Response:', response.replace(/\n/g, ' '));

    // Parse response
    const isFullBody = /FULLBODY\s*:\s*Ya/i.test(response);
    const countMatch = response.match(/JUMLAH\s*:\s*(\d+)/i);
    const modelCount = countMatch ? parseInt(countMatch[1]) : 1;
    const isSingleModel = modelCount === 1;
    const colorMatch = response.match(/WARNA\s*:\s*(\w+)/i);
    const color = colorMatch ? colorMatch[1].toLowerCase() : 'unknown';

    // Motif detection
    const motifMatch = response.match(/MOTIF\s*:\s*(\w+)/i);
    const motif = motifMatch ? motifMatch[1].toLowerCase() : 'polos';

    // Unique key = warna + motif (untuk filter duplikat)
    const uniqueKey = `${color}-${motif}`;

    // Collage detection
    const isCollage = /COLLAGE\s*:\s*Ya/i.test(response);
    const varianMatch = response.match(/VARIAN\s*:\s*(\d+)/i);
    const collageVariantCount = varianMatch ? parseInt(varianMatch[1]) : 0;

    // Hijab type detection (for SET KHIMAR/SCARF products)
    const hijabMatch = response.match(/HIJAB\s*:\s*(\w+)/i);
    const hijabType = hijabMatch ? hijabMatch[1].toUpperCase() : 'UNKNOWN';

    // Family type detection (for busana keluarga)
    const familyMatch = response.match(/FAMILY\s*:\s*(\w+)/i);
    const familyType = familyMatch ? familyMatch[1].toUpperCase() : 'DEWASA';

    // Valid image = full body + single model + NOT collage
    const isValid = isFullBody && isSingleModel && !isCollage;

    console.log(`   📊 Result: FullBody=${isFullBody}, Models=${modelCount}, Color=${color}, Motif=${motif}, Hijab=${hijabType}, Family=${familyType}, Collage=${isCollage}, Valid=${isValid}`);

    return {
      isFullBody, isSingleModel, modelCount, color, motif, uniqueKey,
      isCollage, collageVariantCount, isValid,
      hijabType, familyType
    };
  } catch (error) {
    console.error('   ⚠️ AI analysis failed:', error.message);
    // Fallback: assume valid single model full body
    return {
      isFullBody: true, isSingleModel: true, modelCount: 1,
      color: 'unknown', motif: 'polos', uniqueKey: 'unknown-polos',
      isCollage: false, collageVariantCount: 0, isValid: true,
      hijabType: 'UNKNOWN', familyType: 'DEWASA'
    };
  }
}

async function selectBestImages(images) {
  // Check if Full Body Check is enabled via CONFIG
  if (!CONFIG.ENABLE_FULL_BODY_CHECK) {
    console.log(`📸 Full Body Check DISABLED - using all ${images.length} images`);
    return { images, isPreMadeCollage: false };
  }

  console.log(`📸 Full Body Check ENABLED - analyzing ${images.length} images...`);

  // Analyze each image
  const analyzed = [];
  for (let i = 0; i < images.length; i++) {
    console.log(`   📸 Analyzing image ${i + 1}/${images.length}...`);
    const analysis = await analyzeImageWithAI(images[i].imageBuffer);
    analyzed.push({
      ...images[i],
      ...analysis,
      index: i
    });

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  // SPECIAL CASE: Jika hanya 1 gambar dan itu adalah COLLAGE
  if (images.length === 1 && analyzed[0].isCollage) {
    console.log(`📸 SINGLE COLLAGE detected with ${analyzed[0].collageVariantCount} variants`);
    console.log('   ✨ Using pre-made collage - will add variant labels only');
    return {
      images: analyzed,
      isPreMadeCollage: true,
      collageVariantCount: analyzed[0].collageVariantCount || 2
    };
  }

  // For multiple images: Filter out collages first
  const nonCollageImages = analyzed.filter(img => !img.isCollage);
  if (nonCollageImages.length < analyzed.length) {
    const skippedCount = analyzed.length - nonCollageImages.length;
    console.log(`   🖼️ Filtered out ${skippedCount} collage images from multi-image upload`);
  }

  // Filter: only VALID images (full body + single model + not collage)
  const validImages = nonCollageImages.filter(img => img.isValid);
  console.log(`   ✅ Valid images (full body + 1 model): ${validImages.length}/${analyzed.length}`);

  // Log skipped images with detailed reason
  analyzed.filter(img => !img.isValid).forEach(img => {
    let reason = '';
    if (img.isCollage) reason = 'is a collage';
    else if (!img.isFullBody) reason = 'not full body';
    else if (!img.isSingleModel) reason = `${img.modelCount} models`;
    else reason = 'unknown';
    console.log(`   ❌ Skipped: Image ${img.index + 1} - ${reason}`);
  });

  if (validImages.length === 0) {
    // Fallback: use first 3 non-collage images, or all if no non-collage
    const fallbackImages = nonCollageImages.length > 0 ? nonCollageImages : analyzed;
    console.log('   ⚠️ No valid images, using first 3 as fallback');
    return { images: fallbackImages.slice(0, 3), isPreMadeCollage: false };
  }

  // SIMPLE MODE: Ambil SEMUA gambar full body yang valid
  // Tidak ada filter warna/motif - tugas user pastikan gambar sudah berbeda
  console.log(`🎯 Final selection: ${validImages.length} valid full body images (no color/motif filter)`);
  validImages.forEach((img, i) => {
    console.log(`   🎨 Selected: Image ${img.index + 1} - ${img.uniqueKey || img.color}`);
  });

  return { images: validImages, isPreMadeCollage: false };
}

// ============================================================
// 3. CAPTION PARSER (Enhanced with Sizes & Colors)
// ============================================================
function parseCaption(caption) {
  if (!caption) {
    return {
      name: 'Produk Baru',
      description: '',
      category: 'Gamis',
      retailPrice: 0,
      resellerPrice: 0,
      costPrice: 0,
      sizes: ['All Size'],
      colors: []
    };
  }

  const lines = caption.split('\n').map(l => l.trim()).filter(Boolean);

  // Find product name (skip lines starting with Estimasi, Ready, PO, etc)
  let name = 'Produk Baru';
  for (const line of lines) {
    const skipPatterns = /^(estimasi|ready|po\s|pre.?order|open\s|close|limited|grab|happy|#)/i;
    if (!skipPatterns.test(line) && line.length > 3 && line.length < 50) {
      // Check if it looks like a product name (mostly uppercase or title case)
      if (/^[A-Z][A-Za-z\s\d-]+$/.test(line) || /^[A-Z\s]+$/.test(line)) {
        name = line;
        break;
      }
    }
  }
  // Fallback to first non-trivial line
  if (name === 'Produk Baru' && lines.length > 0) {
    name = lines.find(l => l.length > 5 && !/^(estimasi|ready|#)/i.test(l)) || lines[0];
  }

  const description = lines.slice(1).join('\n');
  const cleanText = caption.toLowerCase();

  // ========== EXTRACT SIZES ==========
  let sizes = [];

  // Pattern 1: Size Chart section (e.g. "Size Chart\nS : LD 96\nM : LD 100")
  const sizeChartMatch = caption.match(/size\s*(?:chart)?[\s:]*\n([\s\S]*?)(?:\n\n|\nWeight|$)/i);
  if (sizeChartMatch) {
    const sizeLines = sizeChartMatch[1];
    const foundSizes = sizeLines.match(/\b(S|M|L|XL|XXL|XXXL|2XL|3XL)\b/gi);
    if (foundSizes) {
      sizes = [...new Set(foundSizes.map(s => s.toUpperCase()))];
      console.log('   📏 Size Chart detected:', sizes);
    }
  }

  // Pattern 2: Range format "S sampai XL" or "S-XL" or "size S - XL"
  if (sizes.length === 0) {
    const rangeMatch = caption.match(/(?:size[\s:]*)?([SMLX]+)\s*(?:-|sampai|s\.d\.?|hingga|to)\s*([SMLX]+)/i);
    if (rangeMatch) {
      const allSizes = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
      const start = allSizes.indexOf(rangeMatch[1].toUpperCase());
      const end = allSizes.indexOf(rangeMatch[2].toUpperCase());
      if (start >= 0 && end >= start) {
        sizes = allSizes.slice(start, end + 1);
        console.log('   📏 Size range detected:', sizes);
      }
    }
  }

  // Pattern 3: Inline sizes like "S M L XL" or "S/M/L/XL" or "S,M,L,XL"
  if (sizes.length === 0) {
    const inlineSizeMatch = caption.match(/\b((?:[SMLX]{1,3}[\s,/]+)+[SMLX]{1,3})\b/i);
    if (inlineSizeMatch) {
      sizes = inlineSizeMatch[1].split(/[\s,/]+/).filter(s => /^[SMLX]+$/i.test(s)).map(s => s.toUpperCase());
      sizes = [...new Set(sizes)];
      console.log('   📏 Inline sizes detected:', sizes);
    }
  }

  // Default
  if (sizes.length === 0) {
    sizes = ['All Size'];
    console.log('   📏 No size detected, using default: All Size');
  }

  // ========== EXTRACT COLORS ==========
  let colors = [];

  // Pattern 1: "Tersedia warna: Black, Navy" or multiline "warna :\nBlack,Navy"
  const colorLineMatch = caption.match(/(?:warna|color|pilihan)[:\s]*[\n]?([^\n]+(?:,[^\n]+)*)/i);
  if (colorLineMatch) {
    let colorText = colorLineMatch[1].trim();
    // Remove leading/trailing punctuation and whitespace
    colorText = colorText.replace(/^[:\s]+|[:\s]+$/g, '');
    // Split by comma, "dan", "/", newline
    const extracted = colorText.split(/[,\/\n]|\sdan\s|\s&\s/i)
      .map(c => c.trim())
      .filter(c => c.length > 1 && c.length < 25 && !/^[\d\s:]+$/.test(c) && !/^warna$/i.test(c));
    if (extracted.length > 0) {
      colors = extracted;
      console.log('   🎨 Colors detected from pattern:', colors);
    }
  }

  // Pattern 2: Common color names in text (fallback)
  if (colors.length === 0) {
    const commonColors = ['hitam', 'black', 'navy', 'putih', 'white', 'coklat', 'brown', 'mocca', 'mocha',
      'maroon', 'merah', 'red', 'biru', 'blue', 'hijau', 'green', 'abu', 'grey', 'gray',
      'sage', 'dusty', 'pink', 'cream', 'krem', 'army', 'milo', 'wine', 'beige', 'olive'];
    commonColors.forEach(color => {
      if (cleanText.includes(color) && !colors.includes(color)) {
        colors.push(color.charAt(0).toUpperCase() + color.slice(1));
      }
    });
    if (colors.length > 0) {
      console.log('   🎨 Colors detected from common names:', colors);
    }
  }

  // ========== EXTRACT PRICE ==========
  let retailPrice = 0;
  let resellerPrice = 0;

  // Pattern 1: "Retail 895.000 Resell 825k"
  const retailResellMatch = caption.match(/(?:retail|idr|rp)?[\s:]*?(\d[\d.,]+)\s*(?:resell|reseller)[\s:]*?(\d[\d.,k]+)/i);
  if (retailResellMatch) {
    retailPrice = parsePrice(retailResellMatch[1]);
    resellerPrice = parsePrice(retailResellMatch[2]);
  }

  // Pattern 2: Just price like "895.000" or "895k"
  if (retailPrice === 0) {
    const suffixMatch = cleanText.match(/(\d+(?:[.,]\d+)?)\s*(rb|k|ribu|jt)/);
    if (suffixMatch) {
      const val = parseFloat(suffixMatch[1].replace(',', '.'));
      retailPrice = suffixMatch[2] === 'jt' ? val * 1000000 : val * 1000;
    }
  }

  // Pattern 3: "Rp 450.000" or "IDR 150,000"
  if (retailPrice === 0) {
    const currencyMatch = cleanText.match(/(?:rp|idr)\s*\.?\s*([\d,.]+)/);
    if (currencyMatch) {
      retailPrice = parseInt(currencyMatch[1].replace(/[^0-9]/g, ''), 10);
    }
  }

  // Pattern 4: Fallback - numbers in price range
  if (retailPrice === 0) {
    const numberMatches = cleanText.match(/[\d,.]+/g);
    if (numberMatches) {
      const potentialPrices = numberMatches
        .map(m => parseInt(m.replace(/[^0-9]/g, ''), 10))
        .filter(n => n >= 25000 && n <= 2000000);
      if (potentialPrices.length > 0) retailPrice = Math.max(...potentialPrices);
    }
  }

  // Calculate reseller if not found
  if (resellerPrice === 0 && retailPrice > 0) {
    resellerPrice = Math.round(retailPrice * 0.9);
  }
  const costPrice = Math.max(0, resellerPrice - 30000);

  // Detect category
  let category = 'Gamis';
  if (/hijab/i.test(caption)) category = 'Hijab';
  else if (/khimar/i.test(caption)) category = 'Khimar';
  else if (/tunik/i.test(caption)) category = 'Tunik';
  else if (/mukena/i.test(caption)) category = 'Mukena';
  else if (/palazzo|outer|set\s/i.test(caption)) category = 'Set';

  return { name, description, category, retailPrice, resellerPrice, costPrice, sizes, colors };
}

// Helper function to parse price strings
function parsePrice(str) {
  if (!str) return 0;
  const clean = str.toLowerCase().replace(/[^\d.,k]/g, '');
  if (clean.includes('k')) {
    return parseFloat(clean.replace('k', '')) * 1000;
  }
  return parseInt(clean.replace(/[.,]/g, ''), 10) || 0;
}

// ============================================================
// 4. COLLAGE GENERATOR (Using Jimp - Same Layout as Frontend)
// ============================================================
async function generateCollage(imageBuffers) {
  const W = 1500;
  const H = 2000;
  const count = imageBuffers.length;

  // Create white canvas (Jimp v1.x API)
  const canvas = new Jimp({ width: W, height: H, color: 0xFFFFFFFF });

  // Load all images
  const loadedImages = await Promise.all(
    imageBuffers.map(buf => Jimp.read(buf))
  );

  // Get layout
  const layout = calculateLayout(count, W, H);

  // Draw each image
  for (let i = 0; i < Math.min(loadedImages.length, layout.length); i++) {
    const img = loadedImages[i];
    const box = layout[i];
    const label = String.fromCharCode(65 + i); // A, B, C, ...

    // Draw image with cover fit (top-anchor)
    drawImageInBox(canvas, img, box);

    // Draw label (no longer async in v1.x)
    drawLabel(canvas, label, box);

    // Draw white border
    drawBorder(canvas, box);
  }

  // Export as JPEG buffer (Jimp v1.x uses getBuffer)
  return canvas.getBuffer('image/jpeg');
}

function calculateLayout(count, W, H) {
  const boxes = [];

  if (count === 1) {
    boxes.push({ x: 0, y: 0, w: W, h: H });
  }
  else if (count === 2) {
    const w = W / 2;
    boxes.push({ x: 0, y: 0, w: w, h: H });
    boxes.push({ x: w, y: 0, w: w, h: H });
  }
  else if (count === 3) {
    const wHalf = W / 2;
    const hHalf = H / 2;
    boxes.push({ x: 0, y: 0, w: wHalf, h: H });
    boxes.push({ x: wHalf, y: 0, w: wHalf, h: hHalf });
    boxes.push({ x: wHalf, y: hHalf, w: wHalf, h: hHalf });
  }
  else if (count === 4) {
    const w = W / 2;
    const h = H / 2;
    boxes.push({ x: 0, y: 0, w: w, h: h });
    boxes.push({ x: w, y: 0, w: w, h: h });
    boxes.push({ x: 0, y: h, w: w, h: h });
    boxes.push({ x: w, y: h, w: w, h: h });
  }
  else if (count === 5) {
    const hTop = H * 0.5;
    const hBot = H * 0.5;
    const wTop = W / 2;
    const wBot = W / 3;
    boxes.push({ x: 0, y: 0, w: wTop, h: hTop });
    boxes.push({ x: wTop, y: 0, w: wTop, h: hTop });
    boxes.push({ x: 0, y: hTop, w: wBot, h: hBot });
    boxes.push({ x: wBot, y: hTop, w: wBot, h: hBot });
    boxes.push({ x: wBot * 2, y: hTop, w: wBot, h: hBot });
  }
  else if (count === 6) {
    // 3 top + 3 bottom (same as frontend)
    const h = H / 2;
    const w = W / 3;
    // Row 1: 3 items
    for (let c = 0; c < 3; c++) {
      boxes.push({ x: c * w, y: 0, w: w, h: h });
    }
    // Row 2: 3 items
    for (let c = 0; c < 3; c++) {
      boxes.push({ x: c * w, y: h, w: w, h: h });
    }
  }
  else if (count === 7) {
    // 3 top + 4 bottom (same as frontend)
    const h = H / 2;
    const wTop = W / 3;
    const wBot = W / 4;
    // Row 1: 3 items
    for (let c = 0; c < 3; c++) {
      boxes.push({ x: c * wTop, y: 0, w: wTop, h: h });
    }
    // Row 2: 4 items
    for (let c = 0; c < 4; c++) {
      boxes.push({ x: c * wBot, y: h, w: wBot, h: h });
    }
  }
  else if (count === 8) {
    // 4 top + 4 bottom (same as frontend)
    const h = H / 2;
    const w = W / 4;
    // Row 1: 4 items
    for (let c = 0; c < 4; c++) {
      boxes.push({ x: c * w, y: 0, w: w, h: h });
    }
    // Row 2: 4 items
    for (let c = 0; c < 4; c++) {
      boxes.push({ x: c * w, y: h, w: w, h: h });
    }
  }
  else if (count === 9) {
    // 4 top + 5 bottom (same as frontend)
    const h = H / 2;
    const wTop = W / 4;
    const wBot = W / 5;
    // Row 1: 4 items
    for (let c = 0; c < 4; c++) {
      boxes.push({ x: c * wTop, y: 0, w: wTop, h: h });
    }
    // Row 2: 5 items
    for (let c = 0; c < 5; c++) {
      boxes.push({ x: c * wBot, y: h, w: wBot, h: h });
    }
  }
  else if (count === 10) {
    // 5 top + 5 bottom (same as frontend)
    const h = H / 2;
    const w = W / 5;
    // Row 1: 5 items
    for (let c = 0; c < 5; c++) {
      boxes.push({ x: c * w, y: 0, w: w, h: h });
    }
    // Row 2: 5 items
    for (let c = 0; c < 5; c++) {
      boxes.push({ x: c * w, y: h, w: w, h: h });
    }
  }
  else {
    // Fallback grid
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const w = W / cols;
    const h = H / rows;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      boxes.push({ x: c * w, y: r * h, w: w, h: h });
    }
  }

  return boxes;
}

function drawImageInBox(canvas, img, box) {
  // Object-fit: cover with top-anchor (Jimp v1.x uses .width/.height)
  const scale = Math.max(box.w / img.width, box.h / img.height);
  const scaledW = Math.round(img.width * scale);
  const scaledH = Math.round(img.height * scale);

  // Resize image (Jimp v1.x API)
  const resized = img.clone().resize({ w: scaledW, h: scaledH });

  // Calculate position: Center X, Top Y anchor
  let dx = Math.round((box.w - scaledW) / 2); // Offset within box
  let dy = 0; // Top anchor

  // Crop the resized image to fit exactly in the box
  // This prevents overflow into adjacent cells
  const cropX = dx < 0 ? -dx : 0;
  const cropY = dy < 0 ? -dy : 0;
  const cropW = Math.min(scaledW - cropX, box.w);
  const cropH = Math.min(scaledH - cropY, box.h);

  // Apply crop to prevent overflow
  const cropped = resized.crop({ x: cropX, y: cropY, w: cropW, h: cropH });

  // Final position on canvas
  const finalX = Math.round(box.x + (dx < 0 ? 0 : dx));
  const finalY = Math.round(box.y);

  // Composite onto canvas
  canvas.composite(cropped, finalX, finalY);
}

function drawLabel(canvas, label, box) {
  // Match frontend style: black box with white letter at 3/4 down position
  const labelSize = 100; // Fixed size like frontend
  const centerX = Math.round(box.x + box.w / 2);
  // Position at 3/4 down the cell (same as frontend)
  const positionY = Math.round(box.y + box.h * 0.75);

  const x = Math.round(centerX - labelSize / 2);
  const y = Math.round(positionY - labelSize / 2);

  // Jimp color format is RGBA (0xRRGGBBAA)
  // Black with 60% opacity = rgba(0, 0, 0, 0.6) = 0x00000099 is WRONG
  // Jimp uses 0xRRGGBBAA, so black with ~60% opacity (alpha=0x99) = 0x00000099 is actually correct
  // But let's use fully opaque black for better visibility: 0x000000FF
  const bgColor = 0x000000CC; // Black with 80% opacity for better visibility
  for (let px = Math.max(0, x); px < Math.min(canvas.width, x + labelSize); px++) {
    for (let py = Math.max(0, y); py < Math.min(canvas.height, y + labelSize); py++) {
      canvas.setPixelColor(bgColor, px, py);
    }
  }

  // Draw white border (4px)
  const borderColor = 0xFFFFFFFF; // Solid white
  const borderWidth = 4;
  // Top and bottom borders
  for (let px = x; px < x + labelSize; px++) {
    for (let i = 0; i < borderWidth; i++) {
      if (y + i >= 0 && y + i < canvas.height) canvas.setPixelColor(borderColor, px, y + i);
      if (y + labelSize - 1 - i >= 0 && y + labelSize - 1 - i < canvas.height) canvas.setPixelColor(borderColor, px, y + labelSize - 1 - i);
    }
  }
  // Left and right borders
  for (let py = y; py < y + labelSize; py++) {
    for (let i = 0; i < borderWidth; i++) {
      if (x + i >= 0 && x + i < canvas.width) canvas.setPixelColor(borderColor, x + i, py);
      if (x + labelSize - 1 - i >= 0 && x + labelSize - 1 - i < canvas.width) canvas.setPixelColor(borderColor, x + labelSize - 1 - i, py);
    }
  }

  // Draw letter using simple pixel bitmap (5x7 grid scaled up) in WHITE
  const letterPatterns = {
    'A': ['  #  ', ' # # ', '#   #', '#####', '#   #', '#   #', '#   #'],
    'B': ['#### ', '#   #', '#### ', '#   #', '#   #', '#   #', '#### '],
    'C': [' ### ', '#   #', '#    ', '#    ', '#    ', '#   #', ' ### '],
    'D': ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
    'E': ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
    'F': ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#    '],
    'G': [' ### ', '#   #', '#    ', '# ###', '#   #', '#   #', ' ### '],
    'H': ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
    'I': ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '#####'],
    'J': ['#####', '    #', '    #', '    #', '#   #', '#   #', ' ### ']
  };

  const pattern = letterPatterns[label] || letterPatterns['A'];
  const pixelSize = 10; // Size of each "pixel" in the letter
  const letterWidth = 5 * pixelSize;
  const letterHeight = 7 * pixelSize;
  const letterX = x + (labelSize - letterWidth) / 2;
  const letterY = y + (labelSize - letterHeight) / 2;

  // Draw each pixel of the letter in WHITE
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (pattern[row][col] === '#') {
        for (let px = 0; px < pixelSize; px++) {
          for (let py = 0; py < pixelSize; py++) {
            const drawX = Math.round(letterX + col * pixelSize + px);
            const drawY = Math.round(letterY + row * pixelSize + py);
            if (drawX >= 0 && drawX < canvas.width && drawY >= 0 && drawY < canvas.height) {
              canvas.setPixelColor(0xFFFFFFFF, drawX, drawY); // White color
            }
          }
        }
      }
    }
  }

  console.log(`   Label ${label} drawn at (${centerX}, ${positionY})`);
}

function drawBorder(canvas, box) {
  const borderWidth = 4;
  const color = 0xFFFFFFFF; // White

  // Top & Bottom borders (Jimp v1.x uses .width/.height)
  for (let px = Math.floor(box.x); px < Math.floor(box.x + box.w); px++) {
    for (let i = 0; i < borderWidth; i++) {
      if (box.y + i < canvas.height) canvas.setPixelColor(color, px, Math.floor(box.y + i));
      if (box.y + box.h - 1 - i >= 0) canvas.setPixelColor(color, px, Math.floor(box.y + box.h - 1 - i));
    }
  }
  // Left & Right borders
  for (let py = Math.floor(box.y); py < Math.floor(box.y + box.h); py++) {
    for (let i = 0; i < borderWidth; i++) {
      if (box.x + i < canvas.width) canvas.setPixelColor(color, Math.floor(box.x + i), py);
      if (box.x + box.w - 1 - i >= 0) canvas.setPixelColor(color, Math.floor(box.x + box.w - 1 - i), py);
    }
  }
}

// ============================================================
// 5. WHATSAPP CLIENT WITH AUTO-RECONNECT
// ============================================================
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let heartbeatInterval = null;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
    timeout: 60000 // 60 second timeout
  },
  qrMaxRetries: 5
});

client.on('qr', (qr) => {
  console.log('');
  console.log('📱 =========================================');
  console.log('   SCAN QR CODE INI DENGAN WHATSAPP ANDA:');
  console.log('=========================================');
  qrcode.generate(qr, { small: true });
  console.log('⚠️  QR akan expired dalam 60 detik');
  console.log('');
});

client.on('loading_screen', (percent, message) => {
  console.log(`⏳ Loading: ${percent}% - ${message}`);
});

client.on('authenticated', () => {
  console.log('✅ AUTHENTICATED - Session tersimpan');
  reconnectAttempts = 0; // Reset counter on successful auth
});

client.on('auth_failure', msg => {
  console.error('❌ AUTHENTICATION FAILURE:', msg);
  console.log('💡 Coba hapus folder .wwebjs_auth dan scan ulang QR');
});

client.on('ready', () => {
  isConnected = true;
  reconnectAttempts = 0;

  console.log('');
  console.log('🚀 =========================================');
  console.log('   WHATSAPP BRIDGE + AUTO-DRAFT PROCESSOR');
  console.log('   ✅ CONNECTED - Ready to receive messages!');
  console.log('=========================================');
  console.log('');
  console.log('📱 Kirim gambar + caption ke Note to Self');
  console.log('⏱️  Bundle akan diproses 15 detik setelah pesan terakhir');
  console.log('📦 Draft akan otomatis muncul di Dashboard');
  console.log('');
  console.log('💚 Heartbeat aktif - Log tiap 60 detik');
  console.log('');

  // Start heartbeat
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (isConnected) {
      const now = new Date().toLocaleTimeString('id-ID');
      console.log(`🟢 [${now}] Connected - Waiting for messages...`);
    }
  }, 60000); // Every 60 seconds

  // Start notification queue listener
  startNotificationQueueListener();
});

// ============================================================
// 6. NOTIFICATION QUEUE LISTENER (Send queued WhatsApp notifications)
// ============================================================
let notificationListener = null;

function startNotificationQueueListener() {
  console.log('📬 Starting notification queue listener...');

  // Listen to pending notifications
  notificationListener = db.collection('notificationQueue')
    .where('status', '==', 'pending')
    .onSnapshot(async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const doc = change.doc;
          const data = doc.data();

          console.log(`📨 New notification: ${data.type} for ${data.phoneNumber}`);

          // Send via WhatsApp
          try {
            await sendWhatsAppNotification(doc.id, data);
          } catch (error) {
            console.error(`❌ Failed to send notification ${doc.id}:`, error);
          }
        }
      }
    }, (error) => {
      console.error('❌ Notification queue listener error:', error);
    });

  console.log('✅ Notification queue listener active');
}

async function sendWhatsAppNotification(docId, data) {
  if (!isConnected) {
    console.log('⚠️ WhatsApp not connected, skipping notification');
    return;
  }

  const { phoneNumber, message, attempts = 0 } = data;

  // Validate phone number
  if (!phoneNumber || phoneNumber.length < 10) {
    console.log(`⚠️ Invalid phone number: ${phoneNumber}`);
    await db.collection('notificationQueue').doc(docId).update({
      status: 'failed',
      errorMessage: 'Invalid phone number',
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return;
  }

  // Format phone number for WhatsApp (must be 628xxx@c.us format)
  let formattedPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('62')) {
    formattedPhone = '62' + formattedPhone;
  }
  const chatId = formattedPhone + '@c.us';

  console.log(`📤 Sending to ${chatId}...`);

  try {
    await client.sendMessage(chatId, message);

    // Mark as sent
    await db.collection('notificationQueue').doc(docId).update({
      status: 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      attempts: attempts + 1
    });

    console.log(`✅ Notification sent successfully to ${formattedPhone}`);

  } catch (error) {
    console.error(`❌ Send failed:`, error.message);

    // Update with error
    await db.collection('notificationQueue').doc(docId).update({
      status: attempts >= 2 ? 'failed' : 'pending',
      errorMessage: error.message,
      attempts: attempts + 1,
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

client.on('disconnected', async (reason) => {
  isConnected = false;
  console.error('');
  console.error('🔴 =========================================');
  console.error(`   DISCONNECTED: ${reason}`);
  console.error('=========================================');

  // Stop heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Auto-reconnect
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    const delay = Math.min(reconnectAttempts * 5000, 30000); // 5s, 10s, 15s... max 30s
    console.log(`🔄 Auto-reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s...`);

    setTimeout(async () => {
      try {
        console.log('🔄 Reconnecting...');
        await client.initialize();
      } catch (err) {
        console.error('❌ Reconnect failed:', err.message);
      }
    }, delay);
  } else {
    console.error('❌ Max reconnect attempts reached. Please restart manually.');
    console.log('💡 Run: node scripts/whatsapp-bridge.cjs');
  }
});

client.on('change_state', (state) => {
  console.log(`📶 Connection state: ${state}`);
  if (state === 'CONNECTED') {
    isConnected = true;
  } else if (state === 'UNPAIRED' || state === 'CONFLICT') {
    isConnected = false;
  }
});

// --- WHITELIST (using CONFIG.ALLOWED_SENDERS) ---
const ALLOWED_NUMBERS = CONFIG.ALLOWED_SENDERS;

client.on('message_create', async (msg) => {
  if (!isConnected) {
    console.log('⚠️ Not connected, ignoring message');
    return;
  }

  const isAllowed = msg.fromMe || ALLOWED_NUMBERS.includes(msg.from);

  if (!isAllowed) {
    return; // Ignore
  }

  console.log(`📨 Message from ${msg.fromMe ? 'Me' : msg.from} | HasMedia: ${msg.hasMedia}`);

  if (msg.hasMedia) {
    try {
      const media = await msg.downloadMedia();
      if (!media || !media.mimetype.startsWith('image/')) {
        console.log('⚠️ Not an image, skipping');
        return;
      }

      const caption = msg.body || msg.caption || '';
      const imageBuffer = Buffer.from(media.data, 'base64');

      // Upload to storage for backup
      const filename = `pending_uploads/wa_${Date.now()}.${media.mimetype.split('/')[1]}`;
      const file = bucket.file(filename);
      await file.save(imageBuffer, { metadata: { contentType: media.mimetype } });
      const [url] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });

      addToBuffer({
        type: 'image',
        imageBuffer: imageBuffer,
        storageUrl: url,
        caption: caption,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Error processing image:', error);
    }
  } else if (msg.body && msg.body.trim()) {
    // Text message
    addToBuffer({
      type: 'text',
      content: msg.body,
      timestamp: Date.now()
    });
  }
});

// Handle process signals for graceful shutdown
process.on('SIGINT', async () => {
  console.log('');
  console.log('🛑 Shutting down gracefully...');
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  await client.destroy();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Don't exit - try to keep running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  // Don't exit - try to keep running
});

console.log('🚀 Starting WhatsApp Bridge with Auto-Draft Processor...');
console.log('⏳ Initializing (this may take 30-60 seconds first time)...');
console.log('');
client.initialize();

