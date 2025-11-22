import { useState, useEffect } from 'react';
import { auth } from '../utils/firebaseClient';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { ordersService } from '../services/ordersService';
import { Order } from './useFirebaseOrders';

export const useFirebaseAdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupOrdersListener = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setOrders([]);
          setLoading(false);
          setInitialLoad(false);
          return;
        }

  
        // Set up real-time listener for ALL orders (admin)
        const ordersRef = collection(db, 'orders');
        const q = query(
          ordersRef,
          orderBy('timestamp', 'desc')
        );

        // Mobile-optimized query with limit for faster initial load
        const mobileOptimizedQuery = query(
          ordersRef,
          orderBy('timestamp', 'desc')
        );

        unsubscribe = onSnapshot(
          mobileOptimizedQuery,
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

              setOrders(loadedOrders);
            setLoading(false);
            setInitialLoad(false);
            setError(null);
          },
          async (error) => {
            console.error('Error listening to admin orders:', error);
            setError(error.message);
            setLoading(false);

            // Fallback to ordersService
            setInitialLoad(false);
            try {
              const fallbackOrders = await ordersService.getAllOrders();
              setOrders(fallbackOrders);
              setError(null);
            } catch (fallbackError) {
              console.error('Fallback also failed:', fallbackError);
            }
          }
        );
      } catch (error) {
        console.error('Error setting up admin orders listener:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLoading(false);
        setInitialLoad(false);
      }
    };

    // Mobile timeout protection - fail fast if taking too long
    const mobileTimeout = setTimeout(() => {
      if (loading && initialLoad) {
        console.warn('Loading taking too long, triggering fallback');
        setLoading(false);
        setInitialLoad(false);
        setError('Loading terlalu lama, silakan refresh halaman');
      }
    }, 8000); // 8 seconds timeout for mobile

    setupOrdersListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (mobileTimeout) {
        clearTimeout(mobileTimeout);
      }
    };
  }, []);

  return { orders, loading: loading && initialLoad, error, initialLoad };
};