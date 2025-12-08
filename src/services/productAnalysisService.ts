import { doc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';
import { geminiService, GeminiClothingAnalysis } from './geminiVisionService';
import { collageService } from './collageService';

export interface AnalysisProgress {
  total: number;
  current: number;
  currentProduct: string;
  status: 'analyzing' | 'complete' | 'error';
  error?: string;
}

export class ProductAnalysisService {
  /**
   * Analyze a single product's main image
   */
  async analyzeProduct(product: Product): Promise<GeminiClothingAnalysis | null> {
    try {
      // Skip if already analyzed recently (within 30 days)
      if (product.aiAnalysis?.analyzedAt) {
        const analyzedDate = new Date(product.aiAnalysis.analyzedAt);
        const daysSinceAnalysis = (Date.now() - analyzedDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceAnalysis < 30) {
          console.log(`✓ Product ${product.id} already analyzed recently`);
          return product.aiAnalysis as any;
        }
      }

      // Get main image URL
      const mainImageUrl = product.images[0] || product.image;
      
      if (!mainImageUrl) {
        console.warn(`⚠️ Product ${product.id} has no images`);
        return null;
      }

      console.log(`🔍 Analyzing product: ${product.name}`);

      // Fetch image from URL and convert to base64
      const response = await fetch(mainImageUrl);
      const blob = await response.blob();
      
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Analyze with Gemini
      const analysis = await geminiService.analyzeClothingImage(base64);

      // Save analysis to Firestore
      const productRef = doc(db, 'products', product.id);
      await updateDoc(productRef, {
        aiAnalysis: {
          ...analysis,
          analyzedAt: new Date()
        }
      });

      console.log(`✅ Product ${product.id} analyzed successfully`);

      return analysis;
    } catch (error: any) {
      console.error(`❌ Failed to analyze product ${product.id}:`, error);
      
      // Don't throw - just return null to continue with other products
      return null;
    }
  }

  /**
   * Analyze multiple products with progress tracking
   */
  async analyzeBatchProducts(
    products: Product[],
    onProgress?: (progress: AnalysisProgress) => void
  ): Promise<Map<string, GeminiClothingAnalysis>> {
    const results = new Map<string, GeminiClothingAnalysis>();
    const total = products.length;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      // Update progress
      if (onProgress) {
        onProgress({
          total,
          current: i + 1,
          currentProduct: product.name,
          status: 'analyzing'
        });
      }

      try {
        const analysis = await this.analyzeProduct(product);
        
        if (analysis) {
          results.set(product.id, analysis);
        }

        // Small delay to avoid rate limiting
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        console.error(`Error analyzing product ${product.id}:`, error);
        
        // Continue with next product
        if (error.message?.includes('RATE_LIMIT')) {
          // If rate limited, wait longer
          console.log('⏳ Rate limit hit, waiting 60s...');
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      }
    }

    // Final progress
    if (onProgress) {
      onProgress({
        total,
        current: total,
        currentProduct: '',
        status: 'complete'
      });
    }

    return results;
  }

  /**
   * Get products that need analysis (no aiAnalysis or outdated)
   */
  async getProductsNeedingAnalysis(): Promise<Product[]> {
    try {
      const productsRef = collection(db, 'products');
      const snapshot = await getDocs(productsRef);

      const needAnalysis: Product[] = [];
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

      snapshot.docs.forEach(doc => {
        const product = { id: doc.id, ...doc.data() } as Product;

        // Need analysis if:
        // 1. No aiAnalysis field
        // 2. analyzedAt is older than 30 days
        // 3. Has images
        const hasImages = product.images?.length > 0 || product.image;
        
        if (!hasImages) return;

        const needsUpdate = !product.aiAnalysis || 
                          !product.aiAnalysis.analyzedAt ||
                          new Date(product.aiAnalysis.analyzedAt).getTime() < thirtyDaysAgo;

        if (needsUpdate) {
          needAnalysis.push(product);
        }
      });

      console.log(`📊 Products needing analysis: ${needAnalysis.length}`);

      return needAnalysis;
    } catch (error) {
      console.error('Error getting products needing analysis:', error);
      return [];
    }
  }

  /**
   * Get analysis statistics
   */
  async getAnalysisStats(): Promise<{
    total: number;
    analyzed: number;
    pending: number;
    percentComplete: number;
  }> {
    try {
      const productsRef = collection(db, 'products');
      const snapshot = await getDocs(productsRef);

      let total = 0;
      let analyzed = 0;

      snapshot.docs.forEach(doc => {
        const product = doc.data() as Product;
        const hasImages = product.images?.length > 0 || product.image;
        
        if (hasImages) {
          total++;
          if (product.aiAnalysis?.analyzedAt) {
            analyzed++;
          }
        }
      });

      const pending = total - analyzed;
      const percentComplete = total > 0 ? (analyzed / total) * 100 : 0;

      return {
        total,
        analyzed,
        pending,
        percentComplete
      };
    } catch (error) {
      console.error('Error getting analysis stats:', error);
      return {
        total: 0,
        analyzed: 0,
        pending: 0,
        percentComplete: 0
      };
    }
  }
}

export const productAnalysisService = new ProductAnalysisService();
