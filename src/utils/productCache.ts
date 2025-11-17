/**
 * Product Cache Utility for Firebase Cost Optimization
 * Implements intelligent caching with cross-device synchronization
 */

import {
  CacheEntry,
  CacheConfig,
  SearchCacheKey,
  ProductCacheKey,
  CacheStats,
  SearchResult,
  ProductListCache,
  FeaturedCache,
  FlashSaleCache,
  CacheInvalidationEvent,
  CACHE_CONFIG,
  CACHE_KEYS
} from '../types/cache';

class ProductCache {
  private config: CacheConfig;
  private stats: CacheStats;
  private storageKey = 'azzahra_product_cache';
  private statsKey = 'azzahra_cache_stats';

  constructor() {
    this.config = {
      ttl: CACHE_CONFIG.TTL.HOME,
      maxSize: CACHE_CONFIG.MAX_SIZE,
      version: CACHE_CONFIG.VERSION
    };

    this.stats = this.loadStats();
    this.cleanupExpiredEntries();
  }

  /**
   * Generate cache key for different types of product data
   */
  private generateKey(type: string, params: Record<string, any> = {}): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          result[key] = params[key];
        }
        return result;
      }, {} as Record<string, any>);

    const paramString = Object.keys(sortedParams)
      .map(key => `${key}:${sortedParams[key]}`)
      .join('|');

    return paramString ? `${type}_${paramString}` : type;
  }

  /**
   * Generate search cache key with all relevant parameters
   */
  generateSearchKey(params: SearchCacheKey): string {
    return this.generateKey(CACHE_KEYS.SEARCH, {
      q: params.query.toLowerCase().trim(),
      cat: params.category,
      status: params.status || 'all',
      sort: params.sortBy || 'terbaru',
      role: params.userRole || 'customer',
      page: params.page || 1
    });
  }

  /**
   * Generate cache key for product lists
   */
  generateProductListKey(type: string, page = 1, userRole = 'customer'): string {
    return this.generateKey(type, {
      page,
      role: userRole
    });
  }

  /**
   * Check if cache entry exists and is valid
   */
  private isValidEntry(entry: CacheEntry): boolean {
    if (!entry || !entry.metadata) return false;

    const now = Date.now();
    const isExpired = now > entry.metadata.expiresAt;
    const isCorrectVersion = entry.metadata.version === this.config.version;

    return !isExpired && isCorrectVersion;
  }

  /**
   * Get cache entry from localStorage
   */
  private getFromStorage(key: string): CacheEntry | null {
    try {
      const cacheData = localStorage.getItem(this.storageKey);
      if (!cacheData) return null;

      const cache: Record<string, CacheEntry> = JSON.parse(cacheData);
      const entry = cache[key];

      if (!entry) return null;

      if (this.isValidEntry(entry)) {
        this.stats.hits++;
        this.saveStats();
        return entry;
      } else {
        // Remove expired entry
        delete cache[key];
        localStorage.setItem(this.storageKey, JSON.stringify(cache));
        this.stats.misses++;
        this.saveStats();
        return null;
      }
    } catch (error) {
      console.error('❌ Error reading from cache:', error);
      this.stats.misses++;
      this.saveStats();
      return null;
    }
  }

  /**
   * Save cache entry to localStorage
   */
  private saveToStorage(key: string, data: any, ttl: number = this.config.ttl): void {
    try {
      const cacheData = localStorage.getItem(this.storageKey);
      const cache: Record<string, CacheEntry> = cacheData ? JSON.parse(cacheData) : {};

      const now = Date.now();
      const entry: CacheEntry = {
        data,
        metadata: {
          timestamp: now,
          expiresAt: now + ttl,
          version: this.config.version,
          source: 'localStorage'
        }
      };

      cache[key] = entry;

      // Check cache size and cleanup if necessary
      if (this.getCacheSize(cache) > this.config.maxSize) {
        this.cleanupOldEntries(cache);
      }

      localStorage.setItem(this.storageKey, JSON.stringify(cache));
      this.triggerSyncEvent(key, 'save');
    } catch (error) {
      console.error('❌ Error saving to cache:', error);
    }
  }

  /**
   * Get cached data or null if not found/invalid
   */
  get<T = any>(key: string): T | null {
    const entry = this.getFromStorage(key);
    return entry ? entry.data : null;
  }

  /**
   * Save data to cache with TTL
   */
  set(key: string, data: any, ttl?: number): void {
    this.saveToStorage(key, data, ttl);
  }

  /**
   * Get search results from cache
   */
  getSearchResults(params: SearchCacheKey): SearchResult | null {
    const key = this.generateSearchKey(params);
    return this.get<SearchResult>(key);
  }

  /**
   * Save search results to cache
   */
  setSearchResults(params: SearchCacheKey, results: SearchResult): void {
    const key = this.generateSearchKey(params);
    this.set(key, results, CACHE_CONFIG.TTL.SEARCH);
  }

  /**
   * Get product list from cache
   */
  getProductList(type: string, page = 1, userRole = 'customer'): ProductListCache | null {
    const key = this.generateProductListKey(type, page, userRole);
    return this.get<ProductListCache>(key);
  }

  /**
   * Save product list to cache
   */
  setProductList(type: string, data: ProductListCache, page = 1, userRole = 'customer'): void {
    const key = this.generateProductListKey(type, page, userRole);
    const ttl = this.getTTLForType(type);
    this.set(key, data, ttl);
  }

  /**
   * Get featured products from cache
   */
  getFeaturedProducts(): FeaturedCache | null {
    return this.get<FeaturedCache>(CACHE_KEYS.FEATURED);
  }

  /**
   * Save featured products to cache
   */
  setFeaturedProducts(data: FeaturedCache): void {
    this.set(CACHE_KEYS.FEATURED, data, CACHE_CONFIG.TTL.FEATURED);
  }

  /**
   * Get flash sale products from cache
   */
  getFlashSaleProducts(): FlashSaleCache | null {
    return this.get<FlashSaleCache>(CACHE_KEYS.FLASHSALE);
  }

  /**
   * Save flash sale products to cache
   */
  setFlashSaleProducts(data: FlashSaleCache): void {
    this.set(CACHE_KEYS.FLASHSALE, data, CACHE_CONFIG.TTL.FLASHSALE);
  }

  /**
   * Invalidate cache entries based on event
   */
  invalidateCache(event: CacheInvalidationEvent): void {
    try {
      const cacheData = localStorage.getItem(this.storageKey);
      if (!cacheData) return;

      const cache: Record<string, CacheEntry> = JSON.parse(cacheData);
      let keysToRemove: string[] = [];

      switch (event.type) {
        case 'stock_change':
          // Invalidate all product-related cache when stock changes
          keysToRemove = Object.keys(cache).filter(key =>
            key.includes(CACHE_KEYS.HOME) ||
            key.includes(CACHE_KEYS.SEARCH) ||
            key.includes(CACHE_KEYS.READY) ||
            key.includes(CACHE_KEYS.PO) ||
            key.includes(CACHE_KEYS.CHEAPEST)
          );
          break;

        case 'product_update':
          // Invalidate all cache when products are updated
          keysToRemove = Object.keys(cache).filter(key =>
            !key.includes(CACHE_KEYS.STATS)
          );
          break;

        case 'featured_update':
          keysToRemove = Object.keys(cache).filter(key =>
            key.includes(CACHE_KEYS.FEATURED)
          );
          break;

        case 'flashsale_update':
          keysToRemove = Object.keys(cache).filter(key =>
            key.includes(CACHE_KEYS.FLASHSALE)
          );
          break;
      }

      // Remove invalid entries
      keysToRemove.forEach(key => {
        delete cache[key];
      });

      if (keysToRemove.length > 0) {
        localStorage.setItem(this.storageKey, JSON.stringify(cache));
        console.log(`🗑️ Cache invalidated: ${keysToRemove.length} entries removed`);
        this.triggerSyncEvent('cache_invalidated', 'invalidate', {
          type: event.type,
          keysRemoved: keysToRemove.length
        });
      }
    } catch (error) {
      console.error('❌ Error invalidating cache:', error);
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.statsKey);
      this.stats = {
        hits: 0,
        misses: 0,
        totalSize: 0,
        lastCleanup: Date.now()
      };
      this.triggerSyncEvent('cache_cleared', 'clear');
      console.log('🗑️ All cache cleared');
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  }

  /**
   * Get TTL for different cache types
   */
  private getTTLForType(type: string): number {
    switch (type) {
      case CACHE_KEYS.FEATURED:
        return CACHE_CONFIG.TTL.FEATURED;
      case CACHE_KEYS.FLASHSALE:
        return CACHE_CONFIG.TTL.FLASHSALE;
      case CACHE_KEYS.SEARCH:
        return CACHE_CONFIG.TTL.SEARCH;
      default:
        return CACHE_CONFIG.TTL.HOME;
    }
  }

  /**
   * Calculate cache size in bytes
   */
  private getCacheSize(cache: Record<string, CacheEntry>): number {
    try {
      const jsonString = JSON.stringify(cache);
      return new Blob([jsonString]).size;
    } catch {
      return 0;
    }
  }

  /**
   * Cleanup old entries to maintain cache size
   */
  private cleanupOldEntries(cache: Record<string, CacheEntry>): void {
    const entries = Object.entries(cache);

    // Sort by timestamp (oldest first)
    entries.sort(([, a], [, b]) => a.metadata.timestamp - b.metadata.timestamp);

    // Remove oldest entries until cache size is acceptable
    let currentSize = this.getCacheSize(cache);
    const targetSize = this.config.maxSize * 0.8; // 80% of max size

    for (const [key] of entries) {
      if (currentSize <= targetSize) break;

      delete cache[key];
      currentSize = this.getCacheSize(cache);
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpiredEntries(): void {
    try {
      const cacheData = localStorage.getItem(this.storageKey);
      if (!cacheData) return;

      const cache: Record<string, CacheEntry> = JSON.parse(cacheData);
      const now = Date.now();
      let removedCount = 0;

      Object.keys(cache).forEach(key => {
        if (now > cache[key].metadata.expiresAt) {
          delete cache[key];
          removedCount++;
        }
      });

      if (removedCount > 0) {
        localStorage.setItem(this.storageKey, JSON.stringify(cache));
        console.log(`🧹 Cleaned up ${removedCount} expired cache entries`);
      }

      this.stats.lastCleanup = now;
      this.saveStats();
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  /**
   * Load cache statistics
   */
  private loadStats(): CacheStats {
    try {
      const statsData = localStorage.getItem(this.statsKey);
      if (statsData) {
        return JSON.parse(statsData);
      }
    } catch (error) {
      console.error('❌ Error loading cache stats:', error);
    }

    return {
      hits: 0,
      misses: 0,
      totalSize: 0,
      lastCleanup: Date.now()
    };
  }

  /**
   * Save cache statistics
   */
  private saveStats(): void {
    try {
      localStorage.setItem(this.statsKey, JSON.stringify(this.stats));
    } catch (error) {
      console.error('❌ Error saving cache stats:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Trigger cross-device sync event
   */
  private triggerSyncEvent(key: string, action: string, data?: any): void {
    try {
      // localStorage event for cross-device sync
      localStorage.setItem('cache_sync_trigger', JSON.stringify({
        key,
        action,
        timestamp: Date.now(),
        data
      }));

      // Clear trigger immediately to ensure event fires
      localStorage.removeItem('cache_sync_trigger');

      // Custom event for same-tab communication
      window.dispatchEvent(new CustomEvent('cacheUpdated', {
        detail: { key, action, data }
      }));
    } catch (error) {
      console.error('❌ Error triggering sync event:', error);
    }
  }

  /**
   * Check if cache is enabled and working
   */
  isAvailable(): boolean {
    try {
      const test = 'cache_test';
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const productCache = new ProductCache();

// Export convenience functions for backward compatibility
export const getCachedSearchResults = (params: SearchCacheKey) =>
  productCache.getSearchResults(params);

export const setCachedSearchResults = (params: SearchCacheKey, results: SearchResult) =>
  productCache.setSearchResults(params, results);

export const getCachedProductList = (type: string, page = 1, userRole = 'customer') =>
  productCache.getProductList(type, page, userRole);

export const setCachedProductList = (type: string, data: ProductListCache, page = 1, userRole = 'customer') =>
  productCache.setProductList(type, data, page, userRole);

export const invalidateProductCache = (event: CacheInvalidationEvent) =>
  productCache.invalidateCache(event);

export default productCache;