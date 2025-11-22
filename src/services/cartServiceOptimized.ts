// Cart Service - Firestore Persistence Only
// Real-time cart tanpa localStorage cache untuk 0 reads setelah initial load

import { auth } from '../utils/firebaseClient';
import { doc, onSnapshot, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  variant?: {
    size?: string;
    color?: string;
  };
  addedAt: string; // Selalu string untuk Firestore compatibility
}

export interface UserCart {
  userId: string;
  items: CartItem[];
  lastUpdated: Date;
}

class CartServiceOptimized {
  private readonly FIREBASE_COLLECTION = 'user_carts';
  private cartUnsubscribe: (() => void) | null = null;

  // 🔥 FIRESTORE PERSISTENCE: Get cart dengan persistence cache
  async getCart(): Promise<CartItem[]> {
    try {
      const user = auth.currentUser;

      if (!user) {
        console.log('❌ No user logged in - cart requires authentication');
        return [];
      }

      console.log('🔥 Loading cart from Firestore persistence for user:', user.uid);

      const cartRef = doc(db, this.FIREBASE_COLLECTION, user.uid);
      const cartDoc = await getDoc(cartRef);

      if (cartDoc.exists()) {
        const data = cartDoc.data();
        let items = data?.items || [];

        // Validate and sanitize items
        items = items.filter(item =>
          item &&
          item.id &&
          item.productId &&
          item.name &&
          typeof item.price === 'number' &&
          typeof item.quantity === 'number'
        );

        console.log('✅ Cart loaded from Firestore persistence:', items.length, 'items');
        return items;
      } else {
        console.log('ℹ️ No cart found in Firestore - returning empty cart');
        return [];
      }
    } catch (error) {
      console.error('❌ Error getting cart from Firestore:', error);
      // Try to clear corrupted cart and return empty
      try {
        const user = auth.currentUser;
        if (user) {
          const cartRef = doc(db, this.FIREBASE_COLLECTION, user.uid);
          await setDoc(cartRef, {
            userId: user.uid,
            items: [],
            lastUpdated: new Date().toISOString()
          });
          console.log('🗑️ Cleared corrupted cart data');
        }
      } catch (clearError) {
        console.error('❌ Failed to clear corrupted cart:', clearError);
      }
      return [];
    }
  }

  // 🔥 FIRESTORE PERSISTENCE: Real-time listener tanpa localStorage cache
  onCartChange(callback: (items: CartItem[]) => void): () => void {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No user for real-time cart listener');
      return () => {};
    }

    console.log('🔄 Setting up Firestore persistence cart listener for user:', user.uid);

    const cartRef = doc(db, this.FIREBASE_COLLECTION, user.uid);

