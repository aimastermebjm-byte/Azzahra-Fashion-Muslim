// Stock Opname Service - Firebase operations

import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    query,
    orderBy,
    getDocs,
    Timestamp
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { StockOpnameSession, StockOpnameItem } from '../types/stockOpname';
import { Product } from '../types';

const COLLECTION_NAME = 'stockOpnameSessions';

export const stockOpnameService = {
    /**
     * Load inventory data - flatten products to items (1 row per size+variant)
     */
    async loadInventoryData(): Promise<StockOpnameItem[]> {
        try {
            // Get products from batch system
            const batchRef = doc(db, 'productBatches', 'batch_1');
            const batchSnap = await getDoc(batchRef);

            if (!batchSnap.exists()) {
                console.log('❌ No product batch found');
                return [];
            }

            const products: Product[] = batchSnap.data().products || [];
            const items: StockOpnameItem[] = [];

            // Flatten each product's variants to individual items
            for (const product of products) {
                const sizes = product.variants?.sizes || [];
                const colors = product.variants?.colors || [];  // This is "variants" in data
                const stockMap = product.variants?.stock || {};

                // If no variants, create single item with main stock
                if (sizes.length === 0 && colors.length === 0) {
                    items.push({
                        productId: product.id,
                        productName: product.name,
                        productImage: product.image || product.images?.[0] || '',
                        size: '-',
                        variant: '-',
                        systemStock: product.stock || 0,
                        actualStock: null,
                        difference: null,
                    });
                    continue;
                }

                // Flatten variants
                for (const size of sizes) {
                    const sizeStock = stockMap[size] || {};

                    if (colors.length === 0) {
                        // Only sizes, no colors
                        items.push({
                            productId: product.id,
                            productName: product.name,
                            productImage: product.image || product.images?.[0] || '',
                            size: size,
                            variant: '-',
                            systemStock: typeof sizeStock === 'number' ? sizeStock : 0,
                            actualStock: null,
                            difference: null,
                        });
                    } else {
                        // Both sizes and colors
                        for (const color of colors) {
                            const stock = sizeStock[color] ?? 0;
                            items.push({
                                productId: product.id,
                                productName: product.name,
                                productImage: product.image || product.images?.[0] || '',
                                size: size,
                                variant: color,
                                systemStock: stock,
                                actualStock: null,
                                difference: null,
                            });
                        }
                    }
                }
            }

            console.log(`✅ Loaded ${items.length} items from ${products.length} products`);
            return items;
        } catch (error) {
            console.error('❌ Error loading inventory:', error);
            throw error;
        }
    },

    /**
     * Create new opname session
     */
    async createSession(userId: string, userName: string): Promise<string> {
        try {
            const items = await this.loadInventoryData();

            const sessionId = `opname_${Date.now()}`;
            const session: StockOpnameSession = {
                id: sessionId,
                createdAt: new Date(),
                createdBy: userId,
                createdByName: userName,
                status: 'draft',
                items: items,
                totalItems: items.length,
                countedItems: 0,
                itemsWithDifference: 0,
            };

            await setDoc(doc(db, COLLECTION_NAME, sessionId), {
                ...session,
                createdAt: Timestamp.fromDate(session.createdAt),
            });

            console.log(`✅ Created session ${sessionId} with ${items.length} items`);
            return sessionId;
        } catch (error) {
            console.error('❌ Error creating session:', error);
            throw error;
        }
    },

    /**
     * Get session by ID
     */
    async getSession(sessionId: string): Promise<StockOpnameSession | null> {
        try {
            const docRef = doc(db, COLLECTION_NAME, sessionId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) return null;

            const data = docSnap.data();
            return {
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                approvedAt: data.approvedAt?.toDate(),
            } as StockOpnameSession;
        } catch (error) {
            console.error('❌ Error getting session:', error);
            throw error;
        }
    },

    /**
     * Update item count
     */
    async updateItemCount(
        sessionId: string,
        productId: string,
        size: string,
        variant: string,
        actualStock: number,
        notes?: string
    ): Promise<void> {
        try {
            const session = await this.getSession(sessionId);
            if (!session) throw new Error('Session not found');

            // Find and update the item
            const updatedItems = session.items.map(item => {
                if (item.productId === productId && item.size === size && item.variant === variant) {
                    const difference = actualStock - item.systemStock;
                    const updatedItem: any = {
                        ...item,
                        actualStock,
                        difference,
                        countedAt: Timestamp.fromDate(new Date()),
                    };
                    // Only add notes if it's defined (Firestore doesn't accept undefined)
                    if (notes !== undefined) {
                        updatedItem.notes = notes;
                    }
                    return updatedItem;
                }
                return item;
            });

            // Calculate stats
            const countedItems = updatedItems.filter(i => i.actualStock !== null).length;
            const itemsWithDifference = updatedItems.filter(i => i.difference !== null && i.difference !== 0).length;

            await updateDoc(doc(db, COLLECTION_NAME, sessionId), {
                items: updatedItems,
                countedItems,
                itemsWithDifference,
            });

            console.log(`✅ Updated item: ${productId} ${size} ${variant} = ${actualStock}`);
        } catch (error) {
            console.error('❌ Error updating item:', error);
            throw error;
        }
    },

    /**
     * Submit session for approval
     */
    async submitForApproval(sessionId: string): Promise<void> {
        try {
            await updateDoc(doc(db, COLLECTION_NAME, sessionId), {
                status: 'pending_approval',
            });
            console.log(`✅ Session ${sessionId} submitted for approval`);
        } catch (error) {
            console.error('❌ Error submitting:', error);
            throw error;
        }
    },

    /**
     * Approve and apply stock adjustments
     */
    async approveAndApply(sessionId: string, approverId: string): Promise<void> {
        try {
            const session = await this.getSession(sessionId);
            if (!session) throw new Error('Session not found');

            // Update product stocks in batch
            const batchRef = doc(db, 'productBatches', 'batch_1');
            const batchSnap = await getDoc(batchRef);

            if (!batchSnap.exists()) throw new Error('Product batch not found');

            const products: Product[] = batchSnap.data().products || [];

            // Apply stock changes
            for (const item of session.items) {
                if (item.actualStock === null) continue;

                const productIndex = products.findIndex(p => p.id === item.productId);
                if (productIndex === -1) continue;

                const product = products[productIndex];

                // Update variant stock
                if (product.variants?.stock && item.size !== '-' && item.variant !== '-') {
                    if (!product.variants.stock[item.size]) {
                        product.variants.stock[item.size] = {};
                    }
                    product.variants.stock[item.size][item.variant] = item.actualStock;

                    // Recalculate total stock
                    let totalStock = 0;
                    Object.values(product.variants.stock).forEach((sizeStock: any) => {
                        Object.values(sizeStock).forEach((colorStock: any) => {
                            totalStock += Number(colorStock || 0);
                        });
                    });
                    product.stock = totalStock;
                } else {
                    // No variants - update main stock
                    product.stock = item.actualStock;
                }

                products[productIndex] = product;
            }

            // Save updated products
            await updateDoc(batchRef, {
                products,
                lastModified: Date.now(),
            });

            // Mark session as approved
            await updateDoc(doc(db, COLLECTION_NAME, sessionId), {
                status: 'approved',
                approvedBy: approverId,
                approvedAt: Timestamp.fromDate(new Date()),
            });

            console.log(`✅ Session ${sessionId} approved and stock updated`);
        } catch (error) {
            console.error('❌ Error approving:', error);
            throw error;
        }
    },

    /**
     * Reject opname session
     */
    async rejectOpname(sessionId: string, reason: string): Promise<void> {
        try {
            await updateDoc(doc(db, COLLECTION_NAME, sessionId), {
                status: 'rejected',
                rejectedReason: reason,
            });
            console.log(`✅ Session ${sessionId} rejected`);
        } catch (error) {
            console.error('❌ Error rejecting:', error);
            throw error;
        }
    },

    /**
     * Get session history
     */
    async getSessionHistory(): Promise<StockOpnameSession[]> {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    approvedAt: data.approvedAt?.toDate(),
                } as StockOpnameSession;
            });
        } catch (error) {
            console.error('❌ Error getting history:', error);
            throw error;
        }
    },

    /**
     * Delete a draft session
     */
    async deleteSession(sessionId: string): Promise<void> {
        try {
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, COLLECTION_NAME, sessionId));
            console.log(`✅ Session ${sessionId} deleted`);
        } catch (error) {
            console.error('❌ Error deleting:', error);
            throw error;
        }
    },
};
