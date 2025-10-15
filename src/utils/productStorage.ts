interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  images: string[];
  variants?: {
    sizes?: string[];
    colors?: string[];
  };
  retailPrice: number;
  resellerPrice: number;
  costPrice?: number;
  stock: number;
  status: 'ready' | 'po';
  salesCount?: number;
  isFeatured?: boolean;
  featuredOrder?: number;
  createdAt?: Date | string;
  isFlashSale?: boolean;
  flashSalePrice?: number;
}

const STORAGE_KEY = 'azzahra_products';

const initialProducts: Product[] = [
  {
    id: '1',
    name: 'Hijab Segi Empat Premium',
    description: 'Hijab segi empat berbahan premium dengan kualitas terbaik. Nyaman dipakai sehari-hari.',
    category: 'hijab',
    images: ['https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=400'],
    variants: {
      sizes: ['Regular'],
      colors: ['Navy', 'Maroon', 'Black', 'Cream', 'Pink', 'Mint', 'Gray']
    },
    retailPrice: 85000,
    resellerPrice: 70000,
    costPrice: 55000,
    stock: 50,
    status: 'ready',
    salesCount: 15,
    isFeatured: false,
    featuredOrder: 0,
    createdAt: new Date(),
    isFlashSale: false,
    flashSalePrice: 0
  },
  {
    id: '2',
    name: 'Gamis Syari Elegant',
    description: 'Gamis syari dengan desain elegant dan bahan adem. Cocok untuk acara formal maupun casual.',
    category: 'gamis',
    images: ['https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg?auto=compress&cs=tinysrgb&w=400'],
    variants: {
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['Black', 'Navy', 'Maroon', 'Army', 'Dusty']
    },
    retailPrice: 285000,
    resellerPrice: 250000,
    costPrice: 200000,
    stock: 25,
    status: 'ready',
    salesCount: 8,
    isFeatured: false,
    featuredOrder: 0,
    createdAt: new Date(),
    isFlashSale: false,
    flashSalePrice: 0
  },
  {
    id: '3',
    name: 'Khimar Instant Modern',
    description: 'Khimar instant dengan pad antem dan material berkualitas. Praktis dan syari.',
    category: 'khimar',
    images: ['https://images.pexels.com/photos/3184461/pexels-photo-3184461.jpeg?auto=compress&cs=tinysrgb&w=400'],
    variants: {
      sizes: ['Regular', 'Jumbo'],
      colors: ['Black', 'White', 'Cream', 'Silver', 'Pink']
    },
    retailPrice: 95000,
    resellerPrice: 80000,
    costPrice: 65000,
    stock: 40,
    status: 'ready',
    salesCount: 12,
    isFeatured: false,
    featuredOrder: 0,
    createdAt: new Date(),
    isFlashSale: false,
    flashSalePrice: 0
  },
  {
    id: '4',
    name: 'Tunik Kasual Modern',
    description: 'Tunik dengan desain modern yang cocok untuk OOTD harian. Nyaman dan stylish.',
    category: 'tunik',
    images: ['https://images.pexels.com/photos/3184315/pexels-photo-3184315.jpeg?auto=compress&cs=tinysrgb&w=400'],
    variants: {
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Blue', 'Pink', 'White', 'Black', 'Mustard']
    },
    retailPrice: 165000,
    resellerPrice: 140000,
    costPrice: 110000,
    stock: 30,
    status: 'ready',
    salesCount: 6,
    isFeatured: false,
    featuredOrder: 0,
    createdAt: new Date(),
    isFlashSale: false,
    flashSalePrice: 0
  },
  {
    id: '5',
    name: 'Setelan Celana Kulot',
    description: 'Setelan atasan dengan celana kulot yang nyaman. Modern dan syari.',
    category: 'setelan',
    images: ['https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg?auto=compress&cs=tinysrgb&w=400'],
    variants: {
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Army', 'Navy', 'Maroon', 'Gray', 'Beige']
    },
    retailPrice: 225000,
    resellerPrice: 190000,
    costPrice: 150000,
    stock: 20,
    status: 'ready',
    salesCount: 4,
    isFeatured: false,
    featuredOrder: 0,
    createdAt: new Date(),
    isFlashSale: false,
    flashSalePrice: 0
  },
  {
    id: '6',
    name: 'Rok Plisket Premium',
    description: 'Rok plisket dengan bahan premium yang jatuh dan nyaman. Elegan dan modis.',
    category: 'rok',
    images: ['https://images.pexels.com/photos/3184340/pexels-photo-3184340.jpeg?auto=compress&cs=tinysrgb&w=400'],
    variants: {
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Black', 'Navy', 'Maroon', 'Gray', 'Cream']
    },
    retailPrice: 145000,
    resellerPrice: 120000,
    costPrice: 95000,
    stock: 35,
    status: 'ready',
    salesCount: 9,
    isFeatured: false,
    featuredOrder: 0,
    createdAt: new Date(),
    isFlashSale: false,
    flashSalePrice: 0
  },
  {
    id: '7',
    name: 'Blouse Kekinian',
    description: 'Blouse dengan desain kekinian yang nyaman dipakai sehari-hari.',
    category: 'atasan',
    images: ['https://images.pexels.com/photos/3184359/pexels-photo-3184359.jpeg?auto=compress&cs=tinysrgb&w=400'],
    variants: {
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Pink', 'Blue', 'White', 'Yellow', 'Green']
    },
    retailPrice: 125000,
    resellerPrice: 105000,
    costPrice: 85000,
    stock: 28,
    status: 'ready',
    salesCount: 7,
    isFeatured: false,
    featuredOrder: 0,
    createdAt: new Date(),
    isFlashSale: false,
    flashSalePrice: 0
  },
  {
    id: '8',
    name: 'Abaya Simple Elegant',
    description: 'Abaya dengan desain simple namun elegant. Cocok untuk acara formal.',
    category: 'abaya',
    images: ['https://images.pexels.com/photos/3184365/pexels-photo-3184365.jpeg?auto=compress&cs=tinysrgb&w=400'],
    variants: {
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Black', 'Navy', 'Gray', 'Maroon']
    },
    retailPrice: 325000,
    resellerPrice: 280000,
    costPrice: 220000,
    stock: 15,
    status: 'ready',
    salesCount: 3,
    isFeatured: false,
    featuredOrder: 0,
    createdAt: new Date(),
    isFlashSale: false,
    flashSalePrice: 0
  }
];

