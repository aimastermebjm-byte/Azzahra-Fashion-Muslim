import { getFirestore, collection, query, where, orderBy, limit, getDocs, doc } from 'firebase/firestore';

// Initialize Firestore
const db = getFirestore();

const toMillis = (value: any): number | null => {
  if (!value && value !== 0) {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value?.toDate === 'function') {
    return value.toDate().getTime();
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

// Report Service untuk mengambil data transaksi real dari Firestore
export interface Transaction {
  id: string;
  invoice: string;
  date: string;
  customer: string;
  phone: string;
  items: {
    productId?: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
    modal?: number; // costPrice per unit
    modalTotal?: number; // total modal for this item
  }[];
  subtotal: number;
  shippingCost: number;
  total: number;
  totalModal?: number; // total modal for all items
  status: 'lunas' | 'belum_lunas';
  paymentMethod?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ProductReport {
  id: string;
  name: string;
  category: string;
  totalSold: number;
  totalRevenue: number;
  stock: number;
  profit: number;
  lastSoldDate?: Date;
}

export interface CustomerReport {
  id: string;
  name: string;
  phone: string;
  email?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: Date;
  createdAt: Date;
}

export interface InventoryReport {
  id: string;
  name: string;
  category: string;
  stock: number;
  reserved: number;
  available: number;
  value: number;
  lastUpdated: Date;
}

export interface CashFlowReport {
  id: string;
  date: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  createdAt: Date;
}

class ReportsService {

  // Get transactions dengan filter
  static async getTransactions(filters: {
    startDate?: string;
    endDate?: string;
    status?: 'all' | 'lunas' | 'belum_lunas';
    customerQuery?: string;
    limit?: number;
  } = {}): Promise<Transaction[]> {
    try {
      const constraints = [];

      // Apply date filter
      if (filters.startDate) {
        const startMillis = new Date(`${filters.startDate}T00:00:00`).getTime();
        if (!Number.isNaN(startMillis)) {
          constraints.push(where('timestamp', '>=', startMillis));
        }
      }

      if (filters.endDate) {
        const endMillis = new Date(`${filters.endDate}T23:59:59`).getTime();
        if (!Number.isNaN(endMillis)) {
          constraints.push(where('timestamp', '<=', endMillis));
        }
      }

      // Apply status filter
      if (filters.status && filters.status !== 'all') {
        constraints.push(where('status', '==', filters.status));
      }

      // Create query with all constraints - reading from orders collection
      let q = query(collection(db, 'orders'), ...constraints);

      // Order by newest first using numeric timestamp for consistent sorting
      q = query(q, orderBy('timestamp', 'desc'));

      // Apply limit
      if (filters.limit) {
        q = query(q, limit(filters.limit));
      }

      const snapshot = await getDocs(q);

      // Build quick lookup map for product cost data from batch system
      const productBatchesSnapshot = await getDocs(query(collection(db, 'productBatches')));
      const productMap = new Map<string, any>();
      const productNameMap = new Map<string, any>();

      productBatchesSnapshot.docs.forEach(batchDoc => {
        const batchData = batchDoc.data();
        const batchProducts = Array.isArray(batchData.products) ? batchData.products : [];

        batchProducts.forEach((product: any) => {
          if (product?.id) {
            productMap.set(product.id, product);
          }

          if (product?.name) {
            productNameMap.set(String(product.name).toLowerCase(), product);
          }
        });
      });

      const transactions = snapshot.docs.map(doc => {
        const orderData = doc.data();

        const timestampMillis = toMillis(orderData.timestamp) ?? toMillis(orderData.createdAt) ?? Date.now();
        const createdAtDate = new Date(timestampMillis);
        const updatedAtDate = new Date(toMillis(orderData.updatedAt) ?? timestampMillis);

        // Map items with costPrice from products collection
        const itemsWithCost = orderData.items?.map((item: any) => {
          const normalizedName = String(item.name || item.productName || '').toLowerCase();
          const product = productMap.get(item.productId) || (normalizedName ? productNameMap.get(normalizedName) : undefined);
          const resolvedProductId = (typeof item.productId === 'string' && item.productId.trim().length > 0)
            ? item.productId.trim()
            : (typeof product?.id === 'string' ? product.id : undefined);

          // Get modal/costPrice from batch data with sensible fallbacks
          const costPrice = Number(
            item.modal ??
            item.costPrice ??
            product?.costPrice ??
            product?.purchasePrice ??
            product?.modal ??
            product?.wholesalePrice ??
            product?.resellerPrice ??
            0
          ) || Number(item.price || 0) * 0.6; // fallback 60%

          const unitPrice = Number(item.price ?? product?.retailPrice ?? product?.price ?? 0);
          const quantity = Number(item.quantity || 1);

          return {
            productId: resolvedProductId,
            name: item.name || item.productName || product?.name || 'Unknown Product',
            quantity,
            price: unitPrice,
            total: unitPrice * quantity,
            modal: costPrice,
            modalTotal: costPrice * quantity
          };
        }) || [];

        // Calculate total modal
        const totalModal = itemsWithCost.reduce((sum: number, item: any) => sum + (item.modalTotal || 0), 0);

        // Map orders collection fields to Transaction interface
        return {
          id: doc.id,
          invoice: `INV-${doc.id}`, // Generate invoice from order ID
          date: new Date(timestampMillis).toISOString().split('T')[0],
          customer: orderData.userName || 'Unknown Customer',
          phone: orderData.shippingInfo?.phone || '',
          items: itemsWithCost,
          subtotal: orderData.totalAmount || 0,
          shippingCost: orderData.shippingCost || 0,
          total: orderData.finalTotal || (orderData.totalAmount || 0) + (orderData.shippingCost || 0),
          totalModal,
          status: orderData.status === 'paid' ? 'lunas' : 'belum_lunas', // Map order status to transaction status
          paymentMethod: orderData.paymentMethod || '',
          createdAt: createdAtDate,
          updatedAt: updatedAtDate
        };
      }) as Transaction[];

      if (filters.customerQuery) {
        const queryLower = filters.customerQuery.toLowerCase();
        return transactions.filter(transaction => {
          const customer = transaction.customer?.toLowerCase?.() || '';
          const phone = transaction.phone || '';
          return customer.includes(queryLower) || phone.includes(filters.customerQuery || '');
        });
      }

      return transactions;
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw error;
    }
  }

  // Get products report
  static async getProductsReport(filters: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): Promise<ProductReport[]> {
    try {
      // Get all transactions within date range
      const transactions = await this.getTransactions({
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: filters.limit || 1000 // Default limit untuk data volume
      });

      // Process products from transactions (prefer productId when available)
      const aggregatedProducts = new Map<string, ProductReport>();

      transactions.forEach(transaction => {
        transaction.items.forEach(item => {
          const key = item.productId || item.name;
          if (!key) {
            return;
          }

          const profitContribution = (item.total || 0) - (item.modalTotal ?? ((item.modal || 0) * (item.quantity || 0)));
          const existing = aggregatedProducts.get(key);

          if (existing) {
            existing.totalSold += item.quantity;
            existing.totalRevenue += item.total;
            existing.profit += profitContribution;
            const previousDate = existing.lastSoldDate ? existing.lastSoldDate.getTime() : 0;
            const currentDate = transaction.createdAt ? transaction.createdAt.getTime() : Date.now();
            if (currentDate > previousDate) {
              existing.lastSoldDate = new Date(currentDate);
            }
          } else {
            aggregatedProducts.set(key, {
              id: key,
              name: item.name || key,
              category: 'other',
              totalSold: item.quantity,
              totalRevenue: item.total,
              stock: 0,
              profit: profitContribution,
              lastSoldDate: transaction.createdAt ? new Date(transaction.createdAt) : undefined
            });
          }
        });
      });

      // Enrich with latest inventory snapshot for stock/category
      const inventoryReports = await this.getInventoryReports();
      const inventoryById = new Map<string, InventoryReport>();
      const inventoryByName = new Map<string, InventoryReport>();

      inventoryReports.forEach(record => {
        if (record.id) {
          inventoryById.set(record.id, record);
        }
        if (record.name) {
          inventoryByName.set(record.name.toLowerCase(), record);
        }
      });

      return Array.from(aggregatedProducts.values()).map(product => {
        const normalizedName = product.name ? product.name.toLowerCase() : '';
        const inventory = inventoryById.get(product.id) || (normalizedName ? inventoryByName.get(normalizedName) : undefined);

        return {
          ...product,
          category: inventory?.category || product.category,
          stock: inventory?.stock ?? product.stock,
          profit: product.profit,
          lastSoldDate: product.lastSoldDate
        };
      });
    } catch (error) {
      console.error('Error getting products report:', error);
      throw error;
    }
  }

  // Get customer reports
  static async getCustomerReports(filters: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): Promise<CustomerReport[]> {
    try {
      // Get transactions with customer data
      const transactions = await this.getTransactions({
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: filters.limit || 500
      });

      // Process customer data from transactions
      const customerMap = new Map<string, CustomerReport>();

      transactions.forEach(transaction => {
        const existing = customerMap.get(transaction.customer);
        if (existing) {
          // Update existing customer
          existing.totalOrders += 1;
          existing.totalSpent += transaction.total;
          existing.lastOrderDate = new Date(Math.max(
            new Date(existing.lastOrderDate || '').getTime(),
            new Date(transaction.createdAt).getTime()
          ));
        } else {
          // Create new customer entry
          customerMap.set(transaction.customer, {
            id: transaction.customer, // Use customer name as ID
            name: transaction.customer,
            phone: transaction.phone || '',
            totalOrders: 1,
            totalSpent: transaction.total,
            lastOrderDate: new Date(transaction.createdAt),
            createdAt: new Date()
          });
        }
      });

      return Array.from(customerMap.values());
    } catch (error) {
      console.error('Error getting customer reports:', error);
      throw error;
    }
  }

  // Get inventory reports
  static async getInventoryReports(): Promise<InventoryReport[]> {
    try {
      // Get productBatches for inventory data
      const productBatchesSnapshot = await getDocs(query(collection(db, 'productBatches')));

      const calculateVariantStock = (variantStock: any): number => {
        if (!variantStock || typeof variantStock !== 'object') {
          return 0;
        }

        return Object.values(variantStock).reduce((sizeTotal: number, sizeEntry: any) => {
          if (typeof sizeEntry === 'object') {
            return sizeTotal + Object.values(sizeEntry).reduce((colorTotal: number, colorEntry: any) => {
              const value = Number(colorEntry || 0);
              return colorTotal + (Number.isFinite(value) ? value : 0);
            }, 0);
          }
          const value = Number(sizeEntry || 0);
          return sizeTotal + (Number.isFinite(value) ? value : 0);
        }, 0);
      };

      const inventory: InventoryReport[] = [];

      productBatchesSnapshot.docs.forEach(batchDoc => {
        const batchData = batchDoc.data();
        const batchProducts = Array.isArray(batchData.products) ? batchData.products : [];

        batchProducts.forEach((product: any, index: number) => {
          const variantStockTotal = calculateVariantStock(product?.variants?.stock);
          const baseStock = Number(product?.stock || 0);
          const computedStock = variantStockTotal > 0 ? variantStockTotal : baseStock;
          const reserved = Number(product?.reserved || 0);
          const available = Math.max(0, computedStock - reserved);
          const unitPrice = Number(product?.retailPrice ?? product?.price ?? 0);

          const productLastUpdated = toMillis(product?.lastModified)
            ?? toMillis(product?.updatedAt)
            ?? toMillis(batchData?.updatedAt)
            ?? Date.now();

          inventory.push({
            id: product?.id || `${batchDoc.id}_${index}`,
            name: product?.name || `Produk ${index + 1}`,
            category: product?.category || batchData?.category || 'other',
            stock: computedStock,
            reserved: Number.isFinite(reserved) ? reserved : 0,
            available,
            value: computedStock * (Number.isFinite(unitPrice) ? unitPrice : 0),
            lastUpdated: new Date(productLastUpdated)
          });
        });
      });

      return inventory;
    } catch (error) {
      console.error('Error getting inventory reports:', error);
      throw error;
    }
  }

  // Get cash flow reports
  static async getCashFlowReports(filters: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): Promise<CashFlowReport[]> {
    try {
      // Get transactions for cash flow
      const transactions = await this.getTransactions({
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: filters.limit || 500
      });

      // Process cash flow data
      const cashFlowData: CashFlowReport[] = [];

      transactions.forEach(transaction => {
        // Income from sales
        cashFlowData.push({
          id: `${transaction.id}_income`,
          date: transaction.date,
          description: `Penjualan ${transaction.invoice}`,
          type: 'income',
          amount: transaction.subtotal,
          category: 'penjualan',
          createdAt: new Date(transaction.createdAt)
        });

        // Expense from shipping cost
        if (transaction.shippingCost > 0) {
          cashFlowData.push({
            id: `${transaction.id}_expense`,
            date: transaction.date,
            description: `Biaya ongkir ${transaction.invoice}`,
            type: 'expense',
            amount: transaction.shippingCost,
            category: 'ongkir',
            createdAt: new Date(transaction.createdAt)
          });
        }
      });

      // Append financial entries (owner-entered income/expense flagged for P&L)
      try {
        const finSnap = await getDocs(
          query(
            collection(db, 'financial_entries'),
            where('includeInPnL', '==', true),
            orderBy('createdAt', 'desc'),
            limit(filters.limit || 500)
          )
        );

        finSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const created = data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate()
            : new Date();

          cashFlowData.push({
            id: `fin_${docSnap.id}`,
            date: data.effectiveDate || created.toISOString(),
            description: data.note || (data.type === 'income' ? 'Pendapatan lain' : 'Biaya lain'),
            type: data.type,
            amount: Number(data.amount || 0),
            category: data.category || 'lainnya',
            createdAt: created
          });
        });
      } catch (error) {
        console.error('Error getting financial entries for cashflow:', error);
      }

      // Sort by date descending
      cashFlowData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return cashFlowData;
    } catch (error) {
      console.error('Error getting cash flow reports:', error);
      throw error;
    }
  }

  // Get profit/loss analysis
  static async getProfitLossAnalysis(filters: {
    startDate?: string;
    endDate?: string;
  } = {}): Promise<{
    totalIncome: number;
    totalExpense: number;
    totalProfit: number;
    profitMargin: number;
  }> {
    try {
      const cashFlowData = await this.getCashFlowReports(filters);

      const totalIncome = cashFlowData
        .filter(item => item.type === 'income')
        .reduce((sum, item) => sum + item.amount, 0);

      const totalExpense = cashFlowData
        .filter(item => item.type === 'expense')
        .reduce((sum, item) => sum + item.amount, 0);

      const totalProfit = totalIncome - totalExpense;
      const profitMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;

      return {
        totalIncome,
        totalExpense,
        totalProfit,
        profitMargin
      };
    } catch (error) {
      console.error('Error getting profit/loss analysis:', error);
      throw error;
    }
  }

  // Get summary statistics
  static async getSummaryStats(filters: {
    startDate?: string;
    endDate?: string;
  } = {}): Promise<{
    totalTransactions: number;
    totalRevenue: number;
    totalExpenses: number;
    totalShipping: number;
    paidTransactions: number;
    unpaidTransactions: number;
    unpaidAmount: number;
    averageTransaction: number;
  }> {
    try {
      const transactions = await this.getTransactions(filters);

      const totalTransactions = transactions.length;
      const totalRevenue = transactions.reduce((sum, t) => sum + t.subtotal, 0);
      const totalExpenses = transactions.reduce((sum, t) => sum + t.shippingCost, 0);
      const totalShipping = totalExpenses; // Since we categorize shipping as expense

      const paidTransactions = transactions.filter(t => t.status === 'lunas').length;
      const unpaidTransactions = transactions.filter(t => t.status === 'belum_lunas').length;
      const unpaidAmount = transactions
        .filter(t => t.status === 'belum_lunas')
        .reduce((sum, t) => sum + t.total, 0);

      const averageTransaction = totalRevenue > 0 ? totalRevenue / totalTransactions : 0;

      return {
        totalTransactions,
        totalRevenue,
        totalExpenses,
        totalShipping,
        paidTransactions,
        unpaidTransactions,
        unpaidAmount,
        averageTransaction
      };
    } catch (error) {
      console.error('Error getting summary stats:', error);
      throw error;
    }
  }
}

export default ReportsService;