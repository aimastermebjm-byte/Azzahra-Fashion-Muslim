import { useState, useEffect } from 'react';
import { auth } from '../utils/firebaseClient';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';

export const useFirebaseProductsAdmin = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setProducts([]);
          setLoading(false);
          setInitialLoad(false);
          return;
        }

        console.log('🔄 Loading products for admin (ONE-TIME READ)...');

        // One-time query for ALL products (admin)
        const productsRef = collection(db, 'products');
        const q = query(
          productsRef,
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        console.log('📦 Products loaded:', querySnapshot.docs.length, 'products');

        const loadedProducts: Product[] = [];
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

        // Log info untuk debugging
        const stockChangeCount = loadedProducts.filter(p => p.stock <= 5).length;
        console.log(`✅ Admin products loaded: ${stockChangeCount} products with low stock (<=5)`);

      } catch (error) {
        console.error('❌ Error loading admin products:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLoading(false);
        setInitialLoad(false);
      }
    };

    // Load products once on component mount
    loadProducts();
  }, []);

  return { products, loading: loading && initialLoad, error, initialLoad };
};