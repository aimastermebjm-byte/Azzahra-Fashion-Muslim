import { useState, useEffect, useCallback, useMemo } from 'react';
import { wishlistService } from '../services/wishlistService';
import { Product } from '../types';

export const useWishlist = (user: any) => {
    const [wishlistItems, setWishlistItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Real-time subscription to wishlist
    useEffect(() => {
        if (!user?.uid) {
            setWishlistItems([]);
            return;
        }

        setLoading(true);
        const unsubscribe = wishlistService.subscribeToWishlist(user.uid, (items) => {
            setWishlistItems(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Derived state for quick lookup
    const wishlistIds = useMemo(() => {
        return new Set(wishlistItems.map(item => item.id));
    }, [wishlistItems]);

    const isInWishlist = useCallback((productId: string) => {
        return wishlistIds.has(productId);
    }, [wishlistIds]);

    const toggleWishlist = useCallback(async (product: Product) => {
        if (!user?.uid) return false;

        if (wishlistIds.has(product.id)) {
            await wishlistService.removeFromWishlist(user.uid, product.id);
            return false; // Removed
        } else {
            await wishlistService.addToWishlist(user.uid, product);
            return true; // Added
        }
    }, [user, wishlistIds]);

    return {
        wishlistItems,
        loading,
        isInWishlist,
        toggleWishlist
    };
};
