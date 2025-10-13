import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, FlashSale } from '../types';

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

  // Mock orders for demo
  useEffect(() => {
    const mockOrders: Order[] = [
      {
        id: 'AZF12345678',
        userId: '1',
        userName: 'Siti Aminah',
        userEmail: 'siti@example.com',
        items: [
          {
            productId: '2',
            productName: 'Gamis Syari Elegant',
            selectedVariant: { size: 'M', color: 'Navy' },
            quantity: 1,
            price: 200000,
            total: 200000
          }
        ],
        shippingInfo: {
          name: 'Siti Aminah',
          phone: '081234567890',
          address: 'Jl. Merdeka No. 123, Jakarta Selatan',
          isDropship: false
        },
        paymentMethod: 'transfer',
        paymentProof: 'bukti_transfer_123.jpg',
        paymentProofUrl: 'https://images.pexels.com/photos/4386321/pexels-photo-4386321.jpeg?auto=compress&cs=tinysrgb&w=400',
        status: 'awaiting_verification',
        totalAmount: 200000,
        shippingCost: 15000,
        finalTotal: 215000,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'AZF12345679',
        userId: '2',
        userName: 'Fatimah Zahra',
        userEmail: 'fatimah@example.com',
        items: [
          {
            productId: '1',
            productName: 'Hijab Segi Empat Premium',
            selectedVariant: { size: 'M', color: 'Hitam' },
            quantity: 2,
            price: 65000,
            total: 130000
          }
        ],
        shippingInfo: {
          name: 'Fatimah Zahra',
          phone: '081234567891',
          address: 'Jl. Sudirman No. 456, Bandung',
          isDropship: true,
          dropshipName: 'Toko Hijab Cantik',
          dropshipPhone: '081234567892'
        },
        paymentMethod: 'cash',
        status: 'processing',
        totalAmount: 130000,
        shippingCost: 15000,
        finalTotal: 145000,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      }
    ];
    setOrders(mockOrders);
  }, []);

  const addOrder = (orderData: Omit<Order, 'createdAt' | 'updatedAt'>) => {
    const newOrder: Order = {
      ...orderData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setOrders(prev => [newOrder, ...prev]);
  };

  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    setOrders(prev => 
      prev.map(order => 
        order.id === orderId 
          ? { ...order, status, updatedAt: new Date() }
          : order
      )
    );
  };

  const updateOrderPayment = (orderId: string, paymentProof: string, status: Order['status'] = 'pending') => {
    setOrders(prev => 
      prev.map(order => 
        order.id === orderId 
          ? { 
              ...order, 
              paymentProof, 
              paymentProofUrl: 'https://images.pexels.com/photos/4386321/pexels-photo-4386321.jpeg?auto=compress&cs=tinysrgb&w=400',
              status: status,
              updatedAt: new Date() 
            }
          : order
      )
    );
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