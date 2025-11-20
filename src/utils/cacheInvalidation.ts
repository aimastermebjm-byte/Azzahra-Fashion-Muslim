import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseClient';
import CacheUtils from './cacheUtils';

interface CacheInvalidationConfig {
  collection: string;
  document: string;
  lastModified: number;
  checksum?: string;
}

// Track cache invalidation triggers
export const CacheInvalidationManager = {
  // Store invalidation timestamps
  invalidationTimestamps: new Map<string, number>(),

  // Subscribe to real-time updates for cache invalidation
  setupProductUpdatesListener: () => {
    console.log('🔔 Setting up cache invalidation listener...');

    // Listen for changes in any product
    const unsubscribers: (() => void)[] = [];

    // Listen to product stats/global index changes
    try {
      const globalIndexRef = doc(db, 'productBatches', 'globalIndex');
      const globalUnsubscribe = onSnapshot(globalIndexRef, (snapshot) => {
        if (snapshot.exists()) {
          console.log('🔄 Global index updated - invalidating cache...');

          // Invalidate product cache
          CacheUtils.clearCache('products');
          CacheInvalidationManager.invalidationTimestamps.set('products', Date.now());

          // Trigger refresh in all tabs
          CacheInvalidationManager.notifyTabsOfUpdate('products');
        }
      });
      unsubscribers.push(globalUnsubscribe);
    } catch (error) {
      console.log('⚠️ Cannot listen to global index:', error);
    }

    // Listen to batch changes
    try {
      for (let i = 1; i <= 6; i++) {
        const batchRef = doc(db, 'productBatches', `batch_${i}`);
        const batchUnsubscribe = onSnapshot(batchRef, (snapshot) => {
          if (snapshot.exists()) {
            console.log(`🔄 Batch ${i} updated - invalidating cache...`);

            // Clear relevant cache
            CacheUtils.clearCache('products');
            CacheInvalidationManager.invalidationTimestamps.set(`batch_${i}`, Date.now());

            // Notify other tabs
            CacheInvalidationManager.notifyTabsOfUpdate('products');
          }
        });
        unsubscribers.push(batchUnsubscribe);
      }
    } catch (error) {
      console.log('⚠️ Cannot listen to batch changes:', error);
    }

    // Cross-tab communication
    CacheInvalidationManager.setupCrossTabCommunication();

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  },

  // Cross-tab communication for cache invalidation
  setupCrossTabCommunication: () => {
    // Listen for storage events from other tabs
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'azzahra_cache_invalidation') {
        const data = JSON.parse(event.newValue || '{}');

        console.log('🔄 Cross-tab cache invalidation received:', data.type);

        if (data.type === 'products') {
          CacheUtils.clearCache('products');
          CacheInvalidationManager.invalidationTimestamps.set('products', Date.now());
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  },

  // Notify other tabs about cache updates
  notifyTabsOfUpdate: (cacheType: string) => {
    const invalidationData = {
      type: cacheType,
      timestamp: Date.now(),
      trigger: 'realtime_update'
    };

    localStorage.setItem('azzahra_cache_invalidation', JSON.stringify(invalidationData));

    // Remove after a short time to prevent accumulation
    setTimeout(() => {
      localStorage.removeItem('azzahra_cache_invalidation');
    }, 1000);
  },

  // Manual cache invalidation (for admin operations)
  invalidateCache: async (cacheType: string, reason?: string) => {
    console.log(`🗑️ Manual cache invalidation: ${cacheType} (${reason})`);

    // Clear cache
    CacheUtils.clearCache(cacheType);

    // Update timestamp
    CacheInvalidationManager.invalidationTimestamps.set(cacheType, Date.now());

    // Notify other tabs
    CacheInvalidationManager.notifyTabsOfUpdate(cacheType);

    // Optional: Force refresh from Firestore
    if (cacheType === 'products') {
      try {
        // Trigger a fresh load
        await CacheUtils.syncCache(cacheType);
      } catch (error) {
        console.error('❌ Failed to sync cache after invalidation:', error);
      }
    }
  },

  // Check if cache is still valid based on real-time updates
  isCacheValid: (cacheType: string): boolean => {
    const lastInvalidation = CacheInvalidationManager.invalidationTimestamps.get(cacheType) || 0;
    const lastCacheUpdate = CacheUtils.getLastUpdateTime(cacheType) || 0;

    // Cache is valid if it was updated after the last invalidation
    return lastCacheUpdate > lastInvalidation;
  },

  // Force refresh specific product from admin operations
  refreshProductFromAdmin: async (productId: string) => {
    console.log(`🔄 Admin update detected - refreshing product ${productId}`);

    try {
      // Clear all product caches
      CacheUtils.clearCache('products');

      // Force sync with latest data
      await CacheUtils.syncCache('products');

      // Notify all tabs
      CacheInvalidationManager.notifyTabsOfUpdate('products');

      console.log(`✅ Product ${productId} cache refreshed successfully`);
    } catch (error) {
      console.error(`❌ Failed to refresh product ${productId} cache:`, error);
    }
  }
};

// Hook for components to use cache invalidation
export const useCacheInvalidation = (cacheType: string = 'products') => {
  const [invalidationCount, setInvalidationCount] = useState(0);

  useEffect(() => {
    // Listen for invalidation events
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'azzahra_cache_invalidation') {
        const data = JSON.parse(event.newValue || '{}');

        if (data.type === cacheType) {
          console.log(`🔄 Cache invalidation detected for ${cacheType}`);
          setInvalidationCount(prev => prev + 1);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [cacheType]);

  return {
    invalidationCount,
    invalidateCache: () => CacheInvalidationManager.invalidateCache(cacheType),
    refreshCache: () => CacheUtils.syncCache(cacheType)
  };
};

export default CacheInvalidationManager;