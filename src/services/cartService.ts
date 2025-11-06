// Cart Service - Pure Firebase Real-time Cart System
// Single source of truth: Firebase Firestore only

import { auth } from '../utils/firebaseClient';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  variant?: {
    size?: string;
    color?: string;
  };
  addedAt: Date | string;
}

export interface UserCart {
  userId: string;
  items: CartItem[];
  lastUpdated: Date;
}

class CartService {
  private readonly FIREBASE_COLLECTION = 'user_carts';

  // Get current user's cart from Firebase only - DISABLED
  async getCart(): Promise<CartItem[]> {
    console.error('🚨 EMERGENCY: Firebase getCart DISABLED - quota exhausted');
    throw new Error('Firebase operations disabled due to quota exhaustion. Please try again later.');
  }

  // Set up real-time cart listener
  onCartChange(callback: (items: CartItem[]) => void): () => void {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No user for real-time cart listener');
      return () => {};
    }

    // 🚨 EMERGENCY: DISABLED to prevent Firestore quota exhaustion
    console.error('🚨 EMERGENCY: Cart real-time listener DISABLED');
    return () => {};
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const items = data?.items || [];
        console.log('📦 Real-time cart update:', items.length, 'items');
        callback(items);
      } else {
        console.log('📦 Real-time cart update: empty cart');
        callback([]);
      }
    }, (error) => {
      console.error('❌ Real-time cart listener error:', error);
    });

    return unsubscribe;
  }

  // Add item to cart - DISABLED
  async addToCart(item: Omit<CartItem, 'id' | 'addedAt'>): Promise<CartItem[]> {
    console.error('🚨 EMERGENCY: Cart addToCart DISABLED - Firestore quota exhausted');
    throw new Error('Cart operations disabled due to Firestore quota exhaustion. Please try again later.');
  }
      if (!user) {
        throw new Error('User not authenticated - cannot add to cart');
      }

      const cartItem: CartItem = {
        ...item,
        id: this.generateId(),
        addedAt: new Date().toISOString()
      };

      const currentCart = await this.getCart();
      const existingItemIndex = currentCart.findIndex(
        existingItem => existingItem.productId === item.productId &&
        JSON.stringify(existingItem.variant) === JSON.stringify(item.variant)
      );

      // All Firebase cart operations disabled
  }

  // Update item quantity - DISABLED
  async updateQuantity(itemId: string, quantity: number): Promise<CartItem[]> {
    console.error('🚨 EMERGENCY: Firebase updateQuantity DISABLED - quota exhausted');
    throw new Error('Firebase operations disabled due to quota exhaustion. Please try again later.');
  }

  // Remove item from cart - DISABLED
  async removeFromCart(itemId: string): Promise<CartItem[]> {
    console.error('🚨 EMERGENCY: Firebase removeFromCart DISABLED - quota exhausted');
    throw new Error('Firebase operations disabled due to quota exhaustion. Please try again later.');
  }

  // Clear entire cart - DISABLED
  async clearCart(): Promise<void> {
    console.error('🚨 EMERGENCY: Firebase clearCart DISABLED - quota exhausted');
    throw new Error('Firebase operations disabled due to quota exhaustion. Please try again later.');
  }

  // Handle user logout - clear cart from Firebase
  async handleLogout(): Promise<void> {
    try {
      const user = auth.currentUser;
      if (user) {
        await this.clearCart();
        console.log('✅ Cart cleared on logout');
      }
    } catch (error) {
      console.error('Error handling logout:', error);
    }
  }

  // Get cart total
  async getCartTotal(): Promise<number> {
    const cart = await this.getCart();
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  // Get cart items count
  async getCartCount(): Promise<number> {
    const cart = await this.getCart();
    return cart.reduce((total, item) => total + item.quantity, 0);
  }

  // Check if product is in cart
  async isInCart(productId: string, variant?: any): Promise<boolean> {
    const cart = await this.getCart();
    return cart.some(item =>
      item.productId === productId &&
      JSON.stringify(item.variant) === JSON.stringify(variant)
    );
  }

  // Private methods
  private async getCartFromFirebase(userId: string): Promise<CartItem[] | null> {
    try {
      console.log('🔥 Loading cart from Firebase for user:', userId);

      const cartRef = doc(db, 'user_carts', userId);
      const cartDoc = await getDoc(cartRef);

      if (cartDoc.exists()) {
        const data = cartDoc.data();
        const items = data?.items || [];
        console.log('✅ Cart loaded from Firebase:', items.length, 'items');
        return items;
      } else {
        console.log('ℹ️ No cart found in Firebase for user:', userId);
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting cart from Firebase:', error);
      return null;
    }
  }

  private async saveCartToFirebase(userId: string, cart: CartItem[]): Promise<void> {
    try {
      console.log('🔥 Saving cart to Firebase for user:', userId, 'Items:', cart.length);

      const cartRef = doc(db, 'user_carts', userId);
      await setDoc(cartRef, {
        userId: userId,
        items: cart,
        lastUpdated: new Date().toISOString()
      });

      console.log('✅ Cart saved to Firebase successfully');
    } catch (error) {
      console.error('❌ Error saving cart to Firebase:', error);
      throw error;
    }
  }

  
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export const cartService = new CartService();