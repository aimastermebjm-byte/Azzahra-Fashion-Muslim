import { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import {
  collection,
  getDocs,
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
import { db, convertFirebaseUrl } from '../utils/firebaseClient';
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
  const { saveToCache, getFromCache, isCacheValid } = useProductCache();

  useEffect(() => {
    const startTime = performance.now();

    // STEP 1: Check cache first for instant loading
    const cachedProducts = getFromCache();
    if (cachedProducts) {
      console.log('🚀 Instant load from cache -', cachedProducts.length, 'products');
      setProducts(cachedProducts);
      setLoading(false); // Instant loading!
      setIsInitialLoad(false);
    }

    // STEP 2: Set up real-time listener for updates - RESPONSIVE PAGINATION
    const productsRef = collection(db, 'products');
    const q = query(
      productsRef,
      orderBy('createdAt', 'desc'),
      limitCount(productsPerPage) // Dynamic limit based on device
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const processingStartTime = performance.now();

      // Optimized data processing with reduced calculations
      const productsData: Product[] = snapshot.docs.map((doc) => {
        const data = doc.data();

        // Optimized date processing
        const createdAt = data.createdAt ?
          (typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt?.toDate()) :
          new Date();

        // Optimized price calculations with single Number() conversion
        const retailPrice = Number(data.retailPrice || data.price || 0);
        const stock = Number(data.stock || 0);

        // Calculate total stock from variants if available
        const calculatedTotalStock = data.variants?.stock ?
          Object.values(data.variants.stock).reduce((total: number, sizeStock: any) => {
            return total + Object.values(sizeStock as any).reduce((sizeTotal: number, colorStock: any) => {
              return sizeTotal + Number(colorStock || 0);
            }, 0);
          }, 0) : stock;

        
        // Debug for specific products to understand data structure
        if (data.name?.includes('Gamis') || data.name?.includes('Set')) {
          console.log(`🔍 Product: ${data.name}`, {
            originalStock: stock,
            calculatedTotalStock,
            hasVariants: !!data.variants,
            hasVariantStock: !!data.variants?.stock,
            variantsSizes: data.variants?.sizes,
            variantsColors: data.variants?.colors,
            variantsStock: data.variants?.stock,
            separateSizes: data.sizes,
            separateColors: data.colors,
            fullVariants: data.variants
          });
        }

        return {
          id: doc.id,
          name: data.name || '',
          description: data.description || '',
          category: data.category || 'uncategorized',
          retailPrice,
          resellerPrice: Number(data.resellerPrice) || retailPrice * 0.8,
          costPrice: Number(data.costPrice) || retailPrice * 0.6,
          stock: calculatedTotalStock,
          images: (data.images || []),
          image: data.images?.[0] || '/placeholder-product.jpg',
          variants: {
            sizes: data.variants?.sizes || data.sizes || [],
            colors: data.variants?.colors || data.colors || [],
            stock: data.variants?.stock || {}
          },
          isFeatured: Boolean(data.isFeatured || data.featured),
          isFlashSale: Boolean(data.isFlashSale),
          flashSalePrice: Number(data.flashSalePrice) || retailPrice,
          originalRetailPrice: Number(data.originalRetailPrice) || retailPrice,
          originalResellerPrice: Number(data.originalResellerPrice) || retailPrice * 0.8,
          createdAt,
          salesCount: Number(data.salesCount) || 0,
          featuredOrder: Number(data.featuredOrder) || 0,
          weight: Number(data.weight) || 0, // Remove default 1000, use 0 or actual weight
          unit: 'gram',
          status: data.status ||
                  (data.condition === 'baru' ? 'ready' : 'po') ||
                  'ready', // Default to 'ready' instead of based on stock calculation
          estimatedReady: data.estimatedReady ? new Date(data.estimatedReady) : undefined
        };
      });

      // Only show performance logs on initial load to reduce console spam
      if (isInitialLoad) {
        const processingTime = performance.now() - processingStartTime;
        const totalTime = performance.now() - startTime;

        console.log(`   - Processing time: ${processingTime.toFixed(2)}ms`);
        console.log(`   - Total time: ${totalTime.toFixed(2)}ms`);
        console.log(`📊 Initial load complete. Total products: ${productsData.length}`);
        setIsInitialLoad(false);
      } else {
        // Silent real-time updates
        console.log('🔄 Products updated in real-time');
      }

      // Save to cache for future instant loading
      saveToCache(productsData);

      setProducts(productsData);

      // Set pagination info for infinite scroll
      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === productsPerPage);
      } else {
        setHasMore(false);
      }

      setLoading(false); // Set loading false after first load
    });

    return () => unsubscribe();
  }, [productsPerPage, saveToCache, getFromCache]); // Add dependencies

  const addProduct = async (productData: any) => {
    try {
      const docRef = await addDoc(collection(db, 'products'), {
        name: productData.name,
        description: productData.description || '',
        category: productData.category || 'uncategorized',
        price: productData.retailPrice,
        resellerPrice: productData.resellerPrice,
        costPrice: productData.costPrice,
        stock: productData.stock || 0,
        images: productData.images || [],
        sizes: productData.sizes || [],
        colors: productData.colors || [],
        // Use both fields for consistency
        featured: productData.isFeatured || false,
        isFeatured: productData.isFeatured || false,
        isFlashSale: productData.isFlashSale || false,
        flashSalePrice: productData.flashSalePrice || productData.retailPrice,
        salesCount: 0,
        unit: productData.unit || 'gram',
        createdAt: new Date()
      });
      console.log('✅ Product added with ID:', docRef.id);
    } catch (err) {
      console.error('❌ Error adding product:', err);
      throw err;
    }
  };

  const updateProduct = async (id: string, updates: any) => {
    try {
      const docRef = doc(db, 'products', id);

      // Handle featured products: update both isFeatured and featured fields for consistency
      if ('isFeatured' in updates) {
        updates.isFeatured = updates.isFeatured;
        updates.featured = updates.isFeatured; // Also update legacy field
      }

      await updateDoc(docRef, updates);
      console.log('✅ Product updated');
    } catch (err) {
      console.error('❌ Error updating product:', err);
      throw err;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const docRef = doc(db, 'products', id);
      await deleteDoc(docRef);
      console.log('✅ Product deleted');
    } catch (err) {
      console.error('❌ Error deleting product:', err);
      throw err;
    }
  };

  const updateProductStock = async (id: string, quantity: number) => {
    try {
      const docRef = doc(db, 'products', id);
      const product = products.find(p => p.id === id);
      if (product) {
        const newStock = Math.max(0, product.stock - quantity);
        await updateDoc(docRef, { stock: newStock });
        return newStock;
      }
      return 0;
    } catch (err) {
      console.error('❌ Error updating stock:', err);
      throw err;
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

        // Calculate total stock from variants if available
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
          images: (data.images || []),
          image: data.images?.[0] || '/placeholder-product.jpg',
          variants: {
            sizes: data.variants?.sizes || data.sizes || [],
            colors: data.variants?.colors || data.colors || [],
            stock: data.variants?.stock || {}
          },
          retailPrice: Number(data.retailPrice || data.price || 0),
          resellerPrice: Number(data.resellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          costPrice: Number(data.costPrice) || Number(data.retailPrice || data.price || 0) * 0.6,
          stock: calculatedTotalStock,
          status: data.status ||
                  (data.condition === 'baru' ? 'ready' : 'po') ||
                  'ready', // Default to 'ready' instead of based on stock calculation
          isFlashSale: Boolean(data.isFlashSale),
          flashSalePrice: Number(data.flashSalePrice) || Number(data.retailPrice || data.price || 0),
          originalRetailPrice: Number(data.originalRetailPrice) || Number(data.retailPrice || data.price || 0),
          originalResellerPrice: Number(data.originalResellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt?.toDate()) : new Date(),
          salesCount: Number(data.salesCount) || 0,
          isFeatured: Boolean(data.isFeatured || data.featured),
          featuredOrder: Number(data.featuredOrder) || 0,
          weight: Number(data.weight) || 0, // Remove default 1000, use 0 or actual weight
          unit: data.unit || 'gram',
          estimatedReady: data.estimatedReady ? new Date(data.estimatedReady) : undefined
        });
      });

      if (newProducts.length > 0) {
        setProducts(prev => [...prev, ...newProducts]);
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setCurrentPage(prev => prev + 1);

        // Check if there might be more products
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
    loadMoreProducts
  };
};