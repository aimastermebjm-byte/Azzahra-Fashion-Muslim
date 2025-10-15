import { useState, useEffect } from 'react';
import { Product, FlashSale } from '../types';
import { AppStorage } from '../utils/appStorage';

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>(() => {
    // Get products from AppStorage (will initialize if empty)
    return AppStorage.getProducts();
  });
  const [loading, setLoading] = useState(true);

  // Update products and save to AppStorage
  const updateProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    AppStorage.saveProducts(newProducts);
  };

  const updateProductStock = (productId: string, quantity: number) => {
    setProducts(prev => {
      const updated = prev.map(product =>
        product.id === productId
          ? { ...product, stock: Math.max(0, product.stock - quantity) }
          : product
      );
      AppStorage.saveProducts(updated);
      return updated;
    });
  };

  // Initialize products on mount
  useEffect(() => {
    const initializeProducts = async () => {
      setLoading(true);
      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const storedProducts = AppStorage.getProducts();
      setProducts(storedProducts);
      setLoading(false);
    };

    initializeProducts();
  }, []);

  // Listen for featured products updates from admin
  useEffect(() => {
    const handleFeaturedProductsUpdated = (event: any) => {
      console.log('Featured products updated event received:', event.detail);

      // Reload products from storage to get latest state
      const updatedProducts = AppStorage.getProducts();
      setProducts(updatedProducts);
    };

    window.addEventListener('featuredProductsUpdated', handleFeaturedProductsUpdated as EventListener);

    return () => {
      window.removeEventListener('featuredProductsUpdated', handleFeaturedProductsUpdated as EventListener);
    };
  }, []);

  // Flash sale methods (placeholder for future implementation)
  const applyFlashSaleToProducts = (flashSale: FlashSale, forceUpdate = false) => {
    console.log('Flash sale feature not yet implemented with AppStorage');
    // TODO: Implement flash sale with AppStorage
  };

  const removeFlashSaleFromProducts = (productIds: string[]) => {
    console.log('Flash sale feature not yet implemented with AppStorage');
    // TODO: Implement flash sale removal with AppStorage
  };

  return {
    products,
    loading,
    updateProducts,
    updateProductStock,
    applyFlashSaleToProducts,
    removeFlashSaleFromProducts,
    flashSaleEvents: [] // Placeholder
  };
};