import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, FlashSale } from '../types';
import { AppStorage } from '../utils/appStorage';

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
  paymentProof?: string;
  paymentProofUrl?: string;
  status: 'pending' | 'awaiting_verification' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  shippingCost: number;
  finalTotal: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AdminContextType {
  orders: Order[];
  flashSales: FlashSale[];
  addOrder: (order: Omit<Order, 'createdAt' | 'updatedAt'>) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  updateOrderPayment: (orderId: string, paymentProof: string) => void;
  deleteOrder: (orderId: string) => void;
  getOrdersByStatus: (status: Order['status']) => Order[];
  getTotalRevenue: () => number;
  getTodayOrders: () => Order[];
  createFlashSale: (flashSale: Omit<FlashSale, 'id' | 'createdAt'>) => void;
  updateFlashSale: (id: string, updates: Partial<FlashSale>) => void;
  deleteFlashSale: (id: string) => void;
  getActiveFlashSales: () => FlashSale[];
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);

  // Load orders from AppStorage on mount
  useEffect(() => {
    const savedOrders = AppStorage.getOrders();
    setOrders(savedOrders);
    console.log('📋 Orders loaded from AppStorage:', savedOrders.length);
  }, []);

  // Listen for order updates
  useEffect(() => {
    const handleOrderUpdate = () => {
      const updatedOrders = AppStorage.getOrders();
      setOrders(updatedOrders);
      console.log('📋 Orders updated:', updatedOrders.length);
    };

    window.addEventListener('orderUpdated', handleOrderUpdate);
    return () => window.removeEventListener('orderUpdated', handleOrderUpdate);
  }, []);

  const addOrder = (orderData: Omit<Order, 'createdAt' | 'updatedAt'>) => {
    const newOrder: Order = {
      ...orderData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to AppStorage (permanent storage)
    AppStorage.saveOrder(newOrder);

    // Update local state
    setOrders(prev => [newOrder, ...prev]);

    console.log('💾 Order saved permanently:', newOrder.id);

    // Trigger event to notify other components
    window.dispatchEvent(new CustomEvent('orderUpdated', { detail: newOrder }));
  };

  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    // Update in AppStorage
    AppStorage.updateOrderStatus(orderId, status);

    // Update local state
    setOrders(prev =>
      prev.map(order =>
        order.id === orderId
          ? { ...order, status, updatedAt: new Date() }
          : order
      )
    );

    console.log('📋 Order status updated:', orderId, '→', status);

    // Trigger event to notify other components
    window.dispatchEvent(new CustomEvent('orderUpdated', { detail: { orderId, status } }));
  };

  const updateOrderPayment = (orderId: string, paymentProof: string, status: Order['status'] = 'pending') => {
    // Update in AppStorage
    const updatedOrders = orders.map(order =>
      order.id === orderId
        ? {
            ...order,
            paymentProof,
            paymentProofUrl: 'https://images.pexels.com/photos/4386321/pexels-photo-4386321.jpeg?auto=compress&cs=tinysrgb&w=400',
            status,
            updatedAt: new Date()
          }
        : order
    );

    // Save updated orders to AppStorage
    localStorage.setItem('azzahra_orders', JSON.stringify(updatedOrders));

    // Update local state
    setOrders(updatedOrders);

    console.log('💳 Order payment updated:', orderId);

    // Trigger event to notify other components
    window.dispatchEvent(new CustomEvent('orderUpdated', { detail: { orderId, paymentProof, status } }));
  };

  const deleteOrder = (orderId: string) => {
    // Remove from AppStorage
    const updatedOrders = orders.filter(order => order.id !== orderId);
    localStorage.setItem('azzahra_orders', JSON.stringify(updatedOrders));

    // Update local state
    setOrders(updatedOrders);

    console.log('🗑️ Order deleted permanently:', orderId);

    // Trigger event to notify other components
    window.dispatchEvent(new CustomEvent('orderUpdated', { detail: { orderId, deleted: true } }));
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
    return orders.filter(order => order.createdAt >= today);
  };

  const createFlashSale = (flashSaleData: Omit<FlashSale, 'id' | 'createdAt'>) => {
    const newFlashSale: FlashSale = {
      ...flashSaleData,
      id: 'FS' + Date.now().toString(),
      createdAt: new Date()
    };
    
    console.log('Creating flash sale:', newFlashSale);
    console.log('Flash sale products:', flashSaleData.productIds);
    console.log('Discount:', flashSaleData.discountType, flashSaleData.discountValue);
    
    // Update state first
    setFlashSales(prev => {
      const updated = [newFlashSale, ...prev];
      console.log('Updated flash sales:', updated);
      return updated;
    });
    
    // Dispatch event after state update
    setTimeout(() => {
      console.log('Dispatching flashSaleCreated event');
      const event = new CustomEvent('flashSaleCreated', { 
        detail: newFlashSale,
        bubbles: true
      });
      window.dispatchEvent(event);
      console.log('Event dispatched');
    }, 100);
  };

  const updateFlashSale = (id: string, updates: Partial<FlashSale>) => {
    setFlashSales(prev => 
      prev.map(fs => fs.id === id ? { ...fs, ...updates } : fs)
    );
    
    console.log('Updating flash sale:', id, updates);
    
    // Dispatch event to update products
    const updatedFlashSale = flashSales.find(fs => fs.id === id);
    if (updatedFlashSale) {
      window.dispatchEvent(new CustomEvent('flashSaleUpdated', { 
        detail: { ...updatedFlashSale, ...updates }
      }));
    }
  };

  const deleteFlashSale = (id: string) => {
    const flashSaleToDelete = flashSales.find(fs => fs.id === id);
    if (flashSaleToDelete) {
      console.log('Deleting flash sale:', flashSaleToDelete);
      window.dispatchEvent(new CustomEvent('flashSaleDeleted', { 
        detail: flashSaleToDelete 
      }));
    }
    setFlashSales(prev => prev.filter(fs => fs.id !== id));
  };

  const getActiveFlashSales = () => {
    const now = new Date();
    return flashSales.filter(fs => 
      fs.isActive && 
      fs.startDate <= now && 
      fs.endDate >= now
    );
  };

  return (
    <AdminContext.Provider value={{
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
      getActiveFlashSales
    }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};