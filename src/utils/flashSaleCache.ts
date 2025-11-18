/**
 * Flash Sale Cache Utility - Cache-first dengan pagination
 * Mirip seperti featured products tapi untuk flash sale
 */

export interface FlashSaleProduct {
  id: string;
  name: string;
  price: number;
  retailPrice?: number;
  resellerPrice?: number;
  flashSalePrice?: number;
  originalRetailPrice?: number;
  originalResellerPrice?: number;
  stock: number;
  images: string[];
  image?: string;
  category: string;
  status: string;
  isFlashSale: boolean;
  createdAt: Date | string;
  featuredOrder?: number;
  variants?: any;
}

export interface FlashSaleCacheData {
  products: FlashSaleProduct[];
  hasMore: boolean;
  lastVisible?: any;
  totalCount?: number;
  lastUpdated: number;
  version: string;
}

class FlashSaleCache {
  private readonly storageKey = 'azzahra_flashsale_cache';
  private readonly version = '1.0.0';
  private readonly ttl = 5 * 60 * 1000; // 5 minutes TTL
  private isLoading = false; // Global loading flag
  private loadingPromise: Promise<any> | null = null; // Promise queue
  private lastCallTime = 0; // Debounce untuk mencegah spam calls
  private readonly debounceMs = 1000; // 1 second debounce

  /**
   * Get cached flash sale products
   */
  getFlashSaleProducts(): FlashSaleCacheData | null {
    try {
      const cacheData = localStorage.getItem(this.storageKey);
      if (!cacheData) {
        console.log('📦 No flash sale cache found');
        return null;
      }

      const parsed: FlashSaleCacheData = JSON.parse(cacheData);
      const now = Date.now();

      // Validasi cache
      if (parsed.version !== this.version) {
        console.log('📦 Flash sale cache version mismatch - ignoring cache');
        return null;
      }

      if (now - parsed.lastUpdated > this.ttl) {
        console.log('📦 Flash sale cache expired - ignoring cache');
        return null;
      }

      console.log('✅ Using cached flash sale products:', parsed.products.length, 'products');
      return parsed;
    } catch (error) {
      console.error('❌ Error reading flash sale cache:', error);
      return null;
    }
  }

  /**
   * Save flash sale products ke cache
   */
  setFlashSaleProducts(data: {
    products: FlashSaleProduct[];
    hasMore?: boolean;
    lastVisible?: any;
    totalCount?: number;
  }): void {
    try {
      const cacheData: FlashSaleCacheData = {
        products: data.products.slice(0, 10), // Max 10 products di cache
        hasMore: data.hasMore || false,
        lastVisible: data.lastVisible,
        totalCount: data.totalCount,
        lastUpdated: Date.now(),
        version: this.version
      };

      localStorage.setItem(this.storageKey, JSON.stringify(cacheData));
      console.log('💾 Flash sale products cached:', cacheData.products.length, 'products');
    } catch (error) {
      console.error('❌ Error saving flash sale cache:', error);
    }
  }

  /**
   * Append more products ke existing cache (untuk load more)
   */
  appendFlashSaleProducts(newProducts: FlashSaleProduct[]): void {
    try {
      const cached = this.getFlashSaleProducts();
      if (!cached) {
        this.setFlashSaleProducts({ products: newProducts });
        return;
      }

      // Combine existing and new products, remove duplicates
      const existingIds = new Set(cached.products.map(p => p.id));
      const uniqueNewProducts = newProducts.filter(p => !existingIds.has(p.id));
      const allProducts = [...cached.products, ...uniqueNewProducts].slice(0, 50); // Max 50 total

      this.setFlashSaleProducts({
        products: allProducts,
        hasMore: uniqueNewProducts.length > 0,
        lastVisible: cached.lastVisible,
        totalCount: cached.totalCount
      });

      console.log('🔄 Flash sale cache updated:', allProducts.length, 'total products');
    } catch (error) {
      console.error('❌ Error updating flash sale cache:', error);
    }
  }

  /**
   * Check if cache valid
   */
  isCacheValid(): boolean {
    return this.getFlashSaleProducts() !== null;
  }

  /**
   * Get cache age
   */
  getCacheAge(): number {
    try {
      const cacheData = localStorage.getItem(this.storageKey);
      if (!cacheData) return Infinity;

      const parsed: FlashSaleCacheData = JSON.parse(cacheData);
      return Date.now() - parsed.lastUpdated;
    } catch {
      return Infinity;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('🗑️ Flash sale cache cleared');
    } catch (error) {
      console.error('❌ Error clearing flash sale cache:', error);
    }
  }

