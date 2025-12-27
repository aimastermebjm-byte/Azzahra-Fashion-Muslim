// Role Upgrade Service - Auto upgrade Customer to Reseller based on purchase
import { doc, updateDoc, getDoc, Timestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

// WhatsApp notification templates
const WA_TEMPLATES = {
    upgrade: (userName: string) =>
        `🎉 Selamat ${userName}!\n\n` +
        `Anda resmi menjadi *RESELLER* Azzahra Fashion Muslim!\n\n` +
        `✨ Nikmati harga spesial reseller untuk semua produk.\n` +
        `💰 Refresh halaman untuk melihat harga reseller Anda.\n\n` +
        `Terima kasih atas kepercayaan Anda! 🙏`,

    warning: (userName: string, daysLeft: number) =>
        `⚠️ Reminder untuk ${userName}\n\n` +
        `Status reseller Anda akan berakhir dalam *${daysLeft} hari* jika tidak ada pembelian.\n\n` +
        `🛒 Belanja sekarang untuk mempertahankan harga reseller!\n` +
        `📱 Kunjungi: azzahra-fashion.vercel.app`,

    downgrade: (userName: string) =>
        `ℹ️ Informasi untuk ${userName}\n\n` +
        `Status reseller Anda telah berakhir karena tidak ada pembelian selama 1 tahun.\n\n` +
        `🛒 Belanja minimal 3 pcs (Ready) atau 4 pcs (PO) untuk kembali menjadi reseller!\n` +
        `📱 Kunjungi: azzahra-fashion.vercel.app`
};

export interface RoleUpgradeResult {
    upgraded: boolean;
    reason?: string;
    newRole?: string;
}

export interface OrderItemForUpgrade {
    productId: string;
    productName: string;
    productStatus: 'ready' | 'po' | string;
    quantity: number;
}

// Upgrade thresholds
const READY_ONLY_THRESHOLD = 3;   // 3 pcs untuk Ready Stock saja
const PO_ONLY_THRESHOLD = 4;      // 4 pcs untuk PO saja
const MIXED_THRESHOLD = 4;        // 4 pcs untuk campur Ready + PO

/**
 * Check if user should be upgraded to Reseller based on order items
 * Call this AFTER order status changes to 'paid'
 */
export async function checkAndUpgradeRole(
    userId: string,
    orderItems: OrderItemForUpgrade[]
): Promise<RoleUpgradeResult> {
    try {
        // Get current user data
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            console.warn(`[RoleUpgrade] User ${userId} not found`);
            return { upgraded: false, reason: 'User not found' };
        }

        const userData = userDoc.data();

        // Skip if already reseller, admin, or owner
        if (['reseller', 'admin', 'owner'].includes(userData.role)) {
            console.log(`[RoleUpgrade] User ${userId} already has role: ${userData.role}`);

            // Still update lastPurchaseAt for resellers
            if (userData.role === 'reseller') {
                await updateDoc(userRef, {
                    lastPurchaseAt: Timestamp.now()
                });
            }

            return { upgraded: false, reason: `Already ${userData.role}` };
        }

        // Count items by status
        let readyCount = 0;
        let poCount = 0;

        orderItems.forEach(item => {
            const qty = item.quantity || 1;
            const status = (item.productStatus || 'ready').toLowerCase();

            if (status === 'ready') {
                readyCount += qty;
            } else {
                poCount += qty;
            }
        });

        const totalCount = readyCount + poCount;

        console.log(`[RoleUpgrade] User ${userId}: Ready=${readyCount}, PO=${poCount}, Total=${totalCount}`);

        // Check upgrade conditions
        let shouldUpgrade = false;
        let upgradeReason = '';

        if (poCount === 0 && readyCount >= READY_ONLY_THRESHOLD) {
            // Ready only >= 3
            shouldUpgrade = true;
            upgradeReason = `Beli ${readyCount} pcs Ready Stock`;
        } else if (readyCount === 0 && poCount >= PO_ONLY_THRESHOLD) {
            // PO only >= 4
            shouldUpgrade = true;
            upgradeReason = `Beli ${poCount} pcs Pre-Order`;
        } else if (totalCount >= MIXED_THRESHOLD) {
            // Mixed >= 4
            shouldUpgrade = true;
            upgradeReason = `Beli ${totalCount} pcs (${readyCount} Ready + ${poCount} PO)`;
        }

        if (!shouldUpgrade) {
            console.log(`[RoleUpgrade] User ${userId} not eligible for upgrade`);
            return {
                upgraded: false,
                reason: `Tidak memenuhi syarat (Ready: ${readyCount}, PO: ${poCount})`
            };
        }

        // Upgrade user to reseller!
        await updateDoc(userRef, {
            role: 'reseller',
            roleUpgradedAt: Timestamp.now(),
            lastPurchaseAt: Timestamp.now(),
            downgradeWarningAt: null // Reset warning if any
        });

        console.log(`[RoleUpgrade] ✅ User ${userId} upgraded to Reseller! Reason: ${upgradeReason}`);

        return {
            upgraded: true,
            reason: upgradeReason,
            newRole: 'reseller'
        };

    } catch (error) {
        console.error('[RoleUpgrade] Error checking/upgrading role:', error);
        return { upgraded: false, reason: 'Error occurred' };
    }
}

