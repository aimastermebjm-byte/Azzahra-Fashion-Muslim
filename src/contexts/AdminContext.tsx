import React, { createContext, useContext, useState } from 'react';
import { ordersService } from '../services/ordersService';

interface Order {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  items: Array<{
    productId: string;
    productName: string;
    selectedVariant: {
      size: string;
      color: string;
    };
    quantity: number;
    price: number;
    total: number;
  }>;
  shippingInfo: {
    name: string;
    phone: string;
    address: string;
    isDropship: boolean;
    dropshipName?: string;
    dropshipPhone?: string;
  };
  paymentMethod: 'transfer' | 'cash';
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'awaiting_verification' | 'paid';
  totalAmount: number;
  shippingCost: number;
  finalTotal: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  timestamp: number;
  paymentProof?: string;
  paymentProofData?: string;
  paymentProofUrl?: string;
}

interface FlashSale {
  id: string;
  name: string;
  discount: number;
  startDate: Date;
  endDate: Date;
  active: boolean;
  products?: string[];
}

interface AdminContextType {
  orders: Order[];
  flashSales: FlashSale[];
  addOrder: (orderData: Omit<Order, 'createdAt' | 'updatedAt' | 'id' | 'timestamp'>) => Promise<void>;
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>;
  updateOrderPayment: (orderId: string, paymentProof: string, status?: Order['status']) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  getOrdersByStatus: (status: Order['status']) => Order[];
  getTotalRevenue: () => number;
  getTodayOrders: () => Order[];
  createFlashSale: (flashSale: Omit<FlashSale, 'id'>) => void;
  updateFlashSale: (id: string, flashSale: Partial<FlashSale>) => void;
  deleteFlashSale: (id: string) => void;
  getActiveFlashSales: () => FlashSale[];
  updateProductStock: (productId: string, quantity: number, variant?: any) => Promise<void>;
}

const AdminContext = createContext<AdminContextType | null>(null);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
};

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);

  const addOrder = async (orderData: Omit<Order, 'createdAt' | 'updatedAt' | 'id' | 'timestamp'>) => {
    try {
      const newOrder = {
        ...orderData,
        id: `ORD${Date.now().toString().slice(-8)}`,
        timestamp: Date.now(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await ordersService.createOrder(newOrder);
      console.log('✅ Order saved to Firebase:', newOrder.id);
    } catch (error) {
      console.error('❌ Error saving order:', error);
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      await ordersService.updateOrderStatus(orderId, status);
      console.log('📋 Order status updated:', orderId, '→', status);
    } catch (error) {
      console.error('❌ Error updating order status:', error);
    }
  };

  const updateOrderPayment = async (orderId: string, paymentProof: string, status: Order['status'] = 'pending') => {
    try {
      await ordersService.updateOrderPayment(orderId, paymentProof, status);
      console.log('💳 Order payment updated:', orderId);
    } catch (error) {
      console.error('❌ Error updating payment:', error);
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      await ordersService.deleteOrder(orderId);
      console.log('🗑️ Order deleted:', orderId);
    } catch (error) {
      console.error('❌ Error deleting order:', error);
    }
  };

  const getOrdersByStatus = (status: Order['status']) => {
    return orders.filter(order => order.status === status);
  };

  const getTotalRevenue = () => {
    return orders
      .filter(order => order.status === 'delivered')
      .reduce((total, order) => total + order.finalTotal, 0);
  };

  const getTodayOrders = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return orders.filter(order => {
      const orderDate = new Date(order.timestamp);
      return orderDate >= today;
    });
  };

  const createFlashSale = (flashSale: Omit<FlashSale, 'id'>) => {
    const newFlashSale: FlashSale = {
      ...flashSale,
      id: `fs_${Date.now()}`
    };
    setFlashSales(prev => [...prev, newFlashSale]);
  };

  const updateFlashSale = (id: string, flashSale: Partial<FlashSale>) => {
    setFlashSales(prev =>
      prev.map(fs => fs.id === id ? { ...fs, ...flashSale } : fs)
    );
  };

  const deleteFlashSale = (id: string) => {
    setFlashSales(prev => prev.filter(fs => fs.id !== id));
  };

  const getActiveFlashSales = () => {
    const now = new Date();
    return flashSales.filter(fs =>
      fs.active &&
      new Date(fs.startDate) <= now &&
      new Date(fs.endDate) >= now
    );
  };

  const updateProductStock = async (productId: string, quantity: number, variant?: any) => {
    // This would be implemented with the admin products hook
    console.log('🔄 Stock update requested:', productId, quantity, variant);
  };

  const value: AdminContextType = {
    orders,
    flashSales,
    addOrder,
    updateOrderStatus,
    updateOrderPayment,
    deleteOrder,
    getOrdersByStatus,
    getTotalRevenue,
    getTodayOrders,
    createFlashSale,
    updateFlashSale,
    deleteFlashSale,
    getActiveFlashSales,
    updateProductStock
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};

export default AdminProvider;