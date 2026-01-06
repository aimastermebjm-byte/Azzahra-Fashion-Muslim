import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from './PageHeader';
import {
  Download, Calendar, BarChart3, PieChart, TrendingUp, TrendingDown, Package, Users,
  FileText, DollarSign, Truck, Filter, Eye, CheckCircle, XCircle,
  ShoppingCart, ArrowUpRight, ArrowDownRight, Box, Wallet, PiggyBank,
  CreditCard, Search, ChevronDown, User
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
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
  ProductBuyerSummary
} from '../services/reportsService';
import StockHistoryModal from './StockHistoryModal';

interface AdminReportsPageProps {
  onBack: () => void;
  user: any;
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

const AdminReportsPage: React.FC<AdminReportsPageProps> = ({ onBack, user }) => {
  const isOwner = user?.role === 'owner';

  // Report type untuk tab navigation
  const [reportType, setReportType] = useState<'summary' | 'sales' | 'products' | 'invoice' | 'inventory' | 'cashflow' | 'profitloss' | 'detail'>('summary');

  // Date filtering
  const [dateFilter, setDateFilter] = useState<'hari_ini' | 'kemaren' | 'bulan_ini' | 'bulan_kemaren' | 'custom'>('bulan_ini');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Additional filters for sales report
  const [statusFilter, setStatusFilter] = useState<'all' | 'lunas' | 'belum_lunas'>('all');
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
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [loadingCashFlow, setLoadingCashFlow] = useState(false);

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

  // Load products report - with caching
  const loadProductsReport = async () => {
    const { start, end } = getDateRange;
    const cacheKey = `products-cache-${start}-${end}`;

    // Check cache first
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour

        if (now - timestamp < CACHE_EXPIRY) {
          console.log('✅ Products loaded from cache');
          setProducts(data);
          return;
        }
      }
    } catch (err) {
      console.error('Cache read error:', err);
    }

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
    setLoadingInventory(true);
    try {
      const inventoryData = await ReportsService.getInventoryReports();
      setInventory(inventoryData);
    } catch (error) {
      console.error('Error loading inventory report:', error);
      setInventory([]);
    } finally {
      setLoadingInventory(false);
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
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const now = Date.now();
          const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

          if (now - timestamp < CACHE_EXPIRY) {
            console.log('✅ Payment methods loaded from cache');
            setPaymentMethods(data);
            return;
          }
        }

        const methods = await financialService.listPaymentMethods();
        setPaymentMethods(methods);

