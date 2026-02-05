import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from './PageHeader';
import {
  Download, Package, Users,
  ArrowUpRight, ArrowDownRight,
  Search, ChevronDown, XCircle, Wallet
} from 'lucide-react';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import ReportsService from '../services/reportsService';
import { financialService, PaymentMethod } from '../services/financialService';
import { productCategoryService, ProductCategory } from '../services/productCategoryService';
import {
  Transaction,
  ProductReport,
  InventoryReport,
  CashFlowReport,
  ProductBuyerReport,
  ProductBuyerSummary,
  CustomerReceivable,
  InvoiceReceivable
} from '../services/reportsService';
import StockHistoryModal from './StockHistoryModal';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface AdminReportsPageProps {
  onBack: () => void;
  user: any;
  onNavigateToStockAdjustments?: () => void;
}

interface CombinedBuyerSummary {
  productId: string;
  productName: string;
  buyers: ProductBuyerSummary[];
  totalBuyers: number;
  totalQuantity: number;
  totalAmount: number;
}

// Cache keys
const USERS_CACHE_KEY = 'reports-users-cache';
const USERS_CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Cache helpers
const readUsersCache = (): { data: any[], timestamp: number } | null => {
  try {
    const raw = localStorage.getItem(USERS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.data || !Array.isArray(parsed.data)) return null;

    // Check if cache expired (7 days)
    const now = Date.now();
    if (parsed.timestamp && (now - parsed.timestamp) > USERS_CACHE_EXPIRY) {
      localStorage.removeItem(USERS_CACHE_KEY);
      return null;
    }

    return parsed;
  } catch (err) {
    console.error('⚠️ Failed to read users cache', err);
    return null;
  }
};

