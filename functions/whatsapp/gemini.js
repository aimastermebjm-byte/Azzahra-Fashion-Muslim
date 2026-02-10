const { GoogleGenerativeAI } = require('@google/generative-ai');
const { logger } = require("firebase-functions");

// Default Configuration
const CONFIG = {
    DEFAULT_CATEGORY: 'Gamis',
    DEFAULT_STOCK: 1,
    GEMINI_MODEL: 'gemini-2.0-flash-lite'
};

// Initialize Gemini
// Note: We access the API ID from process.env or config
// For now we will use the same hardcoded key pattern if not in env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyB5oDXhIXOaOrukCayVPCdRtbvHSTAqUo4";
// ^ WARNING: In production use defineSecret

let visionModel = null;
if (GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    visionModel = genAI.getGenerativeModel({ model: CONFIG.GEMINI_MODEL });
}

const FAMILY_KEYWORDS = [
    'keluarga', 'sarimbit', 'couple', 'family', 'serimbit',
    'ayah', 'abah', 'bapak', 'daddy', 'papa',
    'mom', 'ibu', 'bunda', 'mommy', 'mama',
    'anak', 'kids', 'junior', 'boy', 'girl'
];

function isFamilyProduct(caption) {
    if (!caption) return false;
    const lower = caption.toLowerCase();
    return FAMILY_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Parse Caption using Gemini Flash-Lite
 */
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
- sizes: EKSTRAK SEMUA SIZE yang tersedia dari deskripsi.
  * Format umum: "Available Size : S | M | L | XL", "Size S M L XL", "Ukuran: S, M, L"
  * Jika ada S, M, L, XL, XXL → return array: ["S", "M", "L", "XL"]
  * HATI-HATI dengan separator: bisa pakai "|", ",", " ", atau "-"
  * Contoh: "Available Size : S | M | L | XL" → ["S", "M", "L", "XL"]
  * Contoh: "Size S M L XL XXL" → ["S", "M", "L", "XL", "XXL"]
  * HANYA return ["All Size"] jika TIDAK ADA size chart (hanya ada PJ/LD/Lingkar)
- stokPerVarian: 
  * Default adalah 1
  * "1 seri" → 1, "3 seri" → 3
- hargaRetail & hargaReseller: EKSTRAK DARI TEKS, JANGAN ESTIMASI!
  * Format umum:
    - "Harga Rp. 1.250.000" → hargaRetail: 1250000
    - "reseller Rp. 1.150.000" → hargaReseller: 1150000
    - "Retail 565k Reseller 515k" → retail: 565000, reseller: 515000
  * PRIORITAS: Ambil angka yang TERTULIS di teks!
  * JANGAN hitung estimasi (misal Retail × 0.9) jika harga sudah ada di teks!
  * Convert: "1.250.000" → 1250000, "895k" → 895000, "Rp 310.000" → 310000
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

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            logger.info('🤖 AI Parse result:', JSON.stringify(parsed, null, 2));
            return parsed;
        }
    } catch (error) {
        logger.error('⚠️ AI parse failed:', error.message);
    }
    return null;
}

/**
 * Regex Fallback Parser
 */
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
    let name = 'Produk Baru';
    // Logic for name extraction
    for (const line of lines) {
        const skipPatterns = /^(estimasi|ready|po\s|pre.?order|open\s|close|limited|grab|happy|#)/i;
        if (!skipPatterns.test(line) && line.length > 3 && line.length < 50) {
            if (/^[A-Z][A-Za-z\s\d-]+$/.test(line) || /^[A-Z\s]+$/.test(line)) {
                name = line;
                break;
            }
        }
    }
    if (name === 'Produk Baru' && lines.length > 0) {
        name = lines.find(l => l.length > 5 && !/^(estimasi|ready|#)/i.test(l)) || lines[0];
    }

    const description = lines.slice(1).join('\n');
    const cleanText = caption.toLowerCase();

    // Size detection
    let sizes = [];
    // ... Simplified regex logic for sizes ...
    const inlineSizeMatch = caption.match(/\b((?:[SMLX]{1,3}[\s,/]+)+[SMLX]{1,3})\b/i);
    if (inlineSizeMatch) {
        sizes = inlineSizeMatch[1].split(/[\s,/]+/).filter(s => /^[SMLX]+$/i.test(s)).map(s => s.toUpperCase());
        sizes = [...new Set(sizes)];
    }
    if (sizes.length === 0) sizes = ['All Size'];

    // Price detection
    let retailPrice = 0;
    let resellerPrice = 0;

    const retailResellMatch = caption.match(/(?:retail|idr|rp)?[\s:]*?(\d[\d.,]+)\s*(?:resell|reseller)[\s:]*?(\d[\d.,k]+)/i);
    if (retailResellMatch) {
        retailPrice = parsePrice(retailResellMatch[1]);
        resellerPrice = parsePrice(retailResellMatch[2]);
    } else {
        const suffixMatch = cleanText.match(/(\d+(?:[.,]\d+)?)\s*(rb|k|ribu|jt)/);
        if (suffixMatch) {
            const val = parseFloat(suffixMatch[1].replace(',', '.'));
            retailPrice = suffixMatch[2] === 'jt' ? val * 1000000 : val * 1000;
        }
    }

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

    return { name, description, category, retailPrice, resellerPrice, costPrice, sizes, colors: [] };
}

function parsePrice(str) {
    if (!str) return 0;
    const clean = str.toLowerCase().replace(/[^\d.,k]/g, '');
    if (clean.includes('k')) {
        return parseFloat(clean.replace('k', '')) * 1000;
    }
    return parseInt(clean.replace(/[.,]/g, ''), 10) || 0;
}

module.exports = {
    parseWithAI,
    parseCaption,
    isFamilyProduct,
    CONFIG
};
