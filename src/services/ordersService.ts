// Orders Service - Sync orders across devices using user account
// This service handles order synchronization between localStorage and Firebase

import { auth } from '../utils/firebaseClient';

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  variant?: {
    size?: string;
    color?: string;
  };
}

export interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  items: OrderItem[];
  status: 'pending' | 'awaiting_verification' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  shippingCost: number;
  finalTotal: number;
  paymentMethod: 'transfer' | 'cash';
  paymentProof?: string;
  paymentProofUrl?: string;
  shippingInfo: {
    address: string;
    phone: string;
    isDropship?: boolean;
    dropshipName?: string;
    dropshipPhone?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
  trackingNumber?: string;
}

class OrdersService {
  private readonly LOCAL_STORAGE_KEY = 'azzahra_user_orders';
  private readonly FIREBASE_COLLECTION = 'user_orders';

  // Get current user's orders
  async getOrders(): Promise<Order[]> {
    try {
      const user = auth.currentUser;

      if (user) {
        // Logged in user - try to sync from Firebase first
        const firebaseOrders = await this.getOrdersFromFirebase(user.uid);
        if (firebaseOrders && firebaseOrders.length > 0) {
          // Sync to localStorage as backup
          this.saveOrdersToLocalStorage(user.uid, firebaseOrders);
          return firebaseOrders;
        } else {
          // No Firebase orders, use localStorage and sync to Firebase
          const localOrders = this.getOrdersFromLocalStorage(user.uid);
          if (localOrders.length > 0) {
            await this.saveOrdersToFirebase(user.uid, localOrders);
          }
          return localOrders;
        }
      } else {
        // Guest user - show empty array
        return [];
      }
    } catch (error) {
      console.error('Error getting orders:', error);
      return [];
    }
  }

  // Get orders for specific user (for admin)
  async getOrdersForUser(userId: string): Promise<Order[]> {
    try {
      const firebaseOrders = await this.getOrdersFromFirebase(userId);
      if (firebaseOrders && firebaseOrders.length > 0) {
        return firebaseOrders;
      } else {
        return this.getOrdersFromLocalStorage(userId);
      }
    } catch (error) {
      console.error('Error getting orders for user:', error);
      return [];
    }
  }

  // Get all orders (for admin)
  async getAllOrders(): Promise<Order[]> {
    try {
      // TODO: Implement Firebase Firestore query for all orders
      // For now, combine all localStorage orders
      const allOrders: Order[] = [];
      const keys = Object.keys(localStorage).filter(key =>
        key.startsWith(this.LOCAL_STORAGE_KEY + '_')
      );

      for (const key of keys) {
        try {
          const orders = JSON.parse(localStorage.getItem(key) || '[]');
          allOrders.push(...orders);
        } catch (error) {
          console.error('Error parsing orders from', key, error);
        }
      }

      return allOrders.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.error('Error getting all orders:', error);
      return [];
    }
  }

