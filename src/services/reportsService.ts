import { getFirestore, collection, query, where, orderBy, limit, getDocs, getDoc, doc, Timestamp } from 'firebase/firestore';

// Initialize Firestore
const db = getFirestore();

// Report Service untuk mengambil data transaksi real dari Firestore
export interface Transaction {
  id: string;
  invoice: string;
  date: string;
  customer: string;
  phone: string;
  items: {
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
      if (filters.startDate || filters.endDate) {
        const startTimestamp = Timestamp.fromDate(new Date(filters.startDate + 'T00:00:00'));
        const endTimestamp = Timestamp.fromDate(new Date(filters.endDate + 'T23:59:59'));
        constraints.push(where('createdAt', '>=', startTimestamp));
        constraints.push(where('createdAt', '<=', endTimestamp));
      }

      // Apply status filter
      if (filters.status && filters.status !== 'all') {
        constraints.push(where('status', '==', filters.status));
      }

      // Apply customer filter (simple contains search)
      if (filters.customerQuery) {
        constraints.push(where('customer', '>=', filters.customerQuery));
        constraints.push(where('customer', '<=', filters.customerQuery + '\uf8ff'));
      }

      // Create query with all constraints - reading from orders collection
      let q = query(collection(db, 'orders'), ...constraints);

      // Order by date descending
      q = query(q, orderBy('createdAt', 'desc'));

      // Apply limit
      if (filters.limit) {
        q = query(q, limit(filters.limit));
      }

      const snapshot = await getDocs(q);

      // Get batch data once for all products
      const batchDoc = await getDoc(doc(db, 'productBatches', 'batch_1'));
      const batchData = batchDoc.exists() ? batchDoc.data() : { products: [] };
      const batchProducts = batchData.products || [];

      return snapshot.docs.map(doc => {
        const orderData = doc.data();

        // Map items with costPrice from productBatches
        const itemsWithCost = orderData.items?.map((item: any) => {
          const product = batchProducts.find((p: any) => p.id === item.productId);
          const costPrice = product?.costPrice || product?.modal || (item.price * 0.6); // fallback 60%

          return {
            name: item.name || item.productName || 'Unknown Product',
            quantity: item.quantity || 1,
            price: item.price || 0,
            total: (item.price || 0) * (item.quantity || 1),
            modal: costPrice,
            modalTotal: costPrice * (item.quantity || 1)
          };
        }) || [];

        // Calculate total modal
        const totalModal = itemsWithCost.reduce((sum: number, item: any) => sum + (item.modalTotal || 0), 0);

        // Map orders collection fields to Transaction interface
        return {
          id: doc.id,
          invoice: `INV-${doc.id}`, // Generate invoice from order ID
          date: orderData.createdAt ? new Date(orderData.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          customer: orderData.userName || 'Unknown Customer',
          phone: orderData.shippingInfo?.phone || '',
          items: itemsWithCost,
          subtotal: orderData.totalAmount || 0,
          shippingCost: orderData.shippingCost || 0,
          total: orderData.finalTotal || (orderData.totalAmount || 0) + (orderData.shippingCost || 0),
          totalModal,
          status: orderData.status === 'paid' ? 'lunas' : 'belum_lunas', // Map order status to transaction status
          paymentMethod: orderData.paymentMethod || '',
          createdAt: orderData.createdAt ? new Date(orderData.createdAt) : new Date(),
          updatedAt: orderData.updatedAt ? new Date(orderData.updatedAt) : new Date()
        };
      }) as Transaction[];
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

      // Process products from transactions
      const productMap = new Map<string, ProductReport>();

      transactions.forEach(transaction => {
        transaction.items.forEach(item => {
          const existing = productMap.get(item.name);
          if (existing) {
            // Update existing product
            existing.totalSold += item.quantity;
            existing.totalRevenue += item.total;
            existing.lastSoldDate = new Date(Math.max(
              new Date(existing.lastSoldDate || '').getTime(),
              new Date(transaction.createdAt).getTime()
            ));
          } else {
            // Create new product entry
            productMap.set(item.name, {
              id: item.name, // Use name as ID for simplicity
              name: item.name,
              category: 'other',
              totalSold: item.quantity,
              totalRevenue: item.total,
              stock: 0, // Will be calculated separately
              profit: item.total * 0.3, // Estimasi 30% profit
              lastSoldDate: new Date(transaction.createdAt)
            });
          }
        });
      });

      return Array.from(productMap.values());
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
      // Get products for inventory data
      const productsSnapshot = await getDocs(query(collection(db, 'products')));

      return productsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          category: data.category || 'other',
          stock: data.stock || 0,
          reserved: data.reserved || 0,
          available: (data.stock || 0) - (data.reserved || 0),
          value: (data.stock || 0) * (data.retailPrice || 0), // Use retail price for inventory value
          lastUpdated: data.updatedAt?.toDate() || new Date()
        };
      }) as InventoryReport[];
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