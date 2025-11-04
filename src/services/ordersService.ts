// Orders Service - Sync orders across devices using Firebase
import { auth } from '../utils/firebaseClient';
import { doc, setDoc, collection, getDocs, query, where, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
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

  // Update order status (for admin dashboard)
  async updateOrderStatus(orderId: string, newStatus: string): Promise<boolean> {
    try {
      console.log('🔄 Updating order status in Firebase:', orderId, '→', newStatus);

      const orderRef = doc(db, this.collection, orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      console.log('✅ Order status updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      return false;
    }
  }

  // Update order payment verification - FREE Base64 in Firestore
  async updateOrderPayment(orderId: string, proof: File | string, status?: string): Promise<boolean> {
    try {
      console.log('💳 Updating order payment in Firebase Firestore:', orderId);

      let paymentProofName = '';
      let paymentProofData = '';

      if (proof instanceof File) {
        paymentProofName = proof.name;

        // Convert file to base64 and save directly to Firestore (FREE!)
        try {
          console.log('📤 Converting payment proof to base64 (FREE storage)...');

          const reader = new FileReader();
          const base64Promise = new Promise((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              // Remove data URL prefix to save space
              const base64Data = result.split(',')[1] || result;
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(proof);
          });

          paymentProofData = await base64Promise;
          console.log('✅ Payment proof converted to base64, size:', paymentProofData.length, 'characters');
          console.log('💰 FREE storage in Firestore - No Firebase Storage cost!');

        } catch (conversionError) {
          console.error('❌ Error converting file to base64:', conversionError);
          // Fallback: Just save filename
          paymentProofName = proof.name;
          paymentProofData = '';
        }
      } else {
        // Handle string proof (could be base64 data or filename)
        if (typeof proof === 'string' && proof.length > 100) {
          // Likely base64 data (very long string)
          paymentProofData = proof;
          paymentProofName = 'payment_proof.jpg';
        } else {
          paymentProofName = proof;
        }
      }

      // Save EVERYTHING to Firebase Firestore (100% FREE!)
      const updateData: any = {
        paymentProof: paymentProofName,
        paymentProofData: paymentProofData, // Base64 image data
        paymentProofUrl: '', // Empty since we use base64
        updatedAt: new Date().toISOString()
      };

      if (status) {
        updateData.status = status;
      }

      // Update data di Firebase Firestore (ini wajib berhasil!)
      const orderRef = doc(db, this.collection, orderId);
      await updateDoc(orderRef, updateData);

      console.log('✅ Order payment updated in Firebase Firestore (FREE storage!)');
      return true;
    } catch (error) {
      console.error('❌ Error updating order payment in Firebase Firestore:', error);
      return false;
    }
  }

  // Delete order (for admin dashboard)
  async deleteOrder(orderId: string): Promise<boolean> {
    try {
      console.log('🗑️ Deleting order from Firebase:', orderId);

      const orderRef = doc(db, this.collection, orderId);
      await deleteDoc(orderRef);

      console.log('✅ Order deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Error deleting order:', error);
      return false;
    }
  }

  // Get all orders (for admin dashboard)
  async getAllOrders(): Promise<Order[]> {
    try {
      console.log('📦 Loading all orders from Firebase...');

      const ordersRef = collection(db, this.collection);
      const querySnapshot = await getDocs(ordersRef);

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

      console.log('✅ All orders loaded from Firebase:', orders.length, 'orders');
      return orders;
    } catch (error) {
      console.error('❌ Error getting all orders:', error);
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
