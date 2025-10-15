// Comprehensive Local Storage System for Azzahra Fashion Muslim
// This handles ALL data persistence: products, orders, users, payments, etc.

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'customer' | 'reseller' | 'admin' | 'owner';
  createdAt: Date | string;
}

interface Order {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  items: any[];
  totalAmount: number;
  shippingCost: number;
  finalTotal: number;
  paymentMethod: 'transfer' | 'cash';
  paymentProof?: string;
  paymentProofUrl?: string;
  status: 'pending' | 'awaiting_verification' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingInfo: {
    address: string;
    phone: string;
    isDropship?: boolean;
    dropshipName?: string;
    dropshipPhone?: string;
  };
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface Product {
  id: string;
  name: string;
  description: string;
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

export class AppStorage {
  // Storage keys
  private static readonly KEYS = {
    PRODUCTS: 'azzahra_products',
    ORDERS: 'azzahra_orders',
    USERS: 'azzahra_users',
    CART: 'azzahra_cart',
    FLASH_SALES: 'azzahra_flash_sales',
    APP_STATE: 'azzahra_app_state'
  };

  // Initialize all data if not exists
  static initializeApp(): void {
    console.log('🚀 Initializing Azzahra Fashion Muslim App...');

    // Initialize products
    if (!localStorage.getItem(this.KEYS.PRODUCTS)) {
      this.initializeProducts();
    }

    // Initialize users
    if (!localStorage.getItem(this.KEYS.USERS)) {
      this.initializeUsers();
    }

    // Initialize orders
    if (!localStorage.getItem(this.KEYS.ORDERS)) {
      this.initializeOrders();
    }

    // Initialize cart
    if (!localStorage.getItem(this.KEYS.CART)) {
      localStorage.setItem(this.KEYS.CART, JSON.stringify([]));
    }

    console.log('✅ App initialized successfully!');
  }

  // ==================== PRODUCTS ====================
  private static initializeProducts(): void {
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

    this.saveData(this.KEYS.PRODUCTS, initialProducts);
    console.log('📦 Products initialized:', initialProducts.length);
  }

  // ==================== USERS ====================
  private static initializeUsers(): void {
    const initialUsers: User[] = [
      {
        id: '1',
        name: 'Customer',
        email: 'customer@azzahra.com',
        phone: '08123456789',
        role: 'customer',
        createdAt: new Date()
      },
      {
        id: '2',
        name: 'Admin',
        email: 'admin@azzahra.com',
        phone: '08123456780',
        role: 'admin',
        createdAt: new Date()
      },
      {
        id: '3',
        name: 'Owner',
        email: 'owner@azzahra.com',
        phone: '08123456781',
        role: 'owner',
        createdAt: new Date()
      }
    ];

    this.saveData(this.KEYS.USERS, initialUsers);
    console.log('👥 Users initialized:', initialUsers.length);
  }

  // ==================== ORDERS ====================
  private static initializeOrders(): void {
    // Start with empty orders array
    this.saveData(this.KEYS.ORDERS, []);
    console.log('📋 Orders initialized: 0');
  }

  // ==================== UTILITY METHODS ====================
  private static saveData(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`❌ Error saving data to ${key}:`, error);
    }
  }

  private static loadData(key: string): any {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`❌ Error loading data from ${key}:`, error);
      return null;
    }
  }

  // ==================== PUBLIC METHODS ====================

  // Products
  static getProducts(): Product[] {
    const products = this.loadData(this.KEYS.PRODUCTS) || [];
    return products.map((product: any) => ({
      ...product,
      createdAt: new Date(product.createdAt)
    }));
  }

  static saveProducts(products: Product[]): void {
    this.saveData(this.KEYS.PRODUCTS, products);
  }

  static getFeaturedProducts(): Product[] {
    return this.getProducts()
      .filter(p => p.isFeatured)
      .sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0));
  }

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

  // Orders
  static getOrders(): Order[] {
    const orders = this.loadData(this.KEYS.ORDERS) || [];
    return orders.map((order: any) => ({
      ...order,
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(order.updatedAt)
    }));
  }

  static saveOrder(order: Order): void {
    const orders = this.getOrders();
    orders.push(order);
    this.saveData(this.KEYS.ORDERS, orders);
    console.log('💾 Order saved:', order.id);
  }

  static updateOrderStatus(orderId: string, status: Order['status']): void {
    const orders = this.getOrders();
    const updatedOrders = orders.map(order =>
      order.id === orderId
        ? { ...order, status, updatedAt: new Date() }
        : order
    );
    this.saveData(this.KEYS.ORDERS, updatedOrders);
    console.log('📋 Order status updated:', orderId, '→', status);
  }

  // Users
  static getUsers(): User[] {
    const users = this.loadData(this.KEYS.USERS) || [];
    return users.map((user: any) => ({
      ...user,
      createdAt: new Date(user.createdAt)
    }));
  }

  static saveUser(user: User): void {
    const users = this.getUsers();
    const existingIndex = users.findIndex(u => u.id === user.id);

    if (existingIndex >= 0) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }

    this.saveData(this.KEYS.USERS, users);
  }

  // Cart
  static getCart(): any[] {
    return this.loadData(this.KEYS.CART) || [];
  }

  static saveCart(cart: any[]): void {
    this.saveData(this.KEYS.CART, cart);
  }

  // ==================== BACKUP & RESTORE ====================
  static exportAllData(): string {
    const allData = {
      products: this.getProducts(),
      orders: this.getOrders(),
      users: this.getUsers(),
      cart: this.getCart(),
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(allData, null, 2);
  }

  static importAllData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);

      if (data.products) {
        this.saveData(this.KEYS.PRODUCTS, data.products);
      }
      if (data.orders) {
        this.saveData(this.KEYS.ORDERS, data.orders);
      }
      if (data.users) {
        this.saveData(this.KEYS.USERS, data.users);
      }
      if (data.cart) {
        this.saveData(this.KEYS.CART, data.cart);
      }

      console.log('📥 Data imported successfully');
      return true;
    } catch (error) {
      console.error('❌ Error importing data:', error);
      return false;
    }
  }

  // ==================== DEBUG & RESET ====================
  static clearAllData(): void {
    Object.values(this.KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('🗑️ All data cleared');
    this.initializeApp(); // Reinitialize with default data
  }

  static getStorageInfo(): any {
    const info: any = {};
    Object.entries(this.KEYS).forEach(([name, key]) => {
      const data = localStorage.getItem(key);
      info[name] = {
        size: data ? data.length : 0,
        items: data ? JSON.parse(data).length : 0
      };
    });
    return info;
  }
}

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  window.AppStorage = AppStorage;
}