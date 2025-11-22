/**
 * Product Cache Utility for Firebase Cost Optimization
 * Implements intelligent caching with cross-device synchronization
 */

import {
  CacheEntry,
  CacheConfig,
  SearchCacheKey,
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
      maxSize: Math.min(CACHE_CONFIG.MAX_SIZE, 2.5 * 1024 * 1024), // Max 2.5MB to prevent quota issues
      version: CACHE_CONFIG.VERSION
    };

    // Clear cache if version changed
    this.clearIfVersionChanged();

    this.stats = this.loadStats();
    this.cleanupExpiredEntries();
    this.enforceSizeLimit(); // Ensure we don't exceed quota on init
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
   * Clear cache if version changed
   */
  private clearIfVersionChanged(): void {
    try {
      const versionKey = this.storageKey + '_version';
      const currentVersion = localStorage.getItem(versionKey);

      if (currentVersion !== this.config.version) {
        console.log(`🆕 Cache version changed from ${currentVersion} to ${this.config.version}, clearing cache`);
        this.clear();
        localStorage.setItem(versionKey, this.config.version);
      }
    } catch (error) {
      console.error('❌ Error checking cache version:', error);
    }
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
   * Save cache entry to localStorage with quota management
   */
  private saveToStorage(key: string, data: any, ttl: number = this.config.ttl): void {
    try {
      // Optimize data size before saving
      const optimizedData = this.optimizeDataSize(data);

      const cacheData = localStorage.getItem(this.storageKey);
      const cache: Record<string, CacheEntry> = cacheData ? JSON.parse(cacheData) : {};

      const now = Date.now();
      const entry: CacheEntry = {
        data: optimizedData,
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

      // Double-check size after cleanup and enforce limit
      this.enforceSizeLimit(cache);

      const jsonString = JSON.stringify(cache);

      // Check if we're still within quota before setting
      if (this.isWithinQuota(jsonString)) {
        localStorage.setItem(this.storageKey, jsonString);
        this.triggerSyncEvent(key, 'save');
      } else {
        // Emergency cleanup if still too large
        this.emergencyCleanup(cache);
        const cleanedJson = JSON.stringify(cache);
        if (this.isWithinQuota(cleanedJson)) {
          localStorage.setItem(this.storageKey, cleanedJson);
          this.triggerSyncEvent(key, 'save');
        } else {
          console.warn('⚠️ Cache data too large for localStorage, skipping cache save');
          this.stats.misses++;
          this.saveStats();
        }
      }
    } catch (error: any) {
      if (error.name === 'QuotaExceededError') {
        console.warn('⚠️ localStorage quota exceeded, clearing cache and retrying');
        this.clear();
        // Retry once with empty cache
        try {
          const retryData = this.optimizeDataSize(data);
          const retryEntry: CacheEntry = {
            data: retryData,
            metadata: {
              timestamp: Date.now(),
              expiresAt: Date.now() + ttl,
              version: this.config.version,
              source: 'localStorage'
            }
          };
          const retryCache = { [key]: retryEntry };
          const retryJson = JSON.stringify(retryCache);
          if (this.isWithinQuota(retryJson)) {
            localStorage.setItem(this.storageKey, retryJson);
            this.triggerSyncEvent(key, 'save');
          }
        } catch (retryError) {
          console.error('❌ Even retry failed, disabling cache temporarily:', retryError);
        }
      } else {
        console.error('❌ Error saving to cache:', error);
      }
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
   * Optimize data size by removing unnecessary fields and compressing
   */
  private optimizeDataSize(data: any): any {
    if (Array.isArray(data)) {
      // For product arrays, keep only essential fields
      return data.map(product => ({
        id: product.id,
        name: product.name,
        price: product.price,
        retailPrice: product.retailPrice,
        resellerPrice: product.resellerPrice,
        stock: product.stock,
        images: product.images?.slice(0, 2), // Keep only first 2 images
        category: product.category,
        status: product.status,
        variants: product.variants ? {
          sizes: product.variants.sizes?.slice(0, 3), // Keep max 3 sizes
          colors: product.variants.colors?.slice(0, 3), // Keep max 3 colors
          stock: product.variants.stock
        } : undefined
      }));
    } else if (data && typeof data === 'object') {
      // For objects with products array
      if (data.products && Array.isArray(data.products)) {
        return {
          ...data,
          products: data.products.slice(0, 20).map((product: any) => ({ // Max 20 products
            id: product.id,
            name: product.name,
            price: product.price,
            retailPrice: product.retailPrice,
            resellerPrice: product.resellerPrice,
            stock: product.stock,
            images: product.images?.slice(0, 2),
            category: product.category,
            status: product.status,
            variants: product.variants ? {
              sizes: product.variants.sizes?.slice(0, 3),
              colors: product.variants.colors?.slice(0, 3),
              stock: product.variants.stock
            } : undefined
          }))
        };
      }
      // For other objects, remove unnecessary fields
      const optimized: any = {};
      Object.keys(data).forEach(key => {
        if (key !== 'lastVisible' && key !== 'fullSnapshot') {
          optimized[key] = data[key];
        }
      });
      return optimized;
    }
    return data;
  }

  /**
   * Check if data is within localStorage quota
   */
  private isWithinQuota(jsonString: string): boolean {
    try {
      const testData = 'quota_test_' + Date.now();
      localStorage.setItem(testData, jsonString);
      localStorage.removeItem(testData);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Enforce strict size limit on cache
   */
  private enforceSizeLimit(cache?: Record<string, CacheEntry>): void {
    const cacheToCheck = cache || (() => {
      try {
        const cacheData = localStorage.getItem(this.storageKey);
        return cacheData ? JSON.parse(cacheData) : {};
      } catch {
        return {};
      }
    })();

    let currentSize = this.getCacheSize(cacheToCheck);
    const targetSize = this.config.maxSize * 0.7; // Target 70% of max size

    if (currentSize > targetSize) {
      const entries = Object.entries(cacheToCheck);

      // Sort by priority: keep search and featured items longer
      entries.sort(([keyA, entryA], [keyB, entryB]) => {
        const priorityA = this.getCachePriority(keyA);
        const priorityB = this.getCachePriority(keyB);

        if (priorityA !== priorityB) {
          return priorityA - priorityB; // Lower priority number = higher priority to keep
        }

        // If same priority, keep newer entries
        return (entryA as CacheEntry).metadata.timestamp - (entryB as CacheEntry).metadata.timestamp;
      });

      // Remove entries until we're under target size
      let removedCount = 0;
      for (const [key] of entries) {
        if (currentSize <= targetSize) break;
        delete cacheToCheck[key];
        currentSize = this.getCacheSize(cacheToCheck);
        removedCount++;
      }

      if (removedCount > 0 && !cache) {
        // Only save back if we're working with localStorage data
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(cacheToCheck));
          console.log(`🗑️ Enforced size limit: removed ${removedCount} cache entries`);
        } catch (error) {
          console.error('❌ Error saving after size enforcement:', error);
        }
      }
    }
  }

  /**
   * Get cache priority for retention (lower number = higher priority)
   */
  private getCachePriority(key: string): number {
    if (key.includes(CACHE_KEYS.FEATURED)) return 1; // Keep featured products longest
    if (key.includes(CACHE_KEYS.SEARCH)) return 2; // Keep search results
    if (key.includes(CACHE_KEYS.HOME)) return 3; // Keep home products
    if (key.includes(CACHE_KEYS.FLASHSALE)) return 4; // Keep flash sale
    return 5; // Everything else has lowest priority
  }

  /**
   * Emergency cleanup when quota is exceeded
   */
  private emergencyCleanup(cache: Record<string, CacheEntry>): void {
    console.warn('🚨 Emergency cache cleanup triggered');

    // Remove all but the highest priority entries
    const entries = Object.entries(cache);
    entries.sort(([keyA], [keyB]) =>
      this.getCachePriority(keyA) - this.getCachePriority(keyB)
    );

    // Keep only top 3 entries by priority
    const keysToKeep = entries.slice(0, 3).map(([key]) => key);
    const keysToRemove = entries.slice(3).map(([key]) => key);

    keysToRemove.forEach(key => {
      delete cache[key];
    });

    console.log(`🚨 Emergency cleanup: removed ${keysToRemove.length} entries, kept ${keysToKeep.length}`);
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