import { Product } from '../types';

const CACHE_KEY = 'azzahra_products_cache';
const CACHE_EXPIRY_KEY = 'azzahra_products_cache_expiry';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useProductCache = () => {
  // Save products to cache
  const saveToCache = (products: Product[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(products));
      localStorage.setItem(CACHE_EXPIRY_KEY, Date.now().toString());
      console.log('💾 Products cached:', products.length);
    } catch (error) {
      console.warn('❌ Failed to cache products:', error);
    }
  };

  // Get products from cache
  const getFromCache = (): Product[] | null => {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      const cacheExpiry = localStorage.getItem(CACHE_EXPIRY_KEY);

      if (!cachedData || !cacheExpiry) {
        return null;
      }

      const isExpired = Date.now() - parseInt(cacheExpiry) > CACHE_DURATION;
      if (isExpired) {
        clearCache();
        return null;
      }

            return JSON.parse(cachedData);
    } catch (error) {
      console.warn('❌ Failed to load from cache:', error);
      clearCache();
      return null;
    }
  };

  // Clear cache
  const clearCache = () => {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_EXPIRY_KEY);
      console.log('🗑️ Cache cleared');
    } catch (error) {
      console.warn('❌ Failed to clear cache:', error);
    }
  };

  // Check if cache exists and is valid
  const isCacheValid = (): boolean => {
    const cachedData = getFromCache();
    return cachedData !== null;
  };

  // Force refresh cache
  const refreshCache = (products: Product[]) => {
    clearCache();
    saveToCache(products);
  };

  return {
    saveToCache,
    getFromCache,
    clearCache,
    isCacheValid,
    refreshCache
  };
};