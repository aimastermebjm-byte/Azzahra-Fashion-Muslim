
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    getDocs,
    Timestamp,
    limit
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export interface StockMutation {
    id?: string;
    productId: string;
    productName: string;
    size: string;
    variant: string;
    previousStock: number;
    newStock: number;
    change: number;
    type: 'order' | 'restock' | 'stock_opname' | 'adjustment' | 'return';
    referenceId: string; // Order ID, Opname Session ID, etc.
    notes?: string;
    createdAt: Date;
    createdBy: string; // User ID
    performedBy: string; // User Name
}

const COLLECTION_NAME = 'stock_mutations';

export const stockMutationService = {
    /**
     * Log a stock mutation
     */
    async logMutation(mutation: Omit<StockMutation, 'id' | 'createdAt'>): Promise<string> {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...mutation,
                createdAt: Timestamp.now()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error logging mutation:', error);
            throw error;
        }
    },

    /**
     * Get mutation history for a specific product variant
     */
    async getHistory(
        productId: string,
        size: string,
        variant: string,
        limitCount: number = 50
    ): Promise<StockMutation[]> {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('productId', '==', productId),
                where('size', '==', size),
                where('variant', '==', variant),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            );

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: (doc.data().createdAt as Timestamp).toDate()
            })) as StockMutation[];
        } catch (error) {
            console.error('Error fetching mutation history:', error);
            throw error;
        }
    }
};
