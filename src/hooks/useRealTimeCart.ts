import { useState, useEffect } from 'react';
import { cartService, CartItem } from '../services/cartService';
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

        console.log('🔄 Setting up real-time cart listener for user:', user.uid);

        // Initial load
        const initialCart = await cartService.getCart();
        setCartItems(initialCart);

        // Set up real-time listener
        unsubscribe = cartService.onCartChange((items) => {
          console.log('📦 Real-time cart update received:', items.length, 'items');
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
        console.log('🔄 Cart listener cleaned up');
      }
    };
  }, []);

  return { cartItems, loading, error };
};