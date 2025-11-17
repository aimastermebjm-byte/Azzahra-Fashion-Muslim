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
    HOME: 2 * 60 * 1000, // 2 minutes (reduced from 5)
    SEARCH: 1 * 60 * 1000, // 1 minute (reduced from 3)
    FEATURED: 5 * 60 * 1000, // 5 minutes (reduced from 10)
    FLASHSALE: 30 * 1000, // 30 seconds (reduced from 1 minute)
    PRODUCT_DETAIL: 2 * 60 * 1000, // 2 minutes (reduced from 5)
  },
  MAX_SIZE: 2 * 1024 * 1024, // 2MB (reduced from 10MB)
  VERSION: '1.1.0',
  CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes (reduced from 15)
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