  // Create new order
  async createOrder(orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>): Promise<Order> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User must be logged in to create an order');
      }

      const order: Order = {
        ...orderData,
        id: this.generateId(),
        orderNumber: this.generateOrderNumber(),
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save both locally and to Firebase
      await this.saveOrder(user.uid, order);

      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  // Update order
  async updateOrder(orderId: string, updateData: Partial<Omit<Order, 'id' | 'orderNumber' | 'createdAt'>>): Promise<Order> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User must be logged in to update an order');
      }

      const orders = await this.getOrders();
      const orderIndex = orders.findIndex(order => order.id === orderId);

      if (orderIndex === -1) {
        throw new Error('Order not found');
      }

      const updatedOrder: Order = {
        ...orders[orderIndex],
        ...updateData,
        updatedAt: new Date()
      };

      orders[orderIndex] = updatedOrder;

      // Save both locally and to Firebase
      await this.saveOrdersToLocalStorage(user.uid, orders);
      await this.saveOrdersToFirebase(user.uid, orders);

      return updatedOrder;
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }

  // Update order status
  async updateOrderStatus(orderId: string, status: Order['status'], notes?: string): Promise<Order> {
    return this.updateOrder(orderId, { status, notes });
  }

  // Add tracking number
  async addTrackingNumber(orderId: string, trackingNumber: string): Promise<Order> {
    return this.updateOrder(orderId, { trackingNumber });
  }

  // Get order by ID
  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const orders = await this.getOrders();
      return orders.find(order => order.id === orderId) || null;
    } catch (error) {
      console.error('Error getting order by ID:', error);
      return null;
    }
  }

  // Get orders by status
  async getOrdersByStatus(status: Order['status']): Promise<Order[]> {
    try {
      const orders = await this.getOrders();
      return orders.filter(order => order.status === status);
    } catch (error) {
      console.error('Error getting orders by status:', error);
      return [];
    }
  }

  // Get order statistics
  async getOrderStats(): Promise<{
    total: number;
    pending: number;
    paid: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  }> {
    try {
      const orders = await this.getAllOrders();

      return {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        paid: orders.filter(o => o.status === 'paid').length,
        processing: orders.filter(o => o.status === 'processing').length,
        shipped: orders.filter(o => o.status === 'shipped').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length
      };
    } catch (error) {
      console.error('Error getting order stats:', error);
      return {
        total: 0,
        pending: 0,
        paid: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0
      };
    }
  }

  // Search orders
  async searchOrders(query: string): Promise<Order[]> {
    try {
      const orders = await this.getAllOrders();
      const lowercaseQuery = query.toLowerCase();

      return orders.filter(order =>
        order.orderNumber.toLowerCase().includes(lowercaseQuery) ||
        order.items.some(item => item.name.toLowerCase().includes(lowercaseQuery)) ||
        order.shippingInfo.phone.includes(query) ||
        order.shippingInfo.address.toLowerCase().includes(lowercaseQuery)
      );
    } catch (error) {
      console.error('Error searching orders:', error);
      return [];
    }
  }

  // Handle user logout
  async handleLogout(): Promise<void> {
    try {
      // Clear local orders for current user
      const user = auth.currentUser;
      if (user) {
        localStorage.removeItem(`${this.LOCAL_STORAGE_KEY}_${user.uid}`);
      }
    } catch (error) {
      console.error('Error handling logout:', error);
    }
  }

  // Private methods
  private getOrdersFromLocalStorage(userId: string): Order[] {
    try {
      const stored = localStorage.getItem(`${this.LOCAL_STORAGE_KEY}_${userId}`);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      return parsed.map((order: any) => ({
        ...order,
        createdAt: new Date(order.createdAt),
        updatedAt: new Date(order.updatedAt)
      }));
    } catch (error) {
      console.error('Error getting orders from localStorage:', error);
      return [];
    }
  }

  private saveOrdersToLocalStorage(userId: string, orders: Order[]): void {
    try {
      localStorage.setItem(`${this.LOCAL_STORAGE_KEY}_${userId}`, JSON.stringify(orders));
    } catch (error) {
      console.error('Error saving orders to localStorage:', error);
    }
  }

  private async getOrdersFromFirebase(userId: string): Promise<Order[] | null> {
    try {
      // Note: This would need Firebase Firestore implementation
      // For now, return null to use localStorage
      // TODO: Implement Firebase Firestore integration when needed
      return null;
    } catch (error) {
      console.error('Error getting orders from Firebase:', error);
      return null;
    }
  }

  private async saveOrderToFirebase(userId: string, order: Order): Promise<void> {
    try {
      // Note: This would need Firebase Firestore implementation
      // For now, do nothing
      // TODO: Implement Firebase Firestore integration when needed
      console.log('Order would be saved to Firebase for user:', userId, 'Order:', order.orderNumber);
    } catch (error) {
      console.error('Error saving order to Firebase:', error);
    }
  }

  private async saveOrdersToFirebase(userId: string, orders: Order[]): Promise<void> {
    try {
      // Note: This would need Firebase Firestore implementation
      // For now, do nothing
      // TODO: Implement Firebase Firestore integration when needed
      console.log('Orders would be saved to Firebase for user:', userId, 'Count:', orders.length);
    } catch (error) {
      console.error('Error saving orders to Firebase:', error);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = Date.now().toString(36).substr(-4).toUpperCase();

    return `ORD${year}${month}${day}${time}`;
  }

  // Format order for display
  formatOrder(order: Order): string {
    return `${order.orderNumber} - ${order.name} (${order.items.length} items)`;
  }

  // Get formatted date
  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

export const ordersService = new OrdersService();