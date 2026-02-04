// Orders Service - Sync orders across devices using Firebase
import { auth } from '../utils/firebaseClient';
import { doc, setDoc, collection, getDocs, query, where, updateDoc, deleteDoc, getDoc, Timestamp, onSnapshot, orderBy, runTransaction } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { pointService } from './pointService';

// 💳 Payment interface for installment/partial payment system
export interface Payment {
  id: string;                   // Unique ID (timestamp-based)
  amount: number;               // Jumlah bayar
  method: 'cash' | 'transfer';  // Metode pembayaran
  date: string;                 // ISO timestamp
  notes?: string;               // Catatan (optional)
  addedBy?: string;             // User ID yang input (owner/admin)
  addedByName?: string;         // Nama user yang input
}

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

  // ✨ NEW: Payment Group System (for batch payments)
  paymentGroupId?: string;             // Reference to payment group (if part of batch payment)
  groupPaymentAmount?: number;         // Total amount for the payment group

  // ✨ NEW: Auto-Expire Order System
  userRole?: 'customer' | 'reseller' | 'admin' | 'owner'; // Role saat order dibuat
  expiresAt?: number | null;           // Timestamp kapan order expired (null = no limit)
  hasReadyStockItems?: boolean;        // True jika ada item ready stock
  expiryNotified?: boolean;            // True jika sudah kirim notifikasi 15 menit

  // ✨ NEW: Reseller Point System
  usedPoints?: number;                 // Points redeeemed in this order
  pointDiscount?: number;              // Discount amount from points

  // 💳 NEW: Installment/Partial Payment System
  payments?: Payment[];                // Array of all payments
  totalPaid?: number;                  // Total amount paid so far
  remainingAmount?: number;            // Remaining amount to be paid

  // 🧾 NEW: Invoice Number System (format: INV-YYMMNNNNN)
  invoiceNumber?: string;              // Nomor invoice unik per bulan
}

class OrdersService {
  private readonly collection = 'orders';
  private readonly printJobsCollection = 'print_jobs';

