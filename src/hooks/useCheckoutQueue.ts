// 🔥 CHECKOUT QUEUE SYSTEM - High Concurrency Atomic Processing
// Individual product processing dengan batch system sebagai SOTN

import { useState, useEffect, useCallback } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDoc, runTransaction, query, orderBy, limit as limitCount, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export interface QueueItem {
  id: string;
  orderId: string;
  userId: string;
  productId: string;
  quantity: number;
  variantInfo?: { size: string; color: string };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
  error?: string;
  retryCount: number;
}

export interface UseCheckoutQueueResult {
  // Queue operations
  addToQueue: (orderId: string, userId: string, productId: string, quantity: number, variantInfo?: { size: string; color: string }) => Promise<string>;
  processQueue: () => Promise<void>;

  // Queue status
  queueItems: QueueItem[];
  processingQueue: boolean;

  // Stats
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
}

// 🔥 GLOBAL QUEUE PROCESSOR - Single instance untuk semua components
let globalQueueProcessor: ((items: QueueItem[]) => Promise<void>) | null = null;
let globalQueueProcessing = false;
let globalQueueItems: QueueItem[] = [];

const useCheckoutQueue = (): UseCheckoutQueueResult => {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [processingQueue, setProcessingQueue] = useState(false);

  // 🔥 REAL-TIME QUEUE MONITORING
  useEffect(() => {
    console.log('🚀 Initializing Checkout Queue System...');

    const queueRef = collection(db, 'checkoutQueue');
    const q = query(queueRef, orderBy('createdAt', 'asc'), limitCount(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: QueueItem[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          orderId: data.orderId || '',
          userId: data.userId || '',
          productId: data.productId || '',
          quantity: data.quantity || 0,
          variantInfo: data.variantInfo,
          status: data.status || 'pending',
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          processedAt: data.processedAt ? data.processedAt.toDate() : undefined,
          error: data.error,
          retryCount: data.retryCount || 0
        });
      });

      globalQueueItems = items;
      setQueueItems(items);

      // Auto-process queue jika ada pending items
      const pendingItems = items.filter(item => item.status === 'pending');
      if (pendingItems.length > 0 && !globalQueueProcessing) {
        console.log(`🔄 Auto-processing ${pendingItems.length} pending queue items...`);
        processQueueItems(pendingItems);
      }
    });

    return unsubscribe;
  }, []);

  // 🔥 ADD TO QUEUE - Instant response untuk user
  const addToQueue = useCallback(async (
    orderId: string,
    userId: string,
    productId: string,
    quantity: number,
    variantInfo?: { size: string; color: string }
  ): Promise<string> => {
    try {
      console.log('📦 Adding to checkout queue:', {
        orderId,
        userId,
        productId,
        quantity,
        variantInfo
      });

      const queueRef = collection(db, 'checkoutQueue');
      const docRef = await addDoc(queueRef, {
        orderId,
        userId,
        productId,
        quantity,
        variantInfo,
        status: 'pending',
        createdAt: new Date(),
        retryCount: 0
      });

      console.log(`✅ Added to queue: ${docRef.id}`);
      return docRef.id;

    } catch (error) {
      console.error('❌ Failed to add to queue:', error);
      throw error;
    }
  }, []);

  // 🔥 PROCESS QUEUE ITEMS - Background worker
  const processQueueItems = useCallback(async (items: QueueItem[]) => {
    if (globalQueueProcessing || items.length === 0) {
      return;
    }

    globalQueueProcessing = true;
    setProcessingQueue(true);

    try {
      console.log(`🔄 Processing ${items.length} queue items...`);

      for (const item of items) {
        try {
          // Update status to processing
          await updateDoc(doc(db, 'checkoutQueue', item.id), {
            status: 'processing',
            processedAt: new Date()
          });

          // 🔥 ATOMIC BATCH UPDATE - Single transaction per item
          await runTransaction(db, async (transaction) => {
            // Read current batch
            const batchRef = doc(db, 'productBatches', 'batch_1');
            const batchDoc = await transaction.get(batchRef);

            if (!batchDoc.exists()) {
              throw new Error('Batch not found');
            }

            const batchData = batchDoc.data();
            const products = batchData.products || [];

            // Find product in batch
            const productIndex = products.findIndex((p: any) => p.id === item.productId);
            if (productIndex === -1) {
              throw new Error(`Product ${item.productId} not found in batch`);
            }

            const product = products[productIndex];
            let newStock: number;

            // Handle variant stock or total stock
            if (item.variantInfo && product.variants?.stock) {
              const { size, color } = item.variantInfo;
              const currentVariantStock = Number(product.variants.stock[size]?.[color] || 0);

              if (currentVariantStock < item.quantity) {
                throw new Error(`Insufficient variant stock. Available: ${currentVariantStock}, Requested: ${item.quantity}`);
              }

              // Update variant stock
              const updatedVariantStock = JSON.parse(JSON.stringify(product.variants.stock));
              updatedVariantStock[size][color] = currentVariantStock - item.quantity;

              // Recalculate total stock
              const totalVariantStock = Object.values(updatedVariantStock)
                .reduce((total: number, sizeStock: any) => {
                  return total + Object.values(sizeStock as any)
                    .reduce((sizeTotal: number, colorStock: any) => {
                      return sizeTotal + Number(colorStock || 0);
                    }, 0);
                }, 0);

              product.stock = totalVariantStock;
              product.variants.stock = updatedVariantStock;
              newStock = totalVariantStock;
            } else {
              // Handle total stock
              const currentStock = Number(product.stock || 0);
              if (currentStock < item.quantity) {
                throw new Error(`Insufficient stock. Available: ${currentStock}, Requested: ${item.quantity}`);
              }

              newStock = currentStock - item.quantity;
              product.stock = newStock;
            }

            // Update batch with modified product
            products[productIndex] = product;

            // Atomic update
            transaction.update(batchRef, {
              products,
              updatedAt: new Date().toISOString()
            });

            console.log(`✅ Stock updated for ${item.productId}: ${item.quantity} units -> New stock: ${newStock}`);
          });

          // Update queue item to completed
          await updateDoc(doc(db, 'checkoutQueue', item.id), {
            status: 'completed',
            processedAt: new Date()
          });

          console.log(`✅ Queue item completed: ${item.id}`);

        } catch (error) {
          console.error(`❌ Failed to process queue item ${item.id}:`, error);

          // Update queue item to failed
          await updateDoc(doc(db, 'checkoutQueue', item.id), {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            processedAt: new Date(),
            retryCount: item.retryCount + 1
          });
        }
      }

      console.log('🎉 Queue processing completed');

    } catch (error) {
      console.error('❌ Queue processing error:', error);
    } finally {
      globalQueueProcessing = false;
      setProcessingQueue(false);
    }
  }, []);

  // 🔥 MANUAL QUEUE PROCESSING
  const processQueue = useCallback(async () => {
    const pendingItems = queueItems.filter(item => item.status === 'pending');
    await processQueueItems(pendingItems);
  }, [queueItems, processQueueItems]);

  // 🔥 QUEUE STATS
  const pendingCount = queueItems.filter(item => item.status === 'pending').length;
  const processingCount = queueItems.filter(item => item.status === 'processing').length;
  const completedCount = queueItems.filter(item => item.status === 'completed').length;
  const failedCount = queueItems.filter(item => item.status === 'failed').length;

  return {
    addToQueue,
    processQueue,
    queueItems,
    processingQueue,
    pendingCount,
    processingCount,
    completedCount,
    failedCount
  };
};

// 🔥 GLOBAL QUEUE PROCESSOR EXPORT
export { globalQueueProcessor, globalQueueItems };

export default useCheckoutQueue;