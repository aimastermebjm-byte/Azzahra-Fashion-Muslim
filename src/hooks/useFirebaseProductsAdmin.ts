import { useState, useEffect } from 'react';
import { doc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';

// 🎯 GLOBAL ADMIN SHARING: Import global products context
import { useGlobalProducts } from './useGlobalProducts';

export const useFirebaseProductsAdmin = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  // 🚀 OPTIMIZATION: Use global products state (0 reads!)
  const { allProducts } = useGlobalProducts();

  useEffect(() => {

    // 🚀 OPTIMIZED: Use global state instead of Firestore reads
    if (allProducts && allProducts.length > 0) {
      console.log('🚀 Admin: Using global products (0 reads)');
      setProducts(allProducts);
      setLoading(false);
      setInitialLoad(false);
    } else {
      console.log('⚠️ Admin: No global products available');
      setProducts([]);
      setLoading(false);
      setInitialLoad(false);
    }

    // Setup simple cross-tab cache invalidation listener for admin (optional)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'azzahra_cache_invalidation') {
        const data = JSON.parse(event.newValue || '{}');
        if (data.type === 'products') {
          console.log('🔄 Admin: Cache invalidation - refreshing...');
          // Force refresh with global state
          setTimeout(() => {
            if (allProducts && allProducts.length > 0) {
              setProducts(allProducts);
            }
          }, 100);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

      // 🚀 OPTIMIZED: Remove auto-refresh loops that cause multiple reads
    // Admin uses global state for real-time updates (0 reads!)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [allProducts.length]);

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

  // 🔥 BATCH SYSTEM: Add product to batch (not individual collection)
  const addProduct = async (productData: any) => {
    try {
      console.log('➕ Adding product to BATCH SYSTEM:', productData);

      // Get current batch
      const batchRef = collection(db, 'productBatches');
      const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
      const batchSnapshot = await getDocs(batchQuery);

      if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
        const batchDoc = batchSnapshot.docs[0];
        const batchData = batchDoc.data();
        const products = batchData.products || [];

        // Generate new product ID
        const newProductId = `product_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        // Create new product object dengan field yang sesuai data aktual
        const newProduct: Product = {
          id: newProductId,
          name: productData.name || '',
          description: productData.description || '',
          category: productData.category || 'uncategorized',

          // Pricing - sesuai dengan struktur data aktual
          price: Number(productData.price || productData.retailPrice || 0),
          retailPrice: Number(productData.retailPrice || productData.price || 0),
          resellerPrice: Number(productData.resellerPrice || (Number(productData.retailPrice || productData.price || 0) * 0.8)),
          costPrice: Number(productData.costPrice || (Number(productData.retailPrice || productData.price || 0) * 0.6)),
          purchasePrice: Number(productData.purchasePrice || productData.costPrice || 0),
          originalRetailPrice: Number(productData.retailPrice || productData.price || 0),
          originalResellerPrice: Number(productData.resellerPrice || (Number(productData.retailPrice || productData.price || 0) * 0.8)),

          // Stock dan status
          stock: Number(productData.stock) || 0,
          status: (productData.status === 'Ready Stock' || productData.status === 'ready') ? 'ready' : (productData.status as 'ready' | 'po' || 'ready'),
          condition: productData.condition,
          estimatedReady: productData.estimatedReady || undefined,

          // Images
          images: Array.isArray(productData.images) ? productData.images : [],
          image: (Array.isArray(productData.images) && productData.images.length > 0) ? productData.images[0] : '/placeholder-product.jpg',

          // Variants - nested structure yang benar
          variants: {
            sizes: Array.isArray(productData.variants?.sizes) ? productData.variants.sizes : [],
            colors: Array.isArray(productData.variants?.colors) ? productData.variants.colors : [],
            stock: (typeof productData.variants?.stock === 'object' && productData.variants.stock !== null) ? productData.variants.stock : {}
          },

          // Flash sale dan featured
          isFeatured: Boolean(productData.isFeatured || productData.featured),
          featured: Boolean(productData.featured || productData.isFeatured),
          isFlashSale: Boolean(productData.isFlashSale),
          flashSalePrice: Number(productData.flashSalePrice || productData.price || productData.retailPrice || 0),
          flashSaleDiscount: productData.flashSaleDiscount || null,
          discount: Number(productData.discount) || 0,

          // Metadata
          createdAt: new Date(),
          salesCount: 0,
          reviews: 0,
          rating: 0,

          // Physical properties
          weight: Number(productData.weight) || 0,
          unit: productData.unit || 'pcs',

          // Migration fields (opsional)
          cleanupDate: undefined,
          cleanupNote: undefined,
          migrationDate: undefined,
          migrationNote: undefined
        };

        // Add to products array
        products.push(newProduct);

        // Update the batch
        await setDoc(doc(db, 'productBatches', 'batch_1'), {
          ...batchData,
          products: products,
          totalProducts: products.length,
          updatedAt: new Date().toISOString()
        });

        console.log('✅ Product added successfully to batch system');

        // Update local state immediately
        setProducts(prev => [...prev, newProduct]);

        return newProductId;
      } else {
        // Create new batch if doesn't exist
        const newProductId = `product_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        // Create new product object dengan field yang sesuai data aktual
        const newProduct: Product = {
          id: newProductId,
          name: productData.name || '',
          description: productData.description || '',
          category: productData.category || 'uncategorized',

          // Pricing - sesuai dengan struktur data aktual
          price: Number(productData.price || productData.retailPrice || 0),
          retailPrice: Number(productData.retailPrice || productData.price || 0),
          resellerPrice: Number(productData.resellerPrice || (Number(productData.retailPrice || productData.price || 0) * 0.8)),
          costPrice: Number(productData.costPrice || (Number(productData.retailPrice || productData.price || 0) * 0.6)),
          purchasePrice: Number(productData.purchasePrice || productData.costPrice || 0),
          originalRetailPrice: Number(productData.retailPrice || productData.price || 0),
          originalResellerPrice: Number(productData.resellerPrice || (Number(productData.retailPrice || productData.price || 0) * 0.8)),

          // Stock dan status
          stock: Number(productData.stock) || 0,
          status: (productData.status === 'Ready Stock' || productData.status === 'ready') ? 'ready' : (productData.status as 'ready' | 'po' || 'ready'),
          condition: productData.condition,
          estimatedReady: productData.estimatedReady || undefined,

          // Images
          images: Array.isArray(productData.images) ? productData.images : [],
          image: (Array.isArray(productData.images) && productData.images.length > 0) ? productData.images[0] : '/placeholder-product.jpg',

          // Variants - nested structure yang benar
          variants: {
            sizes: Array.isArray(productData.variants?.sizes) ? productData.variants.sizes : [],
            colors: Array.isArray(productData.variants?.colors) ? productData.variants.colors : [],
            stock: (typeof productData.variants?.stock === 'object' && productData.variants.stock !== null) ? productData.variants.stock : {}
          },

          // Flash sale dan featured
          isFeatured: Boolean(productData.isFeatured || productData.featured),
          featured: Boolean(productData.featured || productData.isFeatured),
          isFlashSale: Boolean(productData.isFlashSale),
          flashSalePrice: Number(productData.flashSalePrice || productData.price || productData.retailPrice || 0),
          flashSaleDiscount: productData.flashSaleDiscount || null,
          discount: Number(productData.discount) || 0,

          // Metadata
          createdAt: new Date(),
          salesCount: 0,
          reviews: 0,
          rating: 0,

          // Physical properties
          weight: Number(productData.weight) || 0,
          unit: productData.unit || 'pcs',

          // Migration fields (opsional)
          cleanupDate: undefined,
          cleanupNote: undefined,
          migrationDate: undefined,
          migrationNote: undefined
        };

        await setDoc(doc(db, 'productBatches', 'batch_1'), {
          id: 'batch_1',
          products: [newProduct],
          totalProducts: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        console.log('✅ New batch created and product added successfully');

        // Update local state immediately
        setProducts(prev => [...prev, newProduct]);

        return newProductId;
      }
    } catch (error) {
      console.error('❌ Error adding product to batch:', error);
      throw error;
    }
  };

  // 🔥 BATCH SYSTEM: Delete product from batch (not individual collection)
  const deleteProduct = async (id: string) => {
    try {
      console.log('🗑️ Deleting product from BATCH SYSTEM:', id);

      // Get current batch
      const batchRef = collection(db, 'productBatches');
      const batchQuery = query(batchRef, where('__name__', '==', 'batch_1'));
      const batchSnapshot = await getDocs(batchQuery);

      if (!batchSnapshot.empty && batchSnapshot.docs[0].exists()) {
        const batchDoc = batchSnapshot.docs[0];
        const batchData = batchDoc.data();
        let products = batchData.products || [];

        // Remove the product
        const originalLength = products.length;
        products = products.filter((product: any) => product.id !== id);

        if (products.length === originalLength) {
          console.warn('⚠️ Product not found in batch for deletion:', id);
          return false;
        }

        // Update the batch
        await setDoc(doc(db, 'productBatches', 'batch_1'), {
          ...batchData,
          products: products,
          totalProducts: products.length,
          updatedAt: new Date().toISOString()
        });

        console.log('✅ Product deleted successfully from batch system');

        // Update local state immediately
        setProducts(prev => prev.filter(product => product.id !== id));

        return true;
      } else {
        console.error('❌ Batch system not found for product deletion');
        return false;
      }
    } catch (error) {
      console.error('❌ Error deleting product from batch:', error);
      throw error;
    }
  };

  return {
    products,
    loading: loading && initialLoad,
    error: null,
    initialLoad,
    updateProduct,
    updateProductStock,
    addProduct,
    deleteProduct
  };
};