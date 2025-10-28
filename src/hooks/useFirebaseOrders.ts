import { useState, useEffect } from 'react';
import { auth } from '../utils/firebaseClient';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { ordersService } from '../services/ordersService';

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

export const useFirebaseOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupOrdersListener = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setOrders([]);
          setLoading(false);
          return;
        }

        console.log('📦 Setting up orders listener for user:', user.uid);

        // Set up real-time listener for orders
        const ordersRef = collection(db, 'orders');
        const q = query(
          ordersRef,
          where('userId', '==', user.uid),
          orderBy('timestamp', 'desc')
        );

        unsubscribe = onSnapshot(
          q,
          (querySnapshot) => {
            const loadedOrders: Order[] = [];
            querySnapshot.forEach((doc) => {
              const data = doc.data() as Omit<Order, 'id'>;
              loadedOrders.push({
                ...data,
                id: doc.id,
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: data.updatedAt || data.createdAt || new Date().toISOString()
              });
            });

            console.log('✅ Orders loaded from Firebase:', loadedOrders.length, 'orders');
            setOrders(loadedOrders);
            setLoading(false);
            setError(null);
          },
          async (error) => {
            console.error('❌ Error listening to orders:', error);
            setError(error.message);
            setLoading(false);

            // Fallback to ordersService
            console.log('🔄 Falling back to ordersService...');
            try {
              const fallbackOrders = await ordersService.getUserOrders();
              setOrders(fallbackOrders);
              setError(null);
            } catch (fallbackError) {
              console.error('❌ Fallback also failed:', fallbackError);
            }
          }
        );
      } catch (error) {
        console.error('❌ Error setting up orders listener:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLoading(false);
      }
    };

    setupOrdersListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return { orders, loading, error };
};