const writeUsersCache = (users: any[]) => {
  try {
    localStorage.setItem(USERS_CACHE_KEY, JSON.stringify({
      data: users,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.error('⚠️ Failed to write users cache', err);
  }
};

const AdminReportsPage: React.FC<AdminReportsPageProps> = ({ onBack, user, onNavigateToStockAdjustments }) => {
  const isOwner = user?.role === 'owner';

  // Report type untuk tab navigation - Admin default ke 'sales', Owner default ke 'summary'
  const [reportType, setReportType] = useState<'summary' | 'sales' | 'products' | 'invoice' | 'inventory' | 'cashflow' | 'profitloss' | 'detail' | 'receivables'>(
    isOwner ? 'summary' : 'sales'
  );

  // Date filtering
  const [dateFilter, setDateFilter] = useState<'hari_ini' | 'kemaren' | 'bulan_ini' | 'bulan_kemaren' | 'custom'>('bulan_ini');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Additional filters for sales report
  const [statusFilter, setStatusFilter] = useState<'all' | 'lunas' | 'belum_lunas' | 'dibatalkan'>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all');

  // Data states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<ProductReport[]>([]);
  const [inventory, setInventory] = useState<InventoryReport[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowReport[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Separate loading states for lazy loading
  const [loadingProducts, setLoadingProducts] = useState(false);


  // Fast initial state - only show loading for critical data
  const [initialLoadingComplete, setInitialLoadingComplete] = useState(false);

  // Modal states for product buyers
  const [selectedProduct, setSelectedProduct] = useState<ProductReport | null>(null);
  const [productBuyers, setProductBuyers] = useState<ProductBuyerReport[]>([]);
  const [loadingBuyers, setLoadingBuyers] = useState(false);
  const [buyersPage, setBuyersPage] = useState(1);
  const [buyersTotalPages, setBuyersTotalPages] = useState(1);
  const [buyersTotalCount, setBuyersTotalCount] = useState(0);
  const [showBuyersModal, setShowBuyersModal] = useState(false);
  const [buyerSearchQuery, setBuyerSearchQuery] = useState('');
  const [searchTimeoutId, setSearchTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [isFilterActive, setIsFilterActive] = useState(false);

  // State for product selection and combined rekap
  const [selectedProducts, setSelectedProducts] = useState<ProductReport[]>([]);
  const [showCombinedRekapModal, setShowCombinedRekapModal] = useState(false);
  const [combinedRekapData, setCombinedRekapData] = useState<CombinedBuyerSummary[]>([]);
  const [loadingCombinedRekap, setLoadingCombinedRekap] = useState(false);

  // Stock History Modal State
  const [showStockHistoryModal, setShowStockHistoryModal] = useState(false);
  const [selectedStockProduct, setSelectedStockProduct] = useState<any>(null);

  // ✅ NEW: Receivables Report State
  const [receivables, setReceivables] = useState<CustomerReceivable[]>([]);
  const [loadingReceivables, setLoadingReceivables] = useState(false);
  const [selectedCustomerReceivables, setSelectedCustomerReceivables] = useState<CustomerReceivable | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<InvoiceReceivable[]>([]);
  const [loadingCustomerInvoices, setLoadingCustomerInvoices] = useState(false);
  const [showReceivablesModal, setShowReceivablesModal] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any>(null);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);

  // 🧾 Invoice Detail Modal State
  const [showInvoiceDetailModal, setShowInvoiceDetailModal] = useState(false);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<Transaction | null>(null);

  // 📊 Hierarchical Invoice View State
  const [expandedInvoiceCustomer, setExpandedInvoiceCustomer] = useState<string | null>(null);

  // Calculate date range based on filter
  const getDateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    switch (dateFilter) {
      case 'hari_ini':
        return {
          start: today.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0]
        };
      case 'kemaren':
        return {
          start: yesterday.toISOString().split('T')[0],
          end: yesterday.toISOString().split('T')[0]
        };
      case 'bulan_ini':
        return {
          start: firstDayOfMonth.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0]
        };
      case 'bulan_kemaren':
        return {
          start: firstDayOfLastMonth.toISOString().split('T')[0],
          end: lastDayOfLastMonth.toISOString().split('T')[0]
        };
      case 'custom':
        return {
          start: startDate,
          end: endDate
        };
      default:
        return {
          start: firstDayOfMonth.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0]
        };
    }
  }, [dateFilter, startDate, endDate]);

  // Load real data from Firestore
  const loadTransactions = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange;
      const transactionData = await ReportsService.getTransactions({
        startDate: start,
        endDate: end,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        customerQuery: customerFilter || undefined,
        limit: 100 // Increase limit slightly
      });
      setTransactions(transactionData);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Load products report - CACHE DISABLED for debugging
  const loadProductsReport = async () => {
    const { start, end } = getDateRange;
    const cacheKey = `products-cache-${start}-${end}`;

    // ⚠️ CACHE DISABLED - Always fetch fresh data from Firestore
    // This ensures deleted orders are not shown in reports
    console.log('📊 [loadProductsReport] Loading fresh data from Firestore...');

    setLoadingProducts(true);
    try {
      const productData = await ReportsService.getProductsReport({
        startDate: start,
        endDate: end,
        limit: 1000 // Increased limit for better data
      });
      setProducts(productData);

      // Cache the result
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          data: productData,
          timestamp: Date.now()
        }));
      } catch (err) {
        console.error('Cache write error:', err);
      }
    } catch (error) {
      console.error('Error loading products report:', error);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Load inventory report
  const loadInventoryReport = async () => {

    try {
      const inventoryData = await ReportsService.getInventoryReports();
      setInventory(inventoryData);
    } catch (error) {
      console.error('Error loading inventory report:', error);
      setInventory([]);
    } finally {

    }
  };

  useEffect(() => {
    // Only load critical data initially - make page load fast
    const loadUsers = async () => {
      try {
        // Check cache first
        const cached = readUsersCache();
        if (cached) {
          console.log('✅ Users loaded from cache (expires in', Math.round((USERS_CACHE_EXPIRY - (Date.now() - cached.timestamp)) / (24 * 60 * 60 * 1000)), 'days)');
          setUsers(cached.data);
          return;
        }

        // Cache miss - fetch from Firestore
        console.log('🔥 Fetching users from Firestore...');
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Write to cache
        writeUsersCache(usersData);
        setUsers(usersData);
        console.log('✅ Users cached for 7 days');
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };

    // Only load users initially (critical for filters)
    loadUsers().finally(() => {
      // Set loading to false after initial data is loaded
      setLoading(false);
      setInitialLoadingComplete(true);
    });

    // Background load non-critical data after page is interactive
    const loadBackgroundData = async () => {
      // Small delay to ensure page is rendered first
      await new Promise(resolve => setTimeout(resolve, 100));

      // Load payment methods with cache
      try {
        const cacheKey = 'payment-methods-cache';
        const cached = localStorage.getItem(cacheKey);
        let needsFetch = true;

        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const now = Date.now();
          const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

          if (now - timestamp < CACHE_EXPIRY) {
            console.log('✅ Payment methods loaded from cache');
            setPaymentMethods(data);
            needsFetch = false;
          }
        }

        if (needsFetch) {
          const methods = await financialService.listPaymentMethods();
          setPaymentMethods(methods);

          // Cache for 30 minutes
          localStorage.setItem(cacheKey, JSON.stringify({
            data: methods,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Error loading payment methods:', error);
      }

      // Load product categories with cache
      try {
        const cacheKey = 'product-categories-cache';
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const now = Date.now();
          const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

          if (now - timestamp < CACHE_EXPIRY) {
            console.log('✅ Product categories loaded from cache');
            setProductCategories(data);
            return;
          }
        }

        const categories = await productCategoryService.listCategories();
        setProductCategories(categories);

        // Cache for 30 minutes
        localStorage.setItem(cacheKey, JSON.stringify({
          data: categories,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Error loading product categories:', error);
      }
    };

    // Start background loading
    loadBackgroundData();
  }, []);

  // Load cash flow report
  const loadCashFlowReport = async () => {

    try {
      const { start, end } = getDateRange;
      const cashFlowData = await ReportsService.getCashFlowReports({
        startDate: start,
        endDate: end,
        limit: 100, // Limit untuk performance
        paymentMethodId: paymentMethodFilter !== 'all' ? paymentMethodFilter : undefined
      });
      setCashFlow(cashFlowData);
    } catch (error) {
      console.error('Error loading cash flow report:', error);
      setCashFlow([]);
    } finally {

    }
  };

  // ✅ NEW: Load Receivables Report
  const loadReceivablesReport = async () => {
    setLoadingReceivables(true);
    try {
      const { start, end } = getDateRange;
      const data = await ReportsService.getReceivablesReport({
        startDate: start,
        endDate: end
      });
      setReceivables(data);
    } catch (error) {
      console.error('Error loading receivables report:', error);
      setReceivables([]);
    } finally {
      setLoadingReceivables(false);
    }
  };

  // ✅ NEW: Load Customer Invoices (Level 2)
  const loadCustomerInvoices = async (customer: CustomerReceivable) => {
    setSelectedCustomerReceivables(customer);
    setShowReceivablesModal(true);
    setLoadingCustomerInvoices(true);
    try {
      const { start, end } = getDateRange;
      const invoices = await ReportsService.getCustomerReceivables(customer.userId, {
        startDate: start,
        endDate: end
      });
      setCustomerInvoices(invoices);
    } catch (error) {
      console.error('Error loading customer invoices:', error);
      setCustomerInvoices([]);
    } finally {
      setLoadingCustomerInvoices(false);
    }
  };

  // ✅ NEW: Load Order Detail (Level 3)
  const loadOrderDetail = async (orderId: string) => {
    setLoadingOrderDetail(true);
    try {
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      if (orderDoc.exists()) {
        setSelectedOrderDetail({ id: orderDoc.id, ...orderDoc.data() });
      } else {
        alert('Order tidak ditemukan');
      }
    } catch (error) {
      console.error('Error loading order detail:', error);
      alert('Gagal memuat detail order');
    } finally {
      setLoadingOrderDetail(false);
    }
  };

  // Load summary statistics
  const loadSummaryStats = async () => {
    try {
      const { start, end } = getDateRange;
      const stats = await ReportsService.getSummaryStats({
        startDate: start,
        endDate: end
      });

      // Set summary data for display
      const summaryData = {
        totalTransactions: stats.totalTransactions,
        totalRevenue: stats.totalRevenue,
        totalExpenses: stats.totalExpenses,
        totalProfit: stats.totalProfit,
        profitMargin: stats.profitMargin
      };

      console.log('Summary stats loaded:', summaryData);
    } catch (error) {
      console.error('Error loading summary stats:', error);
    }
  }

  // Load data based on active report type - OPTIMIZED: Lazy loading for tabs
  useEffect(() => {
    const loadData = async () => {
      switch (reportType) {
        case 'sales':
        case 'invoice':
        case 'detail':
          await loadTransactions();
          break;
        case 'products':
          // Lazy load - only when tab is clicked
          await loadProductsReport();
          break;
        case 'inventory':
          // Lazy load - only when tab is clicked
          await loadInventoryReport();
          break;
        case 'cashflow':
          // Lazy load - only when tab is clicked
          await loadCashFlowReport();
          break;
        case 'profitloss':
          // Lazy load - only when tab is clicked
          await loadCashFlowReport();
          await loadSummaryStats();
          break;
        case 'receivables':
          // Lazy load - only when tab is clicked
          await loadReceivablesReport();
          break;
        case 'summary':
          // Fix: Load transactions immediately for summary stats
          await loadTransactions();
          break;
        default:
          await loadTransactions();
      }
    };

    loadData();
  }, [reportType]); // OPTIMIZED: Only reload when reportType changes, not filters

  // ✨ FIX: Reload cashflow when payment method filter changes
  useEffect(() => {
    if (reportType === 'cashflow' || reportType === 'profitloss') {
      loadCashFlowReport();
    }
  }, [paymentMethodFilter]);

  // Load product buyers with pagination
  const loadProductBuyers = async (product: ProductReport, page: number = 1, searchQuery?: string) => {
    setLoadingBuyers(true);
    try {
      const { start, end } = getDateRange;
      const result = await ReportsService.getProductBuyers(product.id, {
        startDate: start,
        endDate: end,
        page,
        limit: 20,
        searchQuery
      });

      setProductBuyers(result.buyers);
      setBuyersPage(result.currentPage);
      setBuyersTotalPages(result.totalPages);
      setBuyersTotalCount(result.totalCount);
    } catch (error) {
      console.error('Error loading product buyers:', error);
      setProductBuyers([]);
    } finally {
      setLoadingBuyers(false);
    }
  };

  // Open buyers modal


  // Close buyers modal
  const closeBuyersModal = () => {
    setShowBuyersModal(false);
    setSelectedProduct(null);
    setProductBuyers([]);
    setBuyersPage(1);
    setBuyersTotalPages(1);
    setBuyersTotalCount(0);
    setBuyerSearchQuery(''); // Reset search query when modal closes
    setIsFilterActive(false); // Reset filter active state
    // Clear any pending search timeout
    if (searchTimeoutId) {
      clearTimeout(searchTimeoutId);
      setSearchTimeoutId(null);
    }
  };



  // Handle search query change with debouncing
  const handleBuyerSearchChange = (query: string) => {
    setBuyerSearchQuery(query);
    setIsFilterActive(query.trim() !== ''); // Update filter active state

    // Clear previous timeout
    if (searchTimeoutId) {
      clearTimeout(searchTimeoutId);
    }

    // Set new timeout for debounced search
    const timeoutId = setTimeout(() => {
      if (selectedProduct) {
        setBuyersPage(1); // Reset to first page when searching
        loadProductBuyers(selectedProduct, 1, query);
      }
    }, 300); // 300ms debounce

    setSearchTimeoutId(timeoutId);
  };

  // Handle pagination for buyers
  const handleBuyersPageChange = (newPage: number) => {
    if (selectedProduct) {
      loadProductBuyers(selectedProduct, newPage, buyerSearchQuery);
    }
  };

  // Product selection handlers
  const toggleProductSelection = (product: ProductReport) => {
    setSelectedProducts(prev => {
      const isSelected = prev.some(p => p.id === product.id);
      if (isSelected) {
        return prev.filter(p => p.id !== product.id);
      } else {
        return [...prev, product];
      }
    });
  };

  const selectAllProducts = () => {
    const filteredProducts = products.filter(p => categoryFilter === 'all' || p.category === categoryFilter);
    setSelectedProducts(filteredProducts);
  };

  const clearAllSelections = () => {
    setSelectedProducts([]);
  };

  const openCombinedRekapModal = async () => {
    if (selectedProducts.length === 0) return;

    setLoadingCombinedRekap(true);
    setShowCombinedRekapModal(true);
    setCombinedRekapData([]);

    try {
      const combinedData: CombinedBuyerSummary[] = [];

      for (const product of selectedProducts) {
        const buyersSummary = await ReportsService.getProductBuyersSummary(product.id);

        combinedData.push({
          productId: product.id,
          productName: product.name,
          buyers: buyersSummary.buyers as any,
          totalBuyers: buyersSummary.totalBuyers,
          totalQuantity: buyersSummary.totalQuantity,
          totalAmount: buyersSummary.totalAmount
        });
      }

      setCombinedRekapData(combinedData);
    } catch (error) {
      console.error('Error loading combined rekap data:', error);
    } finally {
      setLoadingCombinedRekap(false);
    }
  };

  const closeCombinedRekapModal = () => {
    setShowCombinedRekapModal(false);
    setCombinedRekapData([]);
  };

  // Remove mock loader - rely on real data above

  // Filter transactions based on filters - optimized with debouncing
  const filteredTransactions = useMemo(() => {
    // Only filter if we have transactions and initial loading is complete
    if (transactions.length === 0 || !initialLoadingComplete) {
      return [];
    }

    const { start, end } = getDateRange;

    return transactions.filter(transaction => {
      const matchesDate = transaction.date >= start && transaction.date <= end;
      const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;

      let matchesCustomer = true;
      if (customerFilter) {
        const customerLower = customerFilter.toLowerCase();
        matchesCustomer =
          transaction.customer.toLowerCase().includes(customerLower) ||
          transaction.phone.includes(customerFilter);
      }

      let matchesCategory = true;
      if (categoryFilter !== 'all' && transaction.items) {
        matchesCategory = transaction.items.some((item: any) => item.category === categoryFilter);
      }

      return matchesDate && matchesStatus && matchesCustomer && matchesCategory;
    });
  }, [transactions, getDateRange, statusFilter, customerFilter, categoryFilter, initialLoadingComplete]);

  // 📊 Group invoices by customer for hierarchical view
  const groupedInvoicesByCustomer = useMemo(() => {
    const grouped: { [key: string]: { customer: string, invoices: Transaction[], totalAmount: number } } = {};

    for (const transaction of filteredTransactions) {
      const customerKey = transaction.customer || 'Unknown';
      if (!grouped[customerKey]) {
        grouped[customerKey] = {
          customer: customerKey,
          invoices: [],
          totalAmount: 0
        };
      }
      grouped[customerKey].invoices.push(transaction);
      grouped[customerKey].totalAmount += transaction.total;
    }

    // Sort by total amount descending
    return Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredTransactions]);

  // Calculate summary statistics - optimized for performance
  const summaryStats = useMemo(() => {
    // Only calculate if we have filtered transactions
    if (filteredTransactions.length === 0) {
      return {
        totalRevenue: 0,
        totalShipping: 0,
        totalSales: 0,
        lunasCount: 0,
        belumLunasCount: 0,
        totalBelumLunas: 0,
        averageTransaction: 0
      };
    }

    let totalRevenue = 0;
    let totalShipping = 0;
    let totalSales = 0;
    let lunasCount = 0;
    let belumLunasCount = 0;
    let totalBelumLunas = 0;

    // Manual loop for better performance than multiple reduce/filter calls
    for (const transaction of filteredTransactions) {
      totalRevenue += transaction.subtotal;
      totalShipping += transaction.shippingCost;
      totalSales += transaction.total;

      if (transaction.status === 'lunas') {
        lunasCount++;
      } else {
        belumLunasCount++;
        totalBelumLunas += transaction.total;
      }
    }

    return {
      totalRevenue,
      totalShipping,
      totalSales,
      lunasCount,
      belumLunasCount,
      totalBelumLunas,
      averageTransaction: filteredTransactions.length > 0 ? totalSales / filteredTransactions.length : 0
    };
  }, [filteredTransactions]);

  // Calculate profit/loss



  const financialBreakdown = useMemo(() => {
    // Filter cashflow for P&L (only entries with includeInPnL = true)
    const pnlCashFlow = cashFlow.filter(flow => flow.includeInPnL !== false);

    const modalCost = filteredTransactions.reduce((sum, transaction) => {
      const transactionModal = transaction.totalModal || (transaction.subtotal * 0.6);
      return sum + transactionModal;
    }, 0);

    const pendapatanPenjualan = summaryStats.totalRevenue;
    const pendapatanOngkir = summaryStats.totalShipping;
    const pendapatanTotal = pendapatanPenjualan + pendapatanOngkir;

    const ongkirPembelian = pnlCashFlow
      .filter(flow => flow.type === 'expense' && (flow.category || '').toLowerCase() === 'ongkir pembelian')
      .reduce((sum, flow) => sum + flow.amount, 0);

    const nonShippingExpenses = pnlCashFlow.filter(
      flow => flow.type === 'expense' && (flow.category || '').toLowerCase() !== 'ongkir pembelian'
    );
    const biayaLain = nonShippingExpenses.reduce((sum, flow) => sum + flow.amount, 0);
    const biayaPerKategoriMap = nonShippingExpenses.reduce<Record<string, number>>((acc, flow) => {
      const key = flow.category || 'Lainnya';
      acc[key] = (acc[key] || 0) + flow.amount;
      return acc;
    }, {});
    const biayaLainPerKategori = Object.entries(biayaPerKategoriMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const totalBiaya = modalCost + ongkirPembelian + biayaLain;
    const labaRugi = pendapatanTotal - totalBiaya;

    return {
      modalCost,
      pendapatanPenjualan,
      pendapatanOngkir,
      pendapatanTotal,
      ongkirPembelian,
      biayaLain,
      biayaLainPerKategori,
      totalBiaya,
      labaRugi
    };
  }, [filteredTransactions, summaryStats, cashFlow]);

  const cashflowRecap = useMemo(() => {
    const saldoSebelum = 0;

    // Group by category for dynamic breakdown
    const incomeByCategory = cashFlow
      .filter(flow => flow.type === 'income')
      .reduce<Record<string, number>>((acc, flow) => {
        const key = flow.category || 'Lainnya';
        acc[key] = (acc[key] || 0) + flow.amount;
        return acc;
      }, {});

    const expenseByCategory = cashFlow
      .filter(flow => flow.type === 'expense')
      .reduce<Record<string, number>>((acc, flow) => {
        const key = flow.category || 'Lainnya';
        acc[key] = (acc[key] || 0) + flow.amount;
        return acc;
      }, {});

    const totalIncome = Object.values(incomeByCategory).reduce((sum, amount) => sum + amount, 0);
    const totalExpense = Object.values(expenseByCategory).reduce((sum, amount) => sum + amount, 0);
    const total = totalIncome - totalExpense;
    const saldoAkhir = saldoSebelum + total;

    return {
      saldoSebelum,
      incomeByCategory: Object.entries(incomeByCategory).map(([category, amount]) => ({ category, amount })),
      expenseByCategory: Object.entries(expenseByCategory).map(([category, amount]) => ({ category, amount })),
      totalIncome,
      totalExpense,
      total,
      saldoAkhir
    };
  }, [cashFlow]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Chart color palette
  const CHART_COLORS = ['#D4AF37', '#997B2C', '#EDD686', '#B8860B', '#DAA520', '#FFD700', '#8B7355', '#CD853F'];

  // Aggregate daily sales data for chart
  const dailySalesData = useMemo(() => {
    if (filteredTransactions.length === 0) return [];

    const dailyMap: Record<string, { date: string, nilai: number, jumlah: number }> = {};

    for (const transaction of filteredTransactions) {
      const dateKey = transaction.date; // Assuming date is already in YYYY-MM-DD format
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: dateKey, nilai: 0, jumlah: 0 };
      }
      dailyMap[dateKey].nilai += transaction.subtotal;
      dailyMap[dateKey].jumlah += transaction.items?.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 1;
    }

    return Object.values(dailyMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14) // Last 14 days
      .map(d => ({
        ...d,
        tanggal: new Date(d.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
      }));
  }, [filteredTransactions]);

  // Aggregate monthly sales data for chart
  const monthlySalesData = useMemo(() => {
    if (filteredTransactions.length === 0) return [];

    const monthlyMap: Record<string, { month: string, nilai: number, jumlah: number }> = {};

    for (const transaction of filteredTransactions) {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { month: monthLabel, nilai: 0, jumlah: 0 };
      }
      monthlyMap[monthKey].nilai += transaction.subtotal;
      monthlyMap[monthKey].jumlah += transaction.items?.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 1;
    }

    return Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // Last 6 months
      .map(([_, data]) => data);
  }, [filteredTransactions]);

  // Aggregate sales by brand/category for pie chart
  const salesByBrandData = useMemo(() => {
    if (filteredTransactions.length === 0) return [];

    const brandMap: Record<string, number> = {};

    for (const transaction of filteredTransactions) {
      if (transaction.items) {
        for (const item of transaction.items) {
          const brand = item.brand || 'Tanpa Brand';
          brandMap[brand] = (brandMap[brand] || 0) + (item.total || item.price * item.quantity);
        }
      }
    }

    return Object.entries(brandMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 brands
  }, [filteredTransactions]);

  // Export functionality
  const exportToCSV = (data: any[], filename: string) => {
    // Simple CSV export
    const csv = data.map(row => Object.values(row).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  // Only show loading screen for initial critical data loading
  if (loading && !initialLoadingComplete) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#D4AF37] mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Memuat data...</p>
        </div>
      </div>
    );
  }

  // Dynamic title & subtitle based on reportType
  const getReportInfo = () => {
    switch (reportType) {
      case 'summary':
        return { title: 'Ringkasan Laporan', subtitle: 'Overview performa bisnis dan grafik penjualan' };
      case 'sales':
        return { title: 'Laporan Penjualan', subtitle: 'Pantau transaksi dan performa penjualan' };
      case 'products':
        return { title: 'Laporan Produk Terjual', subtitle: 'Analisa produk terlaris dan performa produk' };
      case 'invoice':
        return { title: 'Laporan Invoice', subtitle: 'Daftar invoice dan tagihan pelanggan' };
      case 'inventory':
        return { title: 'Laporan Persediaan', subtitle: 'Monitoring stok dan nilai inventory' };
      case 'cashflow':
        return { title: 'Laporan Arus Kas', subtitle: 'Track pemasukan dan pengeluaran bisnis' };
      case 'profitloss':
        return { title: 'Laporan Rugi Laba', subtitle: 'Analisa profit dan loss bisnis' };
      case 'receivables':
        return { title: 'Laporan Piutang Pelanggan', subtitle: 'Daftar piutang per pelanggan' };
      case 'detail':
        return { title: 'Laporan Detail', subtitle: 'Informasi lengkap semua transaksi' };
      default:
        return { title: 'Laporan', subtitle: 'Pilih jenis laporan' };
    }
  };

  const reportInfo = getReportInfo();

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={reportInfo.title}
        subtitle={reportInfo.subtitle}
        onBack={onBack}
      />

      <div className="p-4 space-y-4">
        {/* Filters Section - 3D Gold Cards */}
        <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 shine-effect">
          {/* Report Type Selector */}
          <div className="mb-4">
            <label className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2 block">Jenis Laporan</label>
            <div className="relative">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className="w-full appearance-none rounded-xl border-2 border-[#D4AF37] bg-white px-4 py-3 pr-10 text-base font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 cursor-pointer"
              >
                {/* ⚠️ OWNER ONLY: Ringkasan Laporan */}
                {isOwner && <option value="summary">Ringkasan Laporan</option>}
                <option value="sales">Laporan Penjualan</option>
                <option value="products">Laporan Produk Terjual</option>
                <option value="invoice">Laporan Invoice</option>
                <option value="inventory">Laporan Persediaan</option>
                {isOwner && <option value="cashflow">Laporan Arus Kas</option>}
                {isOwner && <option value="profitloss">Laporan Rugi Laba</option>}
                {isOwner && <option value="receivables">Laporan Piutang Pelanggan</option>}
                <option value="detail">Laporan Detail</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#997B2C] pointer-events-none" />
            </div>
          </div>

          {/* Filters Grid */}
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            {/* Periode Filter */}
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2 block">Periode</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="w-full rounded-xl border-2 border-[#D4AF37] bg-white px-3 py-2 text-sm font-semibold text-[#997B2C] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
              >
                <option value="hari_ini">Hari ini</option>
                <option value="kemaren">Kemarin</option>
                <option value="bulan_ini">Bulan ini</option>
                <option value="bulan_kemaren">Bulan lalu</option>
                <option value="custom">Custom Range</option>
              </select>
              {dateFilter === 'custom' && (
                <div className="mt-2 grid gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                    placeholder="Dari"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                    placeholder="Sampai"
                  />
                </div>
              )}
            </div>

            {/* Status Filter - Only for sales/invoice */}
            {(reportType === 'sales' || reportType === 'invoice' || reportType === 'detail') && (
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2 block">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full rounded-xl border-2 border-[#D4AF37] bg-white px-3 py-2 text-sm font-semibold text-[#997B2C] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                >
                  <option value="all">Semua Status</option>
                  <option value="lunas">Lunas</option>
                  <option value="belum_lunas">Belum Lunas</option>
                  <option value="dibatalkan">Dibatalkan</option>
                </select>
              </div>
            )}

            {/* Customer Filter - Only for sales/invoice/detail */}
            {(reportType === 'sales' || reportType === 'invoice' || reportType === 'detail') && (
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2 block">Pilih Pelanggan</label>
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#D4AF37] bg-white px-3 py-2 text-sm font-semibold text-[#997B2C] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                >
                  <option value="">Semua Pelanggan</option>
                  {users.map((usr) => (
                    <option key={usr.id} value={usr.name || usr.email}>
                      {usr.name || usr.email} {usr.phone && `(${usr.phone})`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Payment Method Filter - Only for cashflow */}
            {reportType === 'cashflow' && (
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2 block">Metode Pembayaran</label>
                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
                  className="w-full rounded-xl border-2 border-[#D4AF37] bg-white px-3 py-2 text-sm font-semibold text-[#997B2C] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                >
                  <option value="all">Semua Metode</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>{method.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Category Filter - For sales/products/inventory */}
            {(reportType === 'sales' || reportType === 'products' || reportType === 'inventory') && (
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2 block">Kategori Produk</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#D4AF37] bg-white px-3 py-2 text-sm font-bold text-[#997B2C] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                >
                  <option value="all">Semua Kategori</option>
                  {productCategories.map((cat) => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => exportToCSV(filteredTransactions, `laporan_${reportType}.csv`)}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#EDD686] via-[#D4AF37] to-[#997B2C] px-3 py-2 text-xs font-semibold text-white hover:shadow-lg transition"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setCustomerFilter('');
                  setDateFilter('bulan_ini');
                  setPaymentMethodFilter('all');
                  setCategoryFilter('all');
                }}
                className="rounded-xl border-2 border-[#D4AF37] px-3 py-2 text-xs font-semibold text-[#997B2C] transition hover:bg-[#D4AF37]/10"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
        {/* Report Content - 3D Gold Theme */}
        <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] shine-effect">
          {/* Ringkasan Laporan */}
          {reportType === 'summary' && (
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Ringkasan Performa Bisnis</h3>

              {/* Summary Cards - 3D Gold Theme */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-5 relative overflow-hidden group hover:shadow-[0_6px_0_0_#997B2C,0_12px_24px_rgba(153,123,44,0.25)] hover:-translate-y-1 transition-all duration-300 shine-effect">
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-[#D4AF37]/20 to-transparent rounded-full blur-2xl group-hover:bg-[#D4AF37]/30 transition-all duration-500" />
                  <div className="relative z-10">
                    <p className="text-gray-500 text-sm">Total Penjualan</p>
                    <p className="text-xl font-bold text-gray-800">
                      {formatCurrency(summaryStats.totalSales)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {filteredTransactions.length} transaksi
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-5 relative overflow-hidden group hover:shadow-[0_6px_0_0_#997B2C,0_12px_24px_rgba(153,123,44,0.25)] hover:-translate-y-1 transition-all duration-300 shine-effect">
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-[#D4AF37]/20 to-transparent rounded-full blur-2xl group-hover:bg-[#D4AF37]/30 transition-all duration-500" />
                  <div className="relative z-10">
                    <p className="text-gray-500 text-sm">Lunas</p>
                    <p className="text-xl font-bold text-green-600">
                      {summaryStats.lunasCount}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatCurrency(summaryStats.totalSales - summaryStats.totalBelumLunas)}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-5 relative overflow-hidden group hover:shadow-[0_6px_0_0_#997B2C,0_12px_24px_rgba(153,123,44,0.25)] hover:-translate-y-1 transition-all duration-300 shine-effect">
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-[#D4AF37]/20 to-transparent rounded-full blur-2xl group-hover:bg-[#D4AF37]/30 transition-all duration-500" />
                  <div className="relative z-10">
                    <p className="text-gray-500 text-sm">Belum Lunas</p>
                    <p className="text-xl font-bold text-amber-600">
                      {summaryStats.belumLunasCount}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatCurrency(summaryStats.totalBelumLunas)}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-5 relative overflow-hidden group hover:shadow-[0_6px_0_0_#997B2C,0_12px_24px_rgba(153,123,44,0.25)] hover:-translate-y-1 transition-all duration-300 shine-effect">
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-[#D4AF37]/20 to-transparent rounded-full blur-2xl group-hover:bg-[#D4AF37]/30 transition-all duration-500" />
                  <div className="relative z-10">
                    <p className="text-gray-500 text-sm">Rata-rata</p>
                    <p className="text-xl font-bold text-gray-800">
                      {formatCurrency(summaryStats.averageTransaction)}
                    </p>
                    <p className="text-xs text-gray-500">per transaksi</p>
                  </div>
                </div>
              </div>

              {/* Daily Sales Chart */}
              <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-6 mt-6 shine-effect">
                <h4 className="text-base font-bold text-gray-800 mb-4">📊 Penjualan Harian (14 Hari Terakhir)</h4>
                {dailySalesData.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailySalesData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} stroke="#6B7280" />
                        <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} tick={{ fontSize: 10 }} stroke="#D4AF37" />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#997B2C" />
                        <Tooltip
                          formatter={(value: any, name: any) => [
                            name === 'nilai' ? `Rp ${(value || 0).toLocaleString('id-ID')}` : `${value || 0} pcs`,
                            name === 'nilai' ? 'Nilai' : 'Jumlah'
                          ]}
                          labelStyle={{ fontWeight: 'bold' }}
                          contentStyle={{ borderRadius: 8, border: '2px solid #D4AF37' }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="nilai" name="Nilai (Rp)" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="jumlah" name="Jumlah (pcs)" fill="#997B2C" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center bg-gray-50 rounded-xl">
                    <p className="text-gray-400">Belum ada data penjualan</p>
                  </div>
                )}
              </div>

              {/* Monthly Sales Chart */}
              <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-6 mt-6 shine-effect">
                <h4 className="text-base font-bold text-gray-800 mb-4">📈 Tren Penjualan Bulanan</h4>
                {monthlySalesData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlySalesData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6B7280" />
                        <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} tick={{ fontSize: 10 }} stroke="#D4AF37" />
                        <Tooltip
                          formatter={(value: any) => [`Rp ${(value || 0).toLocaleString('id-ID')}`, 'Nilai']}
                          contentStyle={{ borderRadius: 8, border: '2px solid #D4AF37' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="nilai" name="Nilai (Rp)" stroke="#D4AF37" strokeWidth={3} dot={{ fill: '#D4AF37', r: 5 }} activeDot={{ r: 8, fill: '#997B2C' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center bg-gray-50 rounded-xl">
                    <p className="text-gray-400">Belum ada data bulanan</p>
                  </div>
                )}
              </div>

              {/* Sales by Brand/Category Pie Chart */}
              <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-6 mt-6 shine-effect">
                <h4 className="text-base font-bold text-gray-800 mb-4">🏷️ Penjualan per Brand</h4>
                {salesByBrandData.length > 0 ? (
                  <div className="h-72 flex flex-col md:flex-row items-center">
                    <div className="w-full md:w-1/2 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={salesByBrandData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#D4AF37"
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {salesByBrandData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => `Rp ${(value || 0).toLocaleString('id-ID')}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full md:w-1/2 space-y-2 mt-4 md:mt-0">
                      {salesByBrandData.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                            <span className="text-gray-700 font-medium">{item.name}</span>
                          </div>
                          <span className="font-bold text-gray-800">Rp {item.value.toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center bg-gray-50 rounded-xl">
                    <p className="text-gray-400">Belum ada data kategori</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Penjualan Tab */}
          {reportType === 'sales' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Transaksi Penjualan</h3>
                <span className="text-sm text-gray-500">{filteredTransactions.length} transaksi</span>
              </div>

              {/* Responsive Table - Works on both mobile and desktop */}
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full min-w-[320px] table-fixed text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#EDD686]/20 via-[#D4AF37]/20 to-[#997B2C]/20">
                      <th className="px-2 py-2 text-left font-bold text-gray-700 uppercase tracking-wider w-[35%] sm:w-auto">Invoice</th>
                      <th className="px-2 py-2 text-right font-bold text-gray-700 uppercase tracking-wider w-[22%] sm:w-auto">Total</th>
                      {isOwner && <th className="px-2 py-2 text-right font-bold text-gray-700 uppercase tracking-wider w-[21.5%] sm:w-auto">Modal</th>}
                      {isOwner && <th className="px-2 py-2 text-right font-bold text-gray-700 uppercase tracking-wider w-[21.5%] sm:w-auto">Laba</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTransactions.map((transaction) => {
                      const modal = transaction.totalModal || (transaction.subtotal * 0.6);
                      const laba = transaction.subtotal - modal;
                      return (
                        <tr
                          key={transaction.id}
                          className="hover:bg-[#D4AF37]/10 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedInvoiceDetail(transaction);
                            setShowInvoiceDetailModal(true);
                          }}
                        >
                          <td className="px-2 py-2">
                            <div className="font-semibold text-[#997B2C] underline decoration-dotted truncate">{transaction.invoice}</div>
                            <div className="text-[10px] text-gray-400 hidden sm:block">{transaction.customer}</div>
                          </td>
                          <td className="px-2 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                            {transaction.subtotal >= 1000000
                              ? `${(transaction.subtotal / 1000000).toFixed(1)}jt`
                              : transaction.subtotal >= 1000
                                ? `${Math.round(transaction.subtotal / 1000)}rb`
                                : formatCurrency(transaction.subtotal)
                            }
                          </td>
                          {isOwner && (
                            <td className="px-2 py-2 text-right text-gray-600 whitespace-nowrap">
                              {modal >= 1000000
                                ? `${(modal / 1000000).toFixed(1)}jt`
                                : modal >= 1000
                                  ? `${Math.round(modal / 1000)}rb`
                                  : formatCurrency(modal)
                              }
                            </td>
                          )}
                          {isOwner && (
                            <td className="px-2 py-2 text-right font-bold text-green-600 whitespace-nowrap">
                              {laba >= 1000000
                                ? `${(laba / 1000000).toFixed(1)}jt`
                                : laba >= 1000
                                  ? `${Math.round(laba / 1000)}rb`
                                  : formatCurrency(laba)
                              }
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Total Footer */}
                  <tfoot>
                    <tr className="bg-gradient-to-r from-[#EDD686] via-[#D4AF37] to-[#997B2C] text-white font-bold">
                      <td className="px-2 py-3 uppercase tracking-wider">Total</td>
                      <td className="px-2 py-3 text-right whitespace-nowrap">
                        {summaryStats.totalRevenue >= 1000000
                          ? `${(summaryStats.totalRevenue / 1000000).toFixed(1)}jt`
                          : `${Math.round(summaryStats.totalRevenue / 1000)}rb`
                        }
                      </td>
                      {isOwner && (
                        <td className="px-2 py-3 text-right whitespace-nowrap">
                          {(() => {
                            const totalModal = filteredTransactions.reduce((sum, t) =>
                              sum + (t.totalModal || t.subtotal * 0.6), 0);
                            return totalModal >= 1000000
                              ? `${(totalModal / 1000000).toFixed(1)}jt`
                              : `${Math.round(totalModal / 1000)}rb`;
                          })()}
                        </td>
                      )}
                      {isOwner && (
                        <td className="px-2 py-3 text-right whitespace-nowrap">
                          {(() => {
                            const totalLaba = filteredTransactions.reduce((sum, t) => {
                              const modal = t.totalModal || t.subtotal * 0.6;
                              return sum + (t.subtotal - modal);
                            }, 0);
                            return totalLaba >= 1000000
                              ? `${(totalLaba / 1000000).toFixed(1)}jt`
                              : `${Math.round(totalLaba / 1000)}rb`;
                          })()}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Hint */}
              <p className="text-xs text-gray-400 mt-3 text-center">💡 Tap invoice untuk lihat detail</p>
            </div>
          )}

          {/* Produk Tab */}
          {reportType === 'products' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Produk Terlaris</h3>
                <div className="flex items-center space-x-2">
                  {selectedProducts.length > 0 && (
                    <button
                      onClick={openCombinedRekapModal}
                      className="px-4 py-2 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white rounded-lg hover:shadow-lg transition-all flex items-center font-bold"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Lihat Rekap Pembeli Terpilih ({selectedProducts.length})
                    </button>
                  )}
                  {loadingProducts && (
                    <div className="flex items-center text-sm text-gray-500">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Loading...
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Card View */}
              {loadingProducts && products.length === 0 ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-blue-600 mb-4"></div>
                  <p className="text-gray-600 font-medium">Memuat data produk...</p>
                </div>
              ) : (
                <>
                  <div className="block md:hidden space-y-4">
                    {products
                      .filter(p => categoryFilter === 'all' || p.category === categoryFilter)
                      .map((product) => {
                        const averagePrice = product.totalSold > 0 ? product.totalRevenue / product.totalSold : 0;
                        const modal = product.totalRevenue - product.profit;

                        return (
                          <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-start gap-3 mb-2">
                              <input
                                type="checkbox"
                                checked={selectedProducts.some(p => p.id === product.id)}
                                onChange={() => toggleProductSelection(product)}
                                className="mt-1 h-5 w-5 text-[#997B2C] rounded focus:ring-[#D4AF37] border-gray-300"
                              />
                              <div className="flex-1">
                                <p className="font-bold text-gray-800 line-clamp-2">{product.name}</p>
                                <p className="text-xs text-[#997B2C] mt-1">{product.totalSold} terjual</p>
                              </div>
                            </div>

                            <div className="pl-8 space-y-1 text-sm border-t pt-2 mt-2">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Harga Rata2</span>
                                <span className="font-medium text-gray-900">{formatCurrency(averagePrice)}</span>
                              </div>
                              {isOwner && (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Total Modal</span>
                                    <span className="text-gray-900">{formatCurrency(modal)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500 font-medium">Profit</span>
                                    <span className="font-bold text-green-600">{formatCurrency(product.profit)}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full table-auto">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">
                            <input
                              type="checkbox"
                              checked={selectedProducts.length > 0 && selectedProducts.length === products.filter(p => categoryFilter === 'all' || p.category === categoryFilter).length}
                              onChange={() => {
                                if (selectedProducts.length > 0 && selectedProducts.length === products.filter(p => categoryFilter === 'all' || p.category === categoryFilter).length) {
                                  clearAllSelections();
                                } else {
                                  selectAllProducts();
                                }
                              }}
                              className="h-4 w-4 text-[#997B2C] rounded focus:ring-[#D4AF37] border-gray-300"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terjual</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Harga</th>
                          {isOwner && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modal</th>}
                          {isOwner && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Laba</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {products
                          .filter(p => categoryFilter === 'all' || p.category === categoryFilter)
                          .map((product) => {
                            const averagePrice = product.totalSold > 0 ? product.totalRevenue / product.totalSold : 0;
                            const modal = product.totalRevenue - product.profit;

                            return (
                              <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 w-12">
                                  <input
                                    type="checkbox"
                                    checked={selectedProducts.some(p => p.id === product.id)}
                                    onChange={() => toggleProductSelection(product)}
                                    className="h-4 w-4 text-[#997B2C] rounded focus:ring-[#D4AF37] border-gray-300"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {product.name}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {product.totalSold}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {formatCurrency(averagePrice)}
                                </td>
                                {isOwner && (
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {formatCurrency(modal)}
                                  </td>
                                )}
                                {isOwner && (
                                  <td className="px-4 py-3 text-sm text-brand-success">
                                    {formatCurrency(product.profit)}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Invoice Tab - Hierarchical View */}
          {reportType === 'invoice' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Rekap Invoice per Pelanggan</h3>
                <span className="text-sm text-gray-500">{groupedInvoicesByCustomer.length} pelanggan · {filteredTransactions.length} invoice</span>
              </div>

              {/* Level 1: Customer Summary Table */}
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full min-w-[320px] table-fixed text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#EDD686]/20 via-[#D4AF37]/20 to-[#997B2C]/20">
                      <th className="px-2 py-2 text-center font-bold text-gray-700 uppercase tracking-wider w-[20%]">Invoice</th>
                      <th className="px-2 py-2 text-left font-bold text-gray-700 uppercase tracking-wider w-[50%]">Pelanggan</th>
                      <th className="px-2 py-2 text-right font-bold text-gray-700 uppercase tracking-wider w-[30%]">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupedInvoicesByCustomer.map((group) => (
                      <React.Fragment key={group.customer}>
                        {/* Level 1 Row - Customer Summary */}
                        <tr
                          className={`cursor-pointer transition-colors ${expandedInvoiceCustomer === group.customer ? 'bg-[#D4AF37]/20' : 'hover:bg-[#D4AF37]/10'}`}
                          onClick={() => setExpandedInvoiceCustomer(expandedInvoiceCustomer === group.customer ? null : group.customer)}
                        >
                          <td className="px-2 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#EDD686] to-[#997B2C] text-white font-bold text-sm">
                              {group.invoices.length}
                            </span>
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs transition-transform ${expandedInvoiceCustomer === group.customer ? 'rotate-90' : ''}`}>▶</span>
                              <span className="font-semibold text-gray-900">{group.customer}</span>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-right font-bold text-[#997B2C] whitespace-nowrap">
                            {group.totalAmount >= 1000000
                              ? `${(group.totalAmount / 1000000).toFixed(1)}jt`
                              : group.totalAmount >= 1000
                                ? `${Math.round(group.totalAmount / 1000)}rb`
                                : formatCurrency(group.totalAmount)
                            }
                          </td>
                        </tr>

                        {/* Level 2 - Invoice List (Expanded) */}
                        {expandedInvoiceCustomer === group.customer && (
                          <tr>
                            <td colSpan={3} className="p-0">
                              <div className="bg-gray-50 border-l-4 border-[#D4AF37] ml-4">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="px-3 py-2 text-left font-semibold text-gray-600 w-[30%]">Tanggal</th>
                                      <th className="px-3 py-2 text-left font-semibold text-gray-600 w-[40%]">No. Invoice</th>
                                      <th className="px-3 py-2 text-right font-semibold text-gray-600 w-[30%]">Nominal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.invoices.map((invoice) => (
                                      <tr
                                        key={invoice.id}
                                        className="hover:bg-[#D4AF37]/10 cursor-pointer border-b border-gray-200 last:border-b-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedInvoiceDetail(invoice);
                                          setShowInvoiceDetailModal(true);
                                        }}
                                      >
                                        <td className="px-3 py-2 text-gray-600">{invoice.date}</td>
                                        <td className="px-3 py-2">
                                          <span className="font-semibold text-[#997B2C] underline decoration-dotted">{invoice.invoice}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium text-gray-900">
                                          {invoice.total >= 1000000
                                            ? `${(invoice.total / 1000000).toFixed(1)}jt`
                                            : invoice.total >= 1000
                                              ? `${Math.round(invoice.total / 1000)}rb`
                                              : formatCurrency(invoice.total)
                                          }
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                  {/* Total Footer */}
                  <tfoot>
                    <tr className="bg-gradient-to-r from-[#EDD686] via-[#D4AF37] to-[#997B2C] text-white font-bold">
                      <td className="px-2 py-3 text-center">{filteredTransactions.length}</td>
                      <td className="px-2 py-3 uppercase tracking-wider">Total</td>
                      <td className="px-2 py-3 text-right whitespace-nowrap">
                        {(() => {
                          const totalAll = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
                          return totalAll >= 1000000
                            ? `${(totalAll / 1000000).toFixed(1)}jt`
                            : `${Math.round(totalAll / 1000)}rb`;
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Hint */}
              <p className="text-xs text-gray-400 mt-3 text-center">💡 Tap pelanggan untuk lihat daftar invoice, tap invoice untuk lihat detail</p>
            </div>
          )}

          {/* Persediaan Tab */}
          {reportType === 'inventory' && (
            <div className="p-4">
              {/* Summary Cards - 3D Gold Look */}
              {(() => {
                const filteredInventory = inventory.filter(i => categoryFilter === 'all' || i.category === categoryFilter);
                const totalStok = filteredInventory.reduce((sum, item) => sum + (Number(item.stock) || 0), 0);
                const totalModal = filteredInventory.reduce((sum, item) => {
                  return sum + (Number(item.value) || 0);
                }, 0);

                return (
                  <div className="grid grid-cols-1 gap-3 mb-4">
                    {/* Total Stok Card */}
                    <div className="bg-gradient-to-br from-[#EDD686] via-[#D4AF37] to-[#997B2C] rounded-xl p-4 shadow-[0_4px_0_0_#997B2C,0_6px_12px_rgba(153,123,44,0.3)] shine-effect">
                      <div className="flex items-center gap-2 mb-1">
                        <Package className="w-5 h-5 text-white/80" />
                        <p className="text-white/80 text-xs font-medium uppercase tracking-wider">Total Stok</p>
                      </div>
                      <p className="text-2xl font-bold text-white">{totalStok.toLocaleString('id-ID')} <span className="text-sm font-normal">pcs</span></p>
                    </div>

                    {/* Total Modal Card - Owner Only */}
                    {isOwner && (
                      <div className="bg-gradient-to-br from-[#EDD686] via-[#D4AF37] to-[#997B2C] rounded-xl p-4 shadow-[0_4px_0_0_#997B2C,0_6px_12px_rgba(153,123,44,0.3)] shine-effect">
                        <div className="flex items-center gap-2 mb-1">
                          <Wallet className="w-5 h-5 text-white/80" />
                          <p className="text-white/80 text-xs font-medium uppercase tracking-wider">Total Modal</p>
                        </div>
                        <p className="text-2xl font-bold text-white">Rp {totalModal.toLocaleString('id-ID')}</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Owner: Tombol Pengajuan Stok Adjustment */}
              {isOwner && onNavigateToStockAdjustments && (
                <button
                  onClick={onNavigateToStockAdjustments}
                  className="w-full mb-4 py-3 px-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <Package className="w-5 h-5" />
                  📋 Lihat Pengajuan Stok dari Admin
                </button>
              )}

              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-800">Stok Persediaan</h3>
                <span className="text-sm text-gray-500">{inventory.filter(i => categoryFilter === 'all' || i.category === categoryFilter).length} produk</span>
              </div>

              {/* Responsive Table */}
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full min-w-[320px] table-fixed text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#EDD686]/20 via-[#D4AF37]/20 to-[#997B2C]/20">
                      <th className="px-2 py-2 text-left font-bold text-gray-700 uppercase tracking-wider w-[40%] sm:w-auto">Produk</th>
                      <th className="px-2 py-2 text-right font-bold text-gray-700 uppercase tracking-wider w-[15%] sm:w-auto">Stok</th>
                      {isOwner && <th className="px-2 py-2 text-right font-bold text-gray-700 uppercase tracking-wider w-[22.5%] sm:w-auto">Modal</th>}
                      {isOwner && <th className="px-2 py-2 text-right font-bold text-gray-700 uppercase tracking-wider w-[22.5%] sm:w-auto">Total</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {inventory
                      .filter(i => categoryFilter === 'all' || i.category === categoryFilter)
                      .map((item) => {
                        const stock = Number(item.stock) || 0;
                        const modalPerUnit = stock > 0 ? (Number(item.value) || 0) / stock : 0;
                        const totalModal = Number(item.value) || 0;

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-[#D4AF37]/10 cursor-pointer transition-colors"
                            onClick={() => {
                              setSelectedStockProduct(item);
                              setShowStockHistoryModal(true);
                            }}
                          >
                            <td className="px-2 py-2">
                              <div className="font-medium text-gray-900 truncate">{item.name}</div>
                              <div className="text-[10px] text-gray-400">{item.size} / {item.color}</div>
                            </td>
                            <td className="px-2 py-2 text-right font-semibold text-gray-900">
                              {stock}
                            </td>
                            {isOwner && (
                              <td className="px-2 py-2 text-right text-gray-600 whitespace-nowrap">
                                {modalPerUnit >= 1000000
                                  ? `${(modalPerUnit / 1000000).toFixed(1)}jt`
                                  : modalPerUnit >= 1000
                                    ? `${Math.round(modalPerUnit / 1000)}rb`
                                    : formatCurrency(modalPerUnit)
                                }
                              </td>
                            )}
                            {isOwner && (
                              <td className="px-2 py-2 text-right font-bold text-gray-900 whitespace-nowrap">
                                {totalModal >= 1000000
                                  ? `${(totalModal / 1000000).toFixed(1)}jt`
                                  : totalModal >= 1000
                                    ? `${Math.round(totalModal / 1000)}rb`
                                    : formatCurrency(totalModal)
                                }
                              </td>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                  {/* Total Footer */}
                  <tfoot>
                    <tr className="bg-gradient-to-r from-[#EDD686] via-[#D4AF37] to-[#997B2C] text-white font-bold">
                      <td className="px-2 py-3 uppercase tracking-wider">Total</td>
                      <td className="px-2 py-3 text-right">
                        {inventory.filter(i => categoryFilter === 'all' || i.category === categoryFilter)
                          .reduce((sum, item) => sum + (Number(item.stock) || 0), 0).toLocaleString('id-ID')}
                      </td>
                      {isOwner && <td className="px-2 py-3"></td>}
                      {isOwner && (
                        <td className="px-2 py-3 text-right whitespace-nowrap">
                          {(() => {
                            const total = inventory.filter(i => categoryFilter === 'all' || i.category === categoryFilter)
                              .reduce((sum, item) => sum + (Number(item.value) || 0), 0);
                            return total >= 1000000
                              ? `${(total / 1000000).toFixed(1)}jt`
                              : `${Math.round(total / 1000)}rb`;
                          })()}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Hint */}
              <p className="text-xs text-gray-400 mt-3 text-center">💡 Tap produk untuk lihat history stok</p>
            </div>
          )}

          {/* Arus Kas Tab */}
          {reportType === 'cashflow' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Transaksi Kas & Bank</h3>
              </div>

              {/* Summary Cards for Cash Flow */}
              <div className="card-elevated p-5 mb-6">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Saldo Sebelum</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(cashflowRecap.saldoSebelum)}</span>
                  </div>

                  {/* Pendapatan per kategori */}
                  {cashflowRecap.incomeByCategory.length > 0 && (
                    <>
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Pendapatan</p>
                      </div>
                      {cashflowRecap.incomeByCategory.map(({ category, amount }) => (
                        <div key={`income-${category}`} className="flex items-center justify-between pl-3">
                          <span className="text-gray-600 capitalize">{category}</span>
                          <span className="font-semibold text-brand-success">+{formatCurrency(amount)}</span>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Biaya per kategori */}
                  {cashflowRecap.expenseByCategory.length > 0 && (
                    <>
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Biaya</p>
                      </div>
                      {cashflowRecap.expenseByCategory.map(({ category, amount }) => (
                        <div key={`expense-${category}`} className="flex items-center justify-between pl-3">
                          <span className="text-gray-600 capitalize">{category}</span>
                          <span className="font-semibold text-brand-warning">-{formatCurrency(amount)}</span>
                        </div>
                      ))}
                    </>
                  )}

                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-gray-600 font-semibold">Total Arus Kas</span>
                    <span className={`font-bold ${cashflowRecap.total >= 0 ? 'text-brand-success' : 'text-brand-warning'}`}>
                      {formatCurrency(cashflowRecap.total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-gray-600">Saldo Akhir</span>
                    <span className="text-lg font-bold text-[#997B2C]">{formatCurrency(cashflowRecap.saldoAkhir)}</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deskripsi</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metode</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {cashFlow.map((flow) => (
                      <tr key={flow.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {flow.date}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {flow.description}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {flow.paymentMethodName || '—'}
                        </td>
                        <td className={`px-4 py-3 text-sm font-medium ${flow.type === 'income' ? 'text-brand-success' : 'text-brand-warning'
                          }`}>
                          {flow.type === 'income' ? '+' : '-'}{formatCurrency(flow.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rugi Laba Tab */}
          {reportType === 'profitloss' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-800">Profit & Loss Statement</h3>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="card-elevated p-6 border border-brand-success/30">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-brand-success">Pendapatan</h4>
                      <ArrowUpRight className="w-6 h-6 text-brand-success" />
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Penjualan</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(financialBreakdown.pendapatanPenjualan)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ongkir Penjualan</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(financialBreakdown.pendapatanOngkir)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-3 text-base">
                        <span className="text-gray-600 font-semibold">Total Pendapatan</span>
                        <span className="font-bold text-brand-success">{formatCurrency(financialBreakdown.pendapatanTotal)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card-elevated p-6 border border-brand-warning/30">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-brand-warning">Biaya</h4>
                      <ArrowDownRight className="w-6 h-6 text-brand-warning" />
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Modal</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(financialBreakdown.modalCost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ongkir Pembelian</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(financialBreakdown.ongkirPembelian)}</span>
                      </div>
                      {financialBreakdown.biayaLain > 0 && (
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Biaya Operasional</span>
                            <span className="font-semibold text-gray-900">{formatCurrency(financialBreakdown.biayaLain)}</span>
                          </div>
                          <div className="rounded-lg bg-gray-50 p-3 space-y-1 text-xs text-gray-600">
                            {financialBreakdown.biayaLainPerKategori.map((item) => (
                              <div key={item.category} className="flex justify-between">
                                <span className="font-medium text-gray-700">{item.category}</span>
                                <span className="font-semibold text-gray-900">{formatCurrency(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-3 text-base">
                        <span className="text-gray-600 font-semibold">Total Biaya</span>
                        <span className="font-bold text-brand-warning">{formatCurrency(financialBreakdown.totalBiaya)}</span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">*Biaya operasional diambil dari entri "Biaya & Pendapatan" yang ditandai hitung laba/rugi.</p>
                  </div>
                </div>

                <div className={`card-elevated p-6 border ${financialBreakdown.labaRugi >= 0 ? 'border-brand-success/40' : 'border-brand-warning/40'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Laba / Rugi</p>
                      <p className={`text-2xl font-bold ${financialBreakdown.labaRugi >= 0 ? 'text-brand-success' : 'text-brand-warning'}`}>
                        {formatCurrency(financialBreakdown.labaRugi)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Total Pendapatan</p>
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(financialBreakdown.pendapatanTotal)}</p>
                      <p className="text-xs text-gray-500 mt-2">Total Biaya</p>
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(financialBreakdown.totalBiaya)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detail Tab */}
          {reportType === 'detail' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Detail Lengkap Transaksi</h3>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden space-y-4">
                {filteredTransactions.map((transaction) => (
                  <div key={transaction.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-gray-800">{transaction.invoice}</p>
                        <p className="text-xs text-gray-500">{transaction.date}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${transaction.status === 'lunas' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                        {transaction.status === 'lunas' ? 'Lunas' : 'Belum'}
                      </span>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm font-medium text-gray-900">{transaction.customer}</p>
                      <p className="text-xs text-gray-500">{transaction.phone}</p>
                    </div>

                    <div className="space-y-2 border-t border-b py-2 my-2">
                      {transaction.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600 truncate flex-1 pr-2">
                            {item.name} <span className="text-xs text-gray-400">x{item.quantity}</span>
                          </span>
                          <span className="text-gray-900 font-medium">
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-700">Total</span>
                      <span className="font-bold text-[#997B2C] text-lg">{formatCurrency(transaction.total)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pelanggan</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                      {isOwner && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modal</th>}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Harga</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      {isOwner && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Laba</th>}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTransactions.map((transaction) =>
                      transaction.items.map((item, index) => (
                        <tr key={`${transaction.id}-${index}`} className="hover:bg-gray-50">
                          {index === 0 && (
                            <td className="px-4 py-3 text-sm font-medium text-gray-900" rowSpan={transaction.items.length}>
                              {transaction.invoice}
                            </td>
                          )}
                          {index === 0 && (
                            <td className="px-4 py-3 text-sm text-gray-500" rowSpan={transaction.items.length}>
                              {transaction.date}
                            </td>
                          )}
                          {index === 0 && (
                            <td className="px-4 py-3 text-sm text-gray-900" rowSpan={transaction.items.length}>
                              <div>
                                <div className="font-medium">{transaction.customer}</div>
                                <div className="text-gray-500">{transaction.phone}</div>
                              </div>
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.quantity}
                          </td>
                          {isOwner && (
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatCurrency(item.modal || 0)}
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {formatCurrency(item.total)}
                          </td>
                          {isOwner && (
                            <td className="px-4 py-3 text-sm text-green-600">
                              {formatCurrency(item.total - (item.modal || 0) * item.quantity)}
                            </td>
                          )}
                          {index === 0 && (
                            <td className="px-4 py-3 text-sm" rowSpan={transaction.items.length}>
                              <span className={transaction.status === 'lunas' ? 'badge-brand-success' : 'badge-brand-warning'}>
                                {transaction.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                              </span>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ✅ NEW: Receivables Tab */}
      {reportType === 'receivables' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-bold text-lg">Daftar Piutang Pelanggan</h3>
            <p className="text-sm text-gray-500">Klik pelanggan untuk melihat detail invoice</p>
          </div>
          {loadingReceivables ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : receivables.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Tidak ada piutang</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gradient-to-r from-[#D4AF37] to-[#F4E4BC] text-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Pelanggan</th>
                    <th className="px-4 py-3 text-center font-bold">Invoice</th>
                    <th className="px-4 py-3 text-right font-bold">Piutang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receivables.map((customer) => (
                    <tr
                      key={customer.userId}
                      onClick={() => loadCustomerInvoices(customer)}
                      className="hover:bg-yellow-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{customer.customerName}</div>
                        {customer.customerPhone && (
                          <div className="text-xs text-gray-500">{customer.customerPhone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {customer.invoiceCount} invoice
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">
                        {formatCurrency(customer.totalReceivable)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Receivables Invoice Modal (Level 2) */}
      {showReceivablesModal && selectedCustomerReceivables && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-[#D4AF37] to-[#F4E4BC]">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">
                    Piutang: {selectedCustomerReceivables.customerName}
                  </h3>
                  <p className="text-sm text-gray-700">
                    Total: {formatCurrency(selectedCustomerReceivables.totalReceivable)}
                  </p>
                </div>
                <button
                  onClick={() => setShowReceivablesModal(false)}
                  className="text-gray-700 hover:text-gray-900"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {loadingCustomerInvoices ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : customerInvoices.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Tidak ada invoice</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold">Tanggal</th>
                      <th className="px-4 py-3 text-left font-bold">Invoice</th>
                      <th className="px-4 py-3 text-right font-bold">Piutang</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {customerInvoices.map((invoice) => (
                      <tr
                        key={invoice.orderId}
                        className="hover:bg-yellow-50 cursor-pointer transition-colors"
                        onClick={() => loadOrderDetail(invoice.orderId)}
                      >
                        <td className="px-4 py-3 text-gray-600">{invoice.date}</td>
                        <td className="px-4 py-3 font-medium text-blue-600 underline">{invoice.invoice}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">
                          {formatCurrency(invoice.receivable)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ✅ Order Detail Modal (Level 3 - from Receivables) */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-[#D4AF37] to-[#F4E4BC]">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">
                    Detail Pesanan
                  </h3>
                  <p className="text-sm text-gray-700">INV-{selectedOrderDetail.id}</p>
                </div>
                <button
                  onClick={() => setSelectedOrderDetail(null)}
                  className="text-gray-700 hover:text-gray-900"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[70vh] p-4 space-y-4">
              {loadingOrderDetail ? (
                <div className="text-center text-gray-500 py-8">Loading...</div>
              ) : (
                <>
                  {/* Customer Info */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs uppercase text-gray-500 font-bold mb-1">Pelanggan</p>
                    <p className="font-medium">{selectedOrderDetail.userName}</p>
                    <p className="text-sm text-gray-600">{selectedOrderDetail.shippingInfo?.phone}</p>
                  </div>

                  {/* Order Items */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs uppercase text-gray-500 font-bold mb-2">Produk</p>
                    {selectedOrderDetail.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between py-1 border-b last:border-0">
                        <span className="text-sm">{item.name} x{item.quantity}</span>
                        <span className="text-sm font-medium">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Payment Summary */}
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">Total Pesanan</span>
                      <span className="font-bold">{formatCurrency(selectedOrderDetail.finalTotal || selectedOrderDetail.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">Sudah Dibayar</span>
                      <span className="font-medium text-green-600">{formatCurrency(selectedOrderDetail.totalPaid || 0)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-bold text-red-600">Sisa Piutang</span>
                      <span className="font-bold text-red-600">
                        {formatCurrency((selectedOrderDetail.finalTotal || selectedOrderDetail.totalAmount) - (selectedOrderDetail.totalPaid || 0))}
                      </span>
                    </div>
                  </div>

                  {/* Payment History */}
                  {selectedOrderDetail.payments?.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs uppercase text-gray-500 font-bold mb-2">Riwayat Pembayaran</p>
                      {selectedOrderDetail.payments.map((p: any, idx: number) => (
                        <div key={idx} className="flex justify-between py-1 text-sm">
                          <span>{p.date} ({p.method})</span>
                          <span className="font-medium text-green-600">+{formatCurrency(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Buyers Modal */}
      {showBuyersModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Pembeli Produk: {selectedProduct.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {buyerSearchQuery ?
                      `Ditemukan: ${buyersTotalCount} pembeli (filter: "${buyerSearchQuery}")` :
                      `Total Pembeli: ${buyersTotalCount} orang`
                    }
                  </p>
                </div>
                <button
                  onClick={closeBuyersModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Search input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={buyerSearchQuery}
                  onChange={(e) => handleBuyerSearchChange(e.target.value)}
                  placeholder="Cari berdasarkan nama atau nomor telepon..."
                  className="block w-full pl-10 pr-20 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] sm:text-sm"
                />
                {buyerSearchQuery && (
                  <button
                    onClick={() => handleBuyerSearchChange('')}
                    className="absolute inset-y-0 right-10 pr-3 flex items-center"
                  >
                    <XCircle className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
                <button
                  onClick={() => handleBuyerSearchChange('')}
                  className={`absolute inset-y-0 right-0 px-3 flex items-center transition-colors ${isFilterActive
                    ? 'text-[#997B2C] hover:text-[#997B2C]/80 bg-[#D4AF37]/10 rounded-r-md border-l-4 border-l-[#D4AF37]'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                  title={isFilterActive ? "Hapus Filter" : "Filter"}
                >
                  {isFilterActive ? 'Hapus' : 'Filter'}
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 200px)' }}>
              {loadingBuyers ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-[#D4AF37] mb-4"></div>
                  <p className="text-gray-600 font-medium">Memuat data pembeli...</p>
                </div>
              ) : productBuyers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {buyerSearchQuery ?
                      `Tidak ada pembeli yang cocok dengan "${buyerSearchQuery}"` :
                      'Tidak ada pembeli untuk produk ini'
                    }
                  </p>
                  {buyerSearchQuery && (
                    <button
                      onClick={() => handleBuyerSearchChange('')}
                      className="mt-2 text-[#997B2C] hover:text-[#997B2C]/80 text-sm"
                    >
                      Hapus filter
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. HP</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {productBuyers.map((buyer) => (
                          <tr key={buyer.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {buyer.customerName}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {buyer.customerPhone}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {buyer.quantity} pcs
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatCurrency(buyer.totalAmount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {buyer.invoice}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {buyer.purchaseDate}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {buyersTotalPages > 1 && (
                    <div className="flex justify-between items-center mt-4">
                      <div className="text-sm text-gray-700">
                        {buyerSearchQuery ?
                          `Menampilkan ${productBuyers.length} dari ${buyersTotalCount} pembeli (filter: "${buyerSearchQuery}")` :
                          `Menampilkan ${productBuyers.length} dari ${buyersTotalCount} pembeli`
                        }
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleBuyersPageChange(buyersPage - 1)}
                          disabled={buyersPage === 1}
                          className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1 text-sm">
                          Halaman {buyersPage} dari {buyersTotalPages}
                        </span>
                        <button
                          onClick={() => handleBuyersPageChange(buyersPage + 1)}
                          disabled={buyersPage === buyersTotalPages}
                          className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Combined Rekap Pembeli Modal */}
      {showCombinedRekapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Rekap Pembeli untuk {selectedProducts.length} Produk Terpilih
                  </h3>
                  <p className="text-sm text-gray-500">
                    Total: {combinedRekapData.reduce((sum, item) => sum + item.totalBuyers, 0)} pembeli |
                    Total Qty: {combinedRekapData.reduce((sum, item) => sum + item.totalQuantity, 0)} pcs
                  </p>
                </div>
                <button
                  onClick={closeCombinedRekapModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
              {loadingCombinedRekap ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-blue-600 mb-4"></div>
                  <p className="text-gray-600 font-medium">Memuat data rekap gabungan...</p>
                </div>
              ) : combinedRekapData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Tidak ada data pembeli untuk produk terpilih</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {combinedRekapData.map((productData) => (
                    <div key={productData.productId} className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b">
                        <h4 className="font-medium text-gray-900">{productData.productName}</h4>
                        <p className="text-sm text-gray-500">
                          {productData.totalBuyers} pembeli | {productData.totalQuantity} pcs | {formatCurrency(productData.totalAmount)}
                        </p>
                      </div>

                      {productData.buyers.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full table-auto">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Pembeli</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. HP</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Belanja</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jumlah Beli</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terakhir Beli</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {productData.buyers.map((buyer: any, index) => (
                                <tr key={`${productData.productId}-${buyer.customerName}-${buyer.customerPhone}`} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {index + 1}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    {buyer.customerName}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {buyer.customerPhone}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {buyer.totalQuantity} pcs
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {formatCurrency(buyer.totalAmount)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {buyer.purchaseCount} kali
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {buyer.lastPurchaseDate}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-center text-gray-500">
                          Tidak ada pembeli untuk produk ini
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🧾 Invoice Detail Modal */}
      {showInvoiceDetailModal && selectedInvoiceDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#EDD686] via-[#D4AF37] to-[#997B2C] px-4 py-3 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-lg">{selectedInvoiceDetail.invoice}</h3>
                <p className="text-white/80 text-xs">{selectedInvoiceDetail.date}</p>
              </div>
              <button
                onClick={() => setShowInvoiceDetailModal(false)}
                className="text-white hover:bg-white/20 rounded-full p-1 transition"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Customer Info */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pelanggan</p>
                <p className="font-bold text-gray-900">{selectedInvoiceDetail.customer}</p>
                <p className="text-sm text-gray-600">{selectedInvoiceDetail.phone}</p>
              </div>

              {/* Items */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Item Pesanan</p>
                <div className="space-y-2">
                  {selectedInvoiceDetail.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white border border-gray-100 rounded-lg p-3">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.quantity} x {formatCurrency(item.price)}</p>
                      </div>
                      <p className="font-bold text-gray-900">{formatCurrency(item.total)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">{formatCurrency(selectedInvoiceDetail.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ongkir</span>
                  <span className="font-medium">{formatCurrency(selectedInvoiceDetail.shippingCost)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                  <span>Total</span>
                  <span className="text-[#997B2C]">{formatCurrency(selectedInvoiceDetail.total)}</span>
                </div>
              </div>

              {/* Status */}
              <div className="mt-4 flex justify-center">
                <span className={`px-4 py-2 rounded-full text-sm font-bold ${selectedInvoiceDetail.status === 'lunas'
                  ? 'bg-green-100 text-green-700'
                  : selectedInvoiceDetail.status === 'dibatalkan'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                  }`}>
                  {selectedInvoiceDetail.status === 'lunas' ? '✅ LUNAS' :
                    selectedInvoiceDetail.status === 'dibatalkan' ? '❌ DIBATALKAN' : '⏳ BELUM LUNAS'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock History Modal */}
      {showStockHistoryModal && selectedStockProduct && (
        <StockHistoryModal
          isOpen={showStockHistoryModal}
          onClose={() => setShowStockHistoryModal(false)}
          product={selectedStockProduct}
          user={user}
        />
      )}
    </div>
  );
};

export default AdminReportsPage;