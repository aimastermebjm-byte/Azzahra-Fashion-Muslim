import { useState, useEffect } from 'react';
import { auth } from '../utils/firebaseClient';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';

export const useFirebaseProductsAdmin = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupProductsListener = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setProducts([]);
          setLoading(false);
          setInitialLoad(false);
          return;
        }

        console.log('🔄 Setting up real-time products listener (ADMIN)...');

        // Set up real-time listener for ALL products (admin) - sama seperti orders
        const productsRef = collection(db, 'products');
        const q = query(
          productsRef,
          orderBy('createdAt', 'desc')
        );

        // Mobile-optimized query - sama seperti di orders
        const mobileOptimizedQuery = query(
          productsRef,
          orderBy('createdAt', 'desc')
        );

        unsubscribe = onSnapshot(
          mobileOptimizedQuery,
          (querySnapshot) => {
            console.log('📦 Real-time products update received:', querySnapshot.docs.length, 'products');

            const loadedProducts: Product[] = [];
            querySnapshot.forEach((doc) => {
              const data = doc.data();

              // Calculate total stock from variants if available - sama seperti di useFirebaseProducts
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

              loadedProducts.push({
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
              });
            });

            setProducts(loadedProducts);
            setLoading(false);
            setInitialLoad(false);
            setError(null);

            // Log stock update info untuk debugging
            const stockChangeCount = loadedProducts.filter(p => p.stock <= 5).length;
            console.log(`📊 Real-time sync complete: ${stockChangeCount} products with low stock (<=5)`);
          },
          async (error) => {
            console.error('❌ Error listening to admin products:', error);
            setError(error.message);
            setLoading(false);
            setInitialLoad(false);

            // Fallback - tidak perlu karena ini real-time listener
            console.warn('Real-time products listener failed, falling back to manual mode');
          }
        );
      } catch (error) {
        console.error('❌ Error setting up admin products listener:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLoading(false);
        setInitialLoad(false);
      }
    };

    // Mobile timeout protection - sama seperti di orders
    const mobileTimeout = setTimeout(() => {
      if (loading && initialLoad) {
        console.warn('⏰ Products loading taking too long, triggering fallback');
        setLoading(false);
        setInitialLoad(false);
        setError('Loading terlalu lama, silakan refresh halaman');
      }
    }, 8000); // 8 seconds timeout untuk mobile

    setupProductsListener();

    return () => {
      if (unsubscribe) {
        console.log('🔄 Unsubscribing from real-time products listener');
        unsubscribe();
      }
      if (mobileTimeout) {
        clearTimeout(mobileTimeout);
      }
    };
  }, []);

  return { products, loading: loading && initialLoad, error, initialLoad };
};