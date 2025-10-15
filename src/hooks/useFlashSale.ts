import { useState, useEffect } from 'react';

interface FlashSaleConfig {
  isActive: boolean;
  startTime: string;
  endTime: string;
  products: string[];
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
            console.log('✅ Flash sale config loaded successfully');
          } else {
            console.warn('⚠️ Invalid flash sale config structure, using default');
            throw new Error('Invalid config structure');
          }
        } catch (e) {
          console.warn('⚠️ Failed to parse flash sale config, creating new one:', e);
          throw e; // Continue to create default config
        }
      } else {
        console.log('📝 No flash sale config found, creating default');
        throw new Error('No config found');
      }
    } catch (e) {
      // Create default flash sale for testing
      const defaultConfig: FlashSaleConfig = {
        isActive: true,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        products: ['1', '2', '4', '6'] // Use valid product IDs from our data
      };

      try {
        localStorage.setItem(FLASH_SALE_KEY, JSON.stringify(defaultConfig));
        setFlashSaleConfig(defaultConfig);
        console.log('✅ Default flash sale config created');
      } catch (storageError) {
        console.error('🚨 Failed to save flash sale config to localStorage:', storageError);
      }
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
            ? `${days}h ${hours}j ${minutes}m ${seconds}d`
            : `${hours}j ${minutes}m ${seconds}d`
        );
      } else {
        // Flash sale ended
        setFlashSaleConfig(prev => prev ? { ...prev, isActive: false } : null);
        localStorage.removeItem(FLASH_SALE_KEY);
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
    return flashSaleConfig?.isActive && flashSaleConfig.products.includes(productId);
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