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
    brand?: string | null; // brand from productBatches
    category?: string | null; // category from productBatches
  }[];
  subtotal: number;
  shippingCost: number;
  total: number;
  totalModal?: number; // total modal for all items
  status: 'lunas' | 'belum_lunas' | 'dibatalkan'; // ✅ Added 'dibatalkan' for cancelled orders
  paymentMethod?: string;
  paymentMethodId?: string | null;
  paymentMethodName?: string | null;
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
  buyerCount?: number; // Total number of unique buyers
}

export interface ProductBuyerReport {
  id: string;
  productName: string;
  customerName: string;
  customerPhone: string;
  quantity: number;
  totalAmount: number;
  invoice: string;
  purchaseDate: string;
}

export interface ProductBuyerSummary {
  productId: string;
  productName: string;
  buyers: Array<{
    customerName: string;
    customerPhone: string;
    totalQuantity: number;
    totalAmount: number;
    purchaseCount: number;
    lastPurchaseDate: string;
  }>;
  totalBuyers: number;
  totalQuantity: number;
  totalAmount: number;
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
  productId: string; // Original product ID for linking
  name: string;
  category: string;
  size: string;
  color: string;
  stock: number;
  reserved: number;
  available: number;
  value: number;
  lastUpdated: Date;
  variants?: {
    sizes: string[];
    colors: string[];
    stock: any;
  };
}

export interface CashFlowReport {
  id: string;
  date: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  paymentMethodId?: string;
  paymentMethodName?: string;
  source?: 'sale' | 'financial';
  includeInPnL?: boolean;
  createdAt: Date;
}

class ReportsService {

