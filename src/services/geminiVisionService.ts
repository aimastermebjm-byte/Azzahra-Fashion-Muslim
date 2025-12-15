import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GeminiClothingAnalysis {
  clothing_type: {
    main_type: 'gamis' | 'tunik' | 'dress' | 'blouse' | 'kaftan' | 'other';
    silhouette: 'a-line' | 'bodycon' | 'loose' | 'fitted' | 'empire';
    length: 'maxi' | 'midi' | 'mini' | 'hip-length';
    confidence: number;
  };
  
  pattern_type: {
    pattern: 'floral' | 'geometric' | 'solid' | 'batik' | 'striped' | 'polkadot' | 'mixed';
    complexity: 'simple' | 'detailed' | 'ornate';
    confidence: number;
  };
  
  lace_details: {
    has_lace: boolean;
    locations: Array<{
      position: 'collar' | 'hem' | 'sleeves' | 'chest' | 'back' | 'full';
      coverage: 'minimal' | 'moderate' | 'extensive';
      lace_type: 'floral_lace' | 'geometric_lace' | 'eyelet' | 'guipure';
    }>;
    confidence: number;
  };
  
  hem_pleats: {
    has_pleats: boolean;
    pleat_type: 'accordion' | 'box' | 'knife' | 'sunray' | 'none';
    depth: 'shallow' | 'medium' | 'deep';
    fullness: number; // 0-100
    confidence: number;
  };
  
  sleeve_details: {
    has_pleats: boolean;
    sleeve_type: 'straight' | 'puffed' | 'bell' | 'bishop' | 'lantern' | 'pleated';
    pleat_position: 'shoulder' | 'elbow' | 'wrist' | 'full';
    ruffle_count: number;
    cuff_style: 'plain' | 'pleated' | 'ruffled' | 'elastic';
    confidence: number;
  };
  
  embellishments: {
    beads: { has: boolean; locations: string[]; density: number };
    embroidery: { has: boolean; pattern: string };
    sequins: { has: boolean; locations: string[] };
    gold_thread: { has: boolean; coverage: number };
  };
  
  colors: string[];
  fabric_texture: 'smooth' | 'textured' | 'glossy' | 'matte';
}

interface RateLimitState {
  requests: number[];
}

class RateLimiter {
  private state: RateLimitState = { requests: [] };
  private readonly maxPerMinute = 15;
  private readonly maxPerDay = 1500;
  
  canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    // Clean old requests
    this.state.requests = this.state.requests.filter(t => t > oneDayAgo);
    
    const lastMinute = this.state.requests.filter(t => t > oneMinuteAgo).length;
    const lastDay = this.state.requests.length;
    
    if (lastMinute >= this.maxPerMinute) {
      throw new Error('RATE_LIMIT: Max 15 requests per minute. Please wait.');
    }
    
    if (lastDay >= this.maxPerDay) {
      throw new Error('RATE_LIMIT: Max 1,500 requests per day (FREE tier).');
    }
    
    this.state.requests.push(now);
    return true;
  }
  
  getRemainingRequests(): { perMinute: number; perDay: number } {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    this.state.requests = this.state.requests.filter(t => t > oneDayAgo);
    
    const lastMinute = this.state.requests.filter(t => t > oneMinuteAgo).length;
    const lastDay = this.state.requests.length;
    
    return {
      perMinute: this.maxPerMinute - lastMinute,
      perDay: this.maxPerDay - lastDay
    };
  }
}

export class GeminiVisionService {
  private genAI: GoogleGenerativeAI | null = null;
  private rateLimiter = new RateLimiter();
  
  initialize(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API key is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }
  
  isInitialized(): boolean {
    return this.genAI !== null;
  }
  
  async testConnection(): Promise<boolean> {
    if (!this.genAI) {
      throw new Error('Gemini not initialized. Please set API key first.');
    }
    
    // Use Gemini models optimized for Free Tier & Stability
    const modelNames = [
      "gemini-2.0-flash",         // Latest 2.0 Flash
      "gemini-1.5-flash-latest",  // Latest 1.5 Flash
      "gemini-pro-vision"         // Legacy fallback
    ];
    
    let lastError = null;
    
    for (const modelName of modelNames) {
      try {
        const model = this.genAI.getGenerativeModel({ 
          model: modelName
        });
        
        const result = await model.generateContent("Say 'OK' if you can read this.");
        const response = result.response.text();
        
        if (response.toLowerCase().includes('ok')) {
          console.log(`✓ Connected with model: ${modelName}`);
          return true;
        }
      } catch (error: any) {
        lastError = error;
        console.warn(`Model ${modelName} failed:`, error.message);
        // Continue to next model
      }
    }
    
    console.error('Gemini test connection failed:', lastError);
    
    if (lastError?.message?.includes('API_KEY_INVALID') || lastError?.message?.includes('401')) {
      throw new Error('API_KEY_INVALID: Invalid API key. Please check your key.');
    }
    
    throw lastError || new Error('Connection test failed for all models');
  }
  
