// REMOVED - Product caching moved to Firebase
// No more localStorage caching - Firebase handles real-time data

import { Product } from '../types';

export const useProductCache = () => {
  // Firebase handles real-time data, no local caching needed
  const saveToCache = () => {
    // No-op - Firebase handles caching
  };

  const getFromCache = () => {
    return null; // Always get fresh data from Firebase
  };

  const clearCache = () => {
    // No-op - Firebase handles cache invalidation
  };

  const isCacheValid = () => {
    return false; // Firebase is always up-to-date
  };

  const refreshCache = () => {
    // No-op - Firebase refreshes automatically
  };

  return {
    saveToCache,
    getFromCache,
    clearCache,
    isCacheValid,
    refreshCache
  };
};