import { useState, useEffect } from 'react';
import { auth } from '../utils/firebaseClient';
import { ordersService } from '../services/ordersService';
import { Order } from './useFirebaseOrders';

export const useFirebaseAdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  // 🌍 GLOBAL ORDERS SHARING: Import global orders context
  const { allOrders, loading: globalLoading, error: globalError } = require('./useGlobalOrders');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setOrders([]);
      setLoading(false);
      setInitialLoad(false);
      return;
    }

    // 🚀 OPTIMIZED: Use global state instead of individual listener (0 additional reads!)
    console.log('🔄 Admin orders using GLOBAL orders state (0 additional reads)...');

    if (globalLoading) {
      setLoading(true);
      setInitialLoad(true);
    } else if (globalError) {
      setError(globalError);
      setLoading(false);
      setInitialLoad(false);
    } else {
      // Use all orders from global state (admin sees all orders)
      setOrders(allOrders);
      setLoading(false);
      setInitialLoad(false);
      setError(null);

      console.log(`✅ Admin orders loaded: ${allOrders.length} orders from global state`);
    }
  }, [allOrders, globalLoading, globalError, auth.currentUser?.uid]);

  return { orders, loading: loading && initialLoad, error, initialLoad };
};