        // Cache for 30 minutes
        localStorage.setItem(cacheKey, JSON.stringify({
          data: methods,
          timestamp: Date.now()
        }));
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
    setLoadingCashFlow(true);
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
      setLoadingCashFlow(false);
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
  const openBuyersModal = (product: ProductReport) => {
    setSelectedProduct(product);
    setBuyersPage(1); // Reset to first page
    setShowBuyersModal(true);
    loadProductBuyers(product, 1);
  };

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
  const profitLossStats = useMemo(() => {
    const totalIncome = cashFlow.filter(c => c.type === 'income').reduce((sum, c) => sum + c.amount, 0);
    const totalExpense = cashFlow.filter(c => c.type === 'expense').reduce((sum, c) => sum + c.amount, 0);
    const profit = totalIncome - totalExpense;

    return {
      totalIncome,
      totalExpense,
      profit,
      profitMargin: totalIncome > 0 ? (profit / totalIncome) * 100 : 0
    };
  }, [cashFlow]);

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-accent mx-auto mb-4"></div>
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
      case 'detail':
        return { title: 'Laporan Detail', subtitle: 'Informasi lengkap semua transaksi' };
      default:
        return { title: 'Laporan', subtitle: 'Pilih jenis laporan' };
    }
  };

  const reportInfo = getReportInfo();

  return (
    <div className="min-h-screen bg-brand-surface">
      <PageHeader
        title={reportInfo.title}
        subtitle={reportInfo.subtitle}
        onBack={onBack}
        variant="gradient"
        align="between"
      >
        {/* Report Type Selector Dropdown */}
        <div className="mb-4">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-white">
            <label className="text-xs uppercase tracking-wide text-white/70 mb-2 block">Jenis Laporan</label>
            <div className="relative">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className="w-full appearance-none rounded-xl border border-white/30 bg-white/95 px-4 py-3 pr-10 text-sm font-semibold text-brand-primary focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
              >
                <option value="summary">📈 Ringkasan Laporan</option>
                <option value="sales">📊 Laporan Penjualan</option>
                <option value="products">📦 Laporan Produk Terjual</option>
                <option value="invoice">📄 Laporan Invoice</option>
                <option value="inventory">📦 Laporan Persediaan</option>
                {isOwner && <option value="cashflow">💰 Laporan Arus Kas</option>}
                {isOwner && <option value="profitloss">📈 Laporan Rugi Laba</option>}
                <option value="detail">👁 Laporan Detail</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-primary pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Filters - Compact Dropdown Style */}
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          {/* Periode Filter */}
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-white">
            <label className="text-xs uppercase tracking-wide text-white/70 mb-2 block">Periode</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full rounded-xl border border-white/30 bg-white/95 px-3 py-2 text-sm font-semibold text-brand-primary focus:outline-none focus:ring-2 focus:ring-white/50"
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
                  className="rounded-xl border border-white/20 bg-white/90 px-3 py-2 text-xs text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Dari"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl border border-white/20 bg-white/90 px-3 py-2 text-xs text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Sampai"
                />
              </div>
            )}
          </div>

          {/* Status Filter - Only for sales/invoice */}
          {(reportType === 'sales' || reportType === 'invoice' || reportType === 'detail') && (
            <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-white">
              <label className="text-xs uppercase tracking-wide text-white/70 mb-2 block">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full rounded-xl border border-white/30 bg-white/95 px-3 py-2 text-sm font-semibold text-brand-primary focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="all">Semua Status</option>
                <option value="lunas">Lunas</option>
                <option value="belum_lunas">Belum Lunas</option>
              </select>
            </div>
          )}

          {/* Customer Filter - Only for sales/invoice/detail */}
          {(reportType === 'sales' || reportType === 'invoice' || reportType === 'detail') && (
            <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-white">
              <label className="text-xs uppercase tracking-wide text-white/70 mb-2 block">Pilih Pelanggan</label>
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="w-full rounded-xl border border-white/30 bg-white/95 px-3 py-2 text-sm font-semibold text-brand-primary focus:outline-none focus:ring-2 focus:ring-white/50"
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
            <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-white">
              <label className="text-xs uppercase tracking-wide text-white/70 mb-2 block">Metode Pembayaran</label>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
                className="w-full rounded-xl border border-white/30 bg-white/95 px-3 py-2 text-sm font-semibold text-brand-primary focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="all">Semua Metode</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>{method.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Category Filter - Only for products/inventory */}
          {(reportType === 'products' || reportType === 'inventory') && (
            <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-white">
              <label className="text-xs uppercase tracking-wide text-white/70 mb-2 block">Kategori Produk</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-xl border border-white/30 bg-white/95 px-3 py-2 text-sm font-semibold text-brand-primary focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="all">Semua Kategori</option>
                {productCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-white flex flex-col gap-2">
            <button
              onClick={() => exportToCSV(filteredTransactions, `laporan_${reportType}.csv`)}
              className="flex items-center justify-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25 transition"
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
              className="rounded-xl border border-white/30 px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-white hover:text-white"
            >
              Reset
            </button>
          </div>
        </div>
      </PageHeader>

      <div className="p-4">
        {/* Report Content */}
        <div className="bg-white rounded-lg shadow-md">
          {/* Ringkasan Laporan */}
          {reportType === 'summary' && (
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Ringkasan Performa Bisnis</h3>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="card-elevated p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm">Total Penjualan</p>
                      <p className="text-xl font-bold text-gray-800">
                        {formatCurrency(summaryStats.totalSales)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {filteredTransactions.length} transaksi
                      </p>
                    </div>
                    <div className="bg-brand-accentMuted p-3 rounded-2xl">
                      <DollarSign className="w-6 h-6 text-brand-primary" />
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm">Lunas</p>
                      <p className="text-xl font-bold text-brand-success">
                        {summaryStats.lunasCount}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(summaryStats.totalSales - summaryStats.totalBelumLunas)}
                      </p>
                    </div>
                    <div className="bg-brand-success/10 p-3 rounded-2xl">
                      <CheckCircle className="w-6 h-6 text-brand-success" />
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm">Belum Lunas</p>
                      <p className="text-xl font-bold text-brand-warning">
                        {summaryStats.belumLunasCount}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(summaryStats.totalBelumLunas)}
                      </p>
                    </div>
                    <div className="bg-brand-warning/10 p-3 rounded-2xl">
                      <XCircle className="w-6 h-6 text-brand-warning" />
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm">Rata-rata</p>
                      <p className="text-xl font-bold text-gray-800">
                        {formatCurrency(summaryStats.averageTransaction)}
                      </p>
                      <p className="text-xs text-gray-500">per transaksi</p>
                    </div>
                    <div className="bg-brand-accentMuted p-3 rounded-2xl">
                      <TrendingUp className="w-6 h-6 text-brand-primary" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sales Chart */}
              <div className="card-elevated p-6 mt-6">
                <h4 className="text-base font-semibold text-gray-800 mb-4">Grafik Penjualan</h4>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Grafik penjualan akan ditampilkan di sini</p>
                    <p className="text-xs text-gray-400 mt-1">Implementasi Chart.js atau Recharts sedang dalam proses</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Penjualan Tab */}
          {reportType === 'sales' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Transaksi Penjualan</h3>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden space-y-4">
                {filteredTransactions.map((transaction) => {
                  const modal = transaction.totalModal || (transaction.subtotal * 0.6);
                  const laba = transaction.subtotal - modal;
                  return (
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
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Pelanggan</span>
                          <span className="font-medium text-gray-900">{transaction.customer}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total</span>
                          <span className="font-bold text-gray-900">{formatCurrency(transaction.subtotal)}</span>
                        </div>
                        {isOwner && (
                          <div className="flex justify-between border-t pt-1 mt-1">
                            <span className="text-xs text-gray-500">Laba</span>
                            <span className="font-bold text-green-600">{formatCurrency(laba)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                      {isOwner && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modal</th>}
                      {isOwner && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Laba</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTransactions.map((transaction) => {
                      const modal = transaction.totalModal || (transaction.subtotal * 0.6); // Use real modal or fallback 60%
                      const laba = transaction.subtotal - modal;

                      return (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {transaction.invoice}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatCurrency(transaction.subtotal)}
                          </td>
                          {isOwner && (
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatCurrency(modal)}
                            </td>
                          )}
                          {isOwner && (
                            <td className="px-4 py-3 text-sm text-green-600">
                              {formatCurrency(laba)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
                      className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors flex items-center"
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
                                className="mt-1 h-5 w-5 text-brand-primary rounded focus:ring-brand-primary border-gray-300"
                              />
                              <div className="flex-1">
                                <p className="font-bold text-gray-800 line-clamp-2">{product.name}</p>
                                <p className="text-xs text-brand-primary mt-1">{product.totalSold} terjual</p>
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
                              className="h-4 w-4 text-brand-primary rounded focus:ring-brand-primary border-gray-300"
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
                                    className="h-4 w-4 text-brand-primary rounded focus:ring-brand-primary border-gray-300"
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

          {/* Invoice Tab */}
          {reportType === 'invoice' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Daftar Invoice</h3>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden space-y-4">
                {filteredTransactions.map((transaction) => (
                  <div key={transaction.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-gray-800">{transaction.invoice}</p>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Pelanggan</span>
                        <span className="font-medium text-gray-900">
                          {transaction.customer}
                          <span className="text-xs text-gray-400 block">{transaction.phone}</span>
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2 mt-2">
                        <span className="text-gray-500">Total Tagihan</span>
                        <span className="font-bold text-gray-900">{formatCurrency(transaction.total)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pelanggan</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{transaction.customer}</div>
                            <div className="text-gray-500">{transaction.phone}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {transaction.invoice}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {formatCurrency(transaction.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Persediaan Tab */}
          {reportType === 'inventory' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Stok Persediaan</h3>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden space-y-4">
                {inventory
                  .filter(i => categoryFilter === 'all' || i.category === categoryFilter)
                  .map((item) => {
                    const stock = Number(item.stock) || 0;
                    const modalPerUnit = stock > 0 ? (Number(item.value) || 0) / stock : 0;
                    const totalModal = modalPerUnit * stock;

                    return (
                      <div
                        key={item.id}
                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50"
                        onClick={() => {
                          setSelectedStockProduct(item);
                          setShowStockHistoryModal(true);
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-gray-800 line-clamp-2">{item.name}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">{item.size} / {item.color}</p>
                          </div>
                          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ml-2">
                            Stok: {stock}
                          </span>
                        </div>
                        {isOwner && (
                          <div className="space-y-1 text-sm border-t pt-2 mt-2">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Modal/Unit</span>
                              <span className="text-gray-900">{formatCurrency(modalPerUnit)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 font-medium">Total Modal</span>
                              <span className="font-bold text-gray-900">{formatCurrency(totalModal)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warna</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stok</th>
                      {isOwner && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modal</th>}
                      {isOwner && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Modal</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {inventory
                      .filter(i => categoryFilter === 'all' || i.category === categoryFilter)
                      .map((item) => {
                        const stock = Number(item.stock) || 0;
                        const modalPerUnit = stock > 0 ? (Number(item.value) || 0) / stock : 0;
                        const totalModal = modalPerUnit * stock;

                        return (

                          <tr
                            key={item.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => {
                              setSelectedStockProduct(item);
                              setShowStockHistoryModal(true);
                            }}
                          >
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 flex items-center gap-2 group">
                              {item.name}
                              <div className="opacity-0 group-hover:opacity-100 bg-purple-100 p-1 rounded-full text-purple-600 transition-opacity">
                                <Package className="w-3 h-3" />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.size}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.color}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {stock}
                            </td>
                            {isOwner && (
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {formatCurrency(modalPerUnit)}
                              </td>
                            )}
                            {isOwner && (
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {formatCurrency(totalModal)}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
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
                    <span className="text-lg font-bold text-brand-primary">{formatCurrency(cashflowRecap.saldoAkhir)}</span>
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
                      <span className="font-bold text-brand-primary text-lg">{formatCurrency(transaction.total)}</span>
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
                  className="block w-full pl-10 pr-20 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                    ? 'text-blue-600 hover:text-blue-700 bg-blue-50 rounded-r-md border-l-4 border-l-blue-500'
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-blue-600 mb-4"></div>
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
                      className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
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