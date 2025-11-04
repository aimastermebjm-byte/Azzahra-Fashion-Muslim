import { useState, useEffect } from 'react';
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
  onSnapshot
} from 'firebase/firestore';
import { db, convertFirebaseUrl } from '../utils/firebaseClient';
import { useProductCache } from './useProductCache';

export const useFirebaseProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
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

    // STEP 2: Set up real-time listener for updates
    const productsRef = collection(db, 'products');
    const q = query(productsRef, orderBy('createdAt', 'desc'), limitCount(50));

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

        return {
          id: doc.id,
          name: data.name || '',
          description: data.description || '',
          category: data.category || 'uncategorized',
          retailPrice,
          resellerPrice: Number(data.resellerPrice) || retailPrice * 0.8,
          costPrice: Number(data.costPrice) || retailPrice * 0.6,
          stock,
          images: (data.images || []), // Remove convertFirebaseUrl for now
          image: data.images?.[0] || '/placeholder-product.jpg', // Remove convertFirebaseUrl
          variants: { sizes: data.sizes || [], colors: data.colors || [] },
          isFeatured: Boolean(data.isFeatured),
          isFlashSale: Boolean(data.isFlashSale),
          flashSalePrice: Number(data.flashSalePrice) || retailPrice,
          createdAt,
          salesCount: Number(data.salesCount) || 0,
          status: stock > 0 ? 'ready' : 'po'
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
      setLoading(false); // Set loading false after first load
    });

    return () => unsubscribe();
  }, []); // Remove dependencies to prevent re-render loop

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
        featured: productData.isFeatured || false,
        isFlashSale: productData.isFlashSale || false,
        flashSalePrice: productData.flashSalePrice || productData.retailPrice,
        salesCount: 0,
        unit: productData.unit || 'pcs',
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

  return {
    products,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    updateProductStock,
    setProducts
  };
};