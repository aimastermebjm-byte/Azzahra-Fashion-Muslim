import {
    collection,
    doc,
    getDocs,
    setDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    limit
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export interface AutoVerificationLog {
    id: string;
    timestamp: any;  // Firestore Timestamp

    // Order info
    orderId: string;
    invoiceNumber?: string;  // 🧾 NEW: Store invoice number (INV-YYMMNNNNN format)
    orderAmount: number;
    customerName: string;

    // Detection info
    detectionId: string;
    detectedAmount: number;
    senderName: string;
    bank: string;
    rawNotification: string;

    // Matching info
    confidence: number;
    matchReason: string;

    // Execution info
    status: 'success' | 'failed' | 'dry-run';  // dry-run = test mode
    executedBy: 'system' | string;  // 'system' untuk auto, user id untuk manual
    errorMessage?: string;

    // For group payments
    paymentGroupId?: string;
    orderIds?: string[];  // All orders in the group
}

class AutoVerificationLogService {
    private readonly COLLECTION = 'autoVerificationLogs';

    /**
     * Create a new verification log entry
     */
    async createLog(data: Omit<AutoVerificationLog, 'id' | 'timestamp'>): Promise<string> {
        try {
            const logId = `AVL${Date.now()}`;
            const docRef = doc(db, this.COLLECTION, logId);

            await setDoc(docRef, {
                ...data,
                id: logId,
                timestamp: serverTimestamp()
            });

            console.log(`📋 Auto-verification log created: ${logId}`);
            return logId;
        } catch (error) {
            console.error('❌ Error creating auto-verification log:', error);
            throw error;
        }
    }

    /**
     * 🗑️ Delete a single log entry
     */
    async deleteLog(logId: string): Promise<void> {
        try {
            const docRef = doc(db, this.COLLECTION, logId);
            await deleteDoc(docRef);
            console.log(`🗑️ Log deleted: ${logId}`);
        } catch (error) {
            console.error('❌ Error deleting log:', error);
            throw error;
        }
    }

    /**
     * 🗑️ Delete all logs (bulk delete)
     */
    async deleteAllLogs(): Promise<number> {
        try {
            const logsRef = collection(db, this.COLLECTION);
            const snapshot = await getDocs(logsRef);

            let deletedCount = 0;
            for (const docSnap of snapshot.docs) {
                await deleteDoc(docSnap.ref);
                deletedCount++;
            }

            console.log(`🗑️ Deleted ${deletedCount} logs`);
            return deletedCount;
        } catch (error) {
            console.error('❌ Error deleting all logs:', error);
            throw error;
        }
    }

    /**
     * Get all logs (with optional filters)
     */
    async getLogs(options?: {
        status?: 'success' | 'failed' | 'dry-run';
        limitCount?: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<AutoVerificationLog[]> {
        try {
            const logsRef = collection(db, this.COLLECTION);
            let q = query(logsRef, orderBy('timestamp', 'desc'));

            // Apply status filter if provided
            if (options?.status) {
                q = query(
                    logsRef,
                    where('status', '==', options.status),
                    orderBy('timestamp', 'desc')
                );
            }

            // Apply limit if provided
            if (options?.limitCount) {
                q = query(q, limit(options.limitCount));
            }

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AutoVerificationLog[];
        } catch (error) {
            console.error('❌ Error getting auto-verification logs:', error);
            return [];
        }
    }

    /**
     * Get logs for today (quick dashboard view)
     */
    async getTodayLogs(): Promise<AutoVerificationLog[]> {
        try {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const logsRef = collection(db, this.COLLECTION);
            const q = query(
                logsRef,
                where('timestamp', '>=', Timestamp.fromDate(startOfToday)),
                orderBy('timestamp', 'desc')
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AutoVerificationLog[];
        } catch (error) {
            console.error('❌ Error getting today logs:', error);
            return [];
        }
    }

    /**
     * Get summary stats
     */
    async getStats(): Promise<{
        totalSuccess: number;
        totalFailed: number;
        totalDryRun: number;
        totalAmount: number;
    }> {
        try {
            const logs = await this.getLogs();

            return {
                totalSuccess: logs.filter(l => l.status === 'success').length,
                totalFailed: logs.filter(l => l.status === 'failed').length,
                totalDryRun: logs.filter(l => l.status === 'dry-run').length,
                totalAmount: logs
                    .filter(l => l.status === 'success')
                    .reduce((sum, l) => sum + l.detectedAmount, 0)
            };
        } catch (error) {
            console.error('❌ Error getting stats:', error);
            return { totalSuccess: 0, totalFailed: 0, totalDryRun: 0, totalAmount: 0 };
        }
    }
}

export const autoVerificationLogService = new AutoVerificationLogService();
