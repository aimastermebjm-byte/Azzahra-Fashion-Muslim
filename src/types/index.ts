// Product interface for batch system
export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  images: string[];
  image: string; // Primary image URL

  // Variants structure yang sesuai dengan data aktual
  variants: {
    sizes: string[];
    colors: string[];
    stock: Record<string, Record<string, number>>; // Nested: { size: { color: quantity } }
  };

  // Pricing fields yang sesuai dengan data aktual
  price: number; // Harga utama (sellingPrice/retailPrice)
  retailPrice: number;
  resellerPrice: number;
  costPrice: number;
  purchasePrice: number; // Tambahan dari data aktual
  originalRetailPrice: number;
  originalResellerPrice: number;

  // Stock dan status
  stock: number;
  status: 'ready' | 'po'; // Simplified untuk compatibility
  condition?: string; // Tambahan dari data aktual
  estimatedReady?: Date;

  // Flash sale
  isFeatured: boolean;
  featured?: boolean; // Tambahan dari data aktual
  isFlashSale: boolean;
  flashSalePrice: number;
  flashSaleDiscount?: number | null; // Tambahan dari data aktual
  discount?: number; // Tambahan dari data aktual

  // Metadata
  createdAt: Date;
  updatedAt?: string; // Tambahan dari data aktual
  salesCount: number;
  reviews?: number; // Tambahan dari data aktual
  rating?: number; // Tambahan dari data aktual

  // Physical properties
  weight: number;
  unit: 'gram' | 'kg' | 'pcs';

  // Migration fields
  cleanupDate?: string; // Tambahan dari data aktual
  cleanupNote?: string; // Tambahan dari data aktual
  migrationDate?: string; // Tambahan dari data aktual
  migrationNote?: string; // Tambahan dari data aktual
};

// Product interface untuk produk individual (legacy - digunakan jika perlu
export interface IndividualProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  retailPrice: number;
  resellerPrice: number;
  costPrice: number;
  stock: number;
  status: string;
  estimatedReady?: Date;
  isFeatured: boolean;
  isFlashSale: boolean;
  flashSalePrice: number;
  originalRetailPrice: number;
  originalResellerPrice: number;
  createdAt: Date;
  salesCount: number;
  weight: number;
  unit: string;
}