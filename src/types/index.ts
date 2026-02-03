// Product interface for batch system
export interface Product {
  id: string;
  name: string;
  brand?: string; // Tambahan field untuk Merk
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

  // Pricing fields (cleaned up - only essentials)
  retailPrice: number; // Harga retail (customer)
  resellerPrice: number; // Harga reseller
  costPrice: number; // Harga pokok untuk hitung laba

  // Stock dan status
  stock: number;
  status: 'ready' | 'po'; // Simplified untuk compatibility
  condition?: string; // Tambahan dari data aktual
  estimatedReady?: Date;

  // Flash sale (cleaned up)
  isFeatured: boolean;
  isFlashSale: boolean;
  flashSalePrice: number;

  // Metadata (cleaned up)
  createdAt: Date;
  updatedAt?: string;
  salesCount: number;

  // Physical properties
  weight: number;
  unit: 'gram' | 'kg' | 'pcs';

  // Migration fields
  cleanupDate?: string; // Tambahan dari data aktual
  cleanupNote?: string; // Tambahan dari data aktual
  migrationDate?: string; // Tambahan dari data aktual
  migrationNote?: string; // Tambahan dari data aktual

  // Virtual Discount System
  collectionId?: string; // ID of collection this product belongs to (for virtual discount)
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
  createdAt: Date;
  salesCount: number;
  weight: number;
  unit: string;
}