import { db } from '../utils/firebaseClient';
import { doc, getDoc, setDoc, increment, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { Order } from './ordersService';
import { usersService } from './usersService';

export interface PointSettings {
  pointPerItem: number;
  eligibleCategories: string[]; // List of category names
  isEnabled: boolean;
  minOrderForRedeem: number; // ✨ NEW: Minimum order amount to redeem
}

export interface PointTransaction {
  id: string;
  userId: string;
  type: 'earned' | 'redeemed';
  amount: number;
  orderId: string;
  description: string;
  createdAt: any;
}

const SETTINGS_DOC_ID = 'default_settings';
const COLLECTION_SETTINGS = 'point_settings';
const COLLECTION_HISTORY = 'point_history';

export const pointService = {
  /**
   * Get point system settings
   */
  async getSettings(): Promise<PointSettings> {
    try {
      const docRef = doc(db, COLLECTION_SETTINGS, SETTINGS_DOC_ID);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data() as PointSettings;
        return {
          pointPerItem: data.pointPerItem ?? 1000,
          eligibleCategories: data.eligibleCategories ?? [],
          isEnabled: data.isEnabled ?? true,
          minOrderForRedeem: data.minOrderForRedeem ?? 0
        };
      }

      // Default settings
      return {
        pointPerItem: 1000,
        eligibleCategories: ['Gamis', 'Hijab', 'Khimar', 'Tunik'], // Default muslim fashion categories
        isEnabled: true,
        minOrderForRedeem: 0
      };
    } catch (error) {
      console.error('❌ Error getting point settings:', error);
      // Return safe defaults on error
      return {
        pointPerItem: 1000,
        eligibleCategories: [],
        isEnabled: true,
        minOrderForRedeem: 0
      };
    }
  },

  /**
   * Save point system settings
   */
  async saveSettings(settings: PointSettings): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_SETTINGS, SETTINGS_DOC_ID);
      await setDoc(docRef, settings, { merge: true });
      console.log('✅ Point settings saved:', settings);
    } catch (error) {
      console.error('❌ Error saving point settings:', error);
      throw error;
    }
  },

  /**
   * Calculate potential points for an order
   */
  async calculateEarnedPoints(order: Order, settings?: PointSettings): Promise<number> {
    console.log('🔍 DEBUG calculateEarnedPoints:', {
      orderId: order.id,
      userId: order.userId,
      userRole: order.userRole,
      status: order.status,
      itemCount: order.items?.length || 0
    });

    // Only Resellers earn points
    if (order.userRole && order.userRole !== 'reseller') {
      console.log(`❌ Points skipped: User role is "${order.userRole}", not "reseller"`);
      return 0;
    }

    // Double check with latest user data if order.userRole is missing
    if (!order.userRole) {
      console.log('⚠️ order.userRole is missing, checking Firestore...');
      const user = await usersService.getUserById(order.userId);
      if (!user || user.role !== 'reseller') {
        console.log(`❌ Points skipped: User from Firestore is "${user?.role || 'not found'}", not "reseller"`);
        return 0;
      }
      console.log('✅ User is reseller (from Firestore)');
    } else {
      console.log(`✅ User role from order: "${order.userRole}"`);
    }

    // Get settings if not provided
    const config = settings || await this.getSettings();
    console.log('📋 Point settings:', {
      isEnabled: config.isEnabled,
      pointPerItem: config.pointPerItem,
      eligibleCategories: config.eligibleCategories
    });

    if (!config.isEnabled) {
      console.log('❌ Points skipped: Point system is disabled');
      return 0;
    }

    let totalPoints = 0;

    // Calculate based on eligible items
    if (order.items && Array.isArray(order.items)) {
      for (const item of order.items) {
        // Get item name (order items use productName, cart items use name)
        const itemName = item.productName || item.name || 'Unknown';

        // ⛔ RESTRICTION: Skip Flash Sale Items
        if (item.isFlashSale) {
          continue;
        }

        // ⛔ RESTRICTION: Skip Discounted Items (Harga Coret)
        const currentPrice = item.price || 0;
        const originalPrice = item.originalResellerPrice || item.originalRetailPrice || 0;

        if (originalPrice > currentPrice) {
          continue;
        }

        // Check if item category is eligible
        const category = item.category || '';

        // Case insensitive check
        const isEligible = config.eligibleCategories.some(
          cat => cat.toLowerCase() === category.toLowerCase()
        );

        if (isEligible) {
          const itemPoints = (item.quantity || 0) * config.pointPerItem;
          totalPoints += itemPoints;
          console.log(`✅ Point: +${itemPoints} for "${itemName}" (${category})`);
        }
      }
    }

    if (totalPoints > 0) {
      console.log(`💰 Total points earned: ${totalPoints}`);
    }
    return totalPoints;
  },

  /**
   * Distribute points when order is PAID
   */
  async processOrderPoints(order: Order): Promise<void> {
    try {
      console.log(`🔄 Processing points for order ${order.id}...`);

      // 1. Validate status
      if (order.status !== 'paid') {
        console.log('ℹ️ Order not paid, skipping point distribution.');
        return;
      }

      // 2. Check if points already processed for this order (idempotency)
      // We can check if a history record exists for this orderId + type 'earned'
      // Or simply trust the caller. Ideally we check history.
      // For MVP, let's just proceed.

      // 3. Get Settings
      const settings = await this.getSettings();

      // 4. Calculate Points
      const pointsToEarn = await this.calculateEarnedPoints(order, settings);

      if (pointsToEarn <= 0) {
        console.log('ℹ️ No eligible points for this order.');
        return;
      }

      console.log(`💰 Adding ${pointsToEarn} points to user ${order.userId}`);

      // 5. Update User Points & Add History (Atomic)
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', order.userId);
        const historyRef = doc(collection(db, COLLECTION_HISTORY));

        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error('User does not exist!');
        }

        // Increment points
        transaction.update(userRef, {
          points: increment(pointsToEarn)
        });

        // Add history record
        transaction.set(historyRef, {
          userId: order.userId,
          type: 'earned',
          amount: pointsToEarn,
          orderId: order.id,
          description: `Reward transaksi #${order.id}`,
          createdAt: serverTimestamp()
        });
      });

      console.log('✅ Points distributed successfully!');

    } catch (error) {
      console.error('❌ Failed to process order points:', error);
      // Non-blocking error - we don't want to break the order flow if points fail
    }
  },

  /**
   * Deduct points for redemption
   * This is usually called during order creation
   */
  async deductPoints(userId: string, pointsToUse: number, orderId: string): Promise<boolean> {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        const currentPoints = userDoc.data().points || 0;
        if (currentPoints < pointsToUse) {
          throw new Error('Insufficient points');
        }

        // Deduct
        transaction.update(userRef, {
          points: increment(-pointsToUse)
        });

        // Record history
        const historyRef = doc(collection(db, COLLECTION_HISTORY));
        transaction.set(historyRef, {
          userId,
          type: 'redeemed',
          amount: pointsToUse,
          orderId,
          description: `Penukaran point untuk order #${orderId}`,
          createdAt: serverTimestamp()
        });
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to deduct points:', error);
      return false;
    }
  }
};
