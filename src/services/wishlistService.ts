import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    getDocs,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';

export const wishlistService = {
    // Add item to wishlist
    addToWishlist: async (userId: string, product: Product) => {
        if (!userId || !product?.id) return false;

        try {
            const wishlistRef = doc(db, 'users', userId, 'wishlist', product.id);

            // Store minimal product data for display even if product is deleted later
            await setDoc(wishlistRef, {
                productId: product.id,
                name: product.name,
                image: product.image || product.images?.[0] || '',
                price: product.retailPrice || 0,
                addedAt: serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('Error adding to wishlist:', error);
            return false;
        }
    },

    // Remove item from wishlist
    removeFromWishlist: async (userId: string, productId: string) => {
        if (!userId || !productId) return false;

        try {
            const wishlistRef = doc(db, 'users', userId, 'wishlist', productId);
            await deleteDoc(wishlistRef);
            return true;
        } catch (error) {
            console.error('Error removing from wishlist:', error);
            return false;
        }
    },

    // Get all wishlist item IDs (for checking status)
    getWishlistIds: async (userId: string): Promise<string[]> => {
        if (!userId) return [];

        try {
            const wishlistCol = collection(db, 'users', userId, 'wishlist');
            const snapshot = await getDocs(wishlistCol);
            return snapshot.docs.map(doc => doc.id);
        } catch (error) {
            console.error('Error getting wishlist IDs:', error);
            return [];
        }
    },

    // Get full wishlist items (real-time listener)
    subscribeToWishlist: (userId: string, callback: (items: any[]) => void) => {
        if (!userId) return () => { };

        const wishlistCol = collection(db, 'users', userId, 'wishlist');

        return onSnapshot(wishlistCol, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(items);
        });
    }
};