export class ProductStorage {
  // Initialize products if not exists
  static initializeProducts(): Product[] {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        console.log('📦 Products loaded from localStorage:', parsed.length, 'products');
        return parsed;
      } catch (error) {
        console.error('❌ Error parsing products from localStorage:', error);
      }
    }

    console.log('🆕 Initializing products with default data');
    this.saveProducts(initialProducts);
    return initialProducts;
  }

  // Get all products
  static getProducts(): Product[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return this.initializeProducts();

      const products = JSON.parse(stored);
      // Ensure dates are properly converted
      return products.map((product: any) => ({
        ...product,
        createdAt: new Date(product.createdAt)
      }));
    } catch (error) {
      console.error('❌ Error getting products from localStorage:', error);
      return this.initializeProducts();
    }
  }

  // Save products to localStorage
  static saveProducts(products: Product[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
      console.log('💾 Products saved to localStorage:', products.length, 'products');
    } catch (error) {
      console.error('❌ Error saving products to localStorage:', error);
    }
  }

  // Update a single product
  static updateProduct(productId: string, updates: Partial<Product>): Product[] {
    const products = this.getProducts();
    const updatedProducts = products.map(product =>
      product.id === productId ? { ...product, ...updates } : product
    );
    this.saveProducts(updatedProducts);
    return updatedProducts;
  }

  // Toggle featured status
  static toggleFeatured(productId: string): Product[] {
    const products = this.getProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return products;

    let updatedProducts: Product[];

    if (product.isFeatured) {
      // Remove from featured
      updatedProducts = products.map(p => {
        if (p.id === productId) {
          return { ...p, isFeatured: false, featuredOrder: 0 };
        }
        if (p.isFeatured && p.featuredOrder! > product.featuredOrder!) {
          return { ...p, featuredOrder: p.featuredOrder! - 1 };
        }
        return p;
      });
    } else {
      // Add to featured (max 4)
      const currentFeatured = products.filter(p => p.isFeatured);
      if (currentFeatured.length >= 4) {
        alert('Maksimal 4 produk unggulan!');
        return products;
      }

      updatedProducts = products.map(p =>
        p.id === productId
          ? { ...p, isFeatured: true, featuredOrder: currentFeatured.length + 1 }
          : p
      );
    }

    this.saveProducts(updatedProducts);
    return updatedProducts;
  }

  // Reorder featured products
  static reorderFeatured(productId: string, direction: 'up' | 'down'): Product[] {
    const products = this.getProducts();
    const featuredProducts = products
      .filter(p => p.isFeatured)
      .sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0));

    const currentIndex = featuredProducts.findIndex(p => p.id === productId);
    if (currentIndex === -1) return products;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= featuredProducts.length) return products;

    // Reorder
    const [moved] = featuredProducts.splice(currentIndex, 1);
    featuredProducts.splice(newIndex, 0, moved);

    // Update all products with new featured orders
    const updatedProducts = products.map(product => {
      const featuredIndex = featuredProducts.findIndex(f => f.id === product.id);
      if (featuredIndex !== -1) {
        return { ...product, featuredOrder: featuredIndex + 1 };
      }
      return product;
    });

    this.saveProducts(updatedProducts);
    return updatedProducts;
  }

  // Get featured products
  static getFeaturedProducts(): Product[] {
    return this.getProducts()
      .filter(p => p.isFeatured)
      .sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0));
  }

  // Clear all products (reset to initial)
  static clearProducts(): Product[] {
    localStorage.removeItem(STORAGE_KEY);
    return this.initializeProducts();
  }

  // Export products to JSON (for backup)
  static exportProducts(): string {
    const products = this.getProducts();
    return JSON.stringify(products, null, 2);
  }

  // Import products from JSON
  static importProducts(jsonData: string): boolean {
    try {
      const products = JSON.parse(jsonData);
      if (Array.isArray(products)) {
        this.saveProducts(products);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error importing products:', error);
      return false;
    }
  }
}

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  window.ProductStorage = ProductStorage;
}