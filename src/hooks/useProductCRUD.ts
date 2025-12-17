import { useState, useCallback, useEffect } from 'react';
import { doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';
import { syncProductToGlobalIndex, deleteProductFromGlobalIndex } from '../services/globalIndexSync';

export interface UseProductCRUDResult {
  products: Product[];
  loading: boolean;
  error: string | null;
  addProduct: (productData: any) => Promise<string>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
}

export const useProductCRUD = (): UseProductCRUDResult => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🚀 SINGLE LISTENER: Use onSnapshot untuk real-time updates
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const batchDocRef = doc(db, 'productBatches', 'batch_1');

      const unsubscribe = onSnapshot(batchDocRef, (batchSnapshot) => {
        if (batchSnapshot.exists()) {
          const batchData = batchSnapshot.data();
          const allProducts = batchData.products || [];

          console.log(`🚀 SINGLE LISTENER: Products updated with ${allProducts.length} products`);
          setProducts(allProducts);
        } else {
          console.log('⚠️ No batch document found');
          setProducts([]);
        }
        setLoading(false);
      }, (error) => {
        console.error('❌ SINGLE LISTENER: Error fetching products:', error);
        setError(error.message);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('❌ SINGLE LISTENER: Setup error:', error);
      setError('Failed to fetch products');
      setLoading(false);
      return null;
    }
  }, []);

  // Fetch products on mount
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let unsubscribeFunc: any = null;

    fetchProducts().then(unsub => {
      unsubscribeFunc = unsub;
    });

    return () => {
      if (unsubscribeFunc && typeof unsubscribeFunc === 'function') {
        console.log('🔄 SINGLE LISTENER: Cleaning up...');
        unsubscribeFunc();
      }
    };
  }, []);

  const addProduct = useCallback(async (productData: any): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const batchDocRef = doc(db, 'productBatches', 'batch_1');

      // Generate unique ID
      const newProductId = `product_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Create product object (Clean properties based on Product Type)
      const newProduct: Product = {
        id: newProductId,
        name: productData.name || '',
        description: productData.description || '',
        category: productData.category || 'uncategorized',
        // price & sellingPrice removed as they are not in Type or optional
        retailPrice: Number(productData.retailPrice || productData.price || 0),
        resellerPrice: Number(productData.resellerPrice || 0),
        costPrice: Number(productData.costPrice || 0),
        purchasePrice: Number(productData.purchasePrice || productData.costPrice || 0),
        originalRetailPrice: Number(productData.retailPrice || 0),
        originalResellerPrice: Number(productData.resellerPrice || 0),
        stock: Number(productData.stock || 0),
        status: (productData.status === 'Ready Stock' || productData.status === 'ready') ? 'ready' : (productData.status as 'ready' | 'po' || 'ready'),
        condition: productData.condition || 'baru',
        images: Array.isArray(productData.images) ? productData.images : [],
        image: (Array.isArray(productData.images) && productData.images.length > 0) ? productData.images[0] : '/placeholder-product.jpg',
        variants: {
          sizes: Array.isArray(productData.variants?.sizes) ? productData.variants.sizes : [],
          colors: Array.isArray(productData.variants?.colors) ? productData.variants.colors : [],
          stock: (typeof productData.variants?.stock === 'object' && productData.variants.stock !== null) ? productData.variants.stock : {}
        },
        isFeatured: Boolean(productData.isFeatured || productData.featured),
        featured: Boolean(productData.featured || productData.isFeatured),
        isFlashSale: Boolean(productData.isFlashSale),
        flashSalePrice: Number(productData.flashSalePrice || productData.retailPrice || 0),
        flashSaleDiscount: productData.flashSaleDiscount || null,
        discount: Number(productData.discount) || 0,
        createdAt: new Date(),
        salesCount: 0,
        reviews: 0,
        rating: 0,
        weight: Number(productData.weight || 0),
        unit: productData.unit || 'pcs'
      };

      // ATOMIC UPDATE: Use arrayUnion to safely append without reading first
      // This prevents race conditions where existing data is overwritten
      // and solves the issue of concurrent uploads deleting previous products
      await updateDoc(batchDocRef, {
        products: arrayUnion(newProduct),
        productIds: arrayUnion(newProductId),
        totalProducts: increment(1),
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ ATOMIC WRITE: Product added with ID ${newProductId}`);

      return newProductId;

    } catch (error: any) {
      console.error('❌ SINGLE LISTENER: Error adding product:', error);
      setError('Failed to add product');
      setLoading(false);
      throw error;
    }
  }, []);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const batchDocRef = doc(db, 'productBatches', 'batch_1');
      const batchSnapshot = await getDoc(batchDocRef);

      if (batchSnapshot.exists()) {
        const batchData = batchSnapshot.data();
        const currentProducts = batchData.products || [];

        const updatedProducts = currentProducts.map((product: Product) =>
          product.id === id ? { ...product, ...updates } : product
        );

        await setDoc(batchDocRef, {
          ...batchData,
          products: updatedProducts,
          updatedAt: new Date().toISOString()
        });

        // Sync updated product to globalindex
        const updatedProduct = updatedProducts.find((p: Product) => p.id === id);
        if (updatedProduct) {
          console.log('🔄 Syncing updated product to globalindex...');
          const syncSuccess = await syncProductToGlobalIndex(updatedProduct);
          if (!syncSuccess) {
            console.error(`⚠️ WARNING: Product updated in batch but FAILED to sync to globalindex: ${id}`);
          }
        }

        console.log(`✅ SINGLE LISTENER: Product updated with ID ${id}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ SINGLE LISTENER: Error updating product:', error);
      setError('Failed to update product');
      setLoading(false);
      return false;
    }
  }, []);

  const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const batchDocRef = doc(db, 'productBatches', 'batch_1');
      const batchSnapshot = await getDoc(batchDocRef);

      if (batchSnapshot.exists()) {
        const batchData = batchSnapshot.data();
        const currentProducts = batchData.products || [];

        const updatedProducts = currentProducts.filter((product: Product) => product.id !== id);
        const currentProductIds = batchData.productIds || [];
        const updatedProductIds = currentProductIds.filter((productId: string) => productId !== id);

        await setDoc(batchDocRef, {
          ...batchData,
          products: updatedProducts,
          productIds: updatedProductIds,
          totalProducts: updatedProducts.length,
          updatedAt: new Date().toISOString()
        });

        // Delete from globalindex collection
        await deleteProductFromGlobalIndex(id);

        console.log(`✅ SINGLE LISTENER: Product deleted with ID ${id} and removed from globalindex`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ SINGLE LISTENER: Error deleting product:', error);
      setError('Failed to delete product');
      setLoading(false);
      return false;
    }
  }, []);

  return {
    products,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProduct
  };
};