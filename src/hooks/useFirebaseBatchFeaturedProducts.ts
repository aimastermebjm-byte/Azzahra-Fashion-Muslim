import { useState, useEffect, useCallback } from 'react';
import { getFirestore, getDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  category: string;
  isFeatured: boolean;
  isFlashSale: boolean;
  flashSalePrice?: number;
  rating: number;
  soldCount: number;
  stock: number;
  createdAt: Date;
  weight?: number;
  colors?: string[];
  sizes?: string[];
}

const FEATURED_PRODUCTS_LIMIT = 10;

export const useFirebaseBatchFeaturedProducts = () => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load featured products dari batch system
  const loadFeaturedProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('⭐ Loading featured products from batches...');

      let allFeaturedProducts: Product[] = [];
      let batchNumber = 1;

      // Load batch sampai dapat cukup featured products atau max 5 batch
      while (allFeaturedProducts.length < FEATURED_PRODUCTS_LIMIT && batchNumber <= 5) {
        try {
          console.log(`📦 Loading featured from batch_${batchNumber}...`);
          const batchRef = doc(db, 'productBatches', `batch_${batchNumber}`);
          const batchSnap = await getDoc(batchRef);

          if (batchSnap.exists()) {
            const batchData = batchSnap.data();
            const featuredProducts = batchData.products.filter((product: Product) =>
              product.isFeatured && product.stock > 0
            );

            allFeaturedProducts.push(...featuredProducts);
            console.log(`⭐ Batch ${batchNumber}: ${featuredProducts.length} featured products`);
          } else {
            console.log(`⚠️ Batch ${batchNumber} not found`);
            break;
          }

          batchNumber++;
        } catch (err) {
          console.error(`❌ Error loading batch ${batchNumber}:`, err);
          break;
        }
      }

      // Sort berdasarkan rating dan sold count (popularitas)
      allFeaturedProducts.sort((a, b) => {
        // Prioritaskan rating
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }
        // Jika rating sama, prioritaskan sold count
        return b.soldCount - a.soldCount;
      });

      // Ambil produk terbaik
      const selectedProducts = allFeaturedProducts.slice(0, FEATURED_PRODUCTS_LIMIT);

      setFeaturedProducts(selectedProducts);
      console.log(`✅ Loaded ${selectedProducts.length} featured products`);

      if (selectedProducts.length === 0) {
        console.log('ℹ️ No featured products found in any batch');
      }

    } catch (err) {
      console.error('❌ Error loading featured products:', err);
      setError('Gagal memuat produk unggulan');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh featured products
  const refreshFeaturedProducts = useCallback(() => {
    console.log('🔄 Refreshing featured products...');
    loadFeaturedProducts();
  }, [loadFeaturedProducts]);

  // Load featured products saat component mount
  useEffect(() => {
    loadFeaturedProducts();
  }, [loadFeaturedProducts]);

  return {
    featuredProducts,
    loading,
    error,
    refreshFeaturedProducts,
    // Debug info
    debug: {
      totalLoaded: featuredProducts.length,
      limit: FEATURED_PRODUCTS_LIMIT
    }
  };
};

export default useFirebaseBatchFeaturedProducts;