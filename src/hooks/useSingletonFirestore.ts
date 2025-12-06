// Singleton Firestore Listener - Prevent Multiple onSnapshot instances
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

let globalUnsubscribe: (() => void) | null = null;
let isInitialized = false;

export const useSingletonFirestore = () => {
  const subscribe = (callback: (products: any[]) => void, setLoading?: (loading: boolean) => void) => {
    // Jika sudah ada listener, cleanup dulu
    if (globalUnsubscribe) {
      console.log('🔄 SINGLETON: Cleaning up previous listener');
      globalUnsubscribe();
    }

    // Hanya buat listener jika belum ada atau sudah dicleanup
    if (!globalUnsubscribe || !isInitialized) {
      const batchRef = doc(db, 'productBatches', 'batch_1');

      console.log('🚀 SINGLETON: Creating NEW Firestore listener');

      globalUnsubscribe = onSnapshot(batchRef, (batchSnapshot) => {
        if (batchSnapshot.exists()) {
          const batchData = batchSnapshot.data();
          const products = batchData.products || [];

          console.log(`🚀 SINGLETON: Products updated with ${products.length} products`);
          callback(products);
        } else {
          console.log('⚠️ SINGLETON: No batch document found');
          callback([]);
        }
        if (setLoading) {
          setLoading(false);
        }
      });

      isInitialized = true;
    } else {
      console.log('🚀 SINGLETON: Using existing listener');
    }
  };

  const unsubscribe = () => {
    if (globalUnsubscribe) {
      console.log('🔄 SINGLETON: Cleaning up listener');
      globalUnsubscribe();
      globalUnsubscribe = null;
      isInitialized = false;
    }
  };

  return { subscribe, unsubscribe };
};