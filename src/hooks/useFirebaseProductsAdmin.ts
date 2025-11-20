import { useState, useEffect } from 'react';
import { auth } from '../utils/firebaseClient';
import { collection, query, getDocs, where, doc, setDoc } from 'firebase/firestore';
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

        console.log('🔄 Loading products for admin from BATCH SYSTEM...');

        // 🔥 BATCH SYSTEM: Read from productBatches like website
        const batchRef = collection(db, 'productBatches');
        const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
        const batchSnapshot = await getDocs(batchQuery);

        if (batchSnapshot.empty || !batchSnapshot.docs[0].exists()) {
          console.log('❌ Batch system not found');
          setProducts([]);
          setLoading(false);
          setInitialLoad(false);
          return;
        }

        const batchData = batchSnapshot.docs[0].data();
        const allProducts = batchData.products || [];
        console.log('📦 Products loaded from batch:', allProducts.length, 'products');

        const loadedProducts: Product[] = [];
        allProducts.forEach((data: any) => {

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
            id: data.id,
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

    // Setup simple cross-tab cache invalidation listener for admin
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'azzahra_cache_invalidation') {
        const data = JSON.parse(event.newValue || '{}');
        if (data.type === 'products') {
          console.log('🔄 Admin: Cross-tab cache invalidation detected - reloading products...');
          // Debounce reload to prevent infinite loops
          setTimeout(() => loadProducts(), 100);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 🔥 BATCH SYSTEM: Update product in batch (not individual collection)
  const updateProduct = async (id: string, updates: any) => {
    try {
      console.log('📝 Updating product in BATCH SYSTEM:', { id, updates });

      // Get current batch
      const batchRef = collection(db, 'productBatches');
      const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
      const batchSnapshot = await getDocs(batchQuery);

      if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
        const batchDoc = batchSnapshot.docs[0];
        const batchData = batchDoc.data();
        let products = batchData.products || [];

        // Find and update the product
        products = products.map((product: any) => {
          if (product.id === id) {
            console.log('✅ Found product to update:', product.name);
            return { ...product, ...updates };
          }
          return product;
        });

        // Update the batch
        await setDoc(doc(db, 'productBatches', 'batch_1'), {
          ...batchData,
          products: products,
          totalProducts: products.length,
          updatedAt: new Date().toISOString()
        });

        console.log('✅ Product updated successfully in batch system');

        // Update local state immediately (cache invalidation will be handled by onSnapshot listeners)
        setProducts(prev => prev.map(product =>
          product.id === id ? { ...product, ...updates } : product
        ));

      } else {
        console.error('❌ Batch system not found');
      }
    } catch (error) {
      console.error('❌ Error updating product in batch:', error);
      throw error;
    }
  };

  // 🔥 BATCH SYSTEM: Update product stock in batch (not individual collection)
  const updateProductStock = async (id: string, quantity: number, variantInfo?: { size: string; color: string }) => {
    try {
      console.log('🔄 Reducing stock from BATCH SYSTEM:', { id, quantity, variantInfo });

      // Get current batch
      const batchRef = collection(db, 'productBatches');
      const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
      const batchSnapshot = await getDocs(batchQuery);

      if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
        const batchDoc = batchSnapshot.docs[0];
        const batchData = batchDoc.data();
        let products = batchData.products || [];

        // Find and update stock for the product
        products = products.map((product: any) => {
          if (product.id === id) {
            console.log('✅ Found product to update stock:', product.name);

            let updatedProduct = { ...product };

            if (variantInfo?.size && variantInfo?.color && product.variants?.stock) {
              // Update variant stock
              const { size, color } = variantInfo;
              const currentVariantStock = Number(product.variants.stock[size]?.[color] || 0);
              const newVariantStock = Math.max(0, currentVariantStock - quantity);

              updatedProduct.variants = {
                ...product.variants,
                stock: {
                  ...product.variants.stock,
                  [size]: {
                    ...(product.variants.stock[size] || {}),
                    [color]: newVariantStock
                  }
                }
              };

              // Also update total stock
              const totalStock = Number(product.stock || 0);
              updatedProduct.stock = Math.max(0, totalStock - quantity);

              console.log(`📦 Variant stock updated: ${size}-${color}: ${currentVariantStock} → ${newVariantStock}`);
            } else {
              // Update total stock only
              const currentStock = Number(product.stock || 0);
              const newStock = Math.max(0, currentStock - quantity);
              updatedProduct.stock = newStock;

              console.log(`📦 Total stock updated: ${currentStock} → ${newStock}`);
            }

            return updatedProduct;
          }
          return product;
        });

        // Update the batch
        await setDoc(doc(db, 'productBatches', 'batch_1'), {
          ...batchData,
          products: products,
          totalProducts: products.length,
          updatedAt: new Date().toISOString()
        });

        console.log('✅ Product stock updated successfully in batch system');

        // Cache invalidation will be handled by onSnapshot listeners in cacheInvalidation.ts
        return quantity;

      } else {
        console.error('❌ Batch system not found for stock update');
        return 0;
      }
    } catch (error) {
      console.error('❌ Error updating product stock in batch:', error);
      return 0;
    }
  };

  return { products, loading: loading && initialLoad, error, initialLoad, updateProduct, updateProductStock };
};