import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, startAfter, where, getDocs, doc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';

export const useFirebaseProductsRealTimeSimple = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);

  // 🔥 OPTIMIZED: Try batch system first, fallback to legacy
  const loadProducts = useCallback(async (loadMore = false) => {
    try {
      // Set loading state differently for loadMore
      if (!loadMore) {
        setLoading(true);
        setError(null);
        setProducts([]); // Reset products for fresh load
        setLastVisible(null);
      }

      console.log('🔄 Loading products from Firestore (BATCH SYSTEM)...');

      // 🔥 STEP 1: Try Batch System First
      try {
        const batchRef = doc(db, 'productBatches', 'batch_1');
        const batchSnap = await getDoc(batchRef);

        if (batchSnap.exists()) {
          const batchData = batchSnap.data();
          const allProducts = batchData.products || [];

          if (allProducts.length > 0) {
            console.log(`✅ BATCH SUCCESS: Loaded ${allProducts.length} products from batch (1 read vs ${allProducts.length} reads)`);
            console.log(`💰 Cost savings: ${allProducts.length - 1} reads saved (${Math.round((allProducts.length - 1) / allProducts.length * 100)}%)`);

            // Sort by createdAt (terbaru dulu)
            allProducts.sort((a: any, b: any) => {
              const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
              const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
              return dateB.getTime() - dateA.getTime();
            });

            // Pagination logic
            const pageSize = 20;
            const startIndex = loadMore ? products.length : 0;
            const endIndex = startIndex + pageSize;
            const pageProducts = allProducts.slice(startIndex, endIndex);

            if (loadMore) {
              setProducts(prev => [...prev, ...pageProducts]);
            } else {
              setProducts(pageProducts);
            }

            setHasMore(endIndex < allProducts.length);
            setLoading(false);

            // Set last visible for pagination
            if (pageProducts.length > 0) {
              const lastProduct = pageProducts[pageProducts.length - 1];
              setLastVisible(lastProduct);
            }

            return; // ✅ Success - exit function
          }
        }
      } catch (batchError) {
        console.log('⚠️ Batch system failed, falling back to legacy system:', batchError);
      }

      // 🔄 STEP 2: Fallback to Legacy System
      console.log('🔄 Using legacy product system...');
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
  }, []); // ✅ Empty dependency - only run once

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