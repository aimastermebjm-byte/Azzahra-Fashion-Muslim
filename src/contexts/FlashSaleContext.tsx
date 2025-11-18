/**
 * Flash Sale Context untuk mencegah multiple listeners
 * Solusi untuk infinite loop di useFirebaseFlashSale
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  doc,
  onSnapshot,
  updateDoc,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

interface FlashSaleConfig {
  id: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
  products: string[];
  productIds?: string[];
  flashSaleDiscount?: number;
  createdAt: string;
  updatedAt: string;
}

interface FlashSaleContextType {
  flashSaleConfig: FlashSaleConfig | null;
  timeLeft: string;
  isFlashSaleActive: boolean;
  loading: boolean;
}

const FlashSaleContext = createContext<FlashSaleContextType>({
  flashSaleConfig: null,
  timeLeft: '',
  isFlashSaleActive: false,
  loading: true,
});

const FLASH_SALE_DOC_ID = 'current-flash-sale';

export const FlashSaleProvider = ({ children }: { children: ReactNode }) => {
  const [flashSaleConfig, setFlashSaleConfig] = useState<FlashSaleConfig | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Singleton real-time listener untuk flash sale config
  useEffect(() => {
    console.log('🔥 Firebase Flash Sale: Initializing SINGLETON real-time listener');
    setLoading(true);

    const flashSaleRef = doc(db, 'flashSales', FLASH_SALE_DOC_ID);

    const unsubscribe = onSnapshot(flashSaleRef, (docSnapshot: DocumentSnapshot) => {
      if (docSnapshot.exists()) {
        const config = { id: docSnapshot.id, ...docSnapshot.data() } as FlashSaleConfig;
        setFlashSaleConfig(config);
        console.log('✅ Firebase Flash Sale: Config loaded from Firebase (SINGLETON)');
        console.log('📅 Flash sale ends at:', config.endTime);
        console.log('🔥 Firebase Flash Sale: Active status:', config.isActive);
      } else {
        console.log('📝 Firebase Flash Sale: No active flash sale found (SINGLETON)');
        setFlashSaleConfig(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('❌ Firebase Flash Sale: Error listening to config (SINGLETON):', error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      console.log('🔥 Firebase Flash Sale: SINGLETON listener disconnected');
    };
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (!flashSaleConfig || !flashSaleConfig.isActive) {
      setTimeLeft('');
      return;
    }

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const endTime = new Date(flashSaleConfig.endTime).getTime();
      const difference = endTime - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        let timeString = '';
        if (days > 0) {
          timeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        } else if (hours > 0) {
          timeString = `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
          timeString = `${minutes}m ${seconds}s`;
        } else {
          timeString = `${seconds}s`;
        }

        setTimeLeft(timeString);
      } else {
        setTimeLeft('Flash sale ended');
        if (flashSaleConfig.isActive) {
          console.log('🕐 Flash sale ended, stopping automatically...');
          // Auto-stop flash sale when timer ends
          updateDoc(doc(db, 'flashSales', FLASH_SALE_DOC_ID), {
            isActive: false,
            endedAt: new Date().toISOString()
          });
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [flashSaleConfig]);

  const isFlashSaleActive = flashSaleConfig?.isActive || false;

  return (
    <FlashSaleContext.Provider value={{
      flashSaleConfig,
      timeLeft,
      isFlashSaleActive,
      loading
    }}>
      {children}
    </FlashSaleContext.Provider>
  );
};

export const useFlashSaleContext = () => {
  const context = useContext(FlashSaleContext);
  if (!context) {
    throw new Error('useFlashSaleContext must be used within FlashSaleProvider');
  }
  return context;
};