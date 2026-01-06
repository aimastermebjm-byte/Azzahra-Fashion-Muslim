import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Voucher, CreateVoucherInput, VoucherValidationResult } from '../types/voucher';

const VOUCHER_COLLECTION = 'vouchers';
const NOTIFICATION_COLLECTION = 'notifications';

// Generate random voucher code: AFM-XXXXXX
function generateVoucherCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0, O, 1, I)
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `AFM-${code}`;
}

export const voucherService = {
    // Create new voucher
    async createVoucher(input: CreateVoucherInput, createdBy: string): Promise<Voucher> {
        const code = generateVoucherCode();
        const now = new Date();
        const validUntil = new Date(now.getTime() + input.validDays * 24 * 60 * 60 * 1000);

        const voucherData: Omit<Voucher, 'id'> = {
            code,
            discountAmount: input.discountAmount,
            minPurchase: input.minPurchase,
            imageUrl: input.imageUrl || '',
            description: input.description || '',
            assignedTo: input.assignedTo,
            assignedToName: input.assignedToName,
            assignmentReason: input.assignmentReason,
            validUntil: Timestamp.fromDate(validUntil),
            status: 'active',
            notificationSent: false,
            createdAt: Timestamp.now(),
            createdBy
        };

        const docRef = await addDoc(collection(db, VOUCHER_COLLECTION), voucherData);

        const voucher: Voucher = {
            id: docRef.id,
            ...voucherData
        };

        // Send notification to user
        await this.sendVoucherNotification(voucher);

        // Mark notification as sent
        await updateDoc(docRef, { notificationSent: true });

        return { ...voucher, notificationSent: true };
    },

    // Send notification to user
    async sendVoucherNotification(voucher: Voucher): Promise<void> {
        await addDoc(collection(db, NOTIFICATION_COLLECTION), {
            userId: voucher.assignedTo,
            type: 'voucher',
            title: '🎉 Voucher Spesial untuk Anda!',
            message: `Gunakan kode ${voucher.code} untuk diskon Rp ${voucher.discountAmount.toLocaleString('id-ID')}. Min belanja Rp ${voucher.minPurchase.toLocaleString('id-ID')}.`,
            voucherId: voucher.id,
            voucherCode: voucher.code,
            read: false,
            createdAt: serverTimestamp()
        });
    },

    // Get all vouchers (for admin)
    async getAllVouchers(): Promise<Voucher[]> {
        const q = query(
            collection(db, VOUCHER_COLLECTION),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Voucher));
    },

    // Get vouchers for specific user
    async getVouchersForUser(userId: string): Promise<Voucher[]> {
        const q = query(
            collection(db, VOUCHER_COLLECTION),
            where('assignedTo', '==', userId),
            where('status', '==', 'active'),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const now = new Date();

        return snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Voucher))
            .filter(v => v.validUntil.toDate() > now); // Filter out expired
    },

    // Validate voucher for checkout
    async validateVoucher(code: string, userId: string, orderTotal: number): Promise<VoucherValidationResult> {
        console.log('🎟️ VALIDATE VOUCHER START:', { code, userId, orderTotal });

        // Find voucher by code
        const q = query(
            collection(db, VOUCHER_COLLECTION),
            where('code', '==', code.toUpperCase())
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log('🎟️ FAIL: Voucher not found');
            return { valid: false, message: 'Kode voucher tidak ditemukan' };
        }

        const voucherDocSnapshot = snapshot.docs[0];
        const voucher = { id: voucherDocSnapshot.id, ...voucherDocSnapshot.data() } as Voucher;
        console.log('🎟️ VOUCHER FOUND:', {
            id: voucher.id,
            code: voucher.code,
            assignedTo: voucher.assignedTo,
            status: voucher.status,
            minPurchase: voucher.minPurchase
        });

        // Check if assigned to this user
        // ✅ CRITICAL FIX: Allow Admin/Owner to use ANY voucher for testing/manual input
        // Fetch current user role to check permissions
        const userDocRef = await getDoc(doc(db, 'users', userId));
        const userRole = userDocRef.exists() ? userDocRef.data().role : 'customer';
        const isAdminOrOwner = ['admin', 'owner'].includes(userRole);
        console.log('🎟️ USER CHECK:', { userId, userRole, isAdminOrOwner, voucherOwner: voucher.assignedTo });

        if (voucher.assignedTo !== userId && !isAdminOrOwner) {
            console.log('🎟️ FAIL: Not owner and not admin');
            return { valid: false, message: 'Voucher ini milik user lain' };
        }

        // Check if already used
        if (voucher.status === 'used') {
            console.log('🎟️ VOUCHER USED: Checking if order was cancelled...');

            // Check if the order that used this voucher was cancelled
            if (voucher.usedInOrderId) {
                try {
                    const orderDocRef = await getDoc(doc(db, 'orders', voucher.usedInOrderId));
                    if (orderDocRef.exists()) {
                        const orderStatus = orderDocRef.data().status;
                        console.log('🎟️ ORDER STATUS:', { orderId: voucher.usedInOrderId, status: orderStatus });

                        if (orderStatus === 'cancelled') {
                            // Reset voucher to active since order was cancelled
                            console.log('🎟️ ORDER CANCELLED: Resetting voucher to active');
                            await updateDoc(doc(db, VOUCHER_COLLECTION, voucher.id), {
                                status: 'active',
                                usedAt: null,
                                usedInOrderId: null
                            });
                            // Continue validation - don't return error
                        } else {
                            // Order is not cancelled, voucher really is used
                            console.log('🎟️ FAIL: Already used in active order');
                            return { valid: false, message: 'Voucher sudah digunakan' };
                        }
                    } else {
                        // Order doesn't exist anymore, reset voucher
                        console.log('🎟️ ORDER DELETED: Resetting voucher to active');
                        await updateDoc(doc(db, VOUCHER_COLLECTION, voucher.id), {
                            status: 'active',
                            usedAt: null,
                            usedInOrderId: null
                        });
                    }
                } catch (error) {
                    console.error('🎟️ Error checking order status:', error);
                    return { valid: false, message: 'Voucher sudah digunakan' };
                }
            } else {
                console.log('🎟️ FAIL: Already used (no order ID)');
                return { valid: false, message: 'Voucher sudah digunakan' };
            }
        }

        // Check if expired
        const validUntilDate = voucher.validUntil.toDate();
        const now = new Date();
        console.log('🎟️ EXPIRY CHECK:', { validUntil: validUntilDate, now, isExpired: validUntilDate < now });
        if (validUntilDate < now) {
            console.log('🎟️ FAIL: Expired');
            return { valid: false, message: 'Voucher sudah kadaluarsa' };
        }

        // Check minimum purchase
        console.log('🎟️ MIN PURCHASE CHECK:', { orderTotal, minPurchase: voucher.minPurchase, passed: orderTotal >= voucher.minPurchase });
        if (orderTotal < voucher.minPurchase) {
            console.log('🎟️ FAIL: Min purchase not met');
            return {
                valid: false,
                message: `Minimum belanja Rp ${voucher.minPurchase.toLocaleString('id-ID')}`
            };
        }

        console.log('🎟️ SUCCESS: Voucher valid!');
        return {
            valid: true,
            message: 'Voucher valid!',
            voucher,
            discountAmount: voucher.discountAmount
        };
    },

    // Use voucher (mark as used after successful order)
    async useVoucher(voucherId: string, orderId: string): Promise<void> {
        const voucherRef = doc(db, VOUCHER_COLLECTION, voucherId);
        await updateDoc(voucherRef, {
            status: 'used',
            usedAt: Timestamp.now(),
            usedInOrderId: orderId
        });
    },

    // Delete voucher
    async deleteVoucher(voucherId: string): Promise<void> {
        await deleteDoc(doc(db, VOUCHER_COLLECTION, voucherId));
    },

    // Update expired vouchers (can be called periodically)
    async markExpiredVouchers(): Promise<number> {
        const q = query(
            collection(db, VOUCHER_COLLECTION),
            where('status', '==', 'active')
        );

        const snapshot = await getDocs(q);
        const now = new Date();
        let count = 0;

        for (const docSnap of snapshot.docs) {
            const voucher = docSnap.data() as Voucher;
            if (voucher.validUntil.toDate() < now) {
                await updateDoc(docSnap.ref, { status: 'expired' });
                count++;
            }
        }

        return count;
    }
};
