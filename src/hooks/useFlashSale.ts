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

  useEffect(() => {
    // Load flash sale config from localStorage
    let savedConfig = localStorage.getItem(FLASH_SALE_KEY);

    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setFlashSaleConfig(config);
      } catch (e) {
        console.error('Failed to load flash sale config');
      }
    } else {
      // Create default flash sale for testing
      const defaultConfig: FlashSaleConfig = {
        isActive: true,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        products: ['2', '4', '6', '8'] // Product IDs from mock data
      };
      localStorage.setItem(FLASH_SALE_KEY, JSON.stringify(defaultConfig));
      setFlashSaleConfig(defaultConfig);
    }
  }, []);

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