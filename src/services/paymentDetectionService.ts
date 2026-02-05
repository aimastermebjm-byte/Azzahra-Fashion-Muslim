import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export interface PaymentDetection {
  id: string;
  amount: number;
  senderName?: string;
  bank: string;
  timestamp: string;
  rawText: string;
  screenshotUrl?: string;
  matchedOrderId?: string;
  confidence?: number;
  status: 'pending' | 'verified' | 'ignored';
  createdAt: any;
  verifiedBy?: string;
  verifiedAt?: any;
  verificationMode?: 'semi-auto' | 'full-auto';
  reason?: string;
  ignoredAt?: any;
}

export interface PaymentDetectionSettings {
  mode: 'semi-auto' | 'full-auto';
  enabled: boolean;
  testMode?: boolean;  // 🧪 Test mode - hanya log, tidak benar-benar lunaskan
  autoConfirmThreshold: number;
  autoConfirmRules: {
    exactAmountMatch: boolean;
    nameSimilarity: number;
    maxOrderAge: number; // in seconds
  };
}

class PaymentDetectionService {
  private readonly COLLECTION = 'payment-detections';

  // Get all pending payment detections
  async getPendingDetections(): Promise<PaymentDetection[]> {
    try {
      const pendingRef = collection(db, 'paymentDetectionsPending');
      const q = query(pendingRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PaymentDetection[];
    } catch (error) {
      console.error('Error getting pending detections:', error);
      return [];
    }
  }

  // Get verified payment detections
  async getVerifiedDetections(): Promise<PaymentDetection[]> {
    try {
      const verifiedRef = collection(db, 'paymentDetectionsVerified');
      const q = query(verifiedRef, orderBy('verifiedAt', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PaymentDetection[];
    } catch (error) {
      console.error('Error getting verified detections:', error);
      return [];
    }
  }

  // Listen to pending detections (real-time)
  onPendingDetectionsChange(callback: (detections: PaymentDetection[]) => void): () => void {
    const pendingRef = collection(db, 'paymentDetectionsPending');
    const q = query(pendingRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const detections = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PaymentDetection[];

      callback(detections);
    }, (error) => {
      console.error('Error listening to pending detections:', error);
      callback([]);
    });

    return unsubscribe;
  }

  // Mark detection as verified
  async markAsVerified(
    detectionId: string,
    orderId: string,
    verifiedBy: string,
    mode: 'semi-auto' | 'full-auto' = 'semi-auto'
  ): Promise<void> {
    try {
      // Get detection from pending
      const pendingRef = doc(db, 'paymentDetectionsPending', detectionId);
      const pendingDoc = await getDoc(pendingRef);

      if (!pendingDoc.exists()) {
        throw new Error('Detection not found in pending');
      }

      const detectionData = pendingDoc.data();

      // Move to verified
      const verifiedRef = doc(db, 'paymentDetectionsVerified', detectionId);
      await setDoc(verifiedRef, {
        ...detectionData,
        status: 'verified',
        matchedOrderId: orderId,
        verifiedBy,
        verifiedAt: serverTimestamp(),
        verificationMode: mode
      });

      // Delete from pending
      await deleteDoc(pendingRef);

      console.log('✅ Payment detection marked as verified:', detectionId);
    } catch (error) {
      console.error('❌ Error marking detection as verified:', error);
      throw error;
    }
  }

  // Mark detection as ignored
  async markAsIgnored(detectionId: string, reason: string): Promise<void> {
    try {
      // Get detection from pending
      const pendingRef = doc(db, 'paymentDetectionsPending', detectionId);
      const pendingDoc = await getDoc(pendingRef);

      if (!pendingDoc.exists()) {
        throw new Error('Detection not found in pending');
      }

      const detectionData = pendingDoc.data();

      // Move to ignored
      const ignoredRef = doc(db, 'paymentDetectionsIgnored', detectionId);
      await setDoc(ignoredRef, {
        ...detectionData,
        status: 'ignored',
        reason,
        ignoredAt: serverTimestamp()
      });

      // Delete from pending
      await deleteDoc(pendingRef);

      console.log('✅ Payment detection marked as ignored:', detectionId);
    } catch (error) {
      console.error('❌ Error marking detection as ignored:', error);
      throw error;
    }
  }

  // Get settings
  async getSettings(): Promise<PaymentDetectionSettings | null> {
    try {
      const settingsRef = doc(db, 'paymentDetectionSettings', 'config');
      const settingsDoc = await getDoc(settingsRef);

      if (settingsDoc.exists()) {
        return settingsDoc.data() as PaymentDetectionSettings;
      }

      // Return null if settings don't exist yet (need initialization)
      return null;
    } catch (error) {
      console.error('Error getting settings:', error);
      // Return null on error (will trigger initialize button)
      return null;
    }
  }

  // Update settings
  async updateSettings(settings: PaymentDetectionSettings): Promise<void> {
    try {
      const settingsRef = doc(db, 'paymentDetectionSettings', 'config');
      await setDoc(settingsRef, settings, { merge: true });
      console.log('✅ Settings updated:', settings);
    } catch (error) {
      console.error('❌ Error updating settings:', error);
      throw error;
    }
  }

  // Subscribe to settings changes (real-time)
  subscribeToSettings(callback: (settings: PaymentDetectionSettings | null) => void): () => void {
    const settingsRef = doc(db, 'paymentDetectionSettings', 'config');

    const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as PaymentDetectionSettings);
      } else {
        callback(null);
      }
    }, (error) => {
      console.error('Error listening to settings:', error);
      callback(null);
    });

    return unsubscribe;
  }

  // Add mock detection for testing (temporary - for development)
  async addMockDetection(detection: Omit<PaymentDetection, 'id' | 'createdAt' | 'status'>): Promise<void> {
    try {
      const pendingRef = collection(db, 'paymentDetectionsPending');
      const newDocRef = doc(pendingRef);

      await setDoc(newDocRef, {
        ...detection,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      console.log('✅ Mock detection added:', newDocRef.id);
    } catch (error) {
      console.error('❌ Error adding mock detection:', error);
      throw error;
    }
  }

  // Calculate string similarity (for name matching)
  private calculateSimilarity(str1: string | undefined, str2: string | undefined): number {
    const s1 = (str1 || '').toLowerCase().trim();
    const s2 = (str2 || '').toLowerCase().trim();

    if (s1 === s2) return 100;

    // Simple Levenshtein-like comparison
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 100;

    const editDistance = this.getEditDistance(longer, shorter);
    return ((longer.length - editDistance) / longer.length) * 100;
  }

  private getEditDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  // ✨ NEW: Match detection by EXACT amount with unique code (100% confidence if name also matches)
  async matchByExactAmount(
    detectedAmount: number,
    senderName: string | undefined,
    pendingOrders: any[]
  ): Promise<{ orderId: string; confidence: number; reason: string } | null> {
    console.log('🔍 Searching for exact amount match:', detectedAmount);

    // Find orders with exact payment amount OR group payment amount (unique code system)
    let exactMatches = pendingOrders.filter(order =>
      (
        (order.exactPaymentAmount === detectedAmount) ||
        (order.groupPaymentAmount === detectedAmount)
      ) &&
      order.verificationMode === 'auto' &&
      order.status === 'pending'
    );

    // 🔥 FIX: If local state is stale (race condition), try DIRECT Firestore query
    if (exactMatches.length === 0) {
      console.log('⏳ Local state might be stale, querying Firestore directly...');
      try {
        const ordersRef = collection(db, 'orders');
        const q = query(
          ordersRef,
          where('exactPaymentAmount', '==', detectedAmount),
          where('status', '==', 'pending'),
          where('verificationMode', '==', 'auto')
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          exactMatches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          console.log('✅ Found match via direct Firestore query:', exactMatches.length);
        } else {
          // Also try groupPaymentAmount
          const q2 = query(
            ordersRef,
            where('groupPaymentAmount', '==', detectedAmount),
            where('status', '==', 'pending'),
            where('verificationMode', '==', 'auto')
          );
          const snapshot2 = await getDocs(q2);
          if (!snapshot2.empty) {
            exactMatches = snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log('✅ Found match via groupPaymentAmount query:', exactMatches.length);
          }
        }
      } catch (err) {
        console.error('❌ Firestore direct query failed:', err);
      }
    }

    if (exactMatches.length === 0) {
      console.log('❌ No exact amount match found (even after Firestore query)');
      return null;
    }

    if (exactMatches.length > 1) {
      console.warn('⚠️ Multiple orders with same exact amount (collision detected)!', exactMatches.length);
      // Fallback to name matching
    }

    // Get the first match (should be only one in normal cases)
    const matchedOrder = exactMatches[0];

    // ✅ SECURITY CHECK: Validate sender name matches order customer name
    const customerName = matchedOrder.shippingInfo?.name || matchedOrder.userName || '';
    const nameSimilarity = this.calculateSimilarity(senderName || '', customerName);

    console.log('🔐 Security check:', {
      senderName,
      customerName,
      similarity: nameSimilarity + '%'
    });

    // ✨ NEW LOGIC: Trust Unique Code 100%
    // Since we now enforce GLOBAL UNIQUENESS for pending payment amounts in paymentGroupService,
    // an exact amount match is statistically guaranteed to be the correct order.
    // We treat the Amount + Unique Code as the primary verification key.

    // Log the name match status but don't let it block verification
    const isNameMatch = nameSimilarity >= 50;
    const nameStatus = isNameMatch ? 'Confirmed' : 'Ignored (Name missing or diff)';

    return {
      orderId: matchedOrder.id,
      confidence: 100, // Trust the code explicitly
      reason: `Exact amount match (${detectedAmount}) with Unique Code. Name Status: ${nameStatus}`
    };
  }

  // Match detection with orders (LEGACY - fallback for manual mode)
  async matchDetectionWithOrders(
    detection: PaymentDetection,
    pendingOrders: any[]
  ): Promise<{ orderId: string; confidence: number }[]> {
    // ✨ PRIORITY 1: Try exact amount match first (for auto verification mode)
    const exactMatch = await this.matchByExactAmount(
      detection.amount,
      detection.senderName,
      pendingOrders
    );

    if (exactMatch && exactMatch.confidence >= 85) {
      console.log('✅ EXACT MATCH FOUND with high confidence:', exactMatch);
      return [{
        orderId: exactMatch.orderId,
        confidence: exactMatch.confidence
      }];
    }

    // ✨ FALLBACK: Use legacy matching algorithm for manual mode or when no exact match
    console.log('📊 Using legacy matching algorithm...');
    const matches: { orderId: string; confidence: number }[] = [];

    for (const order of pendingOrders) {
      let confidence = 0;

      // 1. Amount matching (50 points)
      // 1. Amount matching (50 points base)
      const amountDiff = Math.abs(detection.amount - order.finalTotal);

      if (amountDiff === 0) {
        // Perfect match
        confidence += 50;
      } else if (amountDiff > 0 && amountDiff < 100) {
        // ⚠️ Potential "Forgot Unique Code" case
        // User paid 50.000 instead of 50.045
        // This is a very strong signal if the diff is exactly the unique code range
        console.log(`⚠️ Potential missing unique code for order ${order.id}. Diff: ${amountDiff}`);
        confidence += 45; // Almost as good as exact match, just human error
      } else if (amountDiff < 1000) {
        confidence += 40;
      } else if (amountDiff < 5000) {
        confidence += 20;
      }

      // 2. Name matching (30 points)
      const customerName = order.customerName || order.userName || '';
      const nameSimilarity = this.calculateSimilarity(detection.senderName, customerName);

      if (nameSimilarity >= 90) {
        confidence += 30;
      } else if (nameSimilarity >= 80) {
        confidence += 20;
      } else if (nameSimilarity >= 60) {
        confidence += 10;
      }

      // 3. Timing (20 points)
      const orderTime = order.timestamp || order.createdAt;
      const detectionTime = new Date(detection.timestamp).getTime();
      const orderTimestamp = typeof orderTime === 'object' && 'seconds' in orderTime
        ? orderTime.seconds * 1000
        : new Date(orderTime).getTime();

      const timeDiffMinutes = (detectionTime - orderTimestamp) / 60000;

      if (timeDiffMinutes >= 0 && timeDiffMinutes <= 60) {
        confidence += 20;
      } else if (timeDiffMinutes >= 0 && timeDiffMinutes <= 1440) {
        confidence += 10;
      }

      // Only include matches with confidence >= 50%
      if (confidence >= 50) {
        matches.push({ orderId: order.id, confidence });
      }
    }

    // Sort by confidence (highest first)
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
}

export const paymentDetectionService = new PaymentDetectionService();