  /**
   * Get products for display dengan ANTI-SPAM protection
   */
  async getProducts(limit: number = 10): Promise<{
    products: FlashSaleProduct[];
    hasMore: boolean;
    lastVisible?: any;
  }> {
    const now = Date.now();

    // DEBOUNCE: Jangan call terlalu sering
    if (now - this.lastCallTime < this.debounceMs) {
      console.log('🚫 Flash sale call debounced, please wait...');

      // Return existing promise atau cache
      if (this.loadingPromise) {
        return this.loadingPromise;
      }

      const cached = this.getFlashSaleProducts();
      if (cached) {
        return {
          products: cached.products.slice(0, limit),
          hasMore: cached.products.length > limit || cached.hasMore,
          lastVisible: cached.lastVisible
        };
      }
    }

    this.lastCallTime = now;

    // Prevent multiple concurrent requests
    if (this.isLoading && this.loadingPromise) {
      console.log('⏸️ Flash sale already loading, returning existing promise...');
      return this.loadingPromise;
    }

    // Try cache first
    const cached = this.getFlashSaleProducts();
    if (cached) {
      console.log('✅ Using cached flash sale products for display');

      // Background refresh hanya jika cache sudah lama dan tidak sedang loading
      const cacheAge = this.getCacheAge();
      if (cacheAge > 3 * 60 * 1000 && !this.isLoading) { // 3 minutes
        console.log('🔄 Flash sale cache getting old, will refresh in background');
        setTimeout(() => {
          if (!this.isLoading) this.refreshFromFirebase();
        }, 5000); // Delay 5 detik untuk background refresh
      }

      return {
        products: cached.products.slice(0, limit),
        hasMore: cached.products.length > limit || cached.hasMore,
        lastVisible: cached.lastVisible
      };
    }

    // Load from Firebase jika tidak ada cache
    if (this.isLoading) {
      console.log('⏸️ Flash sale already loading from Firebase, waiting...');
      return this.loadingPromise!;
    }

    console.log('🔥 Loading flash sale products from Firebase...');
    this.loadingPromise = this.refreshFromFirebase();
    return this.loadingPromise;
  }

