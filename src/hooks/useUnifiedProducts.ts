// Unified Product Hook - Single Read for All Product Data
// Firestore persistence dengan pembagian data cerdas untuk semua kebutuhan

import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';

export interface UseUnifiedProductsResult {
  // Semua produk
  allProducts: Product[];
  // Produk featured
  featuredProducts: Product[];
  // Produk flash sale
  flashSaleProducts: Product[];
  // Loading states
  loading: boolean;
  error: string | null;
  // Admin functions
  updateProductStock: (id: string, quantity: number, variantInfo?: { size: string; color: string }) => Promise<number>;
  refresh: () => Promise<void>;
}

export const useUnifiedProducts = (): UseUnifiedProductsResult => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  // 🔥 FIRESTORE PERSISTENCE: Single batch read untuk semua kebutuhan produk
  useEffect(() => {


    const batchRef = doc(db, 'productBatches', 'batch_1');

    // Setup real-time listener untuk sync otomatis tanpa read tambahan
    const unsubscribe = onSnapshot(batchRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const batchData = snapshot.data();
          const products = batchData.products || [];



          // Transform data products sekali saja
          const transformedProducts: Product[] = products.map((data: any) => {
            // 🔥 CRITICAL FIX: Prioritize calculated variant stock over main stock field
            let calculatedTotalStock = 0;

            if (data.variants?.stock && typeof data.variants?.stock === 'object') {
              // Calculate total from variants (ACCURATE)
              calculatedTotalStock = Object.values(data.variants.stock).reduce((total: number, sizeStock: any) => {
                return total + Object.values(sizeStock as any).reduce((sizeTotal: number, colorStock: any) => {
                  return sizeTotal + Number(colorStock || 0);
                }, 0);
              }, 0);
            } else {
              // Fallback to main stock field if no variants (ACCURATE)
              calculatedTotalStock = Number(data.stock || 0);
            }

            const variantsData = {
              sizes: data.variants?.sizes || data.sizes || [],
              colors: data.variants?.colors || data.colors || [],
              stock: data.variants?.stock && typeof data.variants?.stock === 'object' ? data.variants.stock : {}
            };

            return {
              id: data.id,
              name: data.name || '',
              description: data.description || '',
              category: data.category || 'uncategorized',
              retailPrice: Number(data.retailPrice) || 0,
              resellerPrice: Number(data.resellerPrice) || Number(data.retailPrice || 0) * 0.8,
              costPrice: Number(data.costPrice) || Number(data.retailPrice || 0) * 0.6,
              stock: calculatedTotalStock,
              images: (data.images || []),
              image: data.images?.[0] || '/placeholder-product.jpg',
              variants: variantsData,
              isFeatured: Boolean(data.isFeatured || data.featured),
              isFlashSale: Boolean(data.isFlashSale),
              flashSalePrice: Number(data.flashSalePrice) || Number(data.retailPrice || 0),
              createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt?.toDate()) : new Date(),
              salesCount: Number(data.salesCount) || 0,
              featuredOrder: Number(data.featuredOrder) || 0,
              weight: Number(data.weight) || 0,
              unit: 'gram',
              status: data.status || (data.condition === 'baru' ? 'ready' : 'po') || 'ready',
              estimatedReady: data.estimatedReady ? new Date(data.estimatedReady) : undefined,
              // 🔥 NEW: Variant-specific pricing for price range display
              pricesPerVariant: data.pricesPerVariant || null,
              costPricePerSize: data.costPricePerSize || null,
              variantNames: data.variantNames || null
            };
          });

          setAllProducts(transformedProducts);
          setLoading(false);
          setInitialLoad(false);
          setError(null);

        } else {

          setAllProducts([]);
          setLoading(false);
          setInitialLoad(false);
        }
      },
      (error) => {
        console.error('❌ UNIFIED: Error listening to batch:', error);
        setError(error.message);
        setLoading(false);
        setInitialLoad(false);
      }
    );

    return () => {

      unsubscribe();
    };
  }, []);

  // 🔥 MEMOIZED FILTERING: Filter produk tanpa read tambahan
  const featuredProducts = useMemo(() => {
    return allProducts.filter(product => product.isFeatured === true);
  }, [allProducts]);

  const flashSaleProducts = useMemo(() => {
    return allProducts.filter(product => product.isFlashSale === true);
  }, [allProducts]);

  // 🔥 BATCH SYSTEM: Update product stock dalam batch
  const updateProductStock = async (id: string, quantity: number, variantInfo?: { size: string; color: string }) => {
    try {


      const batchRef = doc(db, 'productBatches', 'batch_1');
      const batchDoc = await getDoc(batchRef);

      if (!batchDoc.exists()) {
        console.error('❌ UNIFIED: Batch system not found for stock update');
        return 0;
      }

      const batchData = batchDoc.data();
      let products = batchData.products || [];

      products = products.map((product: any) => {
        if (product.id === id) {


          let updatedProduct = { ...product };

          if (variantInfo?.size && variantInfo?.color && product.variants?.stock) {
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

            const totalStock = Number(product.stock || 0);
            updatedProduct.stock = Math.max(0, totalStock - quantity);


          } else {
            const currentStock = Number(product.stock || 0);
            const newStock = Math.max(0, currentStock - quantity);
            updatedProduct.stock = newStock;


          }

          return updatedProduct;
        }
        return product;
      });

      // Update batch dengan stock terbaru
      await setDoc(batchRef, {
        ...batchData,
        products: products,
        totalProducts: products.length,
        updatedAt: new Date().toISOString()
      });


      return quantity;

    } catch (error) {
      console.error('❌ UNIFIED: Error updating stock in batch:', error);
      return 0;
    }
  };

  const refresh = async () => {

    try {
      const batchRef = doc(db, 'productBatches', 'batch_1');
      await getDoc(batchRef); // Force refresh dari server
    } catch (error) {
      console.error('❌ UNIFIED: Error during refresh:', error);
    }
  };

  return {
    allProducts,
    featuredProducts,
    flashSaleProducts,
    loading: loading && initialLoad,
    error,
    updateProductStock,
    refresh
  };
};