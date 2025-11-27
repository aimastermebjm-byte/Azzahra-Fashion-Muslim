import { useState, useEffect } from 'react';
import { auth } from '../utils/firebaseClient';
import { ordersService } from '../services/ordersService';
import { useGlobalOrders } from './useGlobalOrders';

export interface Order {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  items: {
    productId: string;
    productName: string;
    productImage: string;
    selectedVariant: {
      size: string;
      color: string;
    };
    quantity: number;
    price: number;
    total: number;
  }[];
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

export const useFirebaseOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🌍 GLOBAL ORDERS SHARING: Import global orders context
  const { allOrders, loading: globalLoading, error: globalError, getUserOrders } = useGlobalOrders();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setOrders([]);
      setLoading(false);
      setError(null);
      return;
    }

    // 🚀 OPTIMIZED: Use global state instead of individual listener (0 additional reads!)
    console.log('🔄 User orders using GLOBAL orders state (0 additional reads)...');

    if (globalLoading) {
      setLoading(true);
    } else if (globalError) {
      setError(globalError);
      setLoading(false);
    } else {
      // Filter user orders from global state
      const userOrders = allOrders.filter(order => order.userId === user.uid);
      setOrders(userOrders);
      setLoading(false);
      setError(null);

      console.log(`✅ User orders loaded: ${userOrders.length} orders from global state`);
    }
  }, [allOrders, globalLoading, globalError, auth.currentUser?.uid]);

  return { orders, loading, error };
};