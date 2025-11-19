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
      // Set loading state differently for loadMore
      if (!loadMore) {
        setLoading(true);
        setError(null);
        setProducts([]); // Reset products for fresh load
        setLastVisible(null);
      }

      const productsRef = collection(db, 'products');

      // Query with proper pagination
      let q;
      try {
        if (loadMore && lastVisible) {
          // Load next page
          q = query(
            productsRef,
            orderBy('createdAt', 'desc'),
            startAfter(lastVisible),
            limit(20)
          );
          console.log('✅ Products: Loading next page');
        } else {
          // Load first page
          q = query(
            productsRef,
            orderBy('createdAt', 'desc'),
            limit(20)
          );
          console.log('✅ Products: Loading first page');
        }
      } catch (indexError: any) {
        if (indexError.message.includes('requires an index')) {
          console.log('⚠️ Products: Index tidak ditemukan, menggunakan fallback query');
          if (loadMore && lastVisible) {
            q = query(
              productsRef,
              startAfter(lastVisible),
              limit(20)
            );
          } else {
            q = query(
              productsRef,
              limit(20)
            );
          }
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

        newProducts.push(processedProduct);
      });

      // Update state
      if (loadMore) {
        setProducts(prev => {
          const combined = [...prev, ...newProducts];
          console.log(`📄 Added ${newProducts.length} products. Total: ${combined.length}`);
          return combined;
        });
      } else {
        setProducts(newProducts);
        console.log(`📄 Loaded ${newProducts.length} products (first page)`);
      }

      // Update pagination state
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc || null);
      setHasMore(newProducts.length === 20);

    } catch (error) {
      console.error('❌ Error loading products:', error);
      setError(error instanceof Error ? error.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [lastVisible]);

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