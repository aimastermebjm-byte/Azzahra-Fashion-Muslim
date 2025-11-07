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
      setProducts(cachedProducts);
      setLoading(false);
      setIsInitialLoad(false);
    }

    // STEP 2: Set up real-time listener with PROPER DEPENDENCIES
    const productsRef = collection(db, 'products');
    const q = query(
      productsRef,
      orderBy('createdAt', 'desc'),
      limitCount(productsPerPage)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('📊 Firestore products updated:', snapshot.docs.length, 'products');

      const productsData: Product[] = snapshot.docs.map((doc) => {
        const data = doc.data();

        // Calculate total stock from variants if available
        const stock = Number(data.stock || 0);
        const calculatedTotalStock = data.variants?.stock ?
          Object.values(data.variants.stock).reduce((total: number, sizeStock: any) => {
            return total + Object.values(sizeStock as any).reduce((sizeTotal: number, colorStock: any) => {
              return sizeTotal + Number(colorStock || 0);
            }, 0);
          }, 0) : stock;

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
          variants: {
            sizes: data.variants?.sizes || data.sizes || [],
            colors: data.variants?.colors || data.colors || [],
            stock: data.variants?.stock || {}
          },
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

      setProducts(productsData);
      setLoading(false);
      setIsInitialLoad(false);

      // Save to cache
      saveToCache(productsData);

      // Set pagination info
      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === productsPerPage);
      } else {
        setHasMore(false);
      }
    }, (error) => {
      console.error('❌ Error fetching products:', error);
      setError(error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [productsPerPage]); // FIXED: Only primitive dependency to prevent infinite loop

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
    } catch (error) {
      console.error('❌ Error deleting product:', error);
      throw error;
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
    } catch (error) {
      console.error('❌ Error updating stock:', error);
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
    loadMoreProducts
  };
};