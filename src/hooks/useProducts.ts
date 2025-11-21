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
      
      // Reload products from storage to get latest state
      const updatedProducts = AppStorage.getProducts();
      setProducts(updatedProducts);
    };

    window.addEventListener('featuredProductsUpdated', handleFeaturedProductsUpdated as EventListener);

    return () => {
      window.removeEventListener('featuredProductsUpdated', handleFeaturedProductsUpdated as EventListener);
    };
  }, []);

  // Listen for products updates from admin
  useEffect(() => {
    const handleProductsUpdated = (event: any) => {
      
      // Reload products from storage to get latest state
      const updatedProducts = AppStorage.getProducts();
      setProducts(updatedProducts);
    };

    window.addEventListener('productsUpdated', handleProductsUpdated as EventListener);

    return () => {
      window.removeEventListener('productsUpdated', handleProductsUpdated as EventListener);
    };
  }, []);

  // Flash sale methods - IMPLEMENTED
  const applyFlashSaleToProducts = (flashSale: FlashSale, forceUpdate = false) => {
    
    setProducts(prev => {
      const updated = prev.map(product => {
        if (flashSale.productIds.includes(product.id)) {
          const originalPrice = product.originalRetailPrice || product.retailPrice;
          let flashSalePrice = product.retailPrice;

          if (flashSale.discountType === 'fixed') {
            // Fixed amount discount (e.g., Rp 10,000 off)
            flashSalePrice = Math.max(0, product.retailPrice - flashSale.discountValue);
          } else if (flashSale.discountType === 'percentage') {
            // Percentage discount (e.g., 20% off)
            flashSalePrice = product.retailPrice * (1 - flashSale.discountValue / 100);
          }

          
          return {
            ...product,
            isFlashSale: true,
            flashSalePrice: Math.round(flashSalePrice),
            originalRetailPrice: originalPrice
          };
        }
        return product;
      });

      // Save to AppStorage
      AppStorage.saveProducts(updated);
      
      return updated;
    });
  };

  const removeFlashSaleFromProducts = (productIds: string[]) => {
    
    setProducts(prev => {
      const updated = prev.map(product => {
        if (productIds.includes(product.id) && product.isFlashSale) {
          
          return {
            ...product,
            isFlashSale: false,
            flashSalePrice: undefined,
            retailPrice: product.originalRetailPrice || product.retailPrice,
            originalRetailPrice: undefined
          };
        }
        return product;
      });

      // Save to AppStorage
      AppStorage.saveProducts(updated);
      
      return updated;
    });
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