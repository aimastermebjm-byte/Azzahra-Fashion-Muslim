// Cart Service - Firebase-only Cart System
// Direct Firebase operations with persistence support

import { auth } from '../utils/firebaseClient';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { cartCache } from '../utils/cartCache';

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

  // Get current user's cart with cache-first approach
  async getCart(): Promise<CartItem[]> {
    try {
      const user = auth.currentUser;

      if (!user) {
        console.log('❌ No user logged in - cart requires authentication');
        return [];
      }

      // Cache-first: coba dari localStorage dulu
      console.log('🔍 Trying cache first for cart...');
      const cachedCart = cartCache.getCart(user.uid);

      if (cachedCart) {
        console.log('✅ Using cached cart:', cachedCart.length, 'items');

        // Background sync jika cache sudah tua
        const cacheAge = cartCache.getCacheAge(user.uid);
        if (cacheAge > 5 * 60 * 1000) { // 5 minutes
          console.log('🔄 Cart cache expired, background syncing...');
          setTimeout(() => this.syncFromFirebase(user.uid), 1000);
        }

        return cachedCart;
      }

      // Load dari Firebase jika tidak ada cache
      console.log('🔥 Loading cart from Firebase for user:', user.uid);
      const firebaseCart = await this.getCartFromFirebase(user.uid);

      if (firebaseCart && firebaseCart.length > 0) {
        console.log('✅ Cart loaded from Firebase:', firebaseCart.length, 'items');
        cartCache.setCart(user.uid, firebaseCart);
        return firebaseCart;
      } else {
        console.log('ℹ️ No cart found in Firebase - returning empty cart');
        cartCache.setCart(user.uid, []);
        return [];
      }
    } catch (error) {
      console.error('❌ Error getting cart from Firebase:', error);
      return [];
    }
  }

  // Set up real-time cart listener
  onCartChange(callback: (items: CartItem[]) => void): () => void {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No user for real-time cart listener');
      return () => {};
    }

    console.log('🔄 Setting up real-time cart listener for user:', user.uid);

    const cartRef = doc(db, this.FIREBASE_COLLECTION, user.uid);
    const unsubscribe = onSnapshot(cartRef, (docSnapshot) => {
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

  // Add item to cart
  async addToCart(item: Omit<CartItem, 'id' | 'addedAt'>): Promise<CartItem[]> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated - cannot add to cart');
      }

      // NOTE: Stock reduction moved to checkout to prevent holding stock for abandoned carts
      // Only check if product exists and has sufficient stock
      const stockCheckSuccess = await this.checkProductStock(item.productId, item.quantity, item.variant);
      if (!stockCheckSuccess) {
        throw new Error('Insufficient stock available');
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

      // Save to Firebase only
      await this.saveCartToFirebase(user.uid, updatedCart);
      console.log('✅ Cart updated in Firebase:', updatedCart.length, 'items');

      return updatedCart;
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  }

  // Update item quantity
  async updateQuantity(itemId: string, quantity: number): Promise<CartItem[]> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated - cannot update cart');
      }

      if (quantity === 0) {
        return this.removeFromCart(itemId);
      }

      const currentCart = await this.getCart();
      const itemToUpdate = currentCart.find(item => item.id === itemId);

      if (!itemToUpdate) {
        throw new Error('Item not found in cart');
      }

      const quantityDifference = quantity - itemToUpdate.quantity;

      // NOTE: Stock reduction moved to checkout - only check if sufficient stock is available
      if (quantityDifference > 0) {
        const stockCheckSuccess = await this.checkProductStock(
          itemToUpdate.productId,
          quantityDifference,
          itemToUpdate.variant
        );
        if (!stockCheckSuccess) {
          throw new Error('Insufficient stock available for quantity increase');
        }
      }
      // Stock reduction will happen at checkout

      const updatedCart = currentCart.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      );

      // Save to Firebase only
      await this.saveCartToFirebase(user.uid, updatedCart);
      console.log('✅ Cart quantity updated in Firebase');

      return updatedCart;
    } catch (error) {
      console.error('Error updating quantity:', error);
      throw error;
    }
  }

  // Remove item from cart
  async removeFromCart(itemId: string): Promise<CartItem[]> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated - cannot remove from cart');
      }

      const currentCart = await this.getCart();
      const updatedCart = currentCart.filter(item => item.id !== itemId);

      // Save to Firebase only
      await this.saveCartToFirebase(user.uid, updatedCart);
      console.log('✅ Item removed from Firebase cart:', itemId);

      return updatedCart;
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  }

  // Check if product has sufficient stock (no reduction)
  private async checkProductStock(productId: string, quantity: number, variant?: CartItem['variant']): Promise<boolean> {
    try {
      console.log('🔍 Checking stock for product:', productId, 'Quantity:', quantity, 'Variant:', variant);

      const productRef = doc(db, 'products', productId);
      const productDoc = await getDoc(productRef);

      if (!productDoc.exists()) {
        console.error('❌ Product not found:', productId);
        return false;
      }

      const currentData = productDoc.data();
      const currentStock = Number(currentData.stock || 0);

      // Check if there's enough total stock
      if (currentStock < quantity) {
        console.error('❌ Insufficient stock. Available:', currentStock, 'Requested:', quantity);
        return false;
      }

      // Check variant stock if variant info is provided
      if (variant?.size && variant?.color && currentData.variants?.stock) {
        const { size, color } = variant;
        const currentVariantStock = currentData.variants.stock;

        if (currentVariantStock[size] && currentVariantStock[size][color] !== undefined) {
          const currentVariantStockValue = Number(currentVariantStock[size][color] || 0);

          if (currentVariantStockValue < quantity) {
            console.error('❌ Insufficient variant stock. Available:', currentVariantStockValue, 'Requested:', quantity);
            return false;
          }

          console.log(`✅ Sufficient variant stock: ${size}-${color} has ${currentVariantStockValue} available`);
        } else {
          console.warn('⚠️ Variant stock not found for:', size, color, '- checking total stock only');
        }
      }

      console.log('✅ Stock check passed - sufficient stock available');
      return true;
    } catch (error) {
      console.error('❌ Error checking product stock:', error);
      return false;
    }
  }

  // NOTE: Stock reduction moved to useFirebaseProducts.updateProductStock
  // This prevents holding stock for abandoned carts

  // Clear entire cart
  async clearCart(): Promise<void> {
    try {
      console.log('🗑️ Clearing cart from Firebase...');

      const user = auth.currentUser;
      if (!user) {
        console.log('❌ No user logged in - cannot clear cart');
        return;
      }

      // Clear from Firebase only
      await this.saveCartToFirebase(user.uid, []);
      console.log('🔥 Firebase cart cleared for user:', user.uid);

      // Verification step
      await new Promise(resolve => setTimeout(resolve, 300)); // Brief wait
      const verifyEmpty = await this.getCartFromFirebase(user.uid);
      if (verifyEmpty && verifyEmpty.length > 0) {
        console.warn('⚠️ Firebase still has items, forcing clear again...');
        await this.saveCartToFirebase(user.uid, []);
      }

      console.log('✅ Cart PERMANENTLY cleared from Firebase - all devices');
    } catch (error) {
      console.error('❌ Error clearing cart:', error);
      throw error;
    }
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

      // Update cache juga
      cartCache.setCart(userId, cart);
      cartCache.triggerSync(); // Trigger cross-device sync

      console.log('✅ Cart saved to Firebase successfully');
    } catch (error) {
      console.error('❌ Error saving cart to Firebase:', error);
      throw error;
    }
  }

  // Sync cart dari Firebase (untuk background refresh)
  private async syncFromFirebase(userId: string): Promise<void> {
    try {
      console.log('🔄 Syncing cart from Firebase for user:', userId);
      const firebaseCart = await this.getCartFromFirebase(userId);

      if (firebaseCart) {
        cartCache.setCart(userId, firebaseCart);
        console.log('✅ Cart synced from Firebase:', firebaseCart.length, 'items');
      } else {
        cartCache.setCart(userId, []);
        console.log('✅ Cart synced from Firebase: empty');
      }
    } catch (error) {
      console.error('❌ Error syncing cart from Firebase:', error);
    }
  }

  
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export const cartService = new CartService();