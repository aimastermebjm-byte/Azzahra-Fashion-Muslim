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

  // Pricing fields yang sesuai dengan data aktual
  sellingPrice: number; // Harga jual utama
  price: number; // Harga umum (sellingPrice/retailPrice)
  retailPrice: number; // Harga retail
  resellerPrice: number; // Harga reseller
  costPrice: number; // Harga pokok
  purchasePrice: number; // Harga beli
  originalRetailPrice: number; // Harga retail asli
  originalResellerPrice: number; // Harga reseller asli
  originalSellingPrice: number; // Harga jual asli (untuk backward compatibility)

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