    this.cartUnsubscribe = onSnapshot(cartRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const items = data?.items || [];
        console.log('📦 Real-time cart update (0 reads - from cache):', items.length, 'items');
        callback(items);
      } else {
        console.log('📦 Real-time cart update: empty cart');
        callback([]);
      }
    }, (error) => {
      console.error('❌ Real-time cart listener error:', error);
    });

    return () => {
      if (this.cartUnsubscribe) {
        console.log('🔄 Unsubscribing from cart listener');
        this.cartUnsubscribe();
        this.cartUnsubscribe = null;
      }
    };
  }

  // 🔥 FIRESTORE PERSISTENCE: Add item to cart
  async addToCart(product: any, quantity: number = 1, variant?: { size?: string; color?: string }): Promise<boolean> {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log('❌ No user logged in');
        return false;
      }

      console.log('🛒 Adding to cart via Firestore persistence:', product.name);

      const cartRef = doc(db, this.FIREBASE_COLLECTION, user.uid);
      const cartDoc = await getDoc(cartRef);

      let currentItems: CartItem[] = [];
      if (cartDoc.exists()) {
        const data = cartDoc.data();
        currentItems = data?.items || [];
      }

      // Check if item already exists
      const existingItemIndex = currentItems.findIndex(item =>
        item.productId === product.id &&
        item.variant?.size === variant?.size &&
        item.variant?.color === variant?.color
      );

      if (existingItemIndex >= 0) {
        // Update quantity
        currentItems[existingItemIndex].quantity += quantity;
        console.log(`📊 Updated quantity for existing item: ${currentItems[existingItemIndex].quantity}`);
      } else {
        // Add new item
        const cartItem: CartItem = {
          id: this.generateCartItemId(),
          productId: product.id || '',
          name: product.name || 'Unknown Product',
          price: Number(user?.role === 'reseller' ? product.resellerPrice : product.retailPrice) || 0,
          quantity: Number(quantity) || 1,
          image: product.image || product.images?.[0] || '/placeholder-product.jpg',
          ...(variant && { variant }), // Hanya include variant jika ada
          addedAt: new Date().toISOString()
        };
        currentItems.push(cartItem);
        console.log(`📦 Added new item to cart: ${cartItem.name}`);
      }

      // Save to Firestore
      await setDoc(cartRef, {
        userId: user.uid,
        items: currentItems,
        lastUpdated: new Date().toISOString()
      });

      console.log('✅ Cart updated successfully in Firestore');
      return true;

    } catch (error) {
      console.error('❌ Error adding to cart:', error);
      return false;
    }
  }

  // 🔥 FIRESTORE PERSISTENCE: Update cart item quantity
  async updateQuantity(itemId: string, newQuantity: number): Promise<boolean> {
    try {
      const user = auth.currentUser;
      if (!user) return false;

      console.log(`🔄 Updating cart item quantity: ${itemId} → ${newQuantity}`);

      const cartRef = doc(db, this.FIREBASE_COLLECTION, user.uid);
      const cartDoc = await getDoc(cartRef);

      if (!cartDoc.exists()) return false;

      const data = cartDoc.data();
      let items = data?.items || [];

      if (newQuantity <= 0) {
        // Remove item
        items = items.filter((item: CartItem) => item.id !== itemId);
        console.log('🗑️ Removed item from cart');
      } else {
        // Update quantity
        const itemIndex = items.findIndex((item: CartItem) => item.id === itemId);
        if (itemIndex >= 0) {
          items[itemIndex].quantity = newQuantity;
          console.log('📊 Updated item quantity');
        }
      }

      await updateDoc(cartRef, {
        items: items,
        lastUpdated: new Date().toISOString()
      });

      console.log('✅ Cart quantity updated successfully');
      return true;

    } catch (error) {
      console.error('❌ Error updating cart quantity:', error);
      return false;
    }
  }

  // 🔥 FIRESTORE PERSISTENCE: Remove item from cart
  async removeFromCart(itemId: string): Promise<boolean> {
    try {
      const user = auth.currentUser;
      if (!user) return false;

      console.log(`🗑️ Removing item from cart: ${itemId}`);

      const cartRef = doc(db, this.FIREBASE_COLLECTION, user.uid);
      const cartDoc = await getDoc(cartRef);

      if (!cartDoc.exists()) return false;

      const data = cartDoc.data();
      let items = data?.items || [];

      // Remove item
      items = items.filter((item: CartItem) => item.id !== itemId);

      await updateDoc(cartRef, {
        items: items,
        lastUpdated: new Date().toISOString()
      });

      console.log('✅ Item removed from cart successfully');
      return true;

    } catch (error) {
      console.error('❌ Error removing from cart:', error);
      return false;
    }
  }

  // 🔥 FIRESTORE PERSISTENCE: Clear cart
  async clearCart(): Promise<boolean> {
    try {
      const user = auth.currentUser;
      if (!user) return false;

      console.log('🗑️ Clearing cart');

      const cartRef = doc(db, this.FIREBASE_COLLECTION, user.uid);
      await setDoc(cartRef, {
        userId: user.uid,
        items: [],
        lastUpdated: new Date().toISOString()
      });

      console.log('✅ Cart cleared successfully');
      return true;

    } catch (error) {
      console.error('❌ Error clearing cart:', error);
      return false;
    }
  }

  // 🔥 FIRESTORE PERSISTENCE: Check product stock before adding
  async checkProductStock(productId: string, quantity: number, variant?: CartItem['variant']): Promise<boolean> {
    try {
      // Read from batch system instead of individual products
      const batchRef = doc(db, 'productBatches', 'batch_1');
      const batchDoc = await getDoc(batchRef);

      if (!batchDoc.exists()) {
        console.error('❌ Batch document not found for stock check');
        return false;
      }

      const batchProducts = batchDoc.data().products || [];
      const currentData = batchProducts.find((p: any) => p.id === productId);

      if (!currentData) {
        console.error('❌ Product not found in batch:', productId);
        return false;
      }

      if (variant?.size && variant?.color && currentData.variants?.stock) {
        // Check variant stock
        const variantStock = currentData.variants.stock[variant.size]?.[variant.color];
        const availableStock = Number(variantStock || 0);
        console.log(`📊 Variant stock check for ${variant.size}-${variant.color}: ${availableStock} >= ${quantity}`);
        return availableStock >= quantity;
      } else {
        // Check total stock
        const availableStock = Number(currentData.stock || 0);
        console.log(`📊 Stock check for ${currentData.name}: ${availableStock} >= ${quantity}`);
        return availableStock >= quantity;
      }
    } catch (error) {
      console.error('❌ Error checking product stock:', error);
      return false;
    }
  }

  // Generate unique cart item ID
  private generateCartItemId(): string {
    return 'cart_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Get cart total
  getCartTotal(items: CartItem[]): number {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  // Get cart items count
  getCartItemsCount(items: CartItem[]): number {
    return items.reduce((total, item) => total + item.quantity, 0);
  }
}

// Singleton instance
export const cartServiceOptimized = new CartServiceOptimized();