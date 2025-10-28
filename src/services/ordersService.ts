// Orders Service - Sync orders across devices using Firebase
import { auth } from '../utils/firebaseClient';
import { doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export interface Order {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  items: any[];
  shippingInfo: any;
  paymentMethod: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'awaiting_verification' | 'paid';
  totalAmount: number;
  shippingCost: number;
  finalTotal: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  timestamp: number;
  paymentProof?: string;
}

class OrdersService {
  private readonly collection = 'orders';

  // Create new order
  async createOrder(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order> {
    try {
      console.log('📦 Creating order in Firebase...');

      const user = auth.currentUser;
      if (!user) {
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

  // Get orders for current user
  async getUserOrders(): Promise<Order[]> {
    try {
      console.log('📦 Loading orders from Firebase...');
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const ordersRef = collection(db, this.collection);
      const q = query(ordersRef, where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);

      const orders: Order[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<Order, 'id'>;
        orders.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || data.createdAt || new Date().toISOString()
        });
      });

      console.log('✅ Orders loaded from Firebase:', orders.length, 'orders');
      return orders;
    } catch (error) {
      console.error('❌ Error getting user orders:', error);
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
