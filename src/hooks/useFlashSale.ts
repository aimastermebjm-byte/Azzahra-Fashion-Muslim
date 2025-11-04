import { useState, useEffect } from 'react';

interface FlashSaleConfig {
  isActive: boolean;
  startTime: string;
  endTime: string;
  products: string[];
  productIds?: string[];
  flashSaleDiscount?: number;
}

const FLASH_SALE_KEY = 'azzahra-flashsale';

export const useFlashSale = () => {
  const [flashSaleConfig, setFlashSaleConfig] = useState<FlashSaleConfig | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isInitialized) return; // Prevent re-initialization

    try {
      // Load flash sale config from localStorage
      const savedConfig = localStorage.getItem(FLASH_SALE_KEY);

      if (savedConfig) {
        try {
          const config = JSON.parse(savedConfig);
          // Validate config structure
          if (config && typeof config === 'object' && 'isActive' in config && 'endTime' in config) {
            setFlashSaleConfig(config);
            console.log('✅ Flash sale config loaded successfully from localStorage');
            console.log('📅 Flash sale ends at:', config.endTime);
            console.log('⏰ Current time:', new Date().toISOString());
          } else {
            console.warn('⚠️ Invalid flash sale config structure, using default');
            throw new Error('Invalid config structure');
          }
        } catch (e) {
          console.warn('⚠️ Failed to parse flash sale config:', e);
          throw e;
        }
      } else {
        console.log('📝 No flash sale config found in localStorage');
        console.log('ℹ️ Please create flash sale from admin dashboard first');
        // Don't create default config - wait for admin to create one
      }
    } catch (e) {
      console.error('🚨 Error initializing flash sale:', e);
    } finally {
      setIsInitialized(true);
    }
  }, [isInitialized]);

  useEffect(() => {
    if (!flashSaleConfig || !flashSaleConfig.isActive) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const endTime = new Date(flashSaleConfig.endTime).getTime();
      const difference = endTime - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft(
          days > 0
            ? `${days} hari ${hours} jam ${minutes} menit`
            : hours > 0
              ? `${hours} jam ${minutes} menit ${seconds} detik`
              : `${minutes} menit ${seconds} detik`
        );
      } else {
        // Flash sale ended - ENHANCED CLEANUP

        // 1. Update local state
        setFlashSaleConfig(prev => prev ? { ...prev, isActive: false } : null);

        // 2. Remove from localStorage
        localStorage.removeItem(FLASH_SALE_KEY);

        // 3. Clean flash sale from products with enhanced data structure support
        const savedProducts = localStorage.getItem('azzahra_products');
        if (savedProducts) {
          try {
            const products = JSON.parse(savedProducts);
            const cleanedProducts = products.map((product: any) => ({
              ...product,
              isFlashSale: false,
              flashSalePrice: undefined,
              flashSaleDiscount: undefined,
              originalRetailPrice: product.originalRetailPrice || product.retailPrice,
              retailPrice: product.originalRetailPrice || product.retailPrice
            }));
            localStorage.setItem('azzahra_products', JSON.stringify(cleanedProducts));
            console.log('🧹 Cleaned flash sale from products:', cleanedProducts.length, 'products');
          } catch (e) {
            console.error('Error cleaning products after flash sale:', e);
          }
        }

        // 4. Trigger multiple events for comprehensive UI updates
        window.dispatchEvent(new CustomEvent('flashSaleEnded', {
          detail: {
            timestamp: new Date().toISOString(),
            reason: 'time_expired'
          }
        }));

        // 5. DEBOUNCED Force auto-refresh after cleanup
        // Use debounced refresh to prevent multiple triggers
        if (!window.flashSaleRefreshTimer) {
          window.flashSaleRefreshTimer = setTimeout(() => {
            console.log('🔄 Auto-refreshing page after flash sale cleanup');
            window.location.reload();
          }, 2000);
        }

        return; // Stop timer
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [flashSaleConfig]);

  const startFlashSale = (config: Omit<FlashSaleConfig, 'isActive'>) => {
    const newConfig = { ...config, isActive: true };
    setFlashSaleConfig(newConfig);
    localStorage.setItem(FLASH_SALE_KEY, JSON.stringify(newConfig));
  };

  const stopFlashSale = () => {
    if (flashSaleConfig) {
      const updatedConfig = { ...flashSaleConfig, isActive: false };
      setFlashSaleConfig(updatedConfig);
      localStorage.removeItem(FLASH_SALE_KEY);
    }
  };

  const isProductInFlashSale = (productId: string) => {
    if (!flashSaleConfig?.isActive) return false;

    // Check both products and productIds arrays for backward compatibility
    const inProducts = flashSaleConfig.products.includes(productId);
    const inProductIds = flashSaleConfig.productIds?.includes(productId) || false;

    return inProducts || inProductIds;
  };

  return {
    flashSaleConfig,
    timeLeft,
    isFlashSaleActive: flashSaleConfig?.isActive || false,
    startFlashSale,
    stopFlashSale,
    isProductInFlashSale
  };
};