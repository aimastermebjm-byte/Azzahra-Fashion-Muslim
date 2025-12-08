export interface ProductVariant {
  sizes: string[];
  colors: string[];
  stock?: {
    [size: string]: {
      [color: string]: number;
    };
  };
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
  aiAnalysis?: {
    clothing_type: {
      main_type: string;
      silhouette: string;
      length: string;
      confidence: number;
    };
    pattern_type: {
      pattern: string;
      complexity: string;
      confidence: number;
    };
    lace_details: {
      has_lace: boolean;
      locations: Array<{
        position: string;
        coverage: string;
        lace_type: string;
      }>;
      confidence: number;
    };
    hem_pleats: {
      has_pleats: boolean;
      pleat_type: string;
      depth: string;
      fullness: number;
      confidence: number;
    };
    sleeve_details: {
      has_pleats: boolean;
      sleeve_type: string;
      pleat_position: string;
      ruffle_count: number;
      cuff_style: string;
      confidence: number;
    };
    embellishments: {
      beads: { has: boolean; locations: string[]; density: number };
      embroidery: { has: boolean; pattern: string };
      sequins: { has: boolean; locations: string[] };
      gold_thread: { has: boolean; coverage: number };
    };
    colors: string[];
    fabric_texture: string;
    analyzedAt?: Date;
  };
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