  // Create temporary print job for Cloud Printing (Android Bridge)
  async createPrintJob(text: string): Promise<string> {
    try {
      const docRef = doc(collection(db, this.printJobsCollection));
      await setDoc(docRef, {
        content: text,
        createdAt: Timestamp.now(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60) // Auto-expire in 1 hour (optional cleanup policy)
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating print job:', error);
      throw error;
    }
  }

  // Create new order
  async createOrder(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order> {
    try {
      console.log('📦 Creating order in Firebase...');

      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // 🧾 Generate invoice number (format: INV-YYMMNNNNN)
      const invoiceNumber = await this.generateInvoiceNumber();

      const newOrder = {
        ...orderData,
        id: this.generateOrderId(),
        invoiceNumber, // 🧾 Save invoice number
        userId: user.uid,
        createdAt: Timestamp.now(), // ✅ Use Firestore Timestamp for queries
        updatedAt: Timestamp.now(),
        timestamp: Date.now()
      };

      // Save to Firebase
      const orderRef = doc(db, this.collection, newOrder.id);
      await setDoc(orderRef, newOrder);

      console.log('✅ Order created in Firebase:', newOrder.id, 'Invoice:', invoiceNumber);
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

      // ✨ NEW: Process Reseller Points if order is PAID
      if (newStatus === 'paid') {
        const fullOrder = { ...orderData, id: orderId };
        pointService.processOrderPoints(fullOrder).catch(err =>
          console.error('❌ Background point processing error:', err)
        );
      }

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

        // Convert file to base64 with COMPRESSION to ensure it fits in Firestore (Limit 1MB)
        try {
          console.log('📤 Compressing and converting payment proof...');

          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(proof);
            reader.onload = (event) => {
              const img = new Image();
              img.src = event.target?.result as string;
              img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;

                // Resize logic
                if (width > height) {
                  if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                  }
                } else {
                  if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                  }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Compress to JPEG with 0.7 quality
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                // Remove prefix
                resolve(dataUrl.split(',')[1]);
              };
              img.onerror = (err) => reject(new Error('Failed to load image for compression'));
            };
            reader.onerror = (err) => reject(err);
          });

          paymentProofData = base64Data;
          console.log('✅ Payment proof compressed & converted, size:', paymentProofData.length, 'chars');

        } catch (conversionError) {
          console.error('❌ Error compressing/converting file:', conversionError);
          // Fallback: Try raw base64 if compression fails, but warn
          try {
            const rawBase64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(proof);
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.onerror = reject;
            });
            paymentProofData = rawBase64;
          } catch (e) {
            paymentProofName = proof.name;
            paymentProofData = '';
          }
        }
      } else {
        // Handle string proof
        if (typeof proof === 'string' && proof.length > 100) {
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
        updatedAt: Timestamp.now(),
        expiresAt: null // ✨ STOP expiration timer when proof is uploaded
      };

      if (status) {
        updateData.status = status;
      }

      // Update data di Firebase Firestore (ini wajib berhasil!)
      const orderRef = doc(db, this.collection, orderId);
      await updateDoc(orderRef, updateData);

      console.log('✅ Order payment updated in Firebase Firestore (FREE storage!)');

      // ✨ NEW: Process Reseller Points if order status is now PAID
      if (status === 'paid') {
        console.log('💰 Order marked as paid, processing reseller points...');
        // Fetch the full order data for point calculation
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
          const fullOrder = { id: orderId, ...orderSnap.data() } as Order;
          pointService.processOrderPoints(fullOrder).catch(err =>
            console.error('❌ Background point processing error:', err)
          );
        }
      }

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

  // ✨ NEW: Sync Address to All Active Orders
  async updateActiveOrdersAddress(userId: string, newAddressData: any): Promise<number> {
    try {
      if (!userId) {
        console.warn('❌ updateActiveOrdersAddress: No userId provided');
        return 0;
      }

      console.log(`🔄 Syncing new address to active orders for user: ${userId}`);
      console.log('📦 New Address Data:', newAddressData);

      // 1. Query all active orders for this user
      // Statuses considered active: pending, awaiting_verification, paid, processing
      // We exclude: shipped (already has label printed likely), delivered, cancelled
      const activeStatuses = ['pending', 'awaiting_verification', 'paid', 'processing'];

      const ordersRef = collection(db, this.collection);
      const q = query(
        ordersRef,
        where('userId', '==', userId),
        where('status', 'in', activeStatuses)
      );

      const snapshot = await getDocs(q);
      const activeOrders = snapshot.docs;

      if (activeOrders.length === 0) {
        console.log('ℹ️ No active orders found to sync.');
        return 0;
      }

      console.log(`Found ${activeOrders.length} active orders to update.`);

      // 2. Batch update each order
      // We use Promise.all for parallel updates
      const updatePromises = activeOrders.map(async (docSnapshot) => {
        const orderData = docSnapshot.data() as Order;

        // Construct updated shipping info preserving existing fields but overwriting address
        const updatedShippingInfo = {
          ...orderData.shippingInfo,
          name: newAddressData.name || orderData.shippingInfo?.name,
          phone: newAddressData.phone || orderData.shippingInfo?.phone,
          address: newAddressData.fullAddress,
          // Sync crucial location data
          provinceName: newAddressData.province,
          cityName: newAddressData.city,
          district: newAddressData.district,
          subdistrict: newAddressData.subdistrict,
          postalCode: newAddressData.postalCode
        };

        const orderRef = doc(db, this.collection, docSnapshot.id);
        await updateDoc(orderRef, {
          shippingInfo: updatedShippingInfo,
          updatedAt: Timestamp.now()
        });

        console.log(`✅ Updated Order #${docSnapshot.id}`);
      });

      await Promise.all(updatePromises);
      console.log('✨ All active orders synced successfully!');

      return activeOrders.length;

    } catch (error) {
      console.error('❌ Failed to sync active orders address:', error);
      throw error;
    }
  }

  // Subscribe to orders (real-time) for PaymentAutoVerifier
  subscribeToOrders(callback: (orders: Order[]) => void): () => void {
    const ordersRef = collection(db, this.collection);
    const q = query(ordersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      callback(orders);
    }, (error) => {
      console.error('Error listening to orders:', error);
      callback([]);
    });

    return unsubscribe;
  }


  // Generate order ID
  private generateOrderId(): string {
    return 'AZF' + Date.now().toString().slice(-8);
  }

  // 🧾 NEW: Generate Invoice Number (format: INV-YYMMNNNNN)
  // Uses Firestore transaction for atomic counter increment
  // Counter resets each month automatically (new document per month)
  private async generateInvoiceNumber(): Promise<string> {
    try {
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2); // "26" for 2026
      const month = (now.getMonth() + 1).toString().padStart(2, '0'); // "02" for February
      const monthKey = `${year}${month}`; // "2602"

      const counterRef = doc(db, 'invoice_counters', monthKey);

      // Use transaction for atomic increment
      const newNumber = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        let currentCount = 0;
        if (counterDoc.exists()) {
          currentCount = counterDoc.data().count || 0;
        }

        const nextCount = currentCount + 1;

        transaction.set(counterRef, {
          count: nextCount,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          lastUpdated: Timestamp.now()
        });

        return nextCount;
      });

      // Format: INV-YYMMNNNNN (4 digit counter)
      const invoiceNumber = `INV-${monthKey}${newNumber.toString().padStart(4, '0')}`;
      console.log('🧾 Generated invoice number:', invoiceNumber);

      return invoiceNumber;
    } catch (error) {
      console.error('❌ Error generating invoice number:', error);
      // Fallback to timestamp-based invoice
      const fallback = `INV-${Date.now()}`;
      console.log('⚠️ Using fallback invoice:', fallback);
      return fallback;
    }
  }

  // 💳 NEW: Add payment to order (for installment/partial payment system)
  async addPayment(
    orderId: string,
    amount: number,
    method: 'cash' | 'transfer',
    notes?: string,
    addedByName?: string
  ): Promise<{ success: boolean; message: string; newStatus?: string }> {
    try {
      const user = auth.currentUser;
      if (!user) {
        return { success: false, message: 'User tidak terautentikasi' };
      }

      // Get current order
      const orderRef = doc(db, this.collection, orderId);
      const orderDoc = await getDoc(orderRef);

      if (!orderDoc.exists()) {
        return { success: false, message: 'Order tidak ditemukan' };
      }

      const order = { id: orderDoc.id, ...orderDoc.data() } as Order;

      // Validate amount
      if (amount <= 0) {
        return { success: false, message: 'Jumlah pembayaran harus lebih dari 0' };
      }

      const currentTotalPaid = order.totalPaid || 0;
      const currentRemaining = order.remainingAmount ?? (order.finalTotal - currentTotalPaid);

      if (amount > currentRemaining) {
        return { success: false, message: `Jumlah melebihi sisa (Rp ${currentRemaining.toLocaleString('id-ID')})` };
      }

      // Create payment record
      const payment: Payment = {
        id: `PAY-${Date.now()}`,
        amount: amount,
        method: method,
        date: new Date().toISOString(),
        notes: notes || '',
        addedBy: user.uid,
        addedByName: addedByName || user.displayName || 'Admin'
      };

      // Calculate new totals
      const existingPayments = order.payments || [];
      const newPayments = [...existingPayments, payment];
      const newTotalPaid = currentTotalPaid + amount;
      const newRemainingAmount = order.finalTotal - newTotalPaid;

      // Determine new status (paid if fully paid)
      const newStatus = newRemainingAmount <= 0 ? 'paid' : order.status;

      // Update order
      const updateData: Partial<Order> = {
        payments: newPayments,
        totalPaid: newTotalPaid,
        remainingAmount: newRemainingAmount,
        status: newStatus,
        updatedAt: Timestamp.now() // ✅ FIX: use Timestamp, not string
      };

      await updateDoc(orderRef, updateData);

      console.log(`💳 Payment added: ${method} Rp ${amount.toLocaleString('id-ID')} for order ${orderId}`);
      console.log(`📊 New total paid: Rp ${newTotalPaid.toLocaleString('id-ID')}, remaining: Rp ${newRemainingAmount.toLocaleString('id-ID')}`);

      // If fully paid, trigger point earning for reseller
      if (newStatus === 'paid' && order.userRole === 'reseller') {
        try {
          await pointService.processOrderPoints(order as any);
          console.log('🏆 Reseller points processed for order:', orderId);
        } catch (pointError) {
          console.error('Error processing points:', pointError);
        }
      }

      return {
        success: true,
        message: newRemainingAmount <= 0
          ? '✅ Pembayaran berhasil! Order sudah LUNAS.'
          : `✅ Pembayaran berhasil! Sisa: Rp ${newRemainingAmount.toLocaleString('id-ID')}`,
        newStatus: newStatus
      };

    } catch (error) {
      console.error('Error adding payment:', error);
      return { success: false, message: 'Gagal menambahkan pembayaran' };
    }
  }
}

// Singleton instance
export const ordersService = new OrdersService();
