import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from './firebaseClient';

// Cache configuration
export const CACHE_CONFIG = {
  // TTL per field dalam milliseconds
  BASIC_INFO: 7 * 24 * 60 * 60 * 1000,        // 7 hari (name, description)
  PRICING: 2 * 24 * 60 * 60 * 1000,           // 2 hari (price info)
  STOCK: 6 * 60 * 60 * 1000,                   // 6 jam (stock info)
  FLASH_SALE: 10 * 60 * 1000,                  // 10 menit (flash sale)
  PRODUCT_STATUS: 2 * 60 * 60 * 1000,          // 2 jam (active status)

  // Background sync intervals
  BACKGROUND_CHECK: 5 * 60 * 1000,             // 5 menit cek background
  CRITICAL_CHECK: 30 * 1000,                   // 30 detik untuk critical data
} as const;

interface CacheMetadata {
  basicInfoLastUpdate: number;
  pricingLastUpdate: number;
  stockLastUpdate: number;
  flashSaleLastUpdate: number;
  lastFullRefresh: number;
  version: string;
}

interface ProductCache {
  productData: any[];
  metadata: CacheMetadata;
}

// Cache key management
const CACHE_KEYS = {
  PRODUCTS_CACHE: 'azzahra_products_cache',
  CACHE_METADATA: 'azzahra_cache_metadata',
  LAST_SYNC: 'azzahra_last_sync',
  OFFLINE_MODE: 'azzahra_offline_mode',
} as const;

// Utility functions
export const CacheUtils = {
  // Save cache to localStorage
  saveCache: (data: any[], cacheType: string = 'products') => {
    try {
      const cacheKey = `${CACHE_KEYS.PRODUCTS_CACHE}_${cacheType}`;
      const cacheData: ProductCache = {
        productData: data,
        metadata: {
          basicInfoLastUpdate: Date.now(),
          pricingLastUpdate: Date.now(),
          stockLastUpdate: Date.now(),
          flashSaleLastUpdate: Date.now(),
          lastFullRefresh: Date.now(),
          version: '1.0.0'
        }
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      localStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());

      console.log(`💾 Cache saved: ${data.length} products (${Math.round(JSON.stringify(cacheData).length/1024)}KB)`);
    } catch (error) {
      console.error('❌ Error saving cache:', error);
      // Clear cache if quota exceeded
      CacheUtils.clearCache();
    }
  },

  // Load cache from localStorage
  loadCache: (cacheType: string = 'products'): any[] | null => {
    try {
      const cacheKey = `${CACHE_KEYS.PRODUCTS_CACHE}_${cacheType}`;
      const cachedData = localStorage.getItem(cacheKey);

      if (cachedData) {
        const cacheData: ProductCache = JSON.parse(cachedData);
        console.log(`📖 Cache loaded: ${cacheData.productData.length} products`);
        return cacheData.productData;
      }

      return null;
    } catch (error) {
      console.error('❌ Error loading cache:', error);
      return null;
    }
  },

  // Check if cache is valid
  isCacheValid: (cacheType: string = 'products'): boolean => {
    try {
      const cacheKey = `${CACHE_KEYS.PRODUCTS_CACHE}_${cacheType}`;
      const cachedData = localStorage.getItem(cacheKey);

      if (!cachedData) return false;

      const cacheData: ProductCache = JSON.parse(cachedData);
      const now = Date.now();
      const lastUpdate = cacheData.metadata.lastFullRefresh;

      // Cache valid for 24 hours
      const isValid = (now - lastUpdate) < (24 * 60 * 60 * 1000);

      console.log(`🔍 Cache validity: ${isValid ? '✅ Valid' : '❌ Expired'} (${Math.round((now - lastUpdate) / (60 * 60 * 1000))}h old)`);

      return isValid;
    } catch (error) {
      console.error('❌ Error checking cache validity:', error);
      return false;
    }
  },

  // Clear cache
  clearCache: (cacheType?: string) => {
    try {
      if (cacheType) {
        const cacheKey = `${CACHE_KEYS.PRODUCTS_CACHE}_${cacheType}`;
        localStorage.removeItem(cacheKey);
        console.log(`🗑️ Cache cleared for: ${cacheType}`);
      } else {
        // Clear all cache
        Object.values(CACHE_KEYS).forEach(key => {
          localStorage.removeItem(key);
        });
        console.log('🗑️ All cache cleared');
      }
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  },

  // Get cache size
  getCacheSize: (): string => {
    try {
      let totalSize = 0;
      Object.values(CACHE_KEYS).forEach(key => {
        const data = localStorage.getItem(key);
        if (data) {
          totalSize += data.length;
        }
      });

      return `${Math.round(totalSize / 1024)}KB`;
    } catch (error) {
      return 'Unknown';
    }
  },

  // Check if online
  isOnline: (): boolean => {
    return navigator.onLine;
  },

  // Set offline mode
  setOfflineMode: (isOffline: boolean) => {
    localStorage.setItem(CACHE_KEYS.OFFLINE_MODE, isOffline.toString());
    console.log(`📶 Offline mode: ${isOffline ? 'ON' : 'OFF'}`);
  },

  // Get offline mode status
  isOfflineMode: (): boolean => {
    return localStorage.getItem(CACHE_KEYS.OFFLINE_MODE) === 'true';
  },

  // Batch data refresh with smart loading
  smartBatchLoad: async (batchIds: string[], cacheType: string = 'products') => {
    console.log(`🔄 Smart batch load: ${batchIds.join(', ')}`);

    // Check cache first
    if (CacheUtils.isCacheValid(cacheType)) {
      const cachedData = CacheUtils.loadCache(cacheType);
      if (cachedData && cachedData.length > 0) {
        console.log('✅ Using cached data - no Firebase reads');
        return cachedData;
      }
    }

    // Load from Firestore if cache invalid/empty
    const batchPromises = batchIds.map(async (batchId) => {
      try {
        const batchRef = doc(db, 'productBatches', batchId);
        const batchDoc = await getDoc(batchRef);

        if (batchDoc.exists()) {
          const batchData = batchDoc.data();
          console.log(`📦 Loaded batch ${batchId}: ${batchData.products?.length || 0} products`);
          return batchData.products || [];
        }

        return [];
      } catch (error) {
        console.error(`❌ Error loading batch ${batchId}:`, error);
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    const allProducts = batchResults.flat();

    // Save to cache
    if (allProducts.length > 0) {
      CacheUtils.saveCache(allProducts, cacheType);
    }

    return allProducts;
  },

  // Sync cache with latest data
  syncCache: async (cacheType: string = 'products') => {
    console.log('🔄 Syncing cache with latest data...');

    try {
      // Force refresh by clearing cache first
      CacheUtils.clearCache(cacheType);

      // Load fresh data
      const batchIds = ['batch_1']; // Extend as needed for multiple batches
      const freshData = await CacheUtils.smartBatchLoad(batchIds, cacheType);

      console.log(`✅ Cache synced: ${freshData.length} products`);
      return freshData;
    } catch (error) {
      console.error('❌ Error syncing cache:', error);
      return null;
    }
  }
};

// Export default for easy import
export default CacheUtils;