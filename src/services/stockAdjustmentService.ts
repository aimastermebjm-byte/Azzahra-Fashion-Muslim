
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    getDocs,
    Timestamp,
    doc,
    updateDoc,
    getDoc,
    writeBatch
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { stockMutationService } from './stockMutationService';

export interface StockAdjustmentRequest {
    id?: string;
    productId: string;
    productName: string;
    size: string;
    variant: string;
    currentStock: number;
    proposedStock: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    requesterId: string;
    requesterName: string;
    createdAt: Date;
    respondedAt?: Date;
    responderId?: string; // Owner ID
    rejectionReason?: string;
}

const COLLECTION_NAME = 'stock_adjustments';

export const stockAdjustmentService = {
    /**
     * Create a new adjustment request (Address Admin -> Owner)
     */
    async createRequest(
        data: Omit<StockAdjustmentRequest, 'id' | 'createdAt' | 'status' | 'respondedAt' | 'responderId'>
    ): Promise<string> {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...data,
                status: 'pending',
                createdAt: Timestamp.now()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating adjustment request:', error);
            throw error;
        }
    },

    /**
     * Get pending adjustment requests
     */
    async getPendingRequests(): Promise<StockAdjustmentRequest[]> {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('status', '==', 'pending'),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: (doc.data().createdAt as Timestamp).toDate()
            })) as StockAdjustmentRequest[];
        } catch (error) {
            console.error('Error fetching pending requests:', error);
            throw error;
        }
    },

    /**
     * Approve adjustment: Update stock, Log mutation, Update request status
     */
    async approveRequest(
        requestId: string,
        approverId: string,
        approverName: string // Used as performedBy in logs
    ): Promise<void> {
        try {
            const requestRef = doc(db, COLLECTION_NAME, requestId);
            const requestSnap = await getDoc(requestRef);

            if (!requestSnap.exists()) {
                throw new Error('Request not found');
            }

            const request = requestSnap.data() as StockAdjustmentRequest;
            if (request.status !== 'pending') {
                throw new Error('Request is already processed');
            }

            // 1. Get Product Batch (Assuming all products are in batch_1 or need generic fetch)
            // Note: Currently system uses 'batch_1'. 
            // We need to find the product document. 
            // Since we store all products in 'productBatches/batch_1' (as per prev context), we fetch that.
            // WARNING: Re-reading entire batch is expensive but consistent with project style.

            const batchRef = doc(db, 'productBatches', 'batch_1');
            const batchSnap = await getDoc(batchRef);

            if (!batchSnap.exists()) throw new Error('Product batch not found');

            const products = batchSnap.data().products || [];
            const productIndex = products.findIndex((p: any) => p.id === request.productId);

            if (productIndex === -1) throw new Error('Product not found in batch');

            const product = products[productIndex];

            // Verify current stock hasn't changed drastically? (Optional check)
            // We trust the adjustment is absolute (proposedStock).

            // 2. Update stock
            // Handle variants
            if (!product.variants || !product.variants.stock) {
                throw new Error('Product structure invalid for variants');
            }
            if (product.variants.stock[request.size]?.[request.variant] === undefined) {
                // Initialize if missing? Or throw error.
                if (!product.variants.stock[request.size]) product.variants.stock[request.size] = {};
            }

            const oldStock = product.variants.stock[request.size][request.variant];
            const change = request.proposedStock - oldStock;

            // Apply new stock
            product.variants.stock[request.size][request.variant] = request.proposedStock;

            // Update main stock count (sum of all variants)
            let totalStock = 0;
            for (const s in product.variants.stock) {
                for (const v in product.variants.stock[s]) {
                    totalStock += Number(product.variants.stock[s][v]);
                }
            }
            product.stock = totalStock;

            // 3. Log Mutation
            await stockMutationService.logMutation({
                productId: request.productId,
                productName: request.productName,
                size: request.size,
                variant: request.variant,
                previousStock: oldStock,
                newStock: request.proposedStock,
                change: change,
                type: 'adjustment',
                referenceId: requestId,
                notes: `Adjustment Approved: ${request.reason}`,
                createdBy: request.requesterId, // Original requester
                performedBy: approverName // Approver
            });

            // 4. Update Batch
            await updateDoc(batchRef, { products });

            // 5. Update Request Status
            await updateDoc(requestRef, {
                status: 'approved',
                respondedAt: Timestamp.now(),
                responderId: approverId
            });

        } catch (error) {
            console.error('Error approving request:', error);
            throw error;
        }
    },

    /**
     * Reject adjustment
     */
    async rejectRequest(
        requestId: string,
        responderId: string,
        reason: string
    ): Promise<void> {
        try {
            const requestRef = doc(db, COLLECTION_NAME, requestId);
            await updateDoc(requestRef, {
                status: 'rejected',
                respondedAt: Timestamp.now(),
                responderId: responderId,
                rejectionReason: reason
            });
        } catch (error) {
            console.error('Error rejecting request:', error);
            throw error;
        }
    }
};
