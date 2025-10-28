// Orders Service - Sync orders across devices using Firebase
import { auth } from '../utils/firebaseClient';
import { doc, getDoc, setDoc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export interface Order {
  id: string;
  userId: string;
  userName: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

class OrdersService {
  private readonly collection = 'orders';

  // Create new order
  async createOrder(orderData): Promise<Order> {
    try {
      console.log('📦 Creating order in Firebase...');

      const user = auth.currentUser;
      if (\!user) {
        throw new Error('User not authenticated');
      }

      const newOrder = {
        ...orderData,
        id: this.generateOrderId(),
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timestamp: Date.now()
      };

      // Save to Firebase
      const orderRef = doc(db, this.collection, newOrder.id);
      await setDoc(orderRef, newOrder);

      console.log('✅ Order created in Firebase:', newOrder.id);
      return newOrder;
    } catch (error) {
      console.error('❌ Error creating order:', error);
      throw error;
    }
  }

  // Generate order ID
  private generateOrderId(): string {
    return 'AZF' + Date.now().toString().slice(-8);
  }
}

// Singleton instance
export const ordersService = new OrdersService();
