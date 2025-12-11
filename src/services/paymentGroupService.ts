/**
 * Payment Group Service
 * Manages batch payments where customers can pay multiple orders at once
 * with a single unique payment code
 */

import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  setDoc, 
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { generateUniquePaymentCode } from '../utils/uniqueCodeGenerator';

export interface PaymentGroup {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  orderIds: string[];              // Array of order IDs to be paid together
  originalTotal: number;           // Sum of all order finalTotals
  uniquePaymentCode: number;       // 2-digit unique code (10-99)
  exactPaymentAmount: number;      // originalTotal + uniquePaymentCode
  verificationMode: 'auto' | 'manual' | null;  // null = pending_selection
  originalMode?: 'auto' | 'manual'; // Track original choice (for mode switching)
  status: 'pending_selection' | 'pending' | 'paid' | 'cancelled' | 'expired';
  createdAt: any;                  // Firestore Timestamp
  updatedAt?: any;                 // Firestore Timestamp
  paidAt?: any;                    // Firestore Timestamp
  expiresAt: any;                  // Firestore Timestamp (48 hours from creation)
  modeSwitchedAt?: any;            // Track when mode was switched
}

class PaymentGroupService {
  private readonly COLLECTION = 'paymentGroups';

  /**
   * Create a new payment group for batch payment
   */
  async createPaymentGroup(data: {
    userId: string;
    userName: string;
    userEmail: string;
    orderIds: string[];
    originalTotal: number;
    verificationMode: 'auto' | 'manual';
  }): Promise<PaymentGroup> {
    try {
      console.log('📦 Creating payment group...', data);

      // Generate unique payment code
      const uniqueCode = generateUniquePaymentCode();
      const exactAmount = data.originalTotal + uniqueCode;

      // Generate group ID
      const groupId = `PG${Date.now()}`;

      // Set expiration (48 hours from now)
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const paymentGroup: PaymentGroup = {
        id: groupId,
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        orderIds: data.orderIds,
        originalTotal: data.originalTotal,
        uniquePaymentCode: uniqueCode,
        exactPaymentAmount: exactAmount,
        verificationMode: data.verificationMode,
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt)
      };

      // Save to Firestore
      const docRef = doc(db, this.COLLECTION, groupId);
      await setDoc(docRef, paymentGroup);

      console.log('✅ Payment group created:', groupId);
      console.log('💰 Exact amount to transfer:', exactAmount);

      return {
        ...paymentGroup,
        createdAt: new Date() // Return current date for immediate use
      };
    } catch (error) {
      console.error('❌ Error creating payment group:', error);
      throw error;
    }
  }

  /**
   * Get payment group by ID
   */
  async getPaymentGroup(groupId: string): Promise<PaymentGroup | null> {
    try {
      const docRef = doc(db, this.COLLECTION, groupId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.log('❌ Payment group not found:', groupId);
        return null;
      }

      return {
        id: docSnap.id,
        ...docSnap.data()
      } as PaymentGroup;
    } catch (error) {
      console.error('❌ Error getting payment group:', error);
      return null;
    }
  }

  /**
   * Get all pending payment groups for a user
   */
  async getUserPendingPaymentGroups(userId: string): Promise<PaymentGroup[]> {
    try {
      const groupsRef = collection(db, this.COLLECTION);
      const q = query(
        groupsRef,
        where('userId', '==', userId),
        where('status', '==', 'pending')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PaymentGroup[];
    } catch (error) {
      console.error('❌ Error getting user payment groups:', error);
      return [];
    }
  }

  /**
   * Get payment group by exact amount (for matching)
   */
  async getPaymentGroupByAmount(exactAmount: number): Promise<PaymentGroup | null> {
    try {
      const groupsRef = collection(db, this.COLLECTION);
      const q = query(
        groupsRef,
        where('exactPaymentAmount', '==', exactAmount),
        where('status', '==', 'pending')
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }

      // Return first match (should be unique due to unique code)
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as PaymentGroup;
    } catch (error) {
      console.error('❌ Error getting payment group by amount:', error);
      return null;
    }
  }

  /**
   * Mark payment group as paid
   */
  async markGroupAsPaid(groupId: string): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION, groupId);
      await updateDoc(docRef, {
        status: 'paid',
        paidAt: serverTimestamp()
      });

      console.log('✅ Payment group marked as paid:', groupId);
    } catch (error) {
      console.error('❌ Error marking payment group as paid:', error);
      throw error;
    }
  }

  /**
   * Update payment group (for mode switching, status changes, etc.)
   */
  async updatePaymentGroup(groupId: string, updates: Partial<PaymentGroup>): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION, groupId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });

      console.log('✅ Payment group updated:', groupId, updates);
    } catch (error) {
      console.error('❌ Error updating payment group:', error);
      throw error;
    }
  }

  /**
   * Cancel payment group
   */
  async cancelPaymentGroup(groupId: string): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION, groupId);
      await updateDoc(docRef, {
        status: 'cancelled'
      });

      console.log('✅ Payment group cancelled:', groupId);
    } catch (error) {
      console.error('❌ Error cancelling payment group:', error);
      throw error;
    }
  }

  /**
   * Check and expire old payment groups (48 hours)
   */
  async expireOldPaymentGroups(): Promise<void> {
    try {
      const groupsRef = collection(db, this.COLLECTION);
      const q = query(
        groupsRef,
        where('status', '==', 'pending')
      );

      const snapshot = await getDocs(q);
      const now = new Date();

      for (const docSnapshot of snapshot.docs) {
        const group = docSnapshot.data() as PaymentGroup;
        const expiresAt = group.expiresAt.toDate();

        if (expiresAt < now) {
          // Expire this group
          await updateDoc(docSnapshot.ref, {
            status: 'expired'
          });
          console.log('⏰ Payment group expired:', docSnapshot.id);
        }
      }
    } catch (error) {
      console.error('❌ Error expiring payment groups:', error);
    }
  }
}

export const paymentGroupService = new PaymentGroupService();
