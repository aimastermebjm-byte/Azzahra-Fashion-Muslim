// Cart Service - Sync cart across devices using user account
// This service handles cart synchronization between localStorage and Firebase

import { auth } from '../utils/firebaseClient';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
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
  private readonly LOCAL_STORAGE_KEY = 'azzahra_cart';
  private readonly FIREBASE_COLLECTION = 'user_carts';

  // Get current user's cart (sync from Firebase or localStorage)
  async getCart(): Promise<CartItem[]> {
    try {
      const user = auth.currentUser;

      if (user) {
        // Logged in user - try to sync from Firebase first
        const firebaseCart = await this.getCartFromFirebase(user.uid);
        if (firebaseCart && firebaseCart.length > 0) {
          // Sync to localStorage as backup
          this.saveCartToLocalStorage(firebaseCart);
          return firebaseCart;
        } else {
          // No Firebase cart, use localStorage and sync to Firebase
          const localCart = this.getCartFromLocalStorage();
          if (localCart.length > 0) {
            await this.saveCartToFirebase(user.uid, localCart);
          }
          return localCart;
        }
      } else {
        // Guest user - use localStorage only
        return this.getCartFromLocalStorage();
      }
    } catch (error) {
      console.error('Error getting cart:', error);
      return this.getCartFromLocalStorage();
    }
  }

  // Add item to cart
  async addToCart(item: Omit<CartItem, 'id' | 'addedAt'>): Promise<CartItem[]> {
    try {
      const cartItem: CartItem = {
        ...item,
        id: this.generateId(),
        addedAt: new Date().toISOString()
      };

      const currentCart = await this.getCart();
      const existingItemIndex = currentCart.findIndex(
        cartItem => cartItem.productId === item.productId &&
        JSON.stringify(cartItem.variant) === JSON.stringify(item.variant)
      );

      let updatedCart: CartItem[];

      if (existingItemIndex !== -1) {
        // Update quantity if item exists
        updatedCart = currentCart.map((item, index) =>
          index === existingItemIndex
            ? { ...item, quantity: item.quantity + cartItem.quantity }
            : item
        );
      } else {
        // Add new item
        updatedCart = [...currentCart, cartItem];
      }

      // Save both locally and to Firebase
      this.saveCartToLocalStorage(updatedCart);

      const user = auth.currentUser;
      if (user) {
        await this.saveCartToFirebase(user.uid, updatedCart);
      }

      return updatedCart;
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  }

  // Update item quantity
  async updateQuantity(itemId: string, quantity: number): Promise<CartItem[]> {
    try {
      const currentCart = await this.getCart();

      if (quantity === 0) {
        return this.removeFromCart(itemId);
      }

      const updatedCart = currentCart.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      );

      // Save both locally and to Firebase
      this.saveCartToLocalStorage(updatedCart);

      const user = auth.currentUser;
      if (user) {
        await this.saveCartToFirebase(user.uid, updatedCart);
      }

      return updatedCart;
    } catch (error) {
      console.error('Error updating quantity:', error);
      throw error;
    }
  }

  // Remove item from cart
  async removeFromCart(itemId: string): Promise<CartItem[]> {
    try {
      const currentCart = await this.getCart();
      const updatedCart = currentCart.filter(item => item.id !== itemId);

      // Save both locally and to Firebase
      this.saveCartToLocalStorage(updatedCart);

      const user = auth.currentUser;
      if (user) {
        await this.saveCartToFirebase(user.uid, updatedCart);
      }

      return updatedCart;
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  }

  // Clear entire cart
  async clearCart(): Promise<void> {
    try {
      console.log('🗑️ Clearing cart from localStorage and Firebase...');

      // Clear localStorage
      this.saveCartToLocalStorage([]);

      // Clear Firebase
      const user = auth.currentUser;
      if (user) {
        await this.saveCartToFirebase(user.uid, []);
        console.log('🔥 Firebase cart cleared for user:', user.uid);
      }

      console.log('✅ Cart cleared from all sources');
    } catch (error) {
      console.error('❌ Error clearing cart:', error);
      throw error;
    }
  }

  // Sync cart when user logs in/out
  async syncCartOnLogin(user: any): Promise<CartItem[]> {
    try {
      const localCart = this.getCartFromLocalStorage();

      // Get user's cart from Firebase
      const firebaseCart = await this.getCartFromFirebase(user.uid);

      let finalCart: CartItem[];

      if (firebaseCart && firebaseCart.length > 0) {
        // Merge local and Firebase carts (avoid duplicates)
        const mergedCart = this.mergeCarts(localCart, firebaseCart);
        finalCart = mergedCart;
      } else {
        // Use local cart and save to Firebase
        finalCart = localCart;
      }

      // Save final cart to both places
      this.saveCartToLocalStorage(finalCart);
      await this.saveCartToFirebase(user.uid, finalCart);

      return finalCart;
    } catch (error) {
      console.error('Error syncing cart on login:', error);
      return this.getCartFromLocalStorage();
    }
  }

  // Handle user logout
  async handleLogout(): Promise<void> {
    try {
      // Clear local cart when logging out
      this.saveCartToLocalStorage([]);
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
  private getCartFromLocalStorage(): CartItem[] {
    try {
      const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      return parsed.map((item: any) => ({
        ...item,
        addedAt: item.addedAt
      }));
    } catch (error) {
      console.error('Error getting cart from localStorage:', error);
      return [];
    }
  }

  private saveCartToLocalStorage(cart: CartItem[]): void {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }

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

  private mergeCarts(localCart: CartItem[], firebaseCart: CartItem[]): CartItem[] {
    const mergedCart = [...firebaseCart];

    // Add items from local cart that don't exist in Firebase cart
    localCart.forEach(localItem => {
      const existsInFirebase = firebaseCart.some(firebaseItem =>
        firebaseItem.productId === localItem.productId &&
        JSON.stringify(firebaseItem.variant) === JSON.stringify(localItem.variant)
      );

      if (!existsInFirebase) {
        mergedCart.push(localItem);
      }
    });

    return mergedCart;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export const cartService = new CartService();