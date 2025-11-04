export interface ProductVariant {
  sizes: string[];
  colors: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  images: string[];
  variants: ProductVariant;
  retailPrice: number;
  resellerPrice: number;
  costPrice: number;
  stock: number;
  status: 'ready' | 'po';
  estimatedReady?: Date;
  isFlashSale: boolean;
  flashSalePrice: number;
  originalRetailPrice?: number;
  originalResellerPrice?: number;
  createdAt: Date;
  salesCount?: number;
  isFeatured?: boolean;
  featuredOrder?: number;
  image: string; // Main image (backward compatibility)
  weight?: number; // Weight in grams (optional, defaults to 1000g = 1kg)
  unit?: string; // Weight unit (e.g., 'gram', 'kg', 'pcs')
}

export interface FlashSale {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  productIds: string[];
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  createdAt: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'reseller' | 'admin' | 'owner';
  points?: number;
}

export interface CartItem extends Product {
  selectedVariant: {
    size: string;
    color: string;
  };
  quantity: number;
  cartId: string;
}