import { geminiService } from './geminiVisionService';
import { imageHashService } from './imageHashService';
import { comparisonCacheService } from './comparisonCacheService';

export interface ComparisonResult {
  overall_similarity: number;
  breakdown: {
    model_type: number;
    motif_pattern: number;
    lace_details: number;
    hem_pleats: number;
    sleeve_details: number;
  };
  visual_analysis: {
    image1_description: string;
    image2_description: string;
    key_similarities: string[];
    key_differences: string[];
  };
  recommendation: string;
  confidence: number;
  hash_similarity?: number;
}

export class ImageComparisonService {
  /**
   * Compare two product images using hybrid approach (hash + AI)
   * @param image1File - New product image file
   * @param image2File - Existing product image file
   * @param existingProductName - Name of existing product
   * @returns Comparison result with similarity scores
   */
  async compareProductImages(
    image1File: File,
    image2File: File,
    existingProductName: string
  ): Promise<ComparisonResult> {
    try {
      // STEP 1: Generate perceptual hashes (instant, free, consistent)
      console.log('🔍 Step 1: Generating image hashes...');
      const hash1 = await imageHashService.generateHash(image1File);
      const hash2 = await imageHashService.generateHash(image2File);
      
      // STEP 2: Check cache first
      const cachedResult = comparisonCacheService.getCached(hash1, hash2);
      if (cachedResult) {
        console.log('⚡ Using cached comparison result');
        return cachedResult;
      }
      
      // STEP 3: Quick hash similarity check
      const hashSimilarity = imageHashService.compareHashes(hash1, hash2);
      console.log(`📊 Hash similarity: ${hashSimilarity}%`);
      
      // If pixel-level very different, skip AI call (optimization)
      if (hashSimilarity < 30) {
        console.log('❌ Images are pixel-level different, skipping AI analysis');
        const result: ComparisonResult = {
          overall_similarity: hashSimilarity,
          breakdown: {
            model_type: 0,
            motif_pattern: 0,
            lace_details: 0,
            hem_pleats: 0,
            sleeve_details: 0
          },
          visual_analysis: {
            image1_description: '',
            image2_description: '',
            key_similarities: [],
            key_differences: ['Pixel-level very different (hash similarity < 30%)']
          },
          recommendation: 'BERBEDA - Images are structurally different',
          confidence: 95,
          hash_similarity: hashSimilarity
        };
        
        // Cache the result
        comparisonCacheService.cache(hash1, hash2, result);
        return result;
      }
      
      // STEP 4: AI Image Understanding comparison
      console.log('🤖 Step 2: AI Image Understanding comparison...');
      const image1Base64 = await this.fileToBase64(image1File);
      const image2Base64 = await this.fileToBase64(image2File);
      
      const aiResult = await geminiService.compareClothingImages(
        image1Base64,
        image2Base64,
        this.buildComparisonPrompt(existingProductName)
      );
      
      // STEP 5: Combine hash + AI scores (weighted)
      // Hash: 20% (pixel-level similarity)
      // AI: 80% (semantic understanding)
      const finalScore = Math.round((hashSimilarity * 0.2) + (aiResult.overall_similarity * 0.8));
      
      console.log(`✅ Final similarity: ${finalScore}% (hash: ${hashSimilarity}%, AI: ${aiResult.overall_similarity}%)`);
      
      const result: ComparisonResult = {
        ...aiResult,
        overall_similarity: finalScore,
        hash_similarity: hashSimilarity
      };
      
      // Cache the result
      comparisonCacheService.cache(hash1, hash2, result);
      
      return result;
    } catch (error: any) {
      console.error('Error comparing images:', error);
      throw new Error(`Image comparison failed: ${error.message}`);
    }
  }
  