  /**
   * Load more products (pagination) dengan fallback
   */
  async loadMoreProducts(currentCount: number, limit: number = 10): Promise<{
    products: FlashSaleProduct[];
    hasMore: boolean;
    lastVisible?: any;
  }> {
    try {
      // Import dinamis untuk menghindari bundle size issues
      const { collection, query, where, orderBy, limit: limitFn, getDocs } = await import('firebase/firestore');
      const { db } = await import('../utils/firebaseClient');

      let querySnapshot;

      try {
        // Coba dengan composite index
        const q = query(
          collection(db, 'products'),
          where('isFlashSale', '==', true),
          orderBy('createdAt', 'desc'),
          limitFn(limit)
        );
        querySnapshot = await getDocs(q);
        console.log('✅ Flash sale loadMore: Menggunakan indexed query');
      } catch (indexError: any) {
        if (indexError.message.includes('requires an index')) {
          console.log('⚠️ Flash sale loadMore: Index tidak ditemukan, menggunakan fallback');

          // Fallback query tanpa orderBy
          const fallbackQuery = query(
            collection(db, 'products'),
            where('isFlashSale', '==', true),
            limitFn(limit + 20) // Ambil extra untuk sorting
          );
          const fallbackSnapshot = await getDocs(fallbackQuery);

          // Client-side sorting
          const sortedDocs = fallbackSnapshot.docs.sort((a, b) => {
            const dateA = a.data().createdAt?.toMillis ? a.data().createdAt.toMillis() :
                         (typeof a.data().createdAt === 'string' ? new Date(a.data().createdAt).getTime() : 0);
            const dateB = b.data().createdAt?.toMillis ? b.data().createdAt.toMillis() :
                         (typeof b.data().createdAt === 'string' ? new Date(b.data().createdAt).getTime() : 0);
            return dateB - dateA;
          });

          // Skip products yang sudah dimuat (pagination manual)
          const paginatedDocs = sortedDocs.slice(currentCount, currentCount + limit);

          querySnapshot = {
            docs: paginatedDocs,
            size: paginatedDocs.length,
            empty: paginatedDocs.length === 0,
            forEach: (callback: (doc: any) => void) => paginatedDocs.forEach(callback)
          } as any;

          console.log('✅ Flash sale loadMore: Menggunakan fallback dengan client-side sorting');
        } else {
          throw indexError;
        }
      }
      const newProducts: FlashSaleProduct[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        newProducts.push({
          id: doc.id,
          name: data.name || '',
          price: Number(data.price || 0),
          retailPrice: Number(data.retailPrice || data.price || 0),
          resellerPrice: Number(data.resellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          flashSalePrice: Number(data.flashSalePrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          originalRetailPrice: Number(data.originalRetailPrice) || Number(data.retailPrice || data.price || 0),
          originalResellerPrice: Number(data.originalResellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          stock: Number(data.stock || 0),
          images: (data.images || []).slice(0, 2),
          image: data.images?.[0] || '/placeholder-product.jpg',
          category: data.category || 'uncategorized',
          status: data.status || 'ready',
          isFlashSale: Boolean(data.isFlashSale),
          createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt?.toDate()) : new Date(),
          featuredOrder: Number(data.featuredOrder) || 0,
          variants: data.variants
        });
      });

      // Update cache dengan new products
      this.appendFlashSaleProducts(newProducts);

      return {
        products: newProducts,
        hasMore: newProducts.length === limit,
        lastVisible: querySnapshot.docs[querySnapshot.docs.length - 1]
      };
    } catch (error) {
      console.error('❌ Error loading more flash sale products:', error);
      return { products: [], hasMore: false };
    }
  }

  /**
   * Refresh dari Firebase dengan fallback query dan loading protection
   */
  private async refreshFromFirebase(): Promise<{
    products: FlashSaleProduct[];
    hasMore: boolean;
    lastVisible?: any;
  }> {
    // Set loading flag
    this.isLoading = true;

    try {
      const { collection, query, where, orderBy, limit: limitFn, getDocs } = await import('firebase/firestore');
      const { db } = await import('../utils/firebaseClient');

      let querySnapshot;

      try {
        // Coba dengan composite index (jika sudah ada)
        const q = query(
          collection(db, 'products'),
          where('isFlashSale', '==', true),
          orderBy('createdAt', 'desc'),
          limitFn(10)
        );
        querySnapshot = await getDocs(q);
        console.log('✅ Flash sale: Menggunakan indexed query');
      } catch (indexError: any) {
        if (indexError.message.includes('requires an index')) {
          console.log('⚠️ Flash sale: Index tidak ditemukan, menggunakan fallback query');

          // Fallback query tanpa orderBy, lalu client-side sorting
          const fallbackQuery = query(
            collection(db, 'products'),
            where('isFlashSale', '==', true),
            limitFn(50) // Ambil lebih banyak untuk client-side sorting
          );
          const fallbackSnapshot = await getDocs(fallbackQuery);

          // Client-side sorting
          const sortedDocs = fallbackSnapshot.docs.sort((a, b) => {
            const dateA = a.data().createdAt?.toMillis ? a.data().createdAt.toMillis() :
                         (typeof a.data().createdAt === 'string' ? new Date(a.data().createdAt).getTime() : 0);
            const dateB = b.data().createdAt?.toMillis ? b.data().createdAt.toMillis() :
                         (typeof b.data().createdAt === 'string' ? new Date(b.data().createdAt).getTime() : 0);
            return dateB - dateA; // Urutan descending
          });

          // Batasi hasil setelah sorting
          querySnapshot = {
            docs: sortedDocs.slice(0, 10),
            size: sortedDocs.length,
            empty: sortedDocs.length === 0,
            forEach: (callback: (doc: any) => void) => sortedDocs.slice(0, 10).forEach(callback)
          } as any;

          console.log('✅ Flash sale: Menggunakan fallback query dengan client-side sorting');
        } else {
          throw indexError;
        }
      }
      const products: FlashSaleProduct[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        products.push({
          id: doc.id,
          name: data.name || '',
          price: Number(data.price || 0),
          retailPrice: Number(data.retailPrice || data.price || 0),
          resellerPrice: Number(data.resellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          flashSalePrice: Number(data.flashSalePrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          originalRetailPrice: Number(data.originalRetailPrice) || Number(data.retailPrice || data.price || 0),
          originalResellerPrice: Number(data.originalResellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          stock: Number(data.stock || 0),
          images: (data.images || []).slice(0, 2),
          image: data.images?.[0] || '/placeholder-product.jpg',
          category: data.category || 'uncategorized',
          status: data.status || 'ready',
          isFlashSale: Boolean(data.isFlashSale),
          createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt?.toDate()) : new Date(),
          featuredOrder: Number(data.featuredOrder) || 0,
          variants: data.variants
        });
      });

      // Save to cache
      this.setFlashSaleProducts({
        products,
        hasMore: products.length === 10,
        lastVisible: querySnapshot.docs[querySnapshot.docs.length - 1],
        totalCount: products.length
      });

      console.log('✅ Fresh flash sale products loaded:', products.length, 'products');
      return {
        products,
        hasMore: products.length === 10,
        lastVisible: querySnapshot.docs[querySnapshot.docs.length - 1]
      };
    } catch (error) {
      console.error('❌ Error refreshing flash sale products:', error);
      return { products: [], hasMore: false };
    } finally {
      // Always reset loading flag
      this.isLoading = false;
      this.loadingPromise = null;
    }
  }

  /**
   * Trigger real-time sync untuk flash sale changes
   */
  triggerRealTimeSync(): void {
    console.log('🔄 Flash sale: Triggering real-time sync...');

    // Clear cache force refresh
    this.clearCache();

    // Trigger cross-device sync
    localStorage.setItem('flashsale_sync_trigger', Date.now().toString());
    setTimeout(() => {
      localStorage.removeItem('flashsale_sync_trigger');
    }, 100);
  }

  /**
   * Listen untuk real-time sync
   */
  onRealTimeSync(callback: () => void): () => void {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'flashsale_sync_trigger') {
        console.log('🔄 Flash sale: Real-time sync detected from other device');
        callback();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }
}

export const flashSaleCache = new FlashSaleCache();