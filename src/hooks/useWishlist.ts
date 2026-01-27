import { useState, useEffect, useCallback, useMemo } from 'react';
import { Product } from '../types';

/**
 * Custom hook for managing wishlist using localStorage
 * Each user has their own wishlist stored with key: `wishlist_${userId}`
 * This avoids Firebase costs while maintaining per-user persistence
 */
export const useWishlist = (user: any) => {
    const [wishlistItems, setWishlistItems] = useState<string[]>([]); // Array of product IDs
    const [loading, setLoading] = useState(true);

    // Get storage key based on user
    const storageKey = useMemo(() => {
        return user?.uid ? `wishlist_${user.uid}` : 'wishlist_guest';
    }, [user?.uid]);

    // Load wishlist from localStorage
    useEffect(() => {
        setLoading(true);
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                setWishlistItems(JSON.parse(stored));
            } else {
                setWishlistItems([]);
            }
        } catch (error) {
            console.error('Error loading wishlist from localStorage:', error);
            setWishlistItems([]);
        } finally {
            setLoading(false);
        }
    }, [storageKey]);

    // Save to localStorage whenever wishlist changes
    const saveToStorage = useCallback((items: string[]) => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(items));
        } catch (error) {
            console.error('Error saving wishlist to localStorage:', error);
        }
    }, [storageKey]);

    // Derived state for quick lookup
    const wishlistIds = useMemo(() => {
        return new Set(wishlistItems);
    }, [wishlistItems]);

    const isInWishlist = useCallback((productId: string) => {
        return wishlistIds.has(productId);
    }, [wishlistIds]);

    const toggleWishlist = useCallback((product: Product): boolean => {
        if (!user?.uid) {
            console.warn('User not logged in, wishlist not saved');
            return false;
        }

        let newItems: string[];
        let added: boolean;

        if (wishlistIds.has(product.id)) {
            // Remove from wishlist
            newItems = wishlistItems.filter(id => id !== product.id);
            added = false;
        } else {
            // Add to wishlist
            newItems = [...wishlistItems, product.id];
            added = true;
        }

        setWishlistItems(newItems);
        saveToStorage(newItems);
        return added;
    }, [user, wishlistIds, wishlistItems, saveToStorage]);

    const removeFromWishlist = useCallback((productId: string) => {
        const newItems = wishlistItems.filter(id => id !== productId);
        setWishlistItems(newItems);
        saveToStorage(newItems);
    }, [wishlistItems, saveToStorage]);

    const clearWishlist = useCallback(() => {
        setWishlistItems([]);
        saveToStorage([]);
    }, [saveToStorage]);

    return {
        wishlistItems,
        wishlistCount: wishlistItems.length,
        loading,
        isInWishlist,
        toggleWishlist,
        removeFromWishlist,
        clearWishlist
    };
};

export default useWishlist;
