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
  onSnapshot,
  startAfter
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { useProductCache } from './useProductCache';

export const useFirebaseProducts = () => {

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(20); // Fixed 20 produk untuk infinite scroll seperti Shopee
  const { saveToCache } = useProductCache();
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

  // INITIAL LOAD: Load data pertama kali saat component mount
  useEffect(() => {
    console.log('🔄 Loading initial products...');
    refreshProducts();
  }, []); // Empty dependency untuk initial load only

  // SISTEM EVENT-BASED: Otomatis refresh tanpa real-time listener yang boros
  useEffect(() => {
    console.log('🔄 Setting up event-based product refresh...');

    // Listen untuk berbagai jenis perubahan produk
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

    // Register event listeners
    window.addEventListener('productsChanged', handleProductsChanged);
    window.addEventListener('featuredProductsChanged', handleFeaturedProductsChanged);
    window.addEventListener('flashSaleChanged', handleFlashSaleChanged);
    window.addEventListener('stockChanged', handleStockChanged);
    window.addEventListener('orderCancelled', handleOrderCancelled);

    // Cleanup
    return () => {
      window.removeEventListener('productsChanged', handleProductsChanged);
      window.removeEventListener('featuredProductsChanged', handleFeaturedProductsChanged);
      window.removeEventListener('flashSaleChanged', handleFlashSaleChanged);
      window.removeEventListener('stockChanged', handleStockChanged);
      window.removeEventListener('orderCancelled', handleOrderCancelled);
    };
  }, []); // Empty dependency, refreshProducts will be called with latest reference

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

      // Trigger event untuk refresh otomatis di semua device
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

      // Trigger event untuk refresh otomatis
      let eventType = 'productsChanged';
      if ('isFeatured' in updates) {
        eventType = 'featuredProductsChanged';
      } else if ('isFlashSale' in updates) {
        eventType = 'flashSaleChanged';
      }

      window.dispatchEvent(new CustomEvent(eventType, {
        detail: { action: 'updated', productId: id, changes: updates }
      }));

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

      // Trigger event untuk refresh otomatis
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

      // Trigger event untuk refresh otomatis stock
      window.dispatchEvent(new CustomEvent('stockChanged', {
        detail: { action: 'stock_updated', productId: id, newStock, variantInfo }
      }));

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