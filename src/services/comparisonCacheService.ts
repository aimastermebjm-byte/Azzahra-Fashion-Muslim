export interface CachedComparison {
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
  timestamp: number;
}

export class ComparisonCacheService {
  private STORAGE_NAME = 'ai_image_comparison_cache_v1';
  private CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private MAX_CACHE_SIZE = 100; // Maximum number of cached comparisons

  /**
   * Get cached comparison result by hash pair
   * @param hash1 - First image hash
   * @param hash2 - Second image hash
   * @returns Cached comparison result or null
   */
  getCached(hash1: string, hash2: string): CachedComparison | null {
    try {
      const cache = this.getCache();
      const key = this.generateKey(hash1, hash2);
      const item = cache[key];
      
      if (!item) {
        return null;
      }
      
      // Check if expired
      const now = Date.now();
      if (now - item.timestamp > this.CACHE_TTL) {
        console.log('Cache expired, removing:', key);
        delete cache[key];
        this.saveCache(cache);
        return null;
      }
      
      console.log('Cache hit:', key);
      return item;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  }

  /**
   * Cache comparison result
   * @param hash1 - First image hash
   * @param hash2 - Second image hash
   * @param result - Comparison result to cache
   */
  cache(hash1: string, hash2: string, result: Omit<CachedComparison, 'timestamp'>): void {
    try {
      const cache = this.getCache();
      const key = this.generateKey(hash1, hash2);
      
      cache[key] = {
        ...result,
        timestamp: Date.now()
      };
      
      this.saveCache(cache);
      console.log('Cached comparison:', key);
      
      // Auto cleanup if cache size exceeds limit
      const cacheSize = Object.keys(cache).length;
      if (cacheSize > this.MAX_CACHE_SIZE) {
        console.log(`Cache size (${cacheSize}) exceeds limit, cleaning up...`);
        this.cleanupOldest(20); // Remove oldest 20 entries
      }
    } catch (error) {
      console.error('Failed to cache comparison:', error);
      // If quota exceeded, try to clear old cache and retry
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('LocalStorage quota exceeded, clearing old cache...');
        this.cleanupOldest(50);
        // Try one more time
        try {
          const cache = this.getCache();
          const key = this.generateKey(hash1, hash2);
          cache[key] = { ...result, timestamp: Date.now() };
          this.saveCache(cache);
        } catch (retryError) {
          console.error('Failed to cache even after cleanup:', retryError);
        }
      }
    }
  }

  /**
   * Generate cache key from two hashes (sorted for consistency)
   * @param hash1 - First hash
   * @param hash2 - Second hash
   * @returns Cache key
   */
  private generateKey(hash1: string, hash2: string): string {
    // Sort hashes to ensure A vs B = B vs A
    const [first, second] = [hash1, hash2].sort();
    return `${first}_vs_${second}`;
  }

  /**
   * Get all cached comparisons
   * @returns Cache object
   */
  private getCache(): Record<string, CachedComparison> {
    try {
      const cached = localStorage.getItem(this.STORAGE_NAME);
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.error('Error parsing cache:', error);
      // If corrupted, clear cache
      localStorage.removeItem(this.STORAGE_NAME);
      return {};
    }
  }

  /**
   * Save cache to localStorage
   * @param cache - Cache object to save
   */
  private saveCache(cache: Record<string, CachedComparison>): void {
    try {
      localStorage.setItem(this.STORAGE_NAME, JSON.stringify(cache));
    } catch (error) {
      console.error('Error saving cache:', error);
      throw error;
    }
  }

  /**
   * Remove oldest N entries from cache
   * @param count - Number of entries to remove
   */
  private cleanupOldest(count: number): void {
    try {
      const cache = this.getCache();
      const entries = Object.entries(cache);
      
      if (entries.length === 0) return;
      
      // Sort by timestamp (oldest first)
      entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      // Remove oldest N entries
      const toRemove = entries.slice(0, count);
      toRemove.forEach(([key]) => {
        delete cache[key];
      });
      
      this.saveCache(cache);
      console.log(`Cleaned up ${toRemove.length} old cache entries`);
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }
  }

  /**
   * Clear all cached comparisons
   */
  clearAll(): void {
    try {
      localStorage.removeItem(this.STORAGE_NAME);
      console.log('All comparison cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns Cache stats
   */
  getStats(): { total: number; size: string; oldestTimestamp: number | null } {
    try {
      const cache = this.getCache();
      const entries = Object.entries(cache);
      
      // Calculate total size
      const cacheString = JSON.stringify(cache);
      const sizeBytes = new Blob([cacheString]).size;
      const sizeKB = (sizeBytes / 1024).toFixed(2);
      
      // Find oldest entry
      let oldestTimestamp: number | null = null;
      if (entries.length > 0) {
        oldestTimestamp = Math.min(...entries.map(([, item]) => item.timestamp));
      }
      
      return {
        total: entries.length,
        size: `${sizeKB} KB`,
        oldestTimestamp
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        total: 0,
        size: '0 KB',
        oldestTimestamp: null
      };
    }
  }

  /**
   * Remove expired entries from cache
   */
  cleanupExpired(): void {
    try {
      const cache = this.getCache();
      const now = Date.now();
      let removedCount = 0;
      
      Object.entries(cache).forEach(([key, item]) => {
        if (now - item.timestamp > this.CACHE_TTL) {
          delete cache[key];
          removedCount++;
        }
      });
      
      if (removedCount > 0) {
        this.saveCache(cache);
        console.log(`Cleaned up ${removedCount} expired cache entries`);
      }
    } catch (error) {
      console.error('Error cleaning up expired cache:', error);
    }
  }
}

export const comparisonCacheService = new ComparisonCacheService();