  // Get transactions dengan filter
  static async getTransactions(filters: {
    startDate?: string;
    endDate?: string;
    status?: 'all' | 'lunas' | 'belum_lunas' | 'dibatalkan';
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
      } else {
        // ✅ FIX: Exclude cancelled orders from reports by default
        // Cancelled/deleted orders should not appear in any reports
        constraints.push(where('status', '!=', 'cancelled'));
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
            modalTotal: costPrice * quantity,
            brand: product?.brand || product?.merk || null,
            category: product?.category || null
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
          // ✅ FIX: Map ALL order statuses to transaction status
          status: (() => {
            switch (orderData.status) {
              case 'paid':
              case 'processing':
              case 'shipped':
              case 'delivered':
                return 'lunas';
              case 'cancelled':
                return 'dibatalkan';
              default:
                // pending, awaiting_verification, etc.
                return 'belum_lunas';
            }
          })(),
          paymentMethod: orderData.paymentMethodName || orderData.paymentMethod || '',
          paymentMethodId: orderData.paymentMethodId || null,
          paymentMethodName: orderData.paymentMethodName || orderData.paymentMethod || null,
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
      const productBuyers = new Map<string, Set<string>>(); // Track unique buyers per product

      transactions.forEach(transaction => {
        transaction.items.forEach(item => {
          // Use consistent key for both maps - prioritize productId when available
          const key = item.productId || item.name;

          if (!key) {
            return;
          }

          // Track unique buyers
          if (!productBuyers.has(key)) {
            productBuyers.set(key, new Set());
          }

          // Use a more reliable way to identify unique buyers
          // Check if buyer already exists in the set to avoid duplicates
          const buyerKey = `${transaction.customer}_${transaction.phone}`;
          const buyerSet = productBuyers.get(key)!;

          // Only add if not already present (handles edge cases)
          if (!Array.from(buyerSet).some(existingBuyer => existingBuyer === buyerKey)) {
            buyerSet.add(buyerKey);
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
              id: key, // Use same key for lookup
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

        // For the buyer count, we need to look up using the product id itself
        // Since we changed the key strategy, we need to match the new format
        const lookupKey = product.id.startsWith('id_') ? product.id : `name_${product.name}`;
        const buyerCount = productBuyers.get(lookupKey)?.size || 0;



        return {
          ...product,
          category: inventory?.category || product.category,
          stock: inventory?.stock ?? product.stock,
          profit: product.profit,
          lastSoldDate: product.lastSoldDate,
          buyerCount: buyerCount
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

  // Get inventory reports - Flattened per Size/Color
  static async getInventoryReports(): Promise<InventoryReport[]> {
    try {
      // Get productBatches for inventory data
      const productBatchesSnapshot = await getDocs(query(collection(db, 'productBatches')));

      const inventory: InventoryReport[] = [];

      productBatchesSnapshot.docs.forEach(batchDoc => {
        const batchData = batchDoc.data();
        const batchProducts = Array.isArray(batchData.products) ? batchData.products : [];

        batchProducts.forEach((product: any, index: number) => {
          const productId = product?.id || `${batchDoc.id}_${index}`;
          const productName = product?.name || `Produk ${index + 1}`;
          const category = product?.category || batchData?.category || 'other';
          const unitPrice = Number(product?.costPrice ?? product?.purchasePrice ?? 0);
          const productLastUpdated = toMillis(product?.lastModified)
            ?? toMillis(product?.updatedAt)
            ?? toMillis(batchData?.updatedAt)
            ?? Date.now();

          const variants = product?.variants;
          const sizes = variants?.sizes || [];
          const colors = variants?.colors || [];
          const stockMap = variants?.stock || {};

          // If product has variants, flatten each size/color combination
          if (sizes.length > 0 && colors.length > 0) {
            sizes.forEach((size: string) => {
              colors.forEach((color: string) => {
                const variantStock = Number(stockMap?.[size]?.[color] || 0);
                const reserved = 0; // Reserved not tracked per variant currently
                const available = Math.max(0, variantStock - reserved);

                inventory.push({
                  id: `${productId}_${size}_${color}`,
                  productId: productId,
                  name: productName,
                  category,
                  size,
                  color,
                  stock: variantStock,
                  reserved,
                  available,
                  value: variantStock * unitPrice,
                  lastUpdated: new Date(productLastUpdated),
                  variants // Keep original for modal link
                });
              });
            });
          } else {
            // Fallback: Product without variants - single entry
            const baseStock = Number(product?.stock || 0);
            inventory.push({
              id: productId,
              productId: productId,
              name: productName,
              category,
              size: '-',
              color: '-',
              stock: baseStock,
              reserved: 0,
              available: baseStock,
              value: baseStock * unitPrice,
              lastUpdated: new Date(productLastUpdated),
              variants
            });
          }
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
    paymentMethodId?: string;
  } = {}): Promise<CashFlowReport[]> {
    try {
      const startMillis = filters.startDate ? new Date(`${filters.startDate}T00:00:00`).getTime() : null;
      const endMillis = filters.endDate ? new Date(`${filters.endDate}T23:59:59`).getTime() : null;
      const selectedPaymentMethodId = filters.paymentMethodId?.trim() || null;

      const paymentMethodsSnap = await getDocs(query(collection(db, 'financial_payment_methods')));
      const paymentMethodById = new Map<string, string>();
      const paymentMethodByName = new Map<string, { id: string; name: string }>();
      paymentMethodsSnap.forEach((methodDoc) => {
        const data = methodDoc.data() as any;
        const name = data?.name || 'Tanpa nama';
        paymentMethodById.set(methodDoc.id, name);
        paymentMethodByName.set(name.toLowerCase(), { id: methodDoc.id, name });
      });

      const resolvePaymentMethod = (value?: string | null): { id: string; name: string } | null => {
        if (!value || typeof value !== 'string') {
          return null;
        }
        const trimmed = value.trim();
        if (!trimmed) {
          return null;
        }
        if (paymentMethodById.has(trimmed)) {
          return { id: trimmed, name: paymentMethodById.get(trimmed)! };
        }
        const normalized = trimmed.toLowerCase();
        if (paymentMethodByName.has(normalized)) {
          return paymentMethodByName.get(normalized)!;
        }
        return null;
      };

      const matchesPaymentFilter = (methodId?: string | null, methodName?: string | null) => {
        if (!selectedPaymentMethodId) {
          return true;
        }
        if (methodId && methodId === selectedPaymentMethodId) {
          return true;
        }
        const filterName = paymentMethodById.get(selectedPaymentMethodId)?.toLowerCase();
        if (filterName && methodName && methodName.toLowerCase() === filterName) {
          return true;
        }
        return false;
      };

      // Get transactions for cash flow
      const transactions = await this.getTransactions({
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: filters.limit || 500
      });

      // Process cash flow data
      const cashFlowData: CashFlowReport[] = [];

      transactions.forEach(transaction => {
        const resolvedPayment = resolvePaymentMethod(transaction.paymentMethodId || transaction.paymentMethodName || transaction.paymentMethod);
        const paymentMethodId = resolvedPayment?.id;
        const paymentMethodName = resolvedPayment?.name || transaction.paymentMethodName || transaction.paymentMethod || null;

        if (!matchesPaymentFilter(paymentMethodId, paymentMethodName)) {
          return;
        }

        // Income from sales (total including shipping cost paid by customer)
        cashFlowData.push({
          id: `${transaction.id}_income`,
          date: transaction.date,
          description: `Penjualan ${transaction.invoice}`,
          type: 'income',
          amount: transaction.total,
          category: 'penjualan',
          paymentMethodId,
          paymentMethodName: paymentMethodName || undefined,
          source: 'sale',
          includeInPnL: true,
          createdAt: new Date(transaction.createdAt)
        });

      });

      // Append financial entries (owner-entered income/expense flagged for P&L)
      try {
        // Load categories once to resolve readable names (so P&L shows the selected category, e.g., "Gaji Karyawan")
        const categoriesSnap = await getDocs(query(collection(db, 'financial_categories')));
        const categoryNameById = new Map<string, string>();
        categoriesSnap.forEach((catDoc) => {
          const catData = catDoc.data() as any;
          categoryNameById.set(catDoc.id, catData?.name || 'Tanpa kategori');
        });

        const finSnap = await getDocs(
          query(
            collection(db, 'financial_entries'),
            orderBy('createdAt', 'desc'),
            limit(filters.limit || 500)
          )
        );

        finSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;

          const effectiveMillis = toMillis(data?.effectiveDate)
            ?? toMillis(data?.createdAt)
            ?? Date.now();

          if (startMillis && effectiveMillis < startMillis) {
            return;
          }

          if (endMillis && effectiveMillis > endMillis) {
            return;
          }

          const effectiveDate = new Date(effectiveMillis);
          const entryType = data?.type === 'income' ? 'income' : 'expense';
          const resolvedCategory = categoryNameById.get(data?.category) || data?.category || 'lainnya';
          const description = data.note || resolvedCategory || (entryType === 'income' ? 'Pendapatan lain' : 'Biaya lain');

          const resolvedMethod = resolvePaymentMethod(data?.paymentMethodId || data?.paymentMethodName);
          const entryPaymentMethodId = resolvedMethod?.id || (typeof data?.paymentMethodId === 'string' ? data.paymentMethodId : undefined);
          const entryPaymentMethodName = resolvedMethod?.name || (typeof data?.paymentMethodName === 'string' ? data.paymentMethodName : null);

          if (!matchesPaymentFilter(entryPaymentMethodId, entryPaymentMethodName)) {
            return;
          }

          cashFlowData.push({
            id: `fin_${docSnap.id}`,
            date: effectiveDate.toISOString().split('T')[0],
            description,
            type: entryType,
            amount: Number(data.amount || 0),
            category: resolvedCategory,
            paymentMethodId: entryPaymentMethodId,
            paymentMethodName: entryPaymentMethodName || undefined,
            source: 'financial',
            includeInPnL: !!data?.includeInPnL,
            createdAt: effectiveDate
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

  // Get product buyers with pagination
  static async getProductBuyers(productId: string, filters: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    searchQuery?: string; // New parameter for searching by name or phone
  } = {}): Promise<{
    buyers: ProductBuyerReport[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
  }> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;

      const transactions = await this.getTransactions({
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: 1000 // Get all transactions for accurate pagination
      });

      // Filter transactions that contain the specific product
      const productTransactions: Array<{
        transaction: Transaction;
        item: any;
      }> = [];

      transactions.forEach(transaction => {
        transaction.items.forEach(item => {
          const itemKey = item.productId || item.name;
          // Match using the same logic as in getProductsReport
          if (itemKey === productId) {
            productTransactions.push({ transaction, item });
          }
        });
      });

      // Sort by date (newest first)
      productTransactions.sort((a, b) =>
        new Date(b.transaction.createdAt).getTime() - new Date(a.transaction.createdAt).getTime()
      );

      // Map to buyer reports
      const allBuyers = productTransactions.map(({ transaction, item }) => ({
        id: `${transaction.id}_${item.productId || item.name}`,
        productName: item.name,
        customerName: transaction.customer,
        customerPhone: transaction.phone,
        quantity: item.quantity,
        totalAmount: item.total,
        invoice: transaction.invoice,
        purchaseDate: transaction.date
      }));

      // Apply search filter if provided
      let filteredBuyers = allBuyers;
      if (filters.searchQuery && filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase().trim();
        filteredBuyers = allBuyers.filter(buyer =>
          buyer.customerName.toLowerCase().includes(query) ||
          buyer.customerPhone.includes(query)
        );
      }

      // Apply pagination
      const totalCount = filteredBuyers.length;
      const totalPages = Math.ceil(totalCount / limit);
      const buyers = filteredBuyers.slice(offset, offset + limit);

      return {
        buyers,
        totalCount,
        currentPage: page,
        totalPages
      };
    } catch (error) {
      console.error('Error getting product buyers:', error);
      throw error;
    }
  }

  // Get profit/loss analysis
  static async getProfitLossAnalysis(filters: {
    startDate?: string;
    endDate?: string;
    paymentMethodId?: string;
  } = {}): Promise<{
    totalIncome: number;
    totalExpense: number;
    totalProfit: number;
    profitMargin: number;
  }> {
    try {
      const cashFlowData = await this.getCashFlowReports(filters);

      const totalIncome = cashFlowData
        .filter(item => item.type === 'income' && item.includeInPnL !== false)
        .reduce((sum, item) => sum + item.amount, 0);

      const totalExpense = cashFlowData
        .filter(item => item.type === 'expense' && item.includeInPnL !== false)
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
    totalProfit: number;
    profitMargin: number;
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
      const totalProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      return {
        totalTransactions,
        totalRevenue,
        totalExpenses,
        totalShipping,
        paidTransactions,
        unpaidTransactions,
        unpaidAmount,
        averageTransaction,
        totalProfit,
        profitMargin
      };
    } catch (error) {
      console.error('Error getting summary stats:', error);
      throw error;
    }
  }

  // Get product buyers summary for rekap pembeli
  static async getProductBuyersSummary(productId: string, filters: {
    startDate?: string;
    endDate?: string;
    status?: 'all' | 'lunas' | 'belum_lunas';
  } = {}): Promise<ProductBuyerSummary> {
    try {
      const transactions = await this.getTransactions({
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: 1000
      });

      // Filter transactions by status if specified
      let filteredTransactions = transactions;
      if (filters.status && filters.status !== 'all') {
        const statusFilter = filters.status === 'lunas' ? 'lunas' : 'belum_lunas';
        filteredTransactions = transactions.filter(transaction => transaction.status === statusFilter);
      }

      // Aggregate buyers for this product
      const buyerMap = new Map<string, {
        customerName: string;
        customerPhone: string;
        totalQuantity: number;
        totalAmount: number;
        purchaseCount: number;
        lastPurchaseDate: string;
      }>();

      filteredTransactions.forEach(transaction => {
        transaction.items.forEach(item => {
          const itemProductId = item.productId || item.name;
          if (itemProductId === productId) {
            const buyerKey = `${transaction.customer}_${transaction.phone}`;

            if (!buyerMap.has(buyerKey)) {
              buyerMap.set(buyerKey, {
                customerName: transaction.customer,
                customerPhone: transaction.phone,
                totalQuantity: 0,
                totalAmount: 0,
                purchaseCount: 0,
                lastPurchaseDate: transaction.date
              });
            }

            const buyer = buyerMap.get(buyerKey)!;
            buyer.totalQuantity += item.quantity;
            buyer.totalAmount += item.total;
            buyer.purchaseCount += 1;

            // Update last purchase date if this transaction is more recent
            if (new Date(transaction.date) > new Date(buyer.lastPurchaseDate)) {
              buyer.lastPurchaseDate = transaction.date;
            }
          }
        });
      });

      const buyers = Array.from(buyerMap.values())
        .sort((a, b) => b.totalQuantity - a.totalQuantity); // Sort by quantity descending

      const totalBuyers = buyers.length;
      const totalQuantity = buyers.reduce((sum, buyer) => sum + buyer.totalQuantity, 0);
      const totalAmount = buyers.reduce((sum, buyer) => sum + buyer.totalAmount, 0);

      return {
        productId,
        productName: filteredTransactions.length > 0 ?
          (filteredTransactions[0].items.find(item => (item.productId || item.name) === productId)?.name || `Produk ${productId}`) :
          `Produk ${productId}`,
        buyers,
        totalBuyers,
        totalQuantity,
        totalAmount
      };
    } catch (error) {
      console.error('Error getting product buyers summary:', error);
      throw error;
    }
  }
}

export default ReportsService;