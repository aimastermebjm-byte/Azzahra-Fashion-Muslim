// Orders Service - Sync orders across devices using Firebase
import { auth } from '../utils/firebaseClient';
import { doc, setDoc, collection, getDocs, query, where, updateDoc, deleteDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export interface Order {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  items: any[];
  shippingInfo: any;
  paymentMethod: string;
  paymentMethodId?: string | null;
  paymentMethodName?: string | null;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'awaiting_verification' | 'paid';
  totalAmount: number;
  shippingCost: number;
  finalTotal: number;
  notes?: string;
  createdAt: Timestamp | string; // Support both Timestamp (new) and string (legacy)
  updatedAt: Timestamp | string;
  timestamp: number;
  paymentProof?: string;
  paymentProofData?: string;
  paymentProofUrl?: string;
  
  // ✨ NEW: Unique Payment Code System (OPTIONAL - Backward Compatible)
  verificationMode?: 'auto' | 'manual'; // Default: 'manual' (existing behavior)
  uniquePaymentCode?: number;          // 2-digit code (10-99) for auto verification
  exactPaymentAmount?: number;         // finalTotal + uniquePaymentCode
  originalAmount?: number;             // Store original finalTotal for reference
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
        createdAt: Timestamp.now(), // ✅ Use Firestore Timestamp for queries
        updatedAt: Timestamp.now(),
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

  // Update order status (for admin dashboard) - WITH STOCK RESTORATION
  async updateOrderStatus(orderId: string, newStatus: string): Promise<boolean> {
    try {
      console.log('🔄 Updating order status in Firebase:', orderId, '→', newStatus);

      // Get order data first to check items for stock restoration
      const orderRef = doc(db, this.collection, orderId);
      const orderDoc = await getDoc(orderRef);
      const orderData = orderDoc.data() as Order;

      // If order is being cancelled, restore stock
      if (newStatus === 'cancelled' && orderData.status !== 'cancelled') {
        console.log('📈 Restoring stock for cancelled order:', orderId);
        await this.restoreStockForOrder(orderData);
      }

      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });

      console.log('✅ Order status updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      return false;
    }
  }

  // NEW: Restore stock for cancelled order - BATCH SYSTEM
  private async restoreStockForOrder(order: Order): Promise<void> {
    try {
      console.log('🔄 RESTORING STOCK FOR CANCELLED ORDER - BATCH SYSTEM:', order.id);
      console.log('📦 Order items to restore:', order.items);

      // Read batch document once
      const batchRef = doc(db, 'productBatches', 'batch_1');
      const batchDoc = await getDoc(batchRef);

      if (!batchDoc.exists()) {
        console.error('❌ Batch document not found for stock restoration');
        return;
      }

      const batchProducts = batchDoc.data().products || [];
      const updatedBatchProducts = [...batchProducts];

      // Process each item for stock restoration
      for (const item of order.items) {
        console.log('🔄 Processing item for stock restoration:', {
          productId: item.productId,
          productName: item.productName,
          selectedVariant: item.selectedVariant,
          quantity: item.quantity
        });

        if (item.productId) {
          // Find product in batch
          const productIndex = updatedBatchProducts.findIndex(p => p.id === item.productId);

          if (productIndex === -1) {
            console.error('❌ PRODUCT NOT FOUND in batch:', item.productId);
            continue;
          }

          if (item.selectedVariant && updatedBatchProducts[productIndex].variants?.stock) {
            // Handle variant stock restoration - CORRECT STRUCTURE
            const oldVariantStock = Number(updatedBatchProducts[productIndex].variants.stock[item.selectedVariant.size]?.[item.selectedVariant.color] || 0);
            const newVariantStock = oldVariantStock + item.quantity;
            updatedBatchProducts[productIndex].variants.stock[item.selectedVariant.size][item.selectedVariant.color] = newVariantStock;

            // Recalculate total stock from all variants
            let totalStock = 0;
            if (updatedBatchProducts[productIndex].variants?.stock) {
              Object.values(updatedBatchProducts[productIndex].variants.stock).forEach((sizeStock: any) => {
                Object.values(sizeStock).forEach((colorStock: any) => {
                  totalStock += Number(colorStock || 0);
                });
              });
            }
            updatedBatchProducts[productIndex].stock = totalStock;

            console.log(`✅ RESTORED ${item.quantity} units to product ${item.productId} (${item.selectedVariant.size}, ${item.selectedVariant.color})`);
            console.log(`📊 Variant stock: ${oldVariantStock} → ${newVariantStock}, Total stock: ${totalStock}`);
          } else {
            // Handle main stock restoration only
            const currentStock = Number(updatedBatchProducts[productIndex].stock || 0);
            const newStock = currentStock + item.quantity;
            updatedBatchProducts[productIndex].stock = newStock;

            console.log(`✅ RESTORED ${item.quantity} units to product ${item.productId} (main stock)`);
            console.log(`📊 Main stock: ${currentStock} → ${newStock}`);
          }

          // Update last modified
          updatedBatchProducts[productIndex].lastModified = Date.now();
        } else {
          console.warn('⚠️ SKIPPING item - missing productId:', {
            productId: item.productId,
            selectedVariant: item.selectedVariant
          });
        }
      }

      // Update batch system with all restored stock in single operation
      await updateDoc(batchRef, {
        products: updatedBatchProducts,
        lastModified: Date.now()
      });

      console.log('✅ BATCH SYSTEM: All stock restored successfully for order:', order.id);
      console.log(`📦 Restored stock for ${order.items.length} items in batch`);

    } catch (error) {
      console.error('❌ ERROR restoring stock for order:', order.id, error);
      // Don't throw error to prevent order cancellation from failing
    }
  }

  // Update order payment verification - FREE Base64 in Firestore
  // ✨ NEW: Update order general data (for edit functionality)
  async updateOrder(orderId: string, updateData: Partial<Order>): Promise<boolean> {
    try {
      const orderRef = doc(db, this.collection, orderId);
      await updateDoc(orderRef, {
        ...updateData,
        updatedAt: Timestamp.now()
      });
      console.log('✅ Order updated successfully:', orderId);
      return true;
    } catch (error) {
      console.error('❌ Error updating order:', error);
      return false;
    }
  }

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
        updatedAt: Timestamp.now()
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

  // Public method for manual stock restoration (used by admin dashboard)
  async restoreStockForOrderManually(order: Order): Promise<void> {
    await this.restoreStockForOrder(order);
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
