/**
 * Product utility functions - BULLETPROOF VERSION
 * Ensures data integrity and prevents crashes
 */

export interface SafeProduct {
  id: string;
  name: string;
  description?: string;
  category?: string;
  images?: string[];
  variants?: {
    sizes?: string[];
    colors?: string[];
  };
  retailPrice?: number;
  resellerPrice?: number;
  costPrice?: number;
  stock?: number;
  status?: 'ready' | 'po';
  isFlashSale?: boolean;
  flashSalePrice?: number;
  createdAt?: Date | string;
  salesCount?: number;
  isFeatured?: boolean;
  featuredOrder?: number;
  [key: string]: any;
}

/**
 * Validates and sanitizes a product object
 */
export function validateProduct(product: any): SafeProduct | null {
  if (!product || typeof product !== 'object') {
    return null;
  }

  if (!product.id || !product.name) {
    return null;
  }

  return {
    id: String(product.id),
    name: String(product.name),
    description: product.description ? String(product.description) : '',
    category: product.category ? String(product.category) : 'other',
    images: Array.isArray(product.images) ? product.images : [],
    variants: product.variants && typeof product.variants === 'object' ? {
      sizes: Array.isArray(product.variants.sizes) ? product.variants.sizes : [],
      colors: Array.isArray(product.variants.colors) ? product.variants.colors : []
    } : { sizes: [], colors: [] },
    retailPrice: typeof product.retailPrice === 'number' ? product.retailPrice : 0,
    resellerPrice: typeof product.resellerPrice === 'number' ? product.resellerPrice : 0,
    costPrice: typeof product.costPrice === 'number' ? product.costPrice : 0,
    stock: typeof product.stock === 'number' ? product.stock : 0,
    status: (product.status === 'ready' || product.status === 'po') ? product.status : 'ready',
    isFlashSale: Boolean(product.isFlashSale),
    flashSalePrice: typeof product.flashSalePrice === 'number' ? product.flashSalePrice : 0,
    createdAt: product.createdAt ? (product.createdAt instanceof Date ? product.createdAt : new Date(product.createdAt)) : new Date(),
    salesCount: typeof product.salesCount === 'number' ? product.salesCount : 0,
    isFeatured: Boolean(product.isFeatured),
    featuredOrder: typeof product.featuredOrder === 'number' ? product.featuredOrder : undefined,
    // Preserve any other properties
    ...Object.keys(product).reduce((acc, key) => {
      if (!['id', 'name', 'description', 'category', 'images', 'variants', 'retailPrice', 'resellerPrice', 'costPrice', 'stock', 'status', 'isFlashSale', 'flashSalePrice', 'createdAt', 'salesCount', 'isFeatured', 'featuredOrder'].includes(key)) {
        acc[key] = product[key];
      }
      return acc;
    }, {} as any)
  };
}

/**
 * Validates and sanitizes an array of products
 */
export function validateProducts(products: any[]): SafeProduct[] {
  if (!Array.isArray(products)) {
    console.warn('⚠️ validateProducts: Input is not an array');
    return [];
  }

  const validProducts = products
    .map(validateProduct)
    .filter((p): p is SafeProduct => p !== null);

  return validProducts;
}

/**
 * Gets featured products with fallback
 */
export function getFeaturedProducts(products: SafeProduct[]): SafeProduct[] {
  try {
    if (!Array.isArray(products) || products.length === 0) {
      return [];
    }

    // Get products with isFeatured flag
    let featured = products.filter(p => p.isFeatured);

    // Fallback: use top 3 products by salesCount
    if (featured.length === 0) {
      featured = products
        .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
        .slice(0, 3)
        .map((p, index) => ({
          ...p,
          isFeatured: true,
          featuredOrder: index + 1
        }));
    }

    // Sort by featuredOrder, then by salesCount
    return featured.sort((a, b) => {
      if (a.featuredOrder && b.featuredOrder) {
        return a.featuredOrder - b.featuredOrder;
      }
      return (b.salesCount || 0) - (a.salesCount || 0);
    });
  } catch (error) {
    console.error('🚨 getFeaturedProducts error:', error);
    return [];
  }
}

/**
 * Gets flash sale products safely
 */
export function getFlashSaleProducts(products: SafeProduct[]): SafeProduct[] {
  try {
    if (!Array.isArray(products) || products.length === 0) {
      return [];
    }

    // Check localStorage for flash sale config
    let flashSaleConfig;
    try {
      const savedConfig = localStorage.getItem('azzahra-flashsale');
      flashSaleConfig = savedConfig ? JSON.parse(savedConfig) : null;
    } catch (e) {
      console.warn('⚠️ Error parsing flash sale config:', e);
      flashSaleConfig = null;
    }

    return products.filter(product => {
      // Check isFlashSale flag
      if (product.isFlashSale) {
        return true;
      }

      // Check flash sale config
      if (flashSaleConfig &&
          flashSaleConfig.isActive === true &&
          Array.isArray(flashSaleConfig.products)) {
        return flashSaleConfig.products.includes(product.id);
      }

      return false;
    });
  } catch (error) {
    console.error('🚨 getFlashSaleProducts error:', error);
    return [];
  }
}