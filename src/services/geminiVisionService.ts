import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GeminiClothingAnalysis {
  clothing_type: {
    main_type: 'gamis' | 'tunik' | 'dress' | 'blouse' | 'kaftan' | 'other';
    silhouette: 'a-line' | 'bodycon' | 'loose' | 'fitted' | 'empire';
    length: 'maxi' | 'midi' | 'mini' | 'hip-length';
    confidence: number;
  };

  pattern_type: {
    pattern: 'floral' | 'geometric' | 'solid' | 'batik' | 'striped' | 'polkadot' | 'mixed' | string; // string allows custom patterns like "geometric_grid_with_logo"
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

  // New fields for product automation
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  resellerPrice?: number;
  sizes?: string[];
  material?: string;
  status?: 'ready' | 'po';
}

interface RateLimitState {
  requests: number[];
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

class RateLimiter {
  private state: RateLimitState = { requests: [] };
  private readonly maxPerMinute = 15;
  private readonly maxPerDay = 1500;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Clean old requests
    this.state.requests = this.state.requests.filter(t => t > oneDayAgo);

    const lastMinute = this.state.requests.filter(t => t > oneMinuteAgo).length;
    const lastDay = this.state.requests.length;

    if (lastMinute >= this.maxPerMinute) {
      const waitTime = Math.ceil((this.state.requests.find(t => t > oneMinuteAgo)! + 60000 - now) / 1000);
      throw new Error(`RATE_LIMIT: Terlalu banyak request (max 15/menit). Tunggu ${waitTime} detik.`);
    }

    if (lastDay >= this.maxPerDay) {
      throw new Error('RATE_LIMIT: Kuota harian habis (max 1,500/hari). Coba lagi besok atau upgrade ke API berbayar.');
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

  // Cache methods
  getCached(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export class GeminiVisionService {
  private genAI: GoogleGenerativeAI | null = null;
  private glmApiKey: string | null = null;
  private geminiApiKey: string | null = null;
  private rateLimiter = new RateLimiter();
  private geminiQuotaExceeded: boolean = false; // Track if Gemini quota is exceeded
  private geminiQuotaExceededAt: number = 0; // Timestamp when quota was exceeded

  /**
   * Initialize with both Gemini and GLM API keys
   * @param geminiApiKey Google Gemini API key (optional if GLM key provided)
   * @param glmApiKey GLM-4.6 API key (optional)
   */
  initialize(geminiApiKey: string = '', glmApiKey: string = '') {
    if (!geminiApiKey && !glmApiKey) {
      throw new Error('At least one API key (Gemini or GLM) is required');
    }

    if (geminiApiKey && geminiApiKey.trim() !== '') {
      this.genAI = new GoogleGenerativeAI(geminiApiKey);
      this.geminiApiKey = geminiApiKey;
    } else {
      this.genAI = null;
      this.geminiApiKey = null;
    }

    if (glmApiKey && glmApiKey.trim() !== '') {
      this.glmApiKey = glmApiKey;
    }
  }

  /**
   * Check if GLM API is available
   */
  hasGLMAPI(): boolean {
    return this.glmApiKey !== null && this.glmApiKey.trim() !== '';
  }

  isInitialized(): boolean {
    return this.genAI !== null;
  }

  /**
   * Check if Gemini quota is currently exceeded
   * Quota resets after 60 seconds
   */
  isGeminiQuotaExceeded(): boolean {
    if (!this.geminiQuotaExceeded) return false;

    // Reset quota flag after 60 seconds
    const now = Date.now();
    if (now - this.geminiQuotaExceededAt > 60000) {
      this.geminiQuotaExceeded = false;
      this.geminiQuotaExceededAt = 0;
      console.log('🔄 Gemini quota reset - will try Gemini again');
      return false;
    }

    return true;
  }

  /**
   * Mark Gemini as quota exceeded
   */
  private markGeminiQuotaExceeded(): void {
    this.geminiQuotaExceeded = true;
    this.geminiQuotaExceededAt = Date.now();
    console.log('⚠️ Gemini quota exceeded - will use GLM for subsequent calls');
  }

  /**
   * Check if we should use GLM directly (skip Gemini)
   */
  shouldUseGLMDirectly(): boolean {
    return this.isGeminiQuotaExceeded() && this.hasGLMAPI();
  }

  async testConnection(provider: 'gemini' | 'glm' = 'gemini'): Promise<boolean> {
    if (provider === 'gemini') {
      return this.testGeminiConnection();
    } else {
      return this.testGLMConnection();
    }
  }

  private async testGeminiConnection(): Promise<boolean> {
    if (!this.genAI) {
      throw new Error('Gemini not initialized. Please set API key first.');
    }

    // Use latest valid Gemini models for image understanding
    const modelNames = [
      "gemini-3-pro-preview",      // Highest priority - most advanced multimodal
      "gemini-2.5-pro",            // Advanced thinking model
      "gemini-2.5-flash",          // Best price-performance (stable)
      "gemini-2.5-flash-lite"      // Fastest fallback
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
          console.log(`✓ Gemini connected with model: ${modelName}`);
          return true;
        }
      } catch (error: any) {
        lastError = error;
        console.warn(`Gemini model ${modelName} failed:`, error.message);
        // Continue to next model
      }
    }

    console.error('Gemini test connection failed:', lastError);

    if (lastError?.message?.includes('API_KEY_INVALID') || lastError?.message?.includes('401')) {
      throw new Error('API_KEY_INVALID: Invalid API key. Please check your key.');
    }

    throw lastError || new Error('Gemini connection test failed for all models');
  }

  private async testGLMConnection(): Promise<boolean> {
    if (!this.glmApiKey) {
      throw new Error('GLM API key not set. Please configure GLM API key first.');
    }

    try {
      const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.glmApiKey}`
        },
        body: JSON.stringify({
          model: 'glm-4.6v-flash',
          messages: [
            {
              role: 'user',
              content: 'Respond with exactly the word "SUCCESS" and nothing else.'
            }
          ],
          max_tokens: 10,
          temperature: 0
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`GLM API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('🔍 GLM test connection response:', data);

      const content = this._extractGLMContent(data);
      console.log('🔍 Extracted GLM content:', content);

      // Check for SUCCESS response (case-insensitive, trimmed)
      const trimmedContent = content.trim().toLowerCase();
      if (trimmedContent.includes('success')) {
        console.log('✓ GLM-4.6 connection successful');
        return true;
      } else if (trimmedContent === '') {
        // Some models might return empty content but still be successful
        console.log('✓ GLM-4.6 connection successful (empty response)');
        return true;
      } else {
        // If we get a 200 response but content doesn't contain "success",
        // still consider it a successful connection (API key is valid)
        console.warn('⚠️ GLM connection successful but unexpected response:', content);
        console.log('✓ GLM-4.6 connection successful (API key valid)');
        return true;
      }
    } catch (error: any) {
      console.error('GLM test connection failed:', error);

      if (error.message?.includes('401') || error.message?.includes('API_KEY_INVALID') || error.message?.includes('Invalid authentication')) {
        throw new Error('API_KEY_INVALID: Invalid GLM API key. Please check your key.');
      }

      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        throw new Error('RATE_LIMIT: GLM rate limit exceeded. Please wait and try again.');
      }

      throw new Error(`GLM connection failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Extract content from GLM API response (supports multiple response formats)
   */
  private _extractGLMContent(data: any): string {
    // OpenAI-compatible format
    if (data.choices && Array.isArray(data.choices) && data.choices[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    // Alternative format
    else if (data.result?.output?.text) {
      return data.result.output.text;
    }
    // Direct response field
    else if (data.response) {
      return data.response;
    }
    // Raw content field
    else if (data.content) {
      return data.content;
    }
    // Fallback to empty string
    return '';
  }

  async analyzeClothingImage(imageBase64: string): Promise<GeminiClothingAnalysis> {
    // Check if we should skip Gemini due to quota exceeded
    if (this.shouldUseGLMDirectly()) {
      console.log('🔄 Gemini quota exceeded - using GLM directly for analysis');
      return await this._analyzeWithGLM(imageBase64);
    }

    try {
      return await this._analyzeWithGemini(imageBase64);
    } catch (error: any) {
      console.warn('Gemini analysis failed, checking for GLM fallback...', error);

      // Check if error is rate limit, quota exceeded, or API key issue
      const isQuotaError = error.message?.includes('RATE_LIMIT') ||
        error.message?.includes('RESOURCE_EXHAUSTED') ||
        error.message?.includes('429') ||
        error.message?.includes('quota');

      const shouldFallback = isQuotaError ||
        error.message?.includes('API_KEY_INVALID') ||
        error.message?.includes('401') ||
        error.message?.includes('404') ||
        error.message?.includes('NOT_FOUND');

      // Mark quota exceeded for future calls
      if (isQuotaError) {
        this.markGeminiQuotaExceeded();
      }

      if (shouldFallback && this.hasGLMAPI()) {
        console.log('🔄 Falling back to GLM-4.6v for analysis...');
        try {
          return await this._analyzeWithGLM(imageBase64);
        } catch (glmError: any) {
          console.error('GLM analysis also failed:', glmError);
          throw new Error(`Both Gemini and GLM failed: ${error.message}, GLM: ${glmError.message}`);
        }
      }

      // Re-throw original error if no fallback or fallback not applicable
      throw error;
    }
  }
  private async _analyzeWithGemini(imageBase64: string): Promise<GeminiClothingAnalysis> {
    if (!this.genAI) {
      throw new Error('Gemini not initialized. Please set API key first.');
    }

    // Check cache first
    const cacheKey = `analyze_${imageBase64.substring(0, 50)}`;
    const cached = this.rateLimiter.getCached(cacheKey);
    if (cached) {
      console.log('✓ Using cached analysis result');
      return cached;
    }

    // Check rate limit
    this.rateLimiter.canMakeRequest();

    // Use latest valid Gemini models for image understanding
    const modelNames = [
      "gemini-3-pro-preview",       // Highest priority - most advanced multimodal
      "gemini-2.5-pro",             // Advanced thinking model
      "gemini-2.5-flash",           // Best price-performance (stable)
      "gemini-2.5-flash-lite"       // Fastest fallback
    ];

    let result = null;
    let lastError: any = null;

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

        if (result) {
          console.log(`✓ Gemini analysis successful with model: ${modelName}`);
          break; // Success
        }
      } catch (e: any) {
        lastError = e;
        console.warn(`Gemini model ${modelName} failed, trying next...`, e.message);

        // CRITICAL: If quota exceeded or rate limit, don't try other models
        // Immediately throw to trigger GLM fallback
        const isQuotaError = e.message?.includes('429') ||
          e.message?.includes('quota') ||
          e.message?.includes('RESOURCE_EXHAUSTED') ||
          e.message?.includes('Quota exceeded');

        if (isQuotaError) {
          console.error('🚨 Gemini quota exceeded, stopping model attempts and triggering GLM fallback...');
          throw new Error('RATE_LIMIT: Gemini quota exceeded. Falling back to GLM.');
        }
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
    const validated = this.validateAndCleanAnalysis(analysis);

    // Cache the result
    this.rateLimiter.setCache(cacheKey, validated);

    return validated;
  }

  private async _analyzeWithGLM(imageBase64: string): Promise<GeminiClothingAnalysis> {
    if (!this.glmApiKey) {
      throw new Error('GLM API key not configured.');
    }

    const prompt = this.buildAnalysisPrompt();

    try {
      const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.glmApiKey}`
        },
        body: JSON.stringify({
          model: 'glm-4.6v-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 2000,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`GLM API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('🔍 GLM analysis response:', data);

      const content = this._extractGLMContent(data);
      console.log('🔍 Extracted GLM content:', content);

      if (!content) {
        throw new Error('GLM returned empty response');
      }

      // Try to parse JSON - sometimes it might be wrapped in markdown code blocks
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1] || jsonMatch[0];
      }

      const analysis = JSON.parse(jsonStr);
      console.log('✓ GLM analysis successful');

      return this.validateAndCleanAnalysis(analysis);
    } catch (error: any) {
      console.error('GLM analysis failed:', error);

      if (error.message?.includes('401') || error.message?.includes('Invalid authentication')) {
        throw new Error('API_KEY_INVALID: Invalid GLM API key.');
      }

      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        throw new Error('RATE_LIMIT: GLM rate limit exceeded.');
      }

      throw new Error(`GLM analysis failed: ${error.message || 'Unknown error'}`);
    }
  }

  private async _compareWithGLM(
    image1Base64: string,
    image2Base64: string,
    prompt: string
  ): Promise<any> {
    if (!this.glmApiKey) {
      throw new Error('GLM API key not configured.');
    }

    try {
      const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.glmApiKey}`
        },
        body: JSON.stringify({
          model: 'glm-4.6v-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${image1Base64}`
                  }
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${image2Base64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 2000,
          temperature: 0.05
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`GLM API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('🔍 GLM comparison response:', data);

      const content = this._extractGLMContent(data);
      console.log('🔍 Extracted GLM content:', content);

      if (!content) {
        throw new Error('GLM returned empty response');
      }

      // Try to parse JSON - sometimes it might be wrapped in markdown code blocks
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1] || jsonMatch[0];
      }

      const parsedResult = JSON.parse(jsonStr);
      console.log('✓ GLM comparison successful');

      return parsedResult;
    } catch (error: any) {
      console.error('GLM comparison failed:', error);

      if (error.message?.includes('401') || error.message?.includes('Invalid authentication')) {
        throw new Error('API_KEY_INVALID: Invalid GLM API key.');
      }

      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        throw new Error('RATE_LIMIT: GLM rate limit exceeded.');
      }

      throw new Error(`GLM comparison failed: ${error.message || 'Unknown error'}`);
    }
  }

  private buildAnalysisPrompt(): string {
    return `
Analyze this clothing/fashion item image. Focus on the OVERALL MODEL and MAIN PATTERN/MOTIF. Return ONLY valid JSON matching this exact structure:

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
  "colors": ["pink", "white"],
  "fabric_texture": "smooth"
}

CRITICAL INSTRUCTIONS:
1. Focus on the OVERALL MODEL of the clothing (main type, silhouette, length)
2. Focus on the MAIN PATTERN/MOTIF (geometric, floral, striped, etc.) - include logos/brands ONLY if actually visible
3. Describe pattern in detail if complex (e.g., "geometric_grid_with_logo", "floral_with_brand_name")
4. Return ONLY the JSON, no markdown formatting, no backticks, no explanation
5. All confidence values should be 0-100 numbers
6. If you cannot see something clearly, use your best judgment

IMPORTANT: For pattern field, be descriptive if there are logos, text, or specific designs:
- "geometric" for general geometric patterns
- "geometric_grid_with_logo" if there's a grid pattern with brand logo
- "floral_with_brand" if floral pattern includes brand text
- "striped_with_text" if stripes include text/logo

Valid values:
- main_type: "gamis", "tunik", "dress", "blouse", "kaftan", "other"
- silhouette: "a-line", "bodycon", "loose", "fitted", "empire"
- length: "maxi", "midi", "mini", "hip-length"
- pattern: "floral", "geometric", "solid", "batik", "striped", "polkadot", "mixed" (or custom descriptive string)
- complexity: "simple", "detailed", "ornate"
- fabric_texture: "smooth", "textured", "glossy", "matte"
    `.trim();
  }

  /**
   * Build prompt for direct comparison of two images (recommended by Gemini)
   */
  private buildComparisonPrompt(): string {
    return `
You are a fashion AI analyst. Your task is to compare two images of Muslim women's clothing and provide a total similarity score.

Focus your assessment EXCLUSIVELY on the following two aspects:
1. **Model Baju:** Potongan, siluet (A-line, lurus, etc.), dan panjang (gamis, abaya, etc.).
2. **Motif Baju:** Pola, cetakan (printing), dan detail tekstur (bordir, renda, garis).

Scoring scale is 0% to 100%, where 100% means model and motif of Garment 1 are exactly the same as Garment 2.

Return ONLY valid JSON matching this exact structure:

{
  "penjelasan": "Berikan penjelasan singkat (max 3 kalimat) mengenai dasar pemberian skor, menyebutkan kemiripan model dan motif yang ditemukan.",
  "skor_kemiripan_persen": [SKOR ANGKA DARI 0 SAMPAI 100],
  "fokus_perbandingan": {
    "model_baju": [PENJELASAN KEMIRIPAN MODEL],
    "motif_baju": [PENJELASAN KEMIRIPAN MOTIF]
  }
}

CRITICAL INSTRUCTIONS:
1. Compare only the MODEL (cut, silhouette, length) and MOTIF/PATTERN
2. Ignore colors, lighting, background, poses, and minor details
3. If images are identical (same photo), return 100% score
4. Focus on visual and conceptual similarity, not pixel-level differences
5. If patterns include logos/text, check if they match between images
6. Return ONLY the JSON, no markdown formatting, no backticks, no explanation
7. Write "penjelasan" and "fokus_perbandingan" in Indonesian (Bahasa Indonesia)
8. Score should reflect true visual similarity (100% for identical images)

Scoring guidelines:
- 100%: Identical model and motif (same photo or visually indistinguishable)
- 90-99%: Very similar model and motif, minor differences
- 80-89%: Similar model, similar motif with some variations
- 70-79%: Similar model, different motif or vice versa
- Below 70%: Different model or motif
    `.trim();
  }

  /**
   * Direct comparison of two images (recommended by Gemini)
   * Sends both images in one prompt for visual comparison
   * @param image1Base64 - Base64 encoded first image (uploaded product)
   * @param image2Base64 - Base64 encoded second image (existing product)
   * @returns Direct comparison result with similarity score and explanations
   */
  async directCompareImages(
    image1Base64: string,
    image2Base64: string
  ): Promise<{
    similarityScore: number;
    explanation: string;
    modelComparison: string;
    motifComparison: string;
  }> {
    const prompt = this.buildComparisonPrompt();

    // Check if we should skip Gemini due to quota exceeded
    if (this.shouldUseGLMDirectly()) {
      console.log('🔄 Gemini quota exceeded - using GLM directly for comparison');
      try {
        const glmResult = await this._compareWithGLM(image1Base64, image2Base64, prompt);

        const similarityScore = Number(glmResult.skor_kemiripan_persen) || 0;
        const explanation = glmResult.penjelasan || 'No explanation provided';
        const modelComparison = glmResult.fokus_perbandingan?.model_baju || 'No model comparison';
        const motifComparison = glmResult.fokus_perbandingan?.motif_baju || 'No motif comparison';

        return { similarityScore, explanation, modelComparison, motifComparison };
      } catch (glmError: any) {
        console.error('❌ GLM comparison failed:', glmError);
        return {
          similarityScore: 0,
          explanation: `GLM failed: ${glmError.message}`,
          modelComparison: 'Comparison failed',
          motifComparison: 'Comparison failed'
        };
      }
    }

    // Try Gemini first
    try {
      console.log('🔍 Starting direct image comparison using Gemini API...');

      const result = await this.compareClothingImages(
        image1Base64,
        image2Base64,
        prompt
      );

      console.log('🔍 Raw direct comparison result:', JSON.stringify(result, null, 2));

      // Parse the result according to our expected format
      const similarityScore = Number(result.skor_kemiripan_persen) || 0;
      const explanation = result.penjelasan || 'No explanation provided';
      const modelComparison = result.fokus_perbandingan?.model_baju || 'No model comparison';
      const motifComparison = result.fokus_perbandingan?.motif_baju || 'No motif comparison';

      console.log('🔍 Parsed direct comparison:', {
        similarityScore,
        explanation: explanation.substring(0, 100) + '...',
        modelComparison: modelComparison.substring(0, 50) + '...',
        motifComparison: motifComparison.substring(0, 50) + '...'
      });

      return {
        similarityScore,
        explanation,
        modelComparison,
        motifComparison
      };
    } catch (geminiError: any) {
      console.warn('Gemini direct comparison failed, checking for GLM fallback...', geminiError);

      // Check if error is rate limit or quota exceeded
      const isQuotaError = geminiError.message?.includes('RATE_LIMIT') ||
        geminiError.message?.includes('RESOURCE_EXHAUSTED') ||
        geminiError.message?.includes('429') ||
        geminiError.message?.includes('quota');

      const shouldFallback = isQuotaError ||
        geminiError.message?.includes('API_KEY_INVALID') ||
        geminiError.message?.includes('401') ||
        geminiError.message?.includes('404') ||
        geminiError.message?.includes('NOT_FOUND');

      // Mark quota exceeded for future calls
      if (isQuotaError) {
        this.markGeminiQuotaExceeded();
      }

      if (shouldFallback && this.hasGLMAPI()) {
        console.log('🔄 Falling back to GLM-4.6v for direct comparison...');
        try {
          const glmResult = await this._compareWithGLM(image1Base64, image2Base64, prompt);

          console.log('🔍 Raw GLM comparison result:', JSON.stringify(glmResult, null, 2));

          const similarityScore = Number(glmResult.skor_kemiripan_persen) || 0;
          const explanation = glmResult.penjelasan || 'No explanation provided';
          const modelComparison = glmResult.fokus_perbandingan?.model_baju || 'No model comparison';
          const motifComparison = glmResult.fokus_perbandingan?.motif_baju || 'No motif comparison';

          console.log('🔍 Parsed GLM comparison:', {
            similarityScore,
            explanation: explanation.substring(0, 100) + '...',
            modelComparison: modelComparison.substring(0, 50) + '...',
            motifComparison: motifComparison.substring(0, 50) + '...'
          });

          return {
            similarityScore,
            explanation,
            modelComparison,
            motifComparison
          };
        } catch (glmError: any) {
          console.error('❌ GLM direct comparison also failed:', glmError);
          // Fallback to 0% if both fail
          return {
            similarityScore: 0,
            explanation: `Both Gemini and GLM failed: ${geminiError.message}, GLM: ${glmError.message}`,
            modelComparison: 'Comparison failed',
            motifComparison: 'Comparison failed'
          };
        }
      }

      // No fallback or fallback not applicable, return Gemini error
      console.error('❌ Error in direct image comparison:', geminiError);
      return {
        similarityScore: 0,
        explanation: 'Error comparing images: ' + geminiError.message,
        modelComparison: 'Comparison failed',
        motifComparison: 'Comparison failed'
      };
    }
  }


  /**
   * Analyze image AND caption to extract product details (for WhatsApp automation)
   */
  async analyzeCaptionAndImage(
    imageBase64: string,
    caption: string
  ): Promise<GeminiClothingAnalysis> {
    const prompt = `
    Analyze this product image and the accompanying caption/text.
    Caption: "${caption}"
    
    Extract the following information into a valid JSON object:
    1. "name": A concise product name (combine model + motif/material).
    2. "description": A short, attractive description for a sales catalog.
    3. "category": Best guess category (Gamis, Tunik, Setelan, Hijab, etc.).
    4. "price": The RETAIL price found in text (usually higher). If text says "Reseller" vs "Retail", take Retail.
    5. "resellerPrice": The RESELLER price if mentioned. If not, set to 0.
    6. "colors": List of available colors found in text or image.
    7. "sizes": List of sizes found in text (e.g., S, M, L, XL, All Size). If text says "All Size" or "Free Size", put ["All Size"].
    8. "material": Material mentioned (e.g. Rayon, Katun).
    9. "status": If text contains "PO", "Pre Order", or "Jahit dulu", set to "po". Otherwise "ready".
    
    Return ONLY JSON. No text.
    Structure:
    {
      "name": "...",
      "description": "...",
      "category": "...",
      "price": 0,
      "resellerPrice": 0,
      "colors": ["..."],
      "sizes": ["..."],
      "material": "...",
      "status": "ready"
    }
    `.trim();

    // Try Gemini first
    try {
      if (this.shouldUseGLMDirectly()) {
        return await this._analyzeCaptionWithGLM(imageBase64, prompt);
      }

      if (!this.genAI) throw new Error('Gemini not initialized');

      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash", // Fast and good enough for text extraction
        generationConfig: { responseMimeType: "application/json" }
      });

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBase64,
            mimeType: "image/jpeg"
          }
        }
      ]);

      const start = Date.now();
      const response = await result.response;
      const text = response.text();
      console.log(`Gemini Caption Analysis took ${Date.now() - start}ms`);

      return JSON.parse(text);

    } catch (error: any) {
      console.warn('Gemini caption analysis failed, trying GLM...', error);
      if (error.message?.includes('quota')) this.markGeminiQuotaExceeded();

      if (this.hasGLMAPI()) {
        return await this._analyzeCaptionWithGLM(imageBase64, prompt);
      }
      throw error;
    }
  }

  private async _analyzeCaptionWithGLM(imageBase64: string, prompt: string): Promise<any> {
    if (!this.glmApiKey) throw new Error('GLM API key missing');

    const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.glmApiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4.6v-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }]
      })
    });

    const data = await response.json();
    const content = this._extractGLMContent(data);

    // Clean markdown if present
    const jsonStr = content.replace(/```json\n|\n```/g, '').trim();
    return JSON.parse(jsonStr);
  }

  private validateAndCleanAnalysis(analysis: any): GeminiClothingAnalysis {
    // Log raw analysis for debugging
    console.log('🔍 Raw Gemini analysis:', JSON.stringify(analysis, null, 2));

    // Basic validation and defaults with case normalization
    // Note: New prompt only returns clothing_type, pattern_type, colors, fabric_texture
    // Other fields get default values
    const validated: GeminiClothingAnalysis = {
      clothing_type: {
        main_type: (analysis.clothing_type?.main_type || 'other').toLowerCase(),
        silhouette: (analysis.clothing_type?.silhouette || 'loose').toLowerCase(),
        length: (analysis.clothing_type?.length || 'maxi').toLowerCase(),
        confidence: analysis.clothing_type?.confidence || 50
      },
      pattern_type: {
        pattern: (analysis.pattern_type?.pattern || 'solid').toLowerCase(),
        complexity: (analysis.pattern_type?.complexity || 'simple').toLowerCase(),
        confidence: analysis.pattern_type?.confidence || 50
      },
      // Default values for fields not in new prompt
      lace_details: {
        has_lace: false,
        locations: [],
        confidence: 50
      },
      hem_pleats: {
        has_pleats: false,
        pleat_type: 'none',
        depth: 'shallow',
        fullness: 0,
        confidence: 50
      },
      sleeve_details: {
        has_pleats: false,
        sleeve_type: 'straight',
        pleat_position: 'wrist',
        ruffle_count: 0,
        cuff_style: 'plain',
        confidence: 50
      },
      embellishments: {
        beads: { has: false, locations: [], density: 0 },
        embroidery: { has: false, pattern: '' },
        sequins: { has: false, locations: [] },
        gold_thread: { has: false, coverage: 0 }
      },
      colors: (analysis.colors || ['unknown']).map((c: string) => c.toLowerCase()),
      fabric_texture: (analysis.fabric_texture || 'smooth').toLowerCase()
    };

    return validated;
  }

  async batchAnalyze(images: string[], onProgress?: (index: number, total: number) => void): Promise<GeminiClothingAnalysis[]> {
    const results: GeminiClothingAnalysis[] = [];

    // Analyze sequentially to respect rate limits
    for (let i = 0; i < images.length; i++) {
      try {
        const analysis = await this.analyzeClothingImage(images[i]);
        results.push(analysis);

        if (onProgress) {
          onProgress(i + 1, images.length);
        }

        // Delay between requests to avoid rate limiting (1 second)
        if (i < images.length - 1) {
          console.log(`⏳ Waiting 1 second before next request (${i + 1}/${images.length})...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.error(`❌ Failed to analyze image ${i + 1}:`, error.message);

        // If quota exceeded, stop batch processing
        if (error.message?.includes('RATE_LIMIT') || error.message?.includes('quota')) {
          console.error('🚨 Quota exceeded, stopping batch analysis');
          throw error;
        }

        // For other errors, continue with next image
        console.warn(`⚠️ Skipping image ${i + 1}, continuing with next...`);
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

    // Check cache first
    const cacheKey = `compare_${image1Base64.substring(0, 30)}_${image2Base64.substring(0, 30)}`;
    const cached = this.rateLimiter.getCached(cacheKey);
    if (cached) {
      console.log('✓ Using cached comparison result');
      return cached;
    }

    // Check rate limit
    this.rateLimiter.canMakeRequest();

    // Use latest valid Gemini models for image understanding
    const modelNames = [
      "gemini-3-pro-preview",       // Highest priority - most advanced multimodal
      "gemini-2.5-pro",             // Advanced thinking model
      "gemini-2.5-flash",           // Best price-performance (stable)
      "gemini-2.5-flash-lite"       // Fastest fallback
    ];

    let result = null;
    let lastError: any = null;

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

        if (result) {
          console.log(`✓ Gemini comparison successful with model: ${modelName}`);
          break; // Success, exit loop
        }
      } catch (e: any) {
        lastError = e;
        console.warn(`Gemini model ${modelName} failed, trying next...`, e.message);

        // CRITICAL: If quota exceeded or rate limit, don't try other models
        // Immediately throw to trigger GLM fallback
        const isQuotaError = e.message?.includes('429') ||
          e.message?.includes('quota') ||
          e.message?.includes('RESOURCE_EXHAUSTED') ||
          e.message?.includes('Quota exceeded');

        if (isQuotaError) {
          console.error('🚨 Gemini quota exceeded, stopping model attempts and triggering GLM fallback...');
          throw new Error('RATE_LIMIT: Gemini quota exceeded. Falling back to GLM.');
        }
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

      // Cache the result
      this.rateLimiter.setCache(cacheKey, parsedResult);

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
    // If Gemini quota is exceeded, skip to fallback directly
    if (this.isGeminiQuotaExceeded()) {
      console.log('🔄 Gemini quota exceeded - using fallback for comparative analysis');
      return this.generateFallbackComparativeAnalysis(uploadedAnalysis, existingProducts, topN);
    }

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
${index + 1}. ${item.salesData.productName} - ${item.salesData.totalQuantity} pcs sold
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

      if (!this.genAI) {
        console.log('⚠️ Gemini not initialized - using fallback');
        return this.generateFallbackComparativeAnalysis(uploadedAnalysis, existingProducts, topN);
      }

      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
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

      // Mark quota exceeded if it's a quota error
      const isQuotaError = error.message?.includes('429') ||
        error.message?.includes('quota') ||
        error.message?.includes('RESOURCE_EXHAUSTED') ||
        error.message?.includes('RATE_LIMIT');

      if (isQuotaError) {
        this.markGeminiQuotaExceeded();
      }

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


  /**
   * Generate marketing title and description based on analysis
   * Priority: GLM (subscribed, no limit) -> Gemini -> Fallback
   */
  async generateMarketingContent(
    analysis: GeminiClothingAnalysis,
    similarProductName?: string
  ): Promise<{ title: string; description: string }> {
    const prompt = `
You are a professional fashion copywriter for Azzahra Fashion Muslim.
Create an SEO-friendly product title and marketing description based on this clothing analysis:

DATA:
${JSON.stringify(analysis, null, 2)}
${similarProductName ? `Similar to bestseller: "${similarProductName}"` : ''}

RULES:
1. TITLE: Catchy, SEO friendly, Indonesian Language. Format: "Type + Motif + Key Feature". Max 6 words. Example: "Gamis Silk Motif Bunga Premium". Do NOT use product codes like "Baju 6" or generic numbers.
2. DESCRIPTION: 3-5 sentences in Indonesian. Engaging, highlights fabric texture, pattern, and suitable occasions. Mention specific details found in analysis (e.g. lace, pleats).
3. BRAND TONE: Elegant, modest, premium.

Return ONLY valid JSON:
{
  "title": "string",
  "description": "string"
}
    `.trim();

    // Priority 1: Use GLM API (subscribed, no rate limit)
    if (this.hasGLMAPI()) {
      try {
        console.log('📝 Generating marketing content with GLM (priority)...');
        const result = await this._generateMarketingWithGLM(prompt);
        console.log('✓ GLM marketing content generated successfully');
        return result;
      } catch (glmError: any) {
        console.warn('GLM marketing content failed, trying Gemini...', glmError.message);
      }
    }

    // Priority 2: Use Gemini API (may hit rate limit)
    if (this.genAI && !this.isGeminiQuotaExceeded()) {
      try {
        console.log('📝 Generating marketing content with Gemini...');
        const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
        console.log('✓ Gemini marketing content generated successfully');
        return JSON.parse(cleanedText);
      } catch (geminiError: any) {
        console.warn('Gemini marketing content failed:', geminiError.message);

        // Mark quota exceeded if applicable
        if (geminiError.message?.includes('429') || geminiError.message?.includes('quota')) {
          this.markGeminiQuotaExceeded();
        }
      }
    }

    // Priority 3: Fallback to template-based generation
    console.log('📝 Using fallback template for marketing content...');
    const title = `${analysis.clothing_type.main_type} ${analysis.pattern_type.pattern} Premium`.replace(/_/g, ' ');
    const description = `Produk ${analysis.clothing_type.main_type} terbaru dari Azzahra Fashion Muslim. Hadir dengan motif ${analysis.pattern_type.pattern} yang elegan dan potongan ${analysis.clothing_type.silhouette} yang nyaman. Cocok untuk acara formal maupun kasual.`;
    return {
      title: title.charAt(0).toUpperCase() + title.slice(1),
      description
    };
  }

  /**
   * Generate marketing content using GLM API
   */
  private async _generateMarketingWithGLM(prompt: string): Promise<{ title: string; description: string }> {
    if (!this.glmApiKey) {
      throw new Error('GLM API key not configured.');
    }

    const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.glmApiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4.6v-flash',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`GLM API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = this._extractGLMContent(data);

    if (!content) {
      throw new Error('GLM returned empty response for marketing content');
    }

    // Parse JSON from response
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1] || jsonMatch[0];
    }

    return JSON.parse(jsonStr);
  }
}

export const geminiService = new GeminiVisionService();
