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
  senderName: string;
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
      const pendingRef = collection(db, `${this.COLLECTION}/pending/items`);
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
      const verifiedRef = collection(db, `${this.COLLECTION}/verified/items`);
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
    const pendingRef = collection(db, `${this.COLLECTION}/pending/items`);
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
      const pendingRef = doc(db, `${this.COLLECTION}/pending/items`, detectionId);
      const pendingDoc = await getDoc(pendingRef);
      
      if (!pendingDoc.exists()) {
        throw new Error('Detection not found in pending');
      }

      const detectionData = pendingDoc.data();

      // Move to verified
      const verifiedRef = doc(db, `${this.COLLECTION}/verified/items`, detectionId);
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
      const pendingRef = doc(db, `${this.COLLECTION}/pending/items`, detectionId);
      const pendingDoc = await getDoc(pendingRef);
      
      if (!pendingDoc.exists()) {
        throw new Error('Detection not found in pending');
      }

      const detectionData = pendingDoc.data();

      // Move to ignored
      const ignoredRef = doc(db, `${this.COLLECTION}/ignored/items`, detectionId);
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
  async getSettings(): Promise<PaymentDetectionSettings> {
    try {
      const settingsRef = doc(db, `${this.COLLECTION}/settings/config`);
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        return settingsDoc.data() as PaymentDetectionSettings;
      }

      // Return default settings
      return {
        mode: 'semi-auto',
        enabled: true,
        autoConfirmThreshold: 90,
        autoConfirmRules: {
          exactAmountMatch: true,
          nameSimilarity: 80,
          maxOrderAge: 7200 // 2 hours
        }
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      // Return default settings on error
      return {
        mode: 'semi-auto',
        enabled: true,
        autoConfirmThreshold: 90,
        autoConfirmRules: {
          exactAmountMatch: true,
          nameSimilarity: 80,
          maxOrderAge: 7200
        }
      };
    }
  }

  // Update settings
  async updateSettings(settings: PaymentDetectionSettings): Promise<void> {
    try {
      const settingsRef = doc(db, `${this.COLLECTION}/settings/config`);
      await setDoc(settingsRef, settings, { merge: true });
      console.log('✅ Settings updated:', settings);
    } catch (error) {
      console.error('❌ Error updating settings:', error);
      throw error;
    }
  }

  // Add mock detection for testing (temporary - for development)
  async addMockDetection(detection: Omit<PaymentDetection, 'id' | 'createdAt' | 'status'>): Promise<void> {
    try {
      const pendingRef = collection(db, `${this.COLLECTION}/pending/items`);
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
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
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

  // Match detection with orders
  async matchDetectionWithOrders(
    detection: PaymentDetection,
    pendingOrders: any[]
  ): Promise<{ orderId: string; confidence: number }[]> {
    const matches: { orderId: string; confidence: number }[] = [];

    for (const order of pendingOrders) {
      let confidence = 0;

      // 1. Amount matching (50 points)
      const amountDiff = Math.abs(detection.amount - order.finalTotal);
      if (amountDiff === 0) {
        confidence += 50;
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
