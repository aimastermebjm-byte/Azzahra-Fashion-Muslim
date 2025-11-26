// 🌍 GLOBAL ORDERS STATE - Single listener untuk seluruh app
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Order } from './useFirebaseOrders';

interface GlobalOrdersState {
  allOrders: Order[];
  loading: boolean;
  error: string | null;
}

// Global state untuk semua components
let globalOrdersState: GlobalOrdersState = {
  allOrders: [],
  loading: true,
  error: null
};

// Global listener instance
let globalOrdersUnsubscribe: (() => void) | null = null;
let globalOrdersListeners: Array<() => void> = [];

// Update semua listeners
const notifyGlobalOrdersListeners = () => {
  globalOrdersListeners.forEach(listener => listener());
};

export const useGlobalOrders = () => {
  const [state, setState] = useState<GlobalOrdersState>(globalOrdersState);

  // Update local state saat global state berubah
  useEffect(() => {
    const updateListener = () => {
      setState({ ...globalOrdersState });
    };

    globalOrdersListeners.push(updateListener);

    // Initial load
    setState({ ...globalOrdersState });

    return () => {
      const index = globalOrdersListeners.indexOf(updateListener);
      if (index > -1) {
        globalOrdersListeners.splice(index, 1);
      }
    };
  }, []);

  // Initialize global listener (hanya sekali untuk seluruh app)
  useEffect(() => {
    if (globalOrdersUnsubscribe) {
      return; // Listener already active
    }

    console.log('🌍 Initializing GLOBAL orders listener (single connection)...');

    const setupGlobalOrdersListener = async () => {
      try {
        const ordersRef = collection(db, 'orders');
        const q = query(
          ordersRef,
          orderBy('timestamp', 'desc')
        );

        globalOrdersUnsubscribe = onSnapshot(
          q,
          (querySnapshot) => {
            console.log('📦 Global orders snapshot received:', querySnapshot.size, 'orders');

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

            // Update global state
            globalOrdersState = {
              allOrders: loadedOrders,
              loading: false,
              error: null
            };

            // Notify semua listeners
            notifyGlobalOrdersListeners();

            console.log('✅ Global orders loaded:', loadedOrders.length, 'orders');
          },
          (error) => {
            console.error('❌ Global orders listener error:', error);
            globalOrdersState = {
              allOrders: [],
              loading: false,
              error: error.message
            };
            notifyGlobalOrdersListeners();
          }
        );
      } catch (error) {
        console.error('❌ Error setting up global orders listener:', error);
        globalOrdersState = {
          allOrders: [],
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        notifyGlobalOrdersListeners();
      }
    };

    setupGlobalOrdersListener();

    return () => {
      // JANGAN cleanup global listener - dibutuhkan untuk app lain
      // Cleanup hanya dilakukan saat app unmount
    };
  }, []);

  // Helper functions
  const getUserOrders = (userId: string): Order[] => {
    return state.allOrders.filter(order => order.userId === userId);
  };

  const getOrderById = (orderId: string): Order | undefined => {
    return state.allOrders.find(order => order.id === orderId);
  };

  const getOrdersByStatus = (status: string): Order[] => {
    return state.allOrders.filter(order => order.status === status);
  };

  const getRecentOrders = (limit: number = 10): Order[] => {
    return state.allOrders.slice(0, limit);
  };

  return {
    ...state,
    allOrders: state.allOrders,
    getUserOrders,
    getOrderById,
    getOrdersByStatus,
    getRecentOrders
  };
};