  /**
   * Build detailed comparison prompt for Gemini AI
   * @param existingProductName - Name of existing product
   * @returns Prompt string
   */
  private buildComparisonPrompt(existingProductName: string): string {
    return `
Kamu adalah expert fashion analyst untuk Azzahra Fashion Muslim.

TUGAS: Bandingkan 2 gambar produk dan tentukan kemiripan MOTIF + MODEL (0-100%).

GAMBAR 1: Produk baru yang akan diupload
GAMBAR 2: Produk "${existingProductName}" (sales >4pcs dalam 3 bulan)

FOKUS UTAMA (Total Weight 100%):

1. MODEL/JENIS BAJU (Weight: 50%)
   Analisis:
   - Apakah jenis sama? (gamis, tunik, dress, khimar)
   - Apakah siluet sama? (A-line, loose, fitted, bodycon, empire)
   - Apakah panjang sama? (maxi, midi, mini, hip-length)
   
   Scoring:
   - 100: Identik (jenis + siluet + panjang sama)
   - 80-99: Sangat mirip (jenis sama, siluet mirip, panjang beda tipis)
   - 50-79: Mirip (jenis sama, tapi siluet/panjang beda)
   - 0-49: Berbeda (jenis berbeda atau sangat beda struktur)

2. MOTIF/PATTERN (Weight: 50%)
   Analisis:
   - Apakah motif sama? (floral, geometric, batik, polos, striped, polkadot)
   - Apakah ukuran motif mirip? (kecil, sedang, besar)
   - Apakah density mirip? (rapat, sedang, jarang)
   - Apakah placement mirip? (all-over, border, scattered, panel)
   
   Scoring:
   - 100: Motif identik (jenis + ukuran + density + placement)
   - 80-99: Sangat mirip (jenis + ukuran sama, density/placement sedikit beda)
   - 50-79: Mirip (jenis sama, tapi ukuran/density berbeda)
   - 0-49: Berbeda (jenis motif berbeda total)

DETAIL TAMBAHAN (info only, tidak masuk perhitungan utama):
- Lace details (ada/tidak, posisi, tipe)
- Hem pleats (ada/tidak, tipe, depth)
- Sleeve details (bentuk, pleats, cuff)

KALKULASI OVERALL SIMILARITY:
overall = (model_score × 0.50) + (motif_score × 0.50)

STRICT RULES:
1. Jika MODEL berbeda (gamis vs tunik) → overall max 40%
2. Jika MOTIF berbeda (floral vs polos) → overall max 40%
3. Jika MODEL + MOTIF sama persis → overall min 85%
4. Jika MODEL sama + MOTIF mirip → overall min 70%
5. IGNORE warna completely (pink vs blue = sama saja)

RECOMMENDATION LOGIC:
- overall ≥ 80% → "HIGHLY RECOMMENDED - Model dan motif sangat mirip dengan produk best-seller"
- 60% ≤ overall < 80% → "MODERATE - Ada kesamaan tapi tidak identik, review manual disarankan"
- overall < 60% → "LOW SIMILARITY - Produk berbeda dari yang ada di inventory"

Return ONLY valid JSON (no markdown, no backticks):
{
  "overall_similarity": 87,
  "breakdown": {
    "model_type": 95,
    "motif_pattern": 90,
    "lace_details": 70,
    "hem_pleats": 60,
    "sleeve_details": 80
  },
  "visual_analysis": {
    "image1_description": "A-line gamis maxi dengan motif floral besar all-over...",
    "image2_description": "A-line gamis maxi dengan motif floral besar all-over...",
    "key_similarities": [
      "Model identik: A-line gamis maxi",
      "Motif sama: floral besar dengan placement all-over"
    ],
    "key_differences": [
      "Warna berbeda (diabaikan dalam scoring)",
      "Detail lace berbeda di collar"
    ]
  },
  "recommendation": "HIGHLY RECOMMENDED - Model dan motif sangat mirip dengan produk best-seller",
  "confidence": 92
}
`.trim();
  }
  
  /**
   * Convert File to base64 string
   * @param file - File to convert
   * @returns Base64 string (without data:image prefix)
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data:image/xxx;base64, prefix
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Compare uploaded image with existing product image URL
   * @param newImageFile - New product image file
   * @param existingImageUrl - URL of existing product image
   * @param existingProductName - Name of existing product
   * @returns Comparison result
   */
  async compareWithExistingProduct(
    newImageFile: File,
    existingImageUrl: string,
    existingProductName: string
  ): Promise<ComparisonResult> {
    try {
      // Fetch existing product image with CORS mode
      console.log(`🔄 Fetching image: ${existingImageUrl}`);
      
      const response = await fetch(existingImageUrl, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'force-cache' // Use cache if available
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch existing product image: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log(`✓ Fetched image: ${blob.size} bytes, type: ${blob.type}`);
      
      const existingImageFile = new File([blob], 'existing.jpg', { type: blob.type || 'image/jpeg' });
      
      // Compare using main method
      return await this.compareProductImages(newImageFile, existingImageFile, existingProductName);
    } catch (error: any) {
      console.error('❌ Error comparing with existing product:', error);
      
      // CORS error - provide helpful message
      if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
        throw new Error(`CORS error: Cannot fetch image from Firebase Storage. Please configure CORS or use cached product images.`);
      }
      
      throw new Error(`Failed to compare with existing product: ${error.message}`);
    }
  }
}

export const imageComparisonService = new ImageComparisonService();
