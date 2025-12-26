import { Timestamp } from 'firebase/firestore';

export interface Voucher {
    id: string;

    // Code (Auto-generated: AFM-XXXXXX)
    code: string;

    // Discount (Rp only)
    discountAmount: number;      // Nilai diskon dalam Rupiah
    minPurchase: number;         // Min belanja untuk apply

    // Appearance
    imageUrl?: string;           // Optional gambar voucher
    description?: string;        // Deskripsi voucher

    // Assignment (User-Tied)
    assignedTo: string;          // userId - 1 voucher = 1 user
    assignedToName?: string;     // Nama user untuk display
    assignmentReason: 'manual' | 'dormant' | 'loyal' | 'first_order' | 'birthday';

    // Validity
    validUntil: Timestamp;

    // Status
    status: 'active' | 'used' | 'expired';
    usedAt?: Timestamp;
    usedInOrderId?: string;

    // Notification
    notificationSent: boolean;

    // Meta
    createdAt: Timestamp;
    createdBy: string;           // Owner userId
}

export interface CreateVoucherInput {
    assignedTo: string;
    assignedToName: string;
    discountAmount: number;
    minPurchase: number;
    validDays: number;           // Berapa hari berlaku dari sekarang
    description?: string;
    imageUrl?: string;
    assignmentReason: Voucher['assignmentReason'];
}

export interface VoucherValidationResult {
    valid: boolean;
    message: string;
    voucher?: Voucher;
    discountAmount?: number;
}