/**
 * Update lastPurchaseAt for any paid order (for existing resellers)
 */
export async function updateLastPurchase(userId: string): Promise<void> {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            lastPurchaseAt: Timestamp.now()
        });
        console.log(`[RoleUpgrade] Updated lastPurchaseAt for user ${userId}`);
    } catch (error) {
        console.error('[RoleUpgrade] Error updating lastPurchaseAt:', error);
    }
}

/**
 * Get user's current role and upgrade status
 */
export async function getUserRoleInfo(userId: string): Promise<{
    role: string;
    roleUpgradedAt?: Date;
    lastPurchaseAt?: Date;
}> {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            return { role: 'customer' };
        }

        const data = userDoc.data();
        return {
            role: data.role || 'customer',
            roleUpgradedAt: data.roleUpgradedAt?.toDate(),
            lastPurchaseAt: data.lastPurchaseAt?.toDate()
        };
    } catch (error) {
        console.error('[RoleUpgrade] Error getting user role info:', error);
        return { role: 'customer' };
    }
}

/**
 * Manual role change (Owner only) - use this from Admin panel
 */
export async function manualRoleChange(
    userId: string,
    newRole: 'customer' | 'reseller',
    changedBy: string
): Promise<boolean> {
    try {
        const userRef = doc(db, 'users', userId);

        const updateData: any = {
            role: newRole,
            roleChangedManuallyAt: Timestamp.now(),
            roleChangedBy: changedBy
        };

        if (newRole === 'reseller') {
            updateData.roleUpgradedAt = Timestamp.now();
        } else {
            updateData.roleUpgradedAt = null;
        }

        await updateDoc(userRef, updateData);
        console.log(`[RoleUpgrade] Manual role change: User ${userId} -> ${newRole} by ${changedBy}`);
        return true;
    } catch (error) {
        console.error('[RoleUpgrade] Error in manual role change:', error);
        return false;
    }
}

/**
 * Queue WhatsApp notification for role change
 * WhatsApp Bridge will read from 'notificationQueue' collection and send messages
 */
export async function queueWhatsAppNotification(
    userId: string,
    phoneNumber: string,
    userName: string,
    type: 'upgrade' | 'warning' | 'downgrade',
    daysLeft?: number
): Promise<boolean> {
    try {
        let message = '';

        switch (type) {
            case 'upgrade':
                message = WA_TEMPLATES.upgrade(userName);
                break;
            case 'warning':
                message = WA_TEMPLATES.warning(userName, daysLeft || 30);
                break;
            case 'downgrade':
                message = WA_TEMPLATES.downgrade(userName);
                break;
        }

        // Add to notification queue in Firestore
        const queueRef = collection(db, 'notificationQueue');
        await addDoc(queueRef, {
            userId,
            phoneNumber: phoneNumber.replace(/\D/g, ''), // Remove non-digits
            message,
            type: `role_${type}`,
            status: 'pending',
            createdAt: Timestamp.now(),
            attempts: 0
        });

        console.log(`[RoleUpgrade] Queued WhatsApp notification: ${type} for ${phoneNumber}`);
        return true;
    } catch (error) {
        console.error('[RoleUpgrade] Error queueing WhatsApp notification:', error);
        return false;
    }
}

/**
 * Get user phone number from order or user profile
 */
export async function getUserPhoneNumber(userId: string): Promise<string | null> {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const data = userDoc.data();
            return data.phone || data.phoneNumber || null;
        }
        return null;
    } catch (error) {
        console.error('[RoleUpgrade] Error getting user phone:', error);
        return null;
    }
}
