import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, startAfter, where, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';

export const useFirebaseProductsRealTimeSimple = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);

  // Simple direct Firestore read - NO CACHE
  const loadProducts = useCallback(async (loadMore = false) => {
    try {
      setLoading(true);
      setError(null);

      const productsRef = collection(db, 'products');

      // Simple query dengan fallback
      let q;
      try {
        q = query(
          productsRef,
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        console.log('✅ Products: Menggunakan indexed query');
      } catch (indexError: any) {
        if (indexError.message.includes('requires an index')) {
          console.log('⚠️ Products: Index tidak ditemukan, menggunakan fallback query');
          q = query(
            productsRef,
            limit(20)
          );
        } else {
          throw indexError;
        }
      }

      const querySnapshot = await getDocs(q);
      const newProducts: Product[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

  
        const processedProduct = {
          id: doc.id,
          name: data.name || '',
          description: data.description || '',
          category: data.category || '',
          retailPrice: Number(data.retailPrice || 0),
          resellerPrice: Number(data.resellerPrice || 0),
          costPrice: Number(data.costPrice || 0),
          stock: Number(data.stock || 0),
          images: Array.isArray(data.images) ? data.images : [],
          image: data.images?.[0] || data.image || '/placeholder-product.jpg',
          variants: data.variants || [],
          status: data.status || 'ready',
          isFlashSale: data.isFlashSale || false,
          flashSalePrice: data.flashSalePrice || null,
          originalRetailPrice: data.originalRetailPrice || null,
          originalResellerPrice: data.originalResellerPrice || null,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          salesCount: Number(data.salesCount || 0),
          isFeatured: data.isFeatured || false,
          featuredOrder: Number(data.featuredOrder || 0),
          weight: Number(data.weight || 0),
          unit: data.unit || 'gram',
          estimatedReady: data.estimatedReady?.toDate ? data.estimatedReady.toDate() : undefined
        };

        // DEBUG: Log processed image data
        if (newProducts.length < 3) {
          console.log(`📦 Processed Product ${newProducts.length + 1}:`);
          console.log('  - Processed image:', processedProduct.image);
          console.log('  - Processed images:', processedProduct.images);
          console.log('  - Final image src:', processedProduct.image || processedProduct.images?.[0] || '/placeholder-product.jpg');
          console.log('  - Will show placeholder:',
            (processedProduct.image || processedProduct.images?.[0] || '/placeholder-product.jpg') === '/placeholder-product.jpg'
          );
        }

        newProducts.push(processedProduct);
      });

      if (loadMore) {
        setProducts(prev => [...prev, ...newProducts]);
      } else {
        setProducts(newProducts);
      }

      setHasMore(newProducts.length === 20);
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);

      console.log(`✅ Loaded ${newProducts.length} products (loadMore: ${loadMore})`);
    } catch (error) {
      console.error('❌ Error loading products:', error);
      setError(error instanceof Error ? error.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    console.log('🔄 Loading products from Firestore (NO CACHE)...');
    loadProducts(false);
  }, [loadProducts]);

  // Load more function
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    console.log('🔄 Loading more products...');
    loadProducts(true);
  }, [loading, hasMore, loadProducts]);

  // Search products - simple direct query
  const searchProducts = useCallback(async (searchParams: any): Promise<any> => {
    try {
      console.log('🔍 Searching products (NO CACHE)...', searchParams);

      const productsRef = collection(db, 'products');
      let q = query(productsRef, limit(50));

      // Add filters
      if (searchParams.category && searchParams.category !== 'all') {
        q = query(q, where('category', '==', searchParams.category));
      }

      if (searchParams.status && searchParams.status !== 'all') {
        q = query(q, where('status', '==', searchParams.status));
      }

      // Try to add sorting with fallback
      try {
        if (searchParams.sortBy === 'termurah') {
          q = query(q, orderBy('retailPrice', 'asc'));
        } else {
          q = query(q, orderBy('createdAt', 'desc'));
        }
        console.log('✅ Search: Menggunakan indexed query');
      } catch (indexError: any) {
        if (indexError.message.includes('requires an index')) {
          console.log('⚠️ Search: Index tidak ditemukan, menggunakan fallback');
          // Client-side sorting akan dilakukan di frontend
        } else {
          throw indexError;
        }
      }

      const querySnapshot = await getDocs(q);
      const searchResults: Product[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        searchResults.push({
          id: doc.id,
          name: data.name || '',
          description: data.description || '',
          category: data.category || '',
          retailPrice: Number(data.retailPrice || 0),
          resellerPrice: Number(data.resellerPrice || 0),
          costPrice: Number(data.costPrice || 0),
          stock: Number(data.stock || 0),
          images: Array.isArray(data.images) ? data.images : [],
          image: data.images?.[0] || data.image || '/placeholder-product.jpg',
          variants: data.variants || [],
          status: data.status || 'ready',
          isFlashSale: data.isFlashSale || false,
          flashSalePrice: data.flashSalePrice || null,
          originalRetailPrice: data.originalRetailPrice || null,
          originalResellerPrice: data.originalResellerPrice || null,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          salesCount: Number(data.salesCount || 0),
          isFeatured: data.isFeatured || false,
          featuredOrder: Number(data.featuredOrder || 0),
          weight: Number(data.weight || 0),
          unit: data.unit || 'gram',
          estimatedReady: data.estimatedReady?.toDate ? data.estimatedReady.toDate() : undefined
        });
      });

      // Client-side filtering by search query
      let filteredResults = searchResults;
      if (searchParams.searchQuery) {
        const query = searchParams.searchQuery.toLowerCase();
        filteredResults = searchResults.filter(product =>
          product.name.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query)
        );
      }

      // Client-side sorting if needed
      if (searchParams.sortBy === 'termurah') {
        filteredResults.sort((a, b) => a.retailPrice - b.retailPrice);
      } else if (searchParams.sortBy === 'terbaru') {
        filteredResults.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }

      console.log(`✅ Search found ${filteredResults.length} products`);
      return {
        products: filteredResults,
        hasMore: false
      };
    } catch (error) {
      console.error('❌ Error searching products:', error);
      return {
        products: [],
        hasMore: false
      };
    }
  }, []);

  // Refresh function
  const refresh = useCallback(() => {
    console.log('🔄 Refreshing products...');
    loadProducts(false);
  }, [loadProducts]);

  return {
    products,
    loading,
    error,
    hasMore,
    loadMore,
    searchProducts,
    refresh
  };
};