/**
 * Cart Cache Utility untuk mengurangi Firebase reads
 * Cache-first approach dengan stock/price validation saat checkout
 */

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  variant?: {
    size?: string;
    color?: string;
  };
  addedAt: Date | string;
}

export interface CartCacheData {
  items: CartItem[];
  lastUpdated: number;
  version: string;
  userId: string;
}

class CartCache {
  private readonly storageKey = 'azzahra_cart_cache';
  private readonly version = '1.0.0';
  private readonly ttl = 10 * 60 * 1000; // 10 minutes TTL
  private readonly maxCacheAge = 5 * 60 * 1000; // 5 minutes max age

  /**
   * Get cart dari cache (localStorage)
   */
  getCart(userId: string): CartItem[] | null {
    try {
      const cacheData = localStorage.getItem(this.storageKey);
      if (!cacheData) {
        console.log('📦 No cart cache found');
        return null;
      }

      const parsed: CartCacheData = JSON.parse(cacheData);
      const now = Date.now();

      // Validasi cache
      if (parsed.userId !== userId) {
        console.log('📦 Cart cache userId mismatch - ignoring cache');
        return null;
      }

      if (parsed.version !== this.version) {
        console.log('📦 Cart cache version mismatch - ignoring cache');
        return null;
      }

      if (now - parsed.lastUpdated > this.maxCacheAge) {
        console.log('📦 Cart cache expired - ignoring cache');
        return null;
      }

      console.log('✅ Using cached cart:', parsed.items.length, 'items');
      return parsed.items;
    } catch (error) {
      console.error('❌ Error reading cart cache:', error);
      return null;
    }
  }

  /**
   * Save cart ke cache
   */
  setCart(userId: string, items: CartItem[]): void {
    try {
      const cacheData: CartCacheData = {
        items,
        lastUpdated: Date.now(),
        version: this.version,
        userId
      };

      localStorage.setItem(this.storageKey, JSON.stringify(cacheData));
      console.log('💾 Cart cached:', items.length, 'items');
    } catch (error) {
      console.error('❌ Error saving cart cache:', error);
    }
  }

  /**
   * Update item quantity di cache
   */
  updateItemQuantity(userId: string, productId: string, quantity: number, variant?: any): void {
    const cachedItems = this.getCart(userId);
    if (!cachedItems) return;

    const updatedItems = cachedItems.map(item => {
      if (item.productId === productId &&
          JSON.stringify(item.variant) === JSON.stringify(variant)) {
        return { ...item, quantity };
      }
      return item;
    });

    this.setCart(userId, updatedItems);
  }

  /**
   * Add item ke cache
   */
  addItem(userId: string, item: CartItem): void {
    const cachedItems = this.getCart(userId) || [];
    const existingIndex = cachedItems.findIndex(
      i => i.productId === item.productId &&
           JSON.stringify(i.variant) === JSON.stringify(item.variant)
    );

    if (existingIndex >= 0) {
      // Update existing item
      cachedItems[existingIndex] = {
        ...cachedItems[existingIndex],
        quantity: cachedItems[existingIndex].quantity + item.quantity
      };
    } else {
      // Add new item
      cachedItems.push(item);
    }

    this.setCart(userId, cachedItems);
  }

  /**
   * Remove item dari cache
   */
  removeItem(userId: string, productId: string, variant?: any): void {
    const cachedItems = this.getCart(userId);
    if (!cachedItems) return;

    const filteredItems = cachedItems.filter(
      item => !(item.productId === productId &&
               JSON.stringify(item.variant) === JSON.stringify(variant))
    );

    this.setCart(userId, filteredItems);
  }

  /**
   * Clear cart cache
   */
  clearCart(userId: string): void {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('🗑️ Cart cache cleared');
    } catch (error) {
      console.error('❌ Error clearing cart cache:', error);
    }
  }

  /**
   * Check if cache masih valid
   */
  isCacheValid(userId: string): boolean {
    const cachedItems = this.getCart(userId);
    return cachedItems !== null;
  }

  /**
   * Get cache age
   */
  getCacheAge(userId: string): number {
    try {
      const cacheData = localStorage.getItem(this.storageKey);
      if (!cacheData) return Infinity;

      const parsed: CartCacheData = JSON.parse(cacheData);
      if (parsed.userId !== userId) return Infinity;

      return Date.now() - parsed.lastUpdated;
    } catch {
      return Infinity;
    }
  }

  /**
   * Trigger cross-device sync
   */
  triggerSync(): void {
    localStorage.setItem('cart_sync_trigger', Date.now().toString());
    setTimeout(() => {
      localStorage.removeItem('cart_sync_trigger');
    }, 100);
  }

  /**
   * Listen for cross-device sync
   */
  onSync(callback: () => void): () => void {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cart_sync_trigger') {
        console.log('🔄 Cart sync detected from other device');
        callback();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }
}

export const cartCache = new CartCache();