  async analyzeClothingImage(imageBase64: string): Promise<GeminiClothingAnalysis> {
    if (!this.genAI) {
      throw new Error('Gemini not initialized. Please set API key first.');
    }
    
    // Check rate limit
    this.rateLimiter.canMakeRequest();
    
    // Model names optimized for Free Tier & Stability
    const modelNames = [
      "gemini-2.0-flash",          // Latest 2.0 Flash
      "gemini-1.5-flash-latest",   // Latest 1.5 Flash
      "gemini-pro-vision"          // Legacy fallback
    ];
    
    let result = null;
    let lastError = null;
    
    const prompt = this.buildAnalysisPrompt();
    
    for (const modelName of modelNames) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        });
        
        result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: imageBase64,
              mimeType: "image/jpeg"
            }
          }
        ]);
        
        if (result) break; // Success
      } catch (e) {
        lastError = e;
        console.warn(`Gemini model ${modelName} failed, trying next...`);
      }
    }
    
    if (!result) {
      console.error('Gemini analysis failed:', lastError);
      
      if (lastError?.message?.includes('API_KEY_INVALID') || lastError?.message?.includes('401')) {
        throw new Error('API_KEY_INVALID: Invalid API key.');
      }
      
      if (lastError?.message?.includes('RATE_LIMIT') || lastError?.message?.includes('429')) {
        throw new Error('RATE_LIMIT: Too many requests. Please wait.');
      }
      
      throw new Error('Failed to analyze image. Please try again.');
    }
    
    const responseText = result.response.text();
    const analysis = JSON.parse(responseText);
    
    return this.validateAndCleanAnalysis(analysis);
  }
  
  private buildAnalysisPrompt(): string {
    return `
Analyze this clothing/fashion item image in EXTREME detail. Return ONLY valid JSON matching this exact structure:

{
  "clothing_type": {
    "main_type": "gamis",
    "silhouette": "a-line",
    "length": "maxi",
    "confidence": 85
  },
  "pattern_type": {
    "pattern": "floral",
    "complexity": "detailed",
    "confidence": 90
  },
  "lace_details": {
    "has_lace": true,
    "locations": [
      {
        "position": "hem",
        "coverage": "moderate",
        "lace_type": "floral_lace"
      }
    ],
    "confidence": 80
  },
  "hem_pleats": {
    "has_pleats": true,
    "pleat_type": "accordion",
    "depth": "medium",
    "fullness": 75,
    "confidence": 70
  },
  "sleeve_details": {
    "has_pleats": true,
    "sleeve_type": "bishop",
    "pleat_position": "wrist",
    "ruffle_count": 2,
    "cuff_style": "elastic",
    "confidence": 85
  },
  "embellishments": {
    "beads": {"has": true, "locations": ["collar"], "density": 30},
    "embroidery": {"has": false, "pattern": ""},
    "sequins": {"has": false, "locations": []},
    "gold_thread": {"has": false, "coverage": 0}
  },
  "colors": ["pink", "white"],
  "fabric_texture": "smooth"
}

CRITICAL INSTRUCTIONS:
1. Look for LACE/RENDA carefully - check collar, hem, sleeves, chest, back areas
2. Look for PLEATS/LIPATAN at hem (bottom) - check if fabric has folds/gathering
3. Look for SLEEVE DETAILS - check for pleats, ruffles, puffed sleeves, elastic cuffs
4. Look for EMBELLISHMENTS - beads (manik-manik), embroidery (bordir), sequins (payet), gold thread (benang emas)
5. Be VERY specific about locations and coverage
6. Return ONLY the JSON, no markdown formatting, no backticks, no explanation
7. All confidence values should be 0-100 numbers
8. If you cannot see something clearly, set has: false or confidence: low

Valid values:
- main_type: "gamis", "tunik", "dress", "blouse", "kaftan", "other"
- silhouette: "a-line", "bodycon", "loose", "fitted", "empire"
- length: "maxi", "midi", "mini", "hip-length"
- pattern: "floral", "geometric", "solid", "batik", "striped", "polkadot", "mixed"
- complexity: "simple", "detailed", "ornate"
- position: "collar", "hem", "sleeves", "chest", "back", "full"
- coverage: "minimal", "moderate", "extensive"
- lace_type: "floral_lace", "geometric_lace", "eyelet", "guipure"
- pleat_type: "accordion", "box", "knife", "sunray", "none"
- depth: "shallow", "medium", "deep"
- sleeve_type: "straight", "puffed", "bell", "bishop", "lantern", "pleated"
- pleat_position: "shoulder", "elbow", "wrist", "full"
- cuff_style: "plain", "pleated", "ruffled", "elastic"
- fabric_texture: "smooth", "textured", "glossy", "matte"
    `.trim();
  }
  
  private validateAndCleanAnalysis(analysis: any): GeminiClothingAnalysis {
    // Basic validation and defaults
    const validated: GeminiClothingAnalysis = {
      clothing_type: {
        main_type: analysis.clothing_type?.main_type || 'other',
        silhouette: analysis.clothing_type?.silhouette || 'loose',
        length: analysis.clothing_type?.length || 'maxi',
        confidence: analysis.clothing_type?.confidence || 50
      },
      pattern_type: {
        pattern: analysis.pattern_type?.pattern || 'solid',
        complexity: analysis.pattern_type?.complexity || 'simple',
        confidence: analysis.pattern_type?.confidence || 50
      },
      lace_details: {
        has_lace: analysis.lace_details?.has_lace || false,
        locations: analysis.lace_details?.locations || [],
        confidence: analysis.lace_details?.confidence || 50
      },
      hem_pleats: {
        has_pleats: analysis.hem_pleats?.has_pleats || false,
        pleat_type: analysis.hem_pleats?.pleat_type || 'none',
        depth: analysis.hem_pleats?.depth || 'shallow',
        fullness: analysis.hem_pleats?.fullness || 0,
        confidence: analysis.hem_pleats?.confidence || 50
      },
      sleeve_details: {
        has_pleats: analysis.sleeve_details?.has_pleats || false,
        sleeve_type: analysis.sleeve_details?.sleeve_type || 'straight',
        pleat_position: analysis.sleeve_details?.pleat_position || 'wrist',
        ruffle_count: analysis.sleeve_details?.ruffle_count || 0,
        cuff_style: analysis.sleeve_details?.cuff_style || 'plain',
        confidence: analysis.sleeve_details?.confidence || 50
      },
      embellishments: {
        beads: analysis.embellishments?.beads || { has: false, locations: [], density: 0 },
        embroidery: analysis.embellishments?.embroidery || { has: false, pattern: '' },
        sequins: analysis.embellishments?.sequins || { has: false, locations: [] },
        gold_thread: analysis.embellishments?.gold_thread || { has: false, coverage: 0 }
      },
      colors: analysis.colors || ['unknown'],
      fabric_texture: analysis.fabric_texture || 'smooth'
    };
    
    return validated;
  }
  
  async batchAnalyze(images: string[], onProgress?: (index: number, total: number) => void): Promise<GeminiClothingAnalysis[]> {
    const results: GeminiClothingAnalysis[] = [];
    
    // Analyze sequentially to respect rate limits
    for (let i = 0; i < images.length; i++) {
      const analysis = await this.analyzeClothingImage(images[i]);
      results.push(analysis);
      
      if (onProgress) {
        onProgress(i + 1, images.length);
      }
      
      // Small delay between requests to avoid rate limiting
      if (i < images.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return results;
  }
  
  getRateLimitStatus() {
    return this.rateLimiter.getRemainingRequests();
  }
  
  /**
   * Compare two clothing images using Gemini Vision API
   * Sends both images in one prompt for direct visual comparison
   * @param image1Base64 - Base64 encoded first image
   * @param image2Base64 - Base64 encoded second image
   * @param prompt - Comparison prompt
   * @returns Parsed JSON comparison result
   */
  async compareClothingImages(
    image1Base64: string,
    image2Base64: string,
    prompt: string
  ): Promise<any> {
    if (!this.genAI) {
      throw new Error('Gemini not initialized. Please set API key first.');
    }
    
    // Check rate limit
    this.rateLimiter.canMakeRequest();
    
    // Model names optimized for Free Tier & Stability
    const modelNames = [
      "gemini-2.0-flash",          // Latest 2.0 Flash
      "gemini-1.5-flash-latest",   // Latest 1.5 Flash
      "gemini-pro-vision"          // Legacy fallback
    ];
    
    let result = null;
    let lastError = null;
    
    for (const modelName of modelNames) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.05,  // Very low for consistency
            topK: 1,            // Force most confident answer
            topP: 0.1           // Very deterministic
          }
        });
        
        // Send both images + prompt in one request
        result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: image1Base64,
              mimeType: "image/jpeg"
            }
          },
          {
            inlineData: {
              data: image2Base64,
              mimeType: "image/jpeg"
            }
          }
        ]);
        
        if (result) break; // Success, exit loop
      } catch (e: any) {
        lastError = e;
        console.warn(`Gemini model ${modelName} failed, trying next...`, e.message);
      }
    }
    
    if (!result) {
      console.error('Gemini comparison failed:', lastError);
      
      if (lastError?.message?.includes('API_KEY_INVALID') || lastError?.message?.includes('401')) {
        throw new Error('API_KEY_INVALID: Invalid API key.');
      }
      
      if (lastError?.message?.includes('RATE_LIMIT') || lastError?.message?.includes('429')) {
        throw new Error('RATE_LIMIT: Too many requests. Please wait.');
      }
      
      throw new Error('Failed to compare images. Please try again.');
    }
    
    const responseText = result.response.text();
    
    try {
      const parsedResult = JSON.parse(responseText);
      return parsedResult;
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', responseText);
      throw new Error('Invalid response format from Gemini API');
    }
  }

  /**
   * Generate comparative analysis between uploaded product and bestseller products
   */
  async generateComparativeAnalysis(
    uploadedAnalysis: GeminiClothingAnalysis,
    existingProducts: Array<{
      product: any;
      analysis: GeminiClothingAnalysis;
      salesData: { totalQuantity: number; productName: string };
    }>,
    topN: number = 3
  ): Promise<{
    topSimilarities: Array<{
      productName: string;
      similarityScore: number;
      keySimilarities: string[];
      recommendation: string;
      reasoning: string;
    }>;
    overallRecommendation: string;
    marketInsights: string[];
  }> {
    try {
      const prompt = `You are a fashion market analyst for Muslim clothing. Compare this new product with existing bestsellers and provide insights.

NEW PRODUCT ANALYSIS:
- Type: ${uploadedAnalysis.clothing_type.main_type} (${uploadedAnalysis.clothing_type.silhouette}, ${uploadedAnalysis.clothing_type.length})
- Pattern: ${uploadedAnalysis.pattern_type.pattern} (${uploadedAnalysis.pattern_type.complexity})
- Colors: ${uploadedAnalysis.colors.join(', ')}
- Lace: ${uploadedAnalysis.lace_details.has_lace ? 'Yes' : 'No'} ${uploadedAnalysis.lace_details.has_lace ? `(${uploadedAnalysis.lace_details.locations.map((l: any) => l.position).join(', ')})` : ''}
- Hem Pleats: ${uploadedAnalysis.hem_pleats.has_pleats ? 'Yes' : 'No'} ${uploadedAnalysis.hem_pleats.has_pleats ? `(${uploadedAnalysis.hem_pleats.pleat_type})` : ''}
- Sleeves: ${uploadedAnalysis.sleeve_details.sleeve_type} ${uploadedAnalysis.sleeve_details.has_pleats ? 'with pleats' : ''}

EXISTING BESTSELLERS (last 3 months):
${existingProducts.slice(0, topN).map((item, index) => `
${index + 1}. ${item.productName} - ${item.salesData.totalQuantity} pcs sold
   - Type: ${item.analysis.clothing_type.main_type}
   - Pattern: ${item.analysis.pattern_type.pattern}
   - Colors: ${item.analysis.colors.join(', ')}
`).join('')}

ANALYSIS REQUEST:
1. For each existing product (1-${Math.min(topN, existingProducts.length)}), calculate similarity score 0-100% based on:
   - Model type similarity (30% weight)
   - Pattern similarity (25% weight)  
   - Color similarity (20% weight)
   - Details similarity (15% weight: lace, pleats, sleeves)
   - Embellishments similarity (10% weight: beads, embroidery, sequins)

2. For each product, provide:
   - Similarity score (0-100%)
   - 2-3 key similarities (most important matching features)
   - Recommendation: "Highly Recommended" (>90%), "Recommended" (80-89%), "Consider" (70-79%), "Not Recommended" (<70%)
   - Brief reasoning (1 sentence)

3. Overall market insights:
   - What type of products are selling well?
   - What patterns/colors are trending?
   - Any gaps in the market this new product could fill?

Return JSON format:
{
  "topSimilarities": [
    {
      "productName": "string",
      "similarityScore": number,
      "keySimilarities": ["string", "string"],
      "recommendation": "string",
      "reasoning": "string"
    }
  ],
  "overallRecommendation": "string",
  "marketInsights": ["string", "string", "string"]
}`;

      const model = this.genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
          topK: 1
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      try {
        const parsed = JSON.parse(text);
        return parsed;
      } catch (e) {
        console.error('Failed to parse comparative analysis response:', text);
        throw new Error('Gemini returned invalid JSON format for comparative analysis');
      }
    } catch (error: any) {
      console.error('Error generating comparative analysis:', error);
      
      // Fallback: Generate basic analysis without Gemini
      return this.generateFallbackComparativeAnalysis(uploadedAnalysis, existingProducts, topN);
    }
  }

  /**
   * Fallback analysis when Gemini fails
   */
  private generateFallbackComparativeAnalysis(
    uploadedAnalysis: GeminiClothingAnalysis,
    existingProducts: Array<{
      product: any;
      analysis: GeminiClothingAnalysis;
      salesData: { totalQuantity: number; productName: string };
    }>,
    topN: number
  ): {
    topSimilarities: Array<{
      productName: string;
      similarityScore: number;
      keySimilarities: string[];
      recommendation: string;
      reasoning: string;
    }>;
    overallRecommendation: string;
    marketInsights: string[];
  } {
    // Simple fallback based on type and pattern matching
    const topSimilarities = existingProducts.slice(0, topN).map(item => {
      let similarityScore = 0;
      const keySimilarities: string[] = [];

      // Check model type
      if (uploadedAnalysis.clothing_type.main_type === item.analysis.clothing_type.main_type) {
        similarityScore += 40;
        keySimilarities.push(`Same model type: ${uploadedAnalysis.clothing_type.main_type}`);
      }

      // Check pattern
      if (uploadedAnalysis.pattern_type.pattern === item.analysis.pattern_type.pattern) {
        similarityScore += 30;
        keySimilarities.push(`Same pattern: ${uploadedAnalysis.pattern_type.pattern}`);
      }

      // Check colors (simple match)
      const colorMatch = uploadedAnalysis.colors.some(color =>
        item.analysis.colors.some(c => c.toLowerCase().includes(color.toLowerCase()))
      );
      if (colorMatch) {
        similarityScore += 20;
        keySimilarities.push('Similar color palette');
      }

      // Determine recommendation
      let recommendation = 'Not Recommended';
      let reasoning = '';

      if (similarityScore >= 70) {
        recommendation = 'Highly Recommended';
        reasoning = `High similarity with bestseller that sold ${item.salesData.totalQuantity} pcs`;
      } else if (similarityScore >= 50) {
        recommendation = 'Recommended';
        reasoning = `Moderate similarity with popular product`;
      } else if (similarityScore >= 30) {
        recommendation = 'Consider';
        reasoning = 'Some similarities but different market segment';
      } else {
        reasoning = 'Limited similarity with existing products';
      }

      return {
        productName: item.salesData.productName,
        similarityScore,
        keySimilarities,
        recommendation,
        reasoning
      };
    });

    // Sort by similarity score
    topSimilarities.sort((a, b) => b.similarityScore - a.similarityScore);

    // Generate overall recommendation
    const avgScore = topSimilarities.reduce((sum, item) => sum + item.similarityScore, 0) / topSimilarities.length;
    let overallRecommendation = 'Not Recommended';
    
    if (avgScore >= 70) {
      overallRecommendation = 'Highly Recommended - Strong market fit';
    } else if (avgScore >= 50) {
      overallRecommendation = 'Recommended - Good potential';
    } else if (avgScore >= 30) {
      overallRecommendation = 'Consider - Niche market opportunity';
    }

    // Basic market insights
    const marketInsights = [
      `Top sellers are ${existingProducts.slice(0, 3).map(p => p.analysis.clothing_type.main_type).join(', ')}`,
      `Popular patterns: ${existingProducts.slice(0, 3).map(p => p.analysis.pattern_type.pattern).join(', ')}`,
      `Color trends: ${existingProducts.slice(0, 3).map(p => p.analysis.colors[0] || 'Various').join(', ')}`
    ];

    return {
      topSimilarities,
      overallRecommendation,
      marketInsights
    };
  }
}

export const geminiService = new GeminiVisionService();
