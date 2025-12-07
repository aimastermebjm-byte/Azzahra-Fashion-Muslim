// Real-time Cart Hook - Firestore Persistence Only
// Tanpa localStorage cache, hanya Firestore persistence

import { useState, useEffect } from 'react';
import { cartServiceOptimized, CartItem } from '../services/cartServiceOptimized';
import { auth } from '../utils/firebaseClient';

export const useRealTimeCartOptimized = () => {
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

        console.log('🔥 Setting up Firestore persistence cart for user:', user.uid);

        // Set up real-time listener dengan Firestore persistence
        unsubscribe = cartServiceOptimized.onCartChange((items) => {
          setCartItems(items);
          setLoading(false);
          setError(null);
        });

      } catch (error) {
        console.error('❌ Error setting up Firestore persistence cart listener:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLoading(false);
      }
    };

    setupCartListener();

    return () => {
      if (unsubscribe) {
        console.log('🔄 Cleaning up Firestore persistence cart listener');
        unsubscribe();
      }
    };
  }, []);

  const addToCart = async (product: any, quantity: number = 1, variant?: { size?: string; color?: string }) => {
    return await cartServiceOptimized.addToCart(product, quantity, variant);
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    return await cartServiceOptimized.updateQuantity(itemId, newQuantity);
  };

  const removeFromCart = async (itemId: string) => {
    return await cartServiceOptimized.removeFromCart(itemId);
  };

  const removeBulkFromCart = async (itemIds: string[]) => {
    return await cartServiceOptimized.removeBulkFromCart(itemIds);
  };

  const clearCart = async () => {
    return await cartServiceOptimized.clearCart();
  };

  const getCartTotal = () => {
    return cartServiceOptimized.getCartTotal(cartItems);
  };

  const getCartItemsCount = () => {
    return cartServiceOptimized.getCartItemsCount(cartItems);
  };

  return {
    cartItems,
    loading,
    error,
    addToCart,
    updateQuantity,
    removeFromCart,
    removeBulkFromCart,
    clearCart,
    getCartTotal,
    getCartItemsCount
  };
};