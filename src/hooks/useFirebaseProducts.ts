import { useState, useEffect, useCallback, useRef } from 'react';
import { Product } from '../types';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit as limitCount,
  startAfter
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { invalidateProductCache } from '../utils/productCache';

export const useFirebaseProducts = () => {

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false); // 🔥 DISABLE AUTO LOADING
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(20); // Fixed 20 produk untuk infinite scroll seperti Shopee
  const isUpdatingStockRef = useRef(false);

  // Manual refresh function untuk cross-device sync dan stock restoration - dipindahkan ke atas
  const refreshProducts = useCallback(async () => {
    try {
      console.log('🔄 Manual refresh dimulai - ambil data terbaru');
      setLoading(true);

      const productsRef = collection(db, 'products');
      const q = query(
        productsRef,
        orderBy('createdAt', 'desc'),
        limitCount(productsPerPage)
      );

      const querySnapshot = await getDocs(q);
      console.log('📊 Refresh: Produk diambil dari Firestore:', querySnapshot.docs.length, 'produk');

      const productsData: Product[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        // Calculate total stock from variants if available
        const stock = Number(data.stock || 0);
        const calculatedTotalStock = data.variants?.stock ?
          Object.values(data.variants.stock).reduce((total: number, sizeStock: any) => {
            return total + Object.values(sizeStock as any).reduce((sizeTotal: number, colorStock: any) => {
              return sizeTotal + Number(colorStock || 0);
            }, 0);
          }, 0) : stock;

        const variantsData = {
          sizes: data.variants?.sizes || data.sizes || [],
          colors: data.variants?.colors || data.colors || [],
          stock: data.variants?.stock && typeof data.variants?.stock === 'object' ? data.variants.stock : {}
        };

        return {
          id: doc.id,
          name: data.name || '',
          description: data.description || '',
          category: data.category || 'uncategorized',
          retailPrice: Number(data.retailPrice || data.price || 0),
          resellerPrice: Number(data.resellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          costPrice: Number(data.costPrice) || Number(data.retailPrice || data.price || 0) * 0.6,
          stock: calculatedTotalStock,
          images: (data.images || []),
          image: data.images?.[0] || '/placeholder-product.jpg',
          variants: variantsData,
          isFeatured: Boolean(data.isFeatured || data.featured),
          isFlashSale: Boolean(data.isFlashSale),
          flashSalePrice: Number(data.flashSalePrice) || Number(data.retailPrice || data.price || 0),
          originalRetailPrice: Number(data.originalRetailPrice) || Number(data.retailPrice || data.price || 0),
          originalResellerPrice: Number(data.originalResellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt?.toDate()) : new Date(),
          salesCount: Number(data.salesCount) || 0,
          featuredOrder: Number(data.featuredOrder) || 0,
          weight: Number(data.weight) || 0,
          unit: 'gram',
          status: data.status || (data.condition === 'baru' ? 'ready' : 'po') || 'ready',
          estimatedReady: data.estimatedReady ? new Date(data.estimatedReady) : undefined
        };
      });

      // Force update untuk cross-device synchronization
      setProducts(productsData);
      setLoading(false);
      console.log('✅ Manual refresh selesai - semua data diperbarui');

      // Log info untuk debugging cross-device sync
      const featuredCount = productsData.filter(p => p.isFeatured).length;
      const flashSaleCount = productsData.filter(p => p.isFlashSale).length;
      console.log(`📊 Refresh stats: ${featuredCount} produk unggulan, ${flashSaleCount} flash sale`);

    } catch (error) {
      console.error('❌ Error refreshing products:', error);
      setError(error instanceof Error ? error.message : 'Unknown error refreshing products');
      setLoading(false);
    }
  }, [productsPerPage]);

  // 🔥 DISABLED: INITIAL LOAD - Using batch system instead
  // useEffect(() => {
  //   console.log('🔄 Loading initial products...');
  //   refreshProducts();
  // }, []); // Empty dependency untuk initial load only

  // CROSS-DEVICE EVENT SYSTEM: Refresh menggunakan localStorage events
  useEffect(() => {
    console.log('🔄 Setting up cross-device event-based refresh...');

    // Listen untuk localStorage changes (bekerja cross-device di browser yang sama)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'product_change_trigger') {
        console.log('📦 Cross-device product change detected - refreshing...');
        refreshProducts();
      } else if (event.key === 'featured_products_change_trigger') {
        console.log('⭐ Cross-device featured products change detected - refreshing...');
        refreshProducts();
      } else if (event.key === 'flash_sale_change_trigger') {
        console.log('🔥 Cross-device flash sale change detected - refreshing...');
        refreshProducts();
      } else if (event.key === 'stock_change_trigger') {
        console.log('📊 Cross-device stock change detected - IMMEDIATE refresh...');
        refreshProducts();
      } else if (event.key === 'stock_depleted_trigger') {
        console.log('🚨 Cross-device stock DEPLETED detected - URGENT refresh...');
        refreshProducts();
      } else if (event.key === 'stock_low_trigger') {
        console.log('⚠️ Cross-device stock LOW detected - priority refresh...');
        refreshProducts();
      } else if (event.key === 'stock_sync_fallback') {
        console.log('🔄 Cross-device stock sync fallback detected - refresh...');
        refreshProducts();
      }
    };

    // Listen untuk window events (untuk same tab refresh)
    const handleProductsChanged = () => {
      console.log('📦 Products changed event received - refreshing...');
      refreshProducts();
    };

    const handleFeaturedProductsChanged = () => {
      console.log('⭐ Featured products changed event received - refreshing...');
      refreshProducts();
    };

    const handleFlashSaleChanged = () => {
      console.log('🔥 Flash sale changed event received - refreshing...');
      refreshProducts();
    };

    const handleStockChanged = () => {
      console.log('📊 Stock changed event received - refreshing...');
      refreshProducts();
    };

    const handleOrderCancelled = () => {
      console.log('❌ Order cancelled event received - refreshing...');
      refreshProducts();
    };

    // 🔥 DISABLED: Event listeners causing infinite loop
    // User will control flash sale manually through admin dashboard
    // Register localStorage event listener (cross-device)
    // window.addEventListener('storage', handleStorageChange);

    // Register window event listeners (same tab)
    // window.addEventListener('productsChanged', handleProductsChanged);
    // window.addEventListener('featuredProductsChanged', handleFeaturedProductsChanged);
    // window.addEventListener('flashSaleChanged', handleFlashSaleChanged);
    // window.addEventListener('stockChanged', handleStockChanged);
    // window.addEventListener('orderCancelled', handleOrderCancelled);

    // Cleanup
    return () => {
      // 🔥 DISABLED: Event listeners causing infinite loop
      // window.removeEventListener('storage', handleStorageChange);
      // window.removeEventListener('productsChanged', handleProductsChanged);
      // window.removeEventListener('featuredProductsChanged', handleFeaturedProductsChanged);
      // window.removeEventListener('flashSaleChanged', handleFlashSaleChanged);
      // window.removeEventListener('stockChanged', handleStockChanged);
      // window.removeEventListener('orderCancelled', handleOrderCancelled);
      console.log('🔄 Cross-device event-based refresh DISABLED to prevent infinite loop');
    };
  }, []); // Empty dependency, refreshProducts akan dipanggil dengan reference terbaru

  // Firebase operations - RE-ENABLED with safety
  const addProduct = async (productData: any) => {
    try {
      console.log('💾 Adding product to Firestore:', productData.name);

      // Ensure variants data is properly saved
      const docRef = await addDoc(collection(db, 'products'), {
        name: productData.name,
        description: productData.description || '',
        category: productData.category || 'uncategorized',
        retailPrice: Number(productData.retailPrice) || 0,
        resellerPrice: Number(productData.resellerPrice) || 0,
        costPrice: Number(productData.costPrice) || 0,
        weight: Number(productData.weight) || 0,
        stock: productData.stock || 0,
        images: productData.images || [],
        // IMPORTANT: Save variants with proper structure
        variants: {
          sizes: productData.variants?.sizes || [],
          colors: productData.variants?.colors || [],
          stock: productData.variants?.stock || {}
        },
        status: productData.status || 'ready',
        // Use both fields for consistency
        featured: productData.isFeatured || false,
        isFeatured: productData.isFeatured || false,
        isFlashSale: productData.isFlashSale || false,
        flashSalePrice: Number(productData.flashSalePrice) || Number(productData.retailPrice) || 0,
        salesCount: 0,
        unit: 'gram',
        createdAt: new Date()
      });

      console.log('✅ Product added successfully:', docRef.id);

      // CACHE INVALIDATION: Invalidate all cache when new product is added
      invalidateProductCache({
        type: 'product_update',
        productIds: [docRef.id],
        timestamp: Date.now(),
        triggerBy: 'admin'
      });

      // Trigger cross-device refresh menggunakan localStorage
      localStorage.setItem('product_change_trigger', Date.now().toString());

      // Trigger same-tab refresh
      window.dispatchEvent(new CustomEvent('productsChanged', {
        detail: { action: 'added', productId: docRef.id }
      }));

      return docRef;
    } catch (error) {
      console.error('❌ Error adding product:', error);
      throw error;
    }
  };

  const updateProduct = async (id: string, updates: any) => {
    try {
      const docRef = doc(db, 'products', id);

      // Handle featured products: update both fields for consistency
      if ('isFeatured' in updates) {
        updates.featured = updates.isFeatured;
      }

      console.log('📝 Updating product:', id, updates);
      await updateDoc(docRef, updates);
      console.log('✅ Product updated successfully');

      // CACHE INVALIDATION: Invalidate appropriate cache based on update type
      let invalidationType: 'product_update' | 'featured_update' | 'flashsale_update' = 'product_update';
      if ('isFeatured' in updates) {
        invalidationType = 'featured_update';
      } else if ('isFlashSale' in updates) {
        invalidationType = 'flashsale_update';
      }

      invalidateProductCache({
        type: invalidationType,
        productIds: [id],
        timestamp: Date.now(),
        triggerBy: 'admin'
      });

      // Trigger cross-device refresh menggunakan localStorage
      if ('isFeatured' in updates) {
        localStorage.setItem('featured_products_change_trigger', Date.now().toString());
      } else if ('isFlashSale' in updates) {
        localStorage.setItem('flash_sale_change_trigger', Date.now().toString());
      } else {
        localStorage.setItem('product_change_trigger', Date.now().toString());
      }

      // 🔥 DISABLED: Event dispatching causing infinite loop
      // Admin dashboard will handle refresh manually
      // Trigger same-tab refresh
      // let eventType = 'productsChanged';
      // if ('isFeatured' in updates) {
      //   eventType = 'featuredProductsChanged';
      // } else if ('isFlashSale' in updates) {
      //   eventType = 'flashSaleChanged';
      // }

      // window.dispatchEvent(new CustomEvent(eventType, {
      //   detail: { action: 'updated', productId: id, changes: updates }
      // }));

    } catch (error) {
      console.error('❌ Error updating product:', error);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      console.log('🗑️ Deleting product:', id);
      await deleteDoc(doc(db, 'products', id));
      console.log('✅ Product deleted successfully');

      // CACHE INVALIDATION: Invalidate all cache when product is deleted
      invalidateProductCache({
        type: 'product_update',
        productIds: [id],
        timestamp: Date.now(),
        triggerBy: 'admin'
      });

      // Trigger cross-device refresh menggunakan localStorage
      localStorage.setItem('product_change_trigger', Date.now().toString());

      // Trigger same-tab refresh
      window.dispatchEvent(new CustomEvent('productsChanged', {
        detail: { action: 'deleted', productId: id }
      }));

    } catch (error) {
      console.error('❌ Error deleting product:', error);
      throw error;
    }
  };

  const updateProductStock = async (id: string, quantity: number, variantInfo?: { size: string; color: string }) => {
    try {
      const docRef = doc(db, 'products', id);
      const product = products.find(p => p.id === id);
      if (!product) {
        console.error('❌ Product not found:', id);
        return 0;
      }

      // OPTIMIZED: Kurangi debug logging untuk performa checkout
      console.log('🔄 Reducing stock:', id, 'Qty:', quantity);

      // CRITICAL: Set flag to prevent real-time listener race conditions
      isUpdatingStockRef.current = true;

      // Get current document to ensure we have the latest data
      const currentDoc = await getDoc(docRef);
      if (!currentDoc.exists()) {
        console.error('❌ Product document not found:', id);
        return 0;
      }

      const currentData = currentDoc.data();
      const currentStock = Number(currentData.stock || 0);
      const newStock = Math.max(0, currentStock - quantity);

      const updateData: any = { stock: newStock };

      // Handle variant stock reduction if variant info is provided
      if (variantInfo && product.variants?.sizes && product.variants?.colors) {
        const { size, color } = variantInfo;

        // Get current variant stock structure
        let currentVariantStock = currentData.variants?.stock || {};

        // MIGRATION: If no variant stock structure exists, create it from total stock
        if (!currentVariantStock || Object.keys(currentVariantStock).length === 0) {
          const totalVariants = product.variants.sizes.length * product.variants.colors.length;
          const stockPerVariant = Math.floor(currentStock / totalVariants);

          currentVariantStock = {};
          product.variants.sizes.forEach((s: string) => {
            currentVariantStock[s] = {};
            product.variants.colors.forEach((c: string) => {
              currentVariantStock[s][c] = stockPerVariant;
            });
          });
        }

        // Create deep copy of variant stock structure
        const updatedVariantStock = JSON.parse(JSON.stringify(currentVariantStock));

        // Reduce stock for specific variant
        if (updatedVariantStock[size] && updatedVariantStock[size][color] !== undefined) {
          const currentVariantStockValue = Number(updatedVariantStock[size][color] || 0);
          const newVariantStock = Math.max(0, currentVariantStockValue - quantity);
          updatedVariantStock[size][color] = newVariantStock;

          console.log(`📦 Variant ${size}-${color}: ${currentVariantStockValue} → ${newVariantStock}`);

          updateData.variants = {
            ...currentData.variants,
            stock: updatedVariantStock
          };
        }
      }

      // Perform the update - OPTIMIZED: tanpa debug logging yang berlebihan
      await updateDoc(docRef, updateData);

      // CACHE INVALIDATION: Invalidate cache when stock changes
      invalidateProductCache({
        type: 'stock_change',
        productIds: [id],
        timestamp: Date.now(),
        triggerBy: 'system'
      });

      // OPTIMISTIC UPDATE: Cepat untuk UI response
      setProducts(prev => prev.map(p =>
        p.id === id
          ? {
              ...p,
              stock: newStock,
              variants: updateData.variants || p.variants
            }
          : p
      ));

      // CRITICAL: Reset flag setelah update berhasil
      isUpdatingStockRef.current = false;

      // ENHANCED CROSS-DEVICE SYNC: Multiple triggers untuk reliability
      const timestamp = Date.now().toString();

      // 1. Primary stock change trigger
      localStorage.setItem('stock_change_trigger', timestamp);

      // 2. Additional specific triggers untuk different scenarios
      if (newStock === 0) {
        localStorage.setItem('stock_depleted_trigger', timestamp);
        console.log('🚨 Stock depleted trigger sent for product:', id);
      } else if (newStock <= 5) {
        localStorage.setItem('stock_low_trigger', timestamp);
        console.log('⚠️ Stock low trigger sent for product:', id, 'Stock:', newStock);
      }

      // 3. Fallback trigger dengan delay untuk reliability
      setTimeout(() => {
        localStorage.setItem('stock_sync_fallback', timestamp);
      }, 100);

      // 4. Same-tab refresh dengan enhanced detail
      window.dispatchEvent(new CustomEvent('stockChanged', {
        detail: {
          action: 'stock_updated',
          productId: id,
          newStock,
          oldStock: oldStock,
          variantInfo,
          timestamp,
          isDepleted: newStock === 0,
          isLow: newStock <= 5
        }
      }));

      // 5. Additional event untuk immediate sync
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('immediateStockSync', {
          detail: { productId: id, newStock, timestamp }
        }));
      }, 50);

      console.log('🔄 Enhanced stock sync triggers sent for product:', id, 'New stock:', newStock);
      return newStock;
    } catch (error) {
      console.error('❌ Error updating stock:', error);
      // IMPORTANT: Reset flag on error
      isUpdatingStockRef.current = false;
      throw error;
    }
  };

  // Load more products for infinite scroll
  const loadMoreProducts = useCallback(async () => {
    if (!hasMore || loading) return;

    setLoading(true);
    try {
      const productsRef = collection(db, 'products');
      const q = query(
        productsRef,
        orderBy('createdAt', 'desc'),
        startAfter(lastVisible),
        limitCount(productsPerPage)
      );

      const querySnapshot = await getDocs(q);
      const newProducts: Product[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const stock = Number(data.stock || 0);
        const calculatedTotalStock = data.variants?.stock ?
          Object.values(data.variants.stock).reduce((total: number, sizeStock: any) => {
            return total + Object.values(sizeStock as any).reduce((sizeTotal: number, colorStock: any) => {
              return sizeTotal + Number(colorStock || 0);
            }, 0);
          }, 0) : stock;

        newProducts.push({
          id: doc.id,
          name: data.name || '',
          description: data.description || '',
          category: data.category || 'uncategorized',
          retailPrice: Number(data.retailPrice || data.price || 0),
          resellerPrice: Number(data.resellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          costPrice: Number(data.costPrice) || Number(data.retailPrice || data.price || 0) * 0.6,
          stock: calculatedTotalStock,
          images: (data.images || []),
          image: data.images?.[0] || '/placeholder-product.jpg',
          variants: {
            sizes: data.variants?.sizes || data.sizes || [],
            colors: data.variants?.colors || data.colors || [],
            stock: data.variants?.stock || {}
          },
          status: data.status || (data.condition === 'baru' ? 'ready' : 'po') || 'ready',
          isFlashSale: Boolean(data.isFlashSale),
          flashSalePrice: Number(data.flashSalePrice) || Number(data.retailPrice || data.price || 0),
          createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt?.toDate()) : new Date(),
          salesCount: Number(data.salesCount) || 0,
          isFeatured: Boolean(data.isFeatured || data.featured),
          featuredOrder: Number(data.featuredOrder) || 0,
          weight: Number(data.weight) || 0,
          unit: data.unit || 'gram',
          estimatedReady: data.estimatedReady ? new Date(data.estimatedReady) : undefined
        });
      });

      if (newProducts.length > 0) {
        setProducts(prev => [...prev, ...newProducts]);
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setCurrentPage(prev => prev + 1);

        if (newProducts.length < productsPerPage) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('❌ Error loading more products:', error);
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, lastVisible, productsPerPage]);

  
  return {
    products,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    updateProductStock,
    setProducts,
    hasMore,
    currentPage,
    productsPerPage,
    setCurrentPage,
    loadMoreProducts,
    refreshProducts
  };
};