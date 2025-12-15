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

export interface EnhancedSimilarityResult {
  productId: string;
  productName: string;
  overallScore: number; // 0-100%
  breakdown: {
    modelType: number;    // weight: 30%
    pattern: number;      // weight: 25%
    colors: number;       // weight: 20%
    details: number;      // weight: 15% (lace, pleats, sleeves)
    embellishments: number; // weight: 10%
  };
  salesLast3Months: number;
  aiReasoning: string;
  recommendation: 'highly_recommended' | 'recommended' | 'consider' | 'not_recommended';
  recommendationLabel: string;
  recommendationReason: string;
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
      
      // Add cache-busting query param to bypass Service Worker cache
      const cacheBustUrl = existingImageUrl.includes('?') 
        ? `${existingImageUrl}&_cb=${Date.now()}`
        : `${existingImageUrl}?_cb=${Date.now()}`;
      
      const response = await fetch(cacheBustUrl, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-cache' // Force fresh fetch, bypass cache
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

  /**
   * Calculate enhanced similarity with weighted scoring and sales context
   */
  calculateEnhancedSimilarity(
    uploadedAnalysis: any, // GeminiClothingAnalysis
    existingAnalysis: any, // GeminiClothingAnalysis from existing product
    salesData: { totalQuantity: number; productName: string }
  ): EnhancedSimilarityResult {
    // Validate analyses
    if (!uploadedAnalysis || !existingAnalysis) {
      console.error('❌ Invalid analysis data:', { uploadedAnalysis, existingAnalysis });
      return this.createDefaultResult(salesData, 'Invalid analysis data');
    }

    // Log analysis structures for debugging
    console.log('🔍 Analysis structures:', {
      uploaded: {
        clothing_type: uploadedAnalysis.clothing_type,
        pattern_type: uploadedAnalysis.pattern_type,
        colors: uploadedAnalysis.colors,
        lace_details: uploadedAnalysis.lace_details,
        hem_pleats: uploadedAnalysis.hem_pleats,
        sleeve_details: uploadedAnalysis.sleeve_details,
        embellishments: uploadedAnalysis.embellishments
      },
      existing: {
        clothing_type: existingAnalysis.clothing_type,
        pattern_type: existingAnalysis.pattern_type,
        colors: existingAnalysis.colors,
        lace_details: existingAnalysis.lace_details,
        hem_pleats: existingAnalysis.hem_pleats,
        sleeve_details: existingAnalysis.sleeve_details,
        embellishments: existingAnalysis.embellishments
      }
    });

    // Calculate weighted scores with fallbacks
    const modelTypeScore = this.calculateModelTypeSimilarity(
      uploadedAnalysis.clothing_type || {},
      existingAnalysis.clothing_type || {}
    );
    
    const patternScore = this.calculatePatternSimilarity(
      uploadedAnalysis.pattern_type || {},
      existingAnalysis.pattern_type || {}
    );
    
    const colorsScore = this.calculateColorsSimilarity(
      uploadedAnalysis.colors || [],
      existingAnalysis.colors || []
    );
    
    const detailsScore = this.calculateDetailsSimilarity(
      uploadedAnalysis,
      existingAnalysis
    );
    
    const embellishmentsScore = this.calculateEmbellishmentsSimilarity(
      uploadedAnalysis.embellishments || {},
      existingAnalysis.embellishments || {}
    );

    // Apply weights
    const overallScore = (
      modelTypeScore * 0.30 + // 30%
      patternScore * 0.25 +   // 25%
      colorsScore * 0.20 +    // 20%
      detailsScore * 0.15 +   // 15%
      embellishmentsScore * 0.10 // 10%
    );

    console.log('🎯 Enhanced Similarity Calculation:', {
      productName: salesData.productName,
      scores: {
        modelType: modelTypeScore,
        pattern: patternScore,
        colors: colorsScore,
        details: detailsScore,
        embellishments: embellishmentsScore
      },
      weighted: {
        modelType: modelTypeScore * 0.30,
        pattern: patternScore * 0.25,
        colors: colorsScore * 0.20,
        details: detailsScore * 0.15,
        embellishments: embellishmentsScore * 0.10
      },
      overallScore
    });

    // Determine recommendation
    const { recommendation, label, reason } = this.getRecommendation(
      overallScore,
      salesData.totalQuantity,
      existingAnalysis.clothing_type.main_type
    );

    // Generate AI reasoning
    const aiReasoning = this.generateAIReasoning(
      overallScore,
      modelTypeScore,
      patternScore,
      colorsScore,
      salesData
    );

    return {
      productId: '', // Will be filled by caller
      productName: salesData.productName,
      overallScore: Math.round(overallScore),
      breakdown: {
        modelType: Math.round(modelTypeScore),
        pattern: Math.round(patternScore),
        colors: Math.round(colorsScore),
        details: Math.round(detailsScore),
        embellishments: Math.round(embellishmentsScore)
      },
      salesLast3Months: salesData.totalQuantity,
      aiReasoning,
      recommendation,
      recommendationLabel: label,
      recommendationReason: reason
    };
  }

  /**
   * Calculate model type similarity
   */
  private calculateModelTypeSimilarity(
    uploaded: any,
    existing: any
  ): number {
    // Handle missing data
    if (!uploaded.main_type || !existing.main_type) {
      console.warn('⚠️ Missing model type data:', { uploaded, existing });
      return 50; // Neutral score for missing data
    }

    if (uploaded.main_type === existing.main_type) {
      // Same main type, check silhouette
      if (uploaded.silhouette === existing.silhouette) return 100;
      if (uploaded.length === existing.length) return 85;
      return 70;
    }
    
    // Different main types
    const similarTypes = [
      ['gamis', 'dress'],
      ['tunik', 'blouse'],
      ['kaftan', 'gamis']
    ];
    
    const isSimilar = similarTypes.some(group =>
      group.includes(uploaded.main_type) && group.includes(existing.main_type)
    );
    
    return isSimilar ? 60 : 30;
  }

  /**
   * Calculate pattern similarity
   */
  private calculatePatternSimilarity(
    uploaded: any,
    existing: any
  ): number {
    // Handle missing data
    if (!uploaded.pattern || !existing.pattern) {
      console.warn('⚠️ Missing pattern data:', { uploaded, existing });
      return 50; // Neutral score for missing data
    }

    if (uploaded.pattern === existing.pattern) {
      // Same pattern, check complexity
      if (uploaded.complexity === existing.complexity) return 100;
      return 80;
    }
    
    // Similar pattern groups
    const similarPatterns = [
      ['floral', 'batik'],
      ['geometric', 'striped'],
      ['solid', 'polkadot']
    ];
    
    const isSimilar = similarPatterns.some(group =>
      group.includes(uploaded.pattern) && group.includes(existing.pattern)
    );
    
    return isSimilar ? 65 : 40;
  }

  /**
   * Calculate colors similarity
   */
  private calculateColorsSimilarity(
    uploadedColors: string[],
    existingColors: string[]
  ): number {
    if (!uploadedColors.length || !existingColors.length) return 50;
    
    // Count matching colors
    const matchingColors = uploadedColors.filter(color =>
      existingColors.some(existingColor =>
        existingColor.toLowerCase().includes(color.toLowerCase()) ||
        color.toLowerCase().includes(existingColor.toLowerCase())
      )
    );
    
    const matchPercentage = (matchingColors.length / Math.max(uploadedColors.length, existingColors.length)) * 100;
    
    // Boost score if primary colors match
    const primaryMatch = uploadedColors[0] && existingColors[0] &&
      uploadedColors[0].toLowerCase() === existingColors[0].toLowerCase();
    
    return primaryMatch ? Math.min(100, matchPercentage + 20) : matchPercentage;
  }

  /**
   * Calculate details similarity (lace, pleats, sleeves)
   */
  private calculateDetailsSimilarity(
    uploaded: any,
    existing: any
  ): number {
    let score = 0;
    let count = 0;

    // Lace details
    if (uploaded.lace_details.has_lace === existing.lace_details.has_lace) {
      score += 40;
      if (uploaded.lace_details.has_lace) {
        // Both have lace, compare locations
        const uploadedLocs = uploaded.lace_details.locations.map((l: any) => l.position);
        const existingLocs = existing.lace_details.locations.map((l: any) => l.position);
        const matchingLocs = uploadedLocs.filter((loc: string) => existingLocs.includes(loc));
        score += (matchingLocs.length / Math.max(uploadedLocs.length, existingLocs.length)) * 30;
      }
    }
    count++;

    // Hem pleats
    if (uploaded.hem_pleats.has_pleats === existing.hem_pleats.has_pleats) {
      score += 30;
      if (uploaded.hem_pleats.has_pleats && uploaded.hem_pleats.pleat_type === existing.hem_pleats.pleat_type) {
        score += 20;
      }
    }
    count++;

    // Sleeve details
    if (uploaded.sleeve_details.sleeve_type === existing.sleeve_details.sleeve_type) {
      score += 30;
      if (uploaded.sleeve_details.has_pleats === existing.sleeve_details.has_pleats) {
        score += 20;
      }
    }
    count++;

    return score / count;
  }

  /**
   * Calculate embellishments similarity
   */
  private calculateEmbellishmentsSimilarity(
    uploaded: any,
    existing: any
  ): number {
    let score = 0;
    let count = 0;

    // Beads
    if (uploaded.beads.has === existing.beads.has) {
      score += 40;
      if (uploaded.beads.has) {
        const beadMatch = uploaded.beads.locations.some((loc: string) =>
          existing.beads.locations.includes(loc)
        );
        if (beadMatch) score += 30;
      }
    }
    count++;

    // Embroidery
    if (uploaded.embroidery.has === existing.embroidery.has) {
      score += 30;
    }
    count++;

    // Sequins
    if (uploaded.sequins.has === existing.sequins.has) {
      score += 20;
    }
    count++;

    // Gold thread
    if (uploaded.gold_thread.has === existing.gold_thread.has) {
      score += 10;
    }
    count++;

    return score / count;
  }

  /**
   * Get recommendation based on score and sales
   */
  private getRecommendation(
    score: number,
    salesQuantity: number,
    productType: string
  ): {
    recommendation: 'highly_recommended' | 'recommended' | 'consider' | 'not_recommended';
    label: string;
    reason: string;
  } {
    if (score >= 90) {
      return {
        recommendation: 'highly_recommended',
        label: 'Highly Recommended',
        reason: `Sangat mirip (${score}%) dengan ${productType} bestseller yang terjual ${salesQuantity} pcs dalam 3 bulan terakhir.`
      };
    } else if (score >= 80) {
      return {
        recommendation: 'recommended',
        label: 'Recommended',
        reason: `Mirip (${score}%) dengan ${productType} yang laris (${salesQuantity} pcs). Potensi pasar tinggi.`
      };
    } else if (score >= 70) {
      return {
        recommendation: 'consider',
        label: 'Consider',
        reason: `Ada kemiripan (${score}%) tapi segment berbeda. ${salesQuantity > 10 ? 'Market ada, tapi perlu positioning berbeda.' : 'Sales masih rendah, perlu evaluasi.'}`
      };
    } else {
      return {
        recommendation: 'not_recommended',
        label: 'Not Recommended',
        reason: `Terlalu berbeda (${score}%) dengan produk yang ada. Risiko tinggi untuk pasar saat ini.`
      };
    }
  }

  /**
   * Generate AI reasoning for the similarity score
   */
  private generateAIReasoning(
    overallScore: number,
    modelScore: number,
    patternScore: number,
    colorsScore: number,
    salesData: { totalQuantity: number; productName: string }
  ): string {
    const reasons: string[] = [];

    if (modelScore >= 80) {
      reasons.push(`Model sangat mirip (${modelScore}%) dengan produk bestseller.`);
    } else if (modelScore >= 60) {
      reasons.push(`Model cukup mirip (${modelScore}%) dengan produk yang ada.`);
    }

    if (patternScore >= 80) {
      reasons.push(`Motif/pattern hampir identik (${patternScore}%).`);
    } else if (patternScore >= 60) {
      reasons.push(`Motif memiliki kemiripan (${patternScore}%).`);
    }

    if (colorsScore >= 80) {
      reasons.push(`Warna dominan sangat cocok (${colorsScore}%).`);
    }

    if (salesData.totalQuantity >= 10) {
      reasons.push(`Produk referensi sangat laris (${salesData.totalQuantity} pcs dalam 3 bulan).`);
    } else if (salesData.totalQuantity >= 5) {
      reasons.push(`Produk referensi cukup laris (${salesData.totalQuantity} pcs).`);
    }

    if (reasons.length === 0) {
      return `Skor kemiripan ${overallScore}% berdasarkan analisis AI.`;
    }

    return reasons.join(' ');
  }

  /**
   * Create default result for invalid/missing analysis
   */
  private createDefaultResult(
    salesData: { totalQuantity: number; productName: string },
    errorReason: string
  ): EnhancedSimilarityResult {
    console.warn('⚠️ Using default result due to:', errorReason);
    
    return {
      productId: '',
      productName: salesData.productName,
      overallScore: 0,
      breakdown: {
        modelType: 0,
        pattern: 0,
        colors: 0,
        details: 0,
        embellishments: 0
      },
      salesLast3Months: salesData.totalQuantity,
      aiReasoning: `Analisis tidak lengkap: ${errorReason}`,
      recommendation: 'not_recommended',
      recommendationLabel: 'Not Recommended',
      recommendationReason: 'Data analisis tidak lengkap atau tidak valid.'
    };
  }
}

export const imageComparisonService = new ImageComparisonService();
