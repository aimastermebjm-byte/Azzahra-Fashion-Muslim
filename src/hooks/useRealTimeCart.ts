import { useState, useEffect } from 'react';
import { cartServiceOptimized, CartItem } from '../services/cartServiceOptimized';
import { auth } from '../utils/firebaseClient';

export const useRealTimeCart = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupCartListener = async () => {
      try {
        setLoading(true);
        setError(null);

        const user = auth.currentUser;
        if (!user) {
          setCartItems([]);
          setLoading(false);
          return;
        }

        
        // Initial load
        const initialCart = await cartServiceOptimized.getCart();
        setCartItems(initialCart);

        // Set up real-time listener
        unsubscribe = cartServiceOptimized.onCartChange((items: CartItem[]) => {
                    setCartItems(items);
          setLoading(false);
          setError(null);
        });

      } catch (error) {
        console.error('❌ Error setting up cart listener:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLoading(false);
      }
    };

    setupCartListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
              }
    };
  }, []);

  return { cartItems, loading, error };
};