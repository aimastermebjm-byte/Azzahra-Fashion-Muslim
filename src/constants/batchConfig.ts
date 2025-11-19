// 🔥 BATCH CONFIGURATION - Optimized for 250 products per batch
export const BATCH_CONFIG = {
  // Core batch settings
  PRODUCTS_PER_BATCH: 250,
  MAX_BATCH_SIZE: 300,

  // Pagination settings
  INITIAL_LOAD_SIZE: 12,  // Products shown initially
  LOAD_MORE_SIZE: 12,      // Products loaded per scroll

  // Performance settings
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes cache
  DEBOUNCE_DELAY: 300,           // Search debounce delay

  // Safety margins
  SAFETY_MARGIN_PERCENT: 80,    // 80% of Firebase 1MB limit
  MAX_DOCUMENT_SIZE_MB: 1,      // Firebase document size limit

  // Batch naming
  BATCH_PREFIX: 'batch_',

  // Performance thresholds
  LARGE_BATCH_THRESHOLD: 200,
  VERY_LARGE_BATCH_THRESHOLD: 500
} as const;

// Calculated values
export const BATCH_LIMITS = {
  MAX_PRODUCTS_PER_BATCH: Math.floor(
    (BATCH_CONFIG.MAX_DOCUMENT_SIZE_MB * 1024 * 1024 * BATCH_CONFIG.SAFETY_MARGIN_PERCENT / 100)
    / 1238 // Average product size in bytes (from analysis)
  ),

  OPTIMAL_BATCH_SIZE: BATCH_CONFIG.PRODUCTS_PER_BATCH,

  // Pagination calculations
  PRODUCTS_PER_PAGE: BATCH_CONFIG.LOAD_MORE_SIZE,
  INITIAL_PRODUCTS: BATCH_CONFIG.INITIAL_LOAD_SIZE
} as const;

// Batch validation
export const validateBatchSize = (productCount: number): boolean => {
  return productCount <= BATCH_CONFIG.PRODUCTS_PER_BATCH;
};

// Performance recommendations
export const getPerformanceLevel = (productCount: number): {
  level: 'SMALL' | 'MEDIUM' | 'LARGE' | 'VERY_LARGE';
  recommendation: string;
} => {
  if (productCount <= 50) return {
    level: 'SMALL',
    recommendation: 'Optimal performance, very fast loading'
  };

  if (productCount <= 150) return {
    level: 'MEDIUM',
    recommendation: 'Good balance between performance and cost'
  };

  if (productCount <= BATCH_CONFIG.PRODUCTS_PER_BATCH) return {
    level: 'LARGE',
    recommendation: 'Optimal for cost efficiency, still fast'
  };

  return {
    level: 'VERY_LARGE',
    recommendation: 'Consider splitting into smaller batches'
  };
};