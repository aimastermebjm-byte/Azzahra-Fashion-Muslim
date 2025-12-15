import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Product } from '../types';

export interface ProductSalesData {
  productId: string;
  productName: string;
  category: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  lastOrderDate: Date | null;
}

export interface SalesHistoryQuery {
  startDate: Date;
  endDate: Date;
  productIds?: string[];
}

export class SalesHistoryService {
  /**
   * Query sales history untuk produk tertentu dalam periode waktu
   */
  async getProductSales(
    productId: string,
    monthsBack: number = 3
  ): Promise<ProductSalesData> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate)),
      where('status', 'in', ['paid', 'delivered', 'processing'])
    );

    try {
      const snapshot = await getDocs(q);
      
      let totalQuantity = 0;
      let totalRevenue = 0;
      let orderCount = 0;
      let lastOrderDate: Date | null = null;
      let productName = '';
      let category = '';

      snapshot.docs.forEach(doc => {
        const order = doc.data();
        const items = order.items || [];

        items.forEach((item: any) => {
          if (item.productId === productId) {
            const quantity = item.quantity || 0;
            const price = item.price || 0;

            totalQuantity += quantity;
            totalRevenue += price * quantity;
            orderCount++;

            // Update product info
            if (!productName && item.productName) {
              productName = item.productName;
            }
            if (!category && item.category) {
              category = item.category;
            }

            // Track last order date
            if (order.createdAt) {
              const orderDate = order.createdAt.toDate();
              if (!lastOrderDate || orderDate > lastOrderDate) {
                lastOrderDate = orderDate;
              }
            }
          }
        });
      });

      return {
        productId,
        productName,
        category,
        totalQuantity,
        totalRevenue,
        orderCount,
        lastOrderDate
      };
    } catch (error: any) {
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        console.error('❌ MISSING FIRESTORE INDEX for orders collection!');
        console.error('📋 Query requires composite index: createdAt + status');
        console.error('🔧 Run: firebase deploy --only firestore:indexes');
        console.error('⏳ Wait 5-10 minutes for index to build, then retry');
      }
      console.error('Error fetching product sales:', error);
      return {
        productId,
        productName: '',
        category: '',
        totalQuantity: 0,
        totalRevenue: 0,
        orderCount: 0,
        lastOrderDate: null
      };
    }
  }

  /**
   * Query sales untuk multiple products sekaligus
   */
  async getBatchProductSales(
    productIds: string[],
    monthsBack: number = 3
  ): Promise<Map<string, ProductSalesData>> {
    const salesMap = new Map<string, ProductSalesData>();

    // Query all orders in the time period
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate)),
      where('status', 'in', ['paid', 'delivered', 'processing'])
    );

    try {
      // DEBUG: First check ALL orders without filters
      console.log('🔍 DEBUG: Checking ALL orders first...');
      const allOrdersSnapshot = await getDocs(collection(db, 'orders'));
      console.log(`📦 Total orders in database: ${allOrdersSnapshot.size}`);
      
      if (allOrdersSnapshot.size > 0) {
        console.log('\n📋 Sample of first 3 orders:');
        allOrdersSnapshot.docs.slice(0, 3).forEach((doc, i) => {
          const order = doc.data();
          console.log(`Order ${i + 1}:`, {
            id: doc.id,
            status: order.status,
            createdAt: order.createdAt ? (order.createdAt.toDate ? order.createdAt.toDate().toISOString() : order.createdAt) : 'MISSING',
            itemsCount: order.items?.length || 0
          });
        });
      }
      
      const snapshot = await getDocs(q);

      // DEBUG: Log query results
      console.log('\n🔍 DEBUG getBatchProductSales with FILTERS:');
      console.log('- Date range:', startDate.toISOString(), 'to', endDate.toISOString());
      console.log('- Status filter: paid, delivered, processing');
      console.log('- Orders found:', snapshot.size);
      console.log('- Looking for product IDs:', productIds);

      // Initialize sales data for all products
      productIds.forEach(id => {
        salesMap.set(id, {
          productId: id,
          productName: '',
          category: '',
          totalQuantity: 0,
          totalRevenue: 0,
          orderCount: 0,
          lastOrderDate: null
        });
      });

      // Process all orders
      snapshot.docs.forEach((doc, orderIndex) => {
        const order = doc.data();
        const items = order.items || [];

        console.log(`\n📦 Order ${orderIndex + 1} (${doc.id}):`, {
          status: order.status,
          createdAt: order.createdAt ? new Date(order.createdAt.seconds * 1000).toISOString() : 'NO DATE',
          itemsCount: items.length
        });

        items.forEach((item: any, itemIndex: number) => {
          console.log(`  Item ${itemIndex + 1}:`, {
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            match: productIds.includes(item.productId) ? '✅ MATCH!' : '❌ no match'
          });

          if (productIds.includes(item.productId)) {
            const currentData = salesMap.get(item.productId)!;
            const quantity = item.quantity || 0;
            const price = item.price || 0;

            console.log(`    💰 Adding to sales: +${quantity} pcs`);

            currentData.totalQuantity += quantity;
            currentData.totalRevenue += price * quantity;
            currentData.orderCount++;

            // Update product info
            if (!currentData.productName && item.productName) {
              currentData.productName = item.productName;
            }
            if (!currentData.category && item.category) {
              currentData.category = item.category;
            }

            // Track last order date
            if (order.createdAt) {
              const orderDate = order.createdAt.toDate();
              if (!currentData.lastOrderDate || orderDate > currentData.lastOrderDate) {
                currentData.lastOrderDate = orderDate;
              }
            }
          }
        });
      });

      console.log('\n📊 Final sales summary:');
      salesMap.forEach((data, productId) => {
        if (data.totalQuantity > 0) {
          console.log(`  ✅ ${data.productName || productId}: ${data.totalQuantity} pcs`);
        }
      });

      return salesMap;
    } catch (error: any) {
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        console.error('❌ MISSING FIRESTORE INDEX for orders collection!');
        console.error('📋 Query requires composite index: createdAt + status');
        console.error('🔧 Run: firebase deploy --only firestore:indexes');
        console.error('⏳ Wait 5-10 minutes for index to build, then retry');
      }
      console.error('Error fetching batch product sales:', error);
      return salesMap;
    }
  }

  /**
   * Get top selling products dalam kategori tertentu
   */
  async getTopSellingByCategory(
    category: string,
    monthsBack: number = 3,
    limit: number = 10
  ): Promise<ProductSalesData[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate)),
      where('status', 'in', ['paid', 'delivered', 'processing'])
    );

    try {
      const snapshot = await getDocs(q);
      const salesByProduct = new Map<string, ProductSalesData>();

      snapshot.docs.forEach(doc => {
        const order = doc.data();
        const items = order.items || [];

        items.forEach((item: any) => {
          // Filter by category
          if (item.category === category) {
            if (!salesByProduct.has(item.productId)) {
              salesByProduct.set(item.productId, {
                productId: item.productId,
                productName: item.productName || '',
                category: item.category || '',
                totalQuantity: 0,
                totalRevenue: 0,
                orderCount: 0,
                lastOrderDate: null
              });
            }

            const currentData = salesByProduct.get(item.productId)!;
            const quantity = item.quantity || 0;
            const price = item.price || 0;

            currentData.totalQuantity += quantity;
            currentData.totalRevenue += price * quantity;
            currentData.orderCount++;

            if (order.createdAt) {
              const orderDate = order.createdAt.toDate();
              if (!currentData.lastOrderDate || orderDate > currentData.lastOrderDate) {
                currentData.lastOrderDate = orderDate;
              }
            }
          }
        });
      });

      // Convert to array and sort by total quantity
      const salesArray = Array.from(salesByProduct.values());
      salesArray.sort((a, b) => b.totalQuantity - a.totalQuantity);

      return salesArray.slice(0, limit);
    } catch (error: any) {
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        console.error('❌ MISSING FIRESTORE INDEX for orders collection!');
        console.error('📋 Query requires composite index: createdAt + status');
        console.error('🔧 Run: firebase deploy --only firestore:indexes');
        console.error('⏳ Wait 5-10 minutes for index to build, then retry');
      }
      console.error('Error fetching top selling products:', error);
      return [];
    }
  }

  /**
   * Calculate similarity score berdasarkan kategori dan analysis
   */
  calculateCategorySimilarity(
    uploadedCategory: string,
    existingCategory: string
  ): number {
    if (uploadedCategory.toLowerCase() === existingCategory.toLowerCase()) {
      return 100;
    }

    // Similar categories
    const similarGroups = [
      ['gamis', 'dress'],
      ['tunik', 'blouse'],
      ['hijab', 'khimar']
    ];

    const isInSameGroup = similarGroups.some(group =>
      group.includes(uploadedCategory.toLowerCase()) &&
      group.includes(existingCategory.toLowerCase())
    );

    return isInSameGroup ? 70 : 30;
  }

  /**
   * Get products with sales > minSales in last monthsBack months
   */
  async getProductsWithMinSales(
    minSales: number = 4,
    monthsBack: number = 3,
    limit: number = 50
  ): Promise<ProductSalesData[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);

      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef,
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate)),
        where('status', 'in', ['paid', 'delivered', 'processing'])
      );

      const snapshot = await getDocs(q);
      
      // Aggregate sales by product
      const salesByProduct = new Map<string, ProductSalesData>();

      snapshot.docs.forEach(doc => {
        const order = doc.data();
        const items = order.items || [];

        items.forEach((item: any) => {
          const productId = item.productId;
          if (!productId) return;

          const quantity = item.quantity || 0;
          const price = item.price || 0;

          const existing = salesByProduct.get(productId);
          if (existing) {
            existing.totalQuantity += quantity;
            existing.totalRevenue += price * quantity;
            existing.orderCount++;
          } else {
            salesByProduct.set(productId, {
              productId,
              productName: item.productName || '',
              category: item.category || '',
              totalQuantity: quantity,
              totalRevenue: price * quantity,
              orderCount: 1,
              lastOrderDate: order.createdAt?.toDate() || null
            });
          }
        });
      });

      // Filter by min sales and convert to array
      const filteredProducts = Array.from(salesByProduct.values())
        .filter(product => product.totalQuantity > minSales)
        .sort((a, b) => b.totalQuantity - a.totalQuantity);

      return filteredProducts.slice(0, limit);
    } catch (error: any) {
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        console.error('❌ MISSING FIRESTORE INDEX for orders collection!');
        console.error('📋 Query requires composite index: createdAt + status');
        console.error('🔧 Run: firebase deploy --only firestore:indexes');
        console.error('⏳ Wait 5-10 minutes for index to build, then retry');
      }
      console.error('Error fetching products with min sales:', error);
      return [];
    }
  }
}

export const salesHistoryService = new SalesHistoryService();
