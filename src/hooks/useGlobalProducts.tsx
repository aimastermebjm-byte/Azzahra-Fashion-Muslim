// Global Product State - Singleton Pattern
// Single listener untuk semua components, ZERO additional reads

import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';

interface GlobalProductsContextType {
  allProducts: Product[];
  loading: boolean;
  error: string | null;
  getProductById: (id: string) => Product | undefined;
}

const GlobalProductsContext = createContext<GlobalProductsContextType | null>(null);

export const GlobalProductsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🌍 Initializing GLOBAL product listener - SINGLE READ for entire app');

    const batchRef = doc(db, 'productBatches', 'batch_1');
    const unsubscribe = onSnapshot(batchRef, (snapshot) => {
      if (snapshot.exists()) {
        const batchData = snapshot.data();
        const products = batchData.products || [];

        const transformedProducts: Product[] = products.map((data: any) => ({
          id: data.id,
          name: data.name || '',
          description: data.description || '',
          category: data.category || 'uncategorized',

          // Pricing - menggunakan field yang ada di data aktual
          price: Number(data.price || data.sellingPrice || data.retailPrice || 0),
          retailPrice: Number(data.retailPrice || data.price || 0),
          resellerPrice: Number(data.resellerPrice) || Number(data.retailPrice || data.price || 0) * 0.8,
          costPrice: Number(data.costPrice) || Number(data.purchasePrice || 0),
          purchasePrice: Number(data.purchasePrice) || Number(data.costPrice || 0),
          originalRetailPrice: Number(data.originalRetailPrice) || Number(data.price || data.retailPrice || 0),
          originalResellerPrice: Number(data.originalResellerPrice) || Number(data.resellerPrice || 0),

          // Stock dan status
          stock: Number(data.stock || 0),
          status: data.status === 'Ready Stock' ? 'ready' : (data.status as 'ready' | 'po' || 'ready'),
          condition: data.condition,
          estimatedReady: data.estimatedReady ? new Date(data.estimatedReady) : undefined,

          // Images
          images: Array.isArray(data.images) ? data.images : (data.image ? [data.image] : []),
          image: data.image || (Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : '/placeholder-product.jpg'),

          // Variants - struktur nested yang benar
          variants: {
            sizes: Array.isArray(data.variants?.sizes) ? data.variants.sizes : (Array.isArray(data.sizes) ? data.sizes : []),
            colors: Array.isArray(data.variants?.colors) ? data.variants.colors : (Array.isArray(data.colors) ? data.colors : []),
            stock: (data.variants?.stock && typeof data.variants?.stock === 'object') ? data.variants.stock : {}
          },

          // Flash sale dan featured
          isFeatured: Boolean(data.isFeatured || data.featured),
          featured: Boolean(data.featured),
          isFlashSale: Boolean(data.isFlashSale),
          flashSalePrice: Number(data.flashSalePrice) || Number(data.price || data.retailPrice || 0),
          flashSaleDiscount: data.flashSaleDiscount || null,
          discount: Number(data.discount) || 0,

          // Metadata
          createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : (data.createdAt?.toDate ? data.createdAt.toDate() : new Date())) : new Date(),
          updatedAt: data.updatedAt,
          salesCount: Number(data.salesCount) || 0,
          reviews: Number(data.reviews) || 0,
          rating: Number(data.rating) || 0,

          // Physical properties
          weight: Number(data.weight) || 0,
          unit: data.unit || 'pcs',

          // Migration fields
          cleanupDate: data.cleanupDate,
          cleanupNote: data.cleanupNote,
          migrationDate: data.migrationDate,
          migrationNote: data.migrationNote
        }));

        setAllProducts(transformedProducts);
        setLoading(false);
        setError(null);

        console.log(`🌍 GLOBAL: Products updated with ${products.length} products (0 reads - from cache)`);
      } else {
        setAllProducts([]);
        setLoading(false);
      }
    }, (error) => {
      console.error('❌ GLOBAL: Error listening to batch:', error);
      setError(error.message);
      setLoading(false);
    });

    return () => {
      console.log('🔄 GLOBAL: Cleaning up single listener');
      unsubscribe();
    };
  }, []);

  const getProductById = useMemo(() => {
    return (id: string): Product | undefined => {
      return allProducts.find(p => p.id === id);
    };
  }, [allProducts]);

  const contextValue = useMemo(() => ({
    allProducts,
    loading,
    error,
    getProductById
  }), [allProducts, loading, error, getProductById]);

  return (
    <GlobalProductsContext.Provider value={contextValue}>
      {children}
    </GlobalProductsContext.Provider>
  );
};

export const useGlobalProducts = (): GlobalProductsContextType => {
  const context = useContext(GlobalProductsContext);
  if (!context) {
    throw new Error('useGlobalProducts must be used within GlobalProductsProvider');
  }
  return context;
};