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
          brand: data.brand || undefined, // Include Brand
          description: data.description || '',
          category: data.category || 'uncategorized',

          // Pricing - only essentials
          retailPrice: Number(data.retailPrice) || 0,
          resellerPrice: Number(data.resellerPrice) || Number(data.retailPrice || 0) * 0.8,
          costPrice: Number(data.costPrice) || Number(data.retailPrice || 0) * 0.6,

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

          // Flash sale dan featured (cleaned up)
          isFeatured: Boolean(data.isFeatured || data.featured),
          isFlashSale: Boolean(data.isFlashSale),
          flashSalePrice: Number(data.flashSalePrice) || Number(data.retailPrice || 0),

          // Metadata (cleaned up)
          createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : (data.createdAt?.toDate ? data.createdAt.toDate() : new Date())) : new Date(),
          updatedAt: data.updatedAt,
          salesCount: Number(data.salesCount) || 0,

          // Physical properties
          weight: Number(data.weight) || 0,
          unit: data.unit || 'pcs',

          // AI analysis (if available)
          aiAnalysis: data.aiAnalysis ? {
            ...data.aiAnalysis,
            analyzedAt: data.aiAnalysis.analyzedAt
              ? (typeof data.aiAnalysis.analyzedAt === 'string'
                ? new Date(data.aiAnalysis.analyzedAt)
                : (data.aiAnalysis.analyzedAt?.toDate ? data.aiAnalysis.analyzedAt.toDate() : new Date()))
              : undefined
          } : undefined,

          // Migration fields
          cleanupDate: data.cleanupDate,
          cleanupNote: data.cleanupNote,
          migrationDate: data.migrationDate,
          migrationNote: data.migrationNote,

          // Variant-specific pricing (for cart/checkout)
          pricesPerVariant: data.pricesPerVariant || null,
          costPricePerSize: data.costPricePerSize || null,
          variantNames: data.variantNames || null
        }));

        // 🔥 FLASH SALE ENRICHMENT - Calculate on-the-fly from flashSaleConfig
        const flashSaleConfig = batchData.flashSaleConfig;
        const enrichedProducts = transformedProducts.map(product => {
          // Check if this product is in flash sale
          const discount = flashSaleConfig?.isActive && flashSaleConfig?.productDiscounts?.[product.id];

          if (discount && discount > 0) {
            // Calculate flash sale price from retailPrice - discount
            const flashSalePrice = Math.max(product.retailPrice - discount, 1000);

            return {
              ...product,
              isFlashSale: true,
              flashSalePrice,
              flashSaleDiscount: discount
            };
          }

          // Not in flash sale - return as-is (remove old flash sale flags if any)
          return {
            ...product,
            isFlashSale: false,
            flashSalePrice: product.retailPrice,  // Default to retailPrice
            flashSaleDiscount: null
          };
        });

        setAllProducts(enrichedProducts);
        setLoading(false);
        setError(null);

        const flashSaleCount = enrichedProducts.filter(p => p.isFlashSale).length;
        console.log(`🌍 GLOBAL: ${products.length} products loaded. ${flashSaleCount} in flash sale (enriched from config).`);
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