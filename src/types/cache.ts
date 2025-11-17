/**
 * Cache System Types for Firebase Cost Optimization
 * Supporting cross-device synchronization and smart invalidation
 */

export interface CacheMetadata {
  timestamp: number;
  expiresAt: number;
  version: string;
  source: 'firebase' | 'localStorage';
}

export interface CacheEntry<T = any> {
  data: T;
  metadata: CacheMetadata;
}

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache size in bytes
  version: string;
}

export interface SearchCacheKey {
  query: string;
  category?: string;
  status?: 'ready' | 'po' | 'all';
  sortBy?: 'terbaru' | 'termurah';
  userRole?: 'customer' | 'reseller';
  page?: number;
}

export interface ProductCacheKey {
  type: 'home' | 'featured' | 'flashsale' | 'ready' | 'po' | 'cheapest' | 'search';
  params: SearchCacheKey | Record<string, any>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  totalSize: number;
  lastCleanup: number;
}

export interface CacheStorage {
  [key: string]: CacheEntry;
}

// Search-specific types
export interface SearchResult {
  products: any[];
  hasMore: boolean;
  totalCount: number;
  lastVisible?: any;
}

// Product list cache types
export interface ProductListCache {
  products: any[];
  hasMore: boolean;
  lastVisible?: any;
  totalCount?: number;
}

// Featured products cache
export interface FeaturedCache {
  products: any[];
  lastUpdated: number;
}

// Flash sale cache
export interface FlashSaleCache {
  products: any[];
  activeFlashSale: any;
  lastUpdated: number;
}

// Cache invalidation events
export interface CacheInvalidationEvent {
  type: 'stock_change' | 'product_update' | 'featured_update' | 'flashsale_update';
  productIds?: string[];
  timestamp: number;
  triggerBy: 'admin' | 'system' | 'user';
}

// Cache configuration constants
export const CACHE_CONFIG = {
  TTL: {
    HOME: 5 * 60 * 1000, // 5 minutes
    SEARCH: 3 * 60 * 1000, // 3 minutes
    FEATURED: 10 * 60 * 1000, // 10 minutes
    FLASHSALE: 1 * 60 * 1000, // 1 minute
    PRODUCT_DETAIL: 5 * 60 * 1000, // 5 minutes
  },
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  VERSION: '1.0.0',
  CLEANUP_INTERVAL: 15 * 60 * 1000, // 15 minutes
  SEARCH_DEBOUNCE: 300, // 300ms
} as const;

// Cache key prefixes
export const CACHE_KEYS = {
  HOME: 'home_products',
  FEATURED: 'featured_products',
  FLASHSALE: 'flashsale_products',
  SEARCH: 'search_products',
  READY: 'ready_products',
  PO: 'po_products',
  CHEAPEST: 'cheapest_products',
  PRODUCT_DETAIL: 'product_detail',
  STATS: 'cache_stats',
} as const;