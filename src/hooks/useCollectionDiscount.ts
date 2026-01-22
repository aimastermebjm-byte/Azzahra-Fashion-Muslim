import { useState, useEffect } from 'react';
import { collectionService } from '../services/collectionService';
import { Collection } from '../types/collection';

// Simple global cache to prevent re-fetching on every component mount
let globalCollectionsCache: Collection[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useCollectionDiscount = () => {
    const [discountedCollections, setDiscountedCollections] = useState<Collection[]>(globalCollectionsCache);

    useEffect(() => {
        const fetchDiscounts = async () => {
            // Use cache if fresh
            const now = Date.now();
            if (globalCollectionsCache.length > 0 && (now - lastFetchTime < CACHE_DURATION)) {
                setDiscountedCollections(globalCollectionsCache);
                return;
            }

            try {
                // Fetch ALL collections
                // Optimization: In a real large app, we would query only active ones.
                // For now, fetching all is safe as the number of collections is manageable.
                const collections = await collectionService.getAllCollections();

                // Filter only those with valid active discounts
                const activeDiscounts = collections.filter(c =>
                    c.discountAmount &&
                    c.discountAmount > 0 &&
                    c.isActive // Assume collections have an active flag, or default to true
                );

                globalCollectionsCache = activeDiscounts;
                lastFetchTime = now;
                setDiscountedCollections(activeDiscounts);

                console.log('💰 Loaded Global Discounts:', activeDiscounts.length, 'collections');
            } catch (err) {
                console.error('Failed to load collection discounts:', err);
            }
        };

        fetchDiscounts();
    }, []);

    // Helper to get discount for a specific product
    const getProductDiscount = (productId: string): number => {
        // Find highest applicable discount (in case product is in multiple discounted collections)
        let maxDiscount = 0;

        for (const collection of discountedCollections) {
            if (collection.productIds && collection.productIds.includes(productId)) {
                if ((collection.discountAmount || 0) > maxDiscount) {
                    maxDiscount = collection.discountAmount || 0;
                }
            }
        }

        return maxDiscount;
    };

    return {
        discountedCollections,
        getProductDiscount,
        refreshDiscounts: () => {
            lastFetchTime = 0; // Force invalidate
            // Implementation detail: Use a reload trigger if needed
        }
    };
};
