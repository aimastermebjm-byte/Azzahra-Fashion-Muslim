// REMOVED - Product caching moved to Firebase
// No more localStorage caching - Firebase handles real-time data

import { Product } from '../types';

export const useProductCache = () => {
  // Firebase handles real-time data, no local caching needed
  const saveToCache = () => {
    console.log('🚀 Firebase mode - No local product caching needed');
  };

  const getFromCache = () => {
    console.log('🚀 Firebase mode - Products come from real-time Firebase');
    return null;
  };

  const clearCache = () => {
    console.log('🚀 Firebase mode - No local cache to clear');
  };

  const isCacheValid = () => {
    return false; // Firebase is always up-to-date
  };

  const refreshCache = () => {
    console.log('🚀 Firebase mode - Products refresh automatically from Firebase');
  };

  return {
    saveToCache,
    getFromCache,
    clearCache,
    isCacheValid,
    refreshCache
  };
};