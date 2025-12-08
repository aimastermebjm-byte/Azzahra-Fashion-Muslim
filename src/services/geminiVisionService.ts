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
    
    try {
      // Test with a simple prompt
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash"
      });
      
      const result = await model.generateContent("Say 'OK' if you can read this.");
      const response = result.response.text();
      
      return response.toLowerCase().includes('ok');
    } catch (error: any) {
      console.error('Gemini test connection failed:', error);
      
      if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('401')) {
        throw new Error('API_KEY_INVALID: Invalid API key. Please check your key.');
      }
      
      throw error;
    }
  }
  
  async analyzeClothingImage(imageBase64: string): Promise<GeminiClothingAnalysis> {
    if (!this.genAI) {
      throw new Error('Gemini not initialized. Please set API key first.');
    }
    
    // Check rate limit
    this.rateLimiter.canMakeRequest();
    
    const model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2 // Low temperature for consistent results
      }
    });
    
    const prompt = this.buildAnalysisPrompt();
    
    try {
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBase64,
            mimeType: "image/jpeg"
          }
        }
      ]);
      
      const responseText = result.response.text();
      const analysis = JSON.parse(responseText);
      
      return this.validateAndCleanAnalysis(analysis);
    } catch (error: any) {
      console.error('Gemini analysis failed:', error);
      
      if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('401')) {
        throw new Error('API_KEY_INVALID: Invalid API key.');
      }
      
      if (error.message?.includes('RATE_LIMIT') || error.message?.includes('429')) {
        throw new Error('RATE_LIMIT: Too many requests. Please wait.');
      }
      
      if (error.message?.includes('TIMEOUT') || error.message?.includes('timeout')) {
        throw new Error('TIMEOUT: Request timeout. Please try again.');
      }
      
      throw new Error('Failed to analyze image. Please try again.');
    }
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
}

export const geminiService = new GeminiVisionService();
