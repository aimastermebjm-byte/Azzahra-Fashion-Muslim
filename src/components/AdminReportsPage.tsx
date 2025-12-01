import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Download, Calendar, BarChart3, PieChart, TrendingUp, TrendingDown, Package, Users,
  FileText, DollarSign, Truck, Filter, Eye, CheckCircle, XCircle,
  ShoppingCart, ArrowUpRight, ArrowDownRight, Box, Wallet, PiggyBank,
  CreditCard, Search, ChevronDown
} from 'lucide-react';
import ReportsService from '../services/reportsService';
import {
  Transaction,
  ProductReport,
  InventoryReport,
  CashFlowReport
} from '../services/reportsService';

interface AdminReportsPageProps {
  onBack: () => void;
  user: any;
}

const AdminReportsPage: React.FC<AdminReportsPageProps> = ({ onBack, user }) => {
  // Report type untuk tab navigation
  const [reportType, setReportType] = useState<'sales' | 'products' | 'invoice' | 'inventory' | 'cashflow' | 'profitloss' | 'detail'>('sales');

  // Date filtering
  const [dateFilter, setDateFilter] = useState<'hari_ini' | 'kemaren' | 'bulan_ini' | 'bulan_kemaren' | 'custom'>('bulan_ini');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Additional filters for sales report
  const [statusFilter, setStatusFilter] = useState<'all' | 'lunas' | 'belum_lunas'>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('');

  // Data states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<ProductReport[]>([]);
  const [inventory, setInventory] = useState<InventoryReport[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Load real data from Firestore
  const loadTransactions = async () => {
    setLoading(true);
    try {
      const transactionData = await ReportsService.getTransactions({
        startDate: dateFilter === 'custom' ? startDate : undefined,
        endDate: dateFilter === 'custom' ? endDate : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        customerQuery: customerFilter || undefined,
        limit: 50 // Limit untuk performance
      });
      setTransactions(transactionData);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Load products report
  const loadProductsReport = async () => {
    setLoading(true);
    try {
      const productData = await ReportsService.getProductsReport({
        startDate: dateFilter === 'custom' ? startDate : undefined,
        endDate: dateFilter === 'custom' ? endDate : undefined,
        limit: 100 // Limit untuk performance
      });
      setProducts(productData);
    } catch (error) {
      console.error('Error loading products report:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Load inventory report
  const loadInventoryReport = async () => {
    setLoading(true);
    try {
      const inventoryData = await ReportsService.getInventoryReports();
      setInventory(inventoryData);
    } catch (error) {
      console.error('Error loading inventory report:', error);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  // Load cash flow report
  const loadCashFlowReport = async () => {
    setLoading(true);
    try {
      const cashFlowData = await ReportsService.getCashFlowReports({
        startDate: dateFilter === 'custom' ? startDate : undefined,
        endDate: dateFilter === 'custom' ? endDate : undefined,
        limit: 100 // Limit untuk performance
      });
      setCashFlow(cashFlowData);
    } catch (error) {
      console.error('Error loading cash flow report:', error);
      setCashFlow([]);
    } finally {
      setLoading(false);
    }
  };

  // Load summary statistics
  const loadSummaryStats = async () => {
    try {
      const stats = await ReportsService.getSummaryStats({
        startDate: dateFilter === 'custom' ? startDate : undefined,
        endDate: dateFilter === 'custom' ? endDate : undefined
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

  // Load data based on active report type
  useEffect(() => {
    const loadData = () => {
      switch (reportType) {
        case 'sales':
        case 'products':
          loadProductsReport();
          break;
        case 'invoice':
          loadTransactions();
          break;
        case 'inventory':
          loadInventoryReport();
          break;
        case 'cashflow':
          loadCashFlowReport();
          break;
        case 'profitloss':
          loadSummaryStats();
          break;
        case 'detail':
          loadTransactions();
          break;
        default:
          loadTransactions();
      }
    };

    loadData();
  }, [dateFilter, statusFilter, customerFilter, reportType]);

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

  // Load mock data
  const loadReportData = async () => {
    setLoading(true);
    try {
      // Mock transaction data
      const mockTransactions: TransactionData[] = [
        {
          id: '1',
          invoice: 'INV-2024-001',
          date: '2024-01-15',
          customer: 'Siti Nurhaliza',
          phone: '08123456789',
          subtotal: 500000,
          shippingCost: 20000,
          total: 520000,
          status: 'lunas',
          paymentMethod: 'Transfer',
          createdAt: new Date('2024-01-15T10:00:00'),
          products: [
            { name: 'Gamis Premium', quantity: 2, price: 250000, total: 500000 }
          ]
        },
        {
          id: '2',
          invoice: 'INV-2024-002',
          date: '2024-01-14',
          customer: 'Ahmad Fauzi',
          phone: '08234567890',
          subtotal: 350000,
          shippingCost: 15000,
          total: 365000,
          status: 'belum_lunas',
          createdAt: new Date('2024-01-14T14:30:00'),
          products: [
            { name: 'Khimar Syar\'i', quantity: 1, price: 350000, total: 350000 }
          ]
        },
        {
          id: '3',
          invoice: 'INV-2024-003',
          date: '2024-01-13',
          customer: 'Fatimah Azzahra',
          phone: '08345678901',
          subtotal: 450000,
          shippingCost: 18000,
          total: 468000,
          status: 'lunas',
          createdAt: new Date('2024-01-13T09:15:00'),
          products: [
            { name: 'Tunik Casual', quantity: 3, price: 150000, total: 450000 }
          ]
        }
      ];
      setTransactions(mockTransactions);

      // Mock product data
      const mockProducts: ProductData[] = [
        {
          id: '1',
          name: 'Gamis Premium',
          category: 'Gamis',
          sold: 15,
          revenue: 3750000,
          stock: 25,
          profit: 1250000,
          lastSold: new Date('2024-01-15T10:00:00')
        },
        {
          id: '2',
          name: 'Khimar Syar\'i',
          category: 'Khimar',
          sold: 8,
          revenue: 2800000,
          stock: 12,
          profit: 800000,
          lastSold: new Date('2024-01-14T14:30:00')
        }
      ];
      setProducts(mockProducts);

      // Mock inventory data
      const mockInventory: InventoryData[] = [
        {
          id: '1',
          name: 'Gamis Premium',
          category: 'Gamis',
          stock: 25,
          reserved: 3,
          available: 22,
          value: 6250000,
          lastUpdated: new Date()
        },
        {
          id: '2',
          name: 'Khimar Syar\'i',
          category: 'Khimar',
          stock: 12,
          reserved: 1,
          available: 11,
          value: 4200000,
          lastUpdated: new Date()
        }
      ];
      setInventory(mockInventory);

      // Mock cash flow data
      const mockCashFlow: CashFlowData[] = [
        {
          id: '1',
          date: '2024-01-15',
          description: 'Penjualan Gamis Premium',
          type: 'income',
          amount: 520000,
          category: 'Penjualan',
          createdAt: new Date('2024-01-15T10:00:00')
        },
        {
          id: '2',
          date: '2024-01-14',
          description: 'Pembelian Bahan Baku',
          type: 'expense',
          amount: 1500000,
          category: 'Operasional',
          createdAt: new Date('2024-01-14T09:00:00')
        }
      ];
      setCashFlow(mockCashFlow);

    } catch (error) {
      console.error('Error loading reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [getDateRange]);

  // Filter transactions based on filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      const matchesDate = transaction.date >= getDateRange.start && transaction.date <= getDateRange.end;
      const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
      const matchesCustomer = !customerFilter ||
        transaction.customer.toLowerCase().includes(customerFilter.toLowerCase()) ||
        transaction.phone.includes(customerFilter);

      return matchesDate && matchesStatus && matchesCustomer;
    });
  }, [transactions, getDateRange, statusFilter, customerFilter]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.subtotal, 0);
    const totalShipping = filteredTransactions.reduce((sum, t) => sum + t.shippingCost, 0);
    const totalSales = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
    const lunasCount = filteredTransactions.filter(t => t.status === 'lunas').length;
    const belumLunasCount = filteredTransactions.filter(t => t.status === 'belum_lunas').length;
    const totalBelumLunas = filteredTransactions
      .filter(t => t.status === 'belum_lunas')
      .reduce((sum, t) => sum + t.total, 0);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Memuat data laporan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6" />
            <h1 className="text-xl font-bold">Laporan Penjualan</h1>
          </div>
          <button
            onClick={onBack}
            className="bg-white/20 px-3 py-1 rounded-full text-sm hover:bg-white/30 transition-colors"
          >
            Kembali
          </button>
        </div>

        {/* Date and Status Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Date Filter */}
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full pl-10 pr-4 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-white/50 appearance-none"
            >
              <option value="hari_ini">Hari Ini</option>
              <option value="kemaren">Kemaren</option>
              <option value="bulan_ini">Bulan Ini</option>
              <option value="bulan_kemaren">Bulan Kemaren</option>
              <option value="custom">Custom Tanggal</option>
            </select>
            <Calendar className="absolute left-3 top-3 text-gray-400 w-5 h-5 pointer-events-none" />
          </div>

          {/* Custom Date Range */}
          {dateFilter === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="Dari tanggal"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="Sampai tanggal"
              />
            </>
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            <option value="all">Semua Status</option>
            <option value="lunas">Lunas</option>
            <option value="belum_lunas">Belum Lunas</option>
          </select>

          {/* Customer Filter */}
          <input
            type="text"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="px-3 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-white/50"
            placeholder="Cari pelanggan..."
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
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
              <div className="bg-green-100 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Lunas</p>
                <p className="text-xl font-bold text-green-600">
                  {summaryStats.lunasCount}
                </p>
                <p className="text-xs text-gray-500">
                  {formatCurrency(summaryStats.totalSales - summaryStats.totalBelumLunas)}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Belum Lunas</p>
                <p className="text-xl font-bold text-orange-600">
                  {summaryStats.belumLunasCount}
                </p>
                <p className="text-xs text-gray-500">
                  {formatCurrency(summaryStats.totalBelumLunas)}
                </p>
              </div>
              <div className="bg-orange-100 p-3 rounded-full">
                <XCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Rata-rata</p>
                <p className="text-xl font-bold text-gray-800">
                  {formatCurrency(summaryStats.averageTransaction)}
                </p>
                <p className="text-xs text-gray-500">per transaksi</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-md mb-4">
          <div className="flex space-x-1 p-1 overflow-x-auto">
            {[
              { id: 'sales', label: 'Penjualan', icon: FileText },
              { id: 'products', label: 'Produk Terjual', icon: Package },
              { id: 'invoice', label: 'Invoice', icon: FileText },
              { id: 'inventory', label: 'Persediaan', icon: Box },
              { id: 'cashflow', label: 'Arus Kas', icon: Wallet },
              { id: 'profitloss', label: 'Rugi Laba', icon: TrendingUp },
              { id: 'detail', label: 'Detail', icon: Eye }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setReportType(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                  reportType === tab.id
                    ? 'bg-pink-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-md">
          {/* Penjualan Tab */}
          {reportType === 'sales' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Laporan Penjualan</h3>
                <button
                  onClick={() => exportToCSV(filteredTransactions, 'laporan_penjualan.csv')}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Export CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pelanggan</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ongkir</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Laba</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTransactions.map((transaction) => {
                      const modal = transaction.subtotal * 0.7; // Estimasi 70% modal
                      const laba = transaction.subtotal - modal;

                      return (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {transaction.invoice}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {transaction.date}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div>
                              <div className="font-medium">{transaction.customer}</div>
                              <div className="text-gray-500">{transaction.phone}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatCurrency(transaction.subtotal)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatCurrency(transaction.shippingCost)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {formatCurrency(transaction.total)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatCurrency(modal)}
                          </td>
                          <td className="px-4 py-3 text-sm text-green-600">
                            {formatCurrency(laba)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              transaction.status === 'lunas'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {transaction.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                            </span>
                          </td>
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
                <h3 className="text-lg font-semibold text-gray-800">Laporan Produk Terjual</h3>
                <button
                  onClick={() => exportToCSV(products, 'laporan_produk.csv')}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Export CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terjual</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stok</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {product.category}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {product.totalSold}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatCurrency(product.totalRevenue)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {product.stock}
                        </td>
                        <td className="px-4 py-3 text-sm text-green-600">
                          {formatCurrency(product.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Invoice Tab */}
          {reportType === 'invoice' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Laporan Invoice Pelanggan</h3>
                <button
                  onClick={() => exportToCSV(filteredTransactions, 'laporan_invoice.csv')}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Export CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pelanggan</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {transaction.invoice}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {transaction.date}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{transaction.customer}</div>
                            <div className="text-gray-500">{transaction.phone}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {formatCurrency(transaction.total)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.status === 'lunas'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {transaction.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button className="text-blue-600 hover:text-blue-800">
                            <Eye className="w-4 h-4" />
                          </button>
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
                <h3 className="text-lg font-semibold text-gray-800">Laporan Persediaan</h3>
                <button
                  onClick={() => exportToCSV(inventory, 'laporan_persediaan.csv')}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Export CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stok</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reserved</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {inventory.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {item.category}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.stock}
                        </td>
                        <td className="px-4 py-3 text-sm text-orange-600">
                          {item.reserved}
                        </td>
                        <td className="px-4 py-3 text-sm text-green-600">
                          {item.available}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatCurrency(item.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Arus Kas Tab */}
          {reportType === 'cashflow' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Laporan Arus Kas</h3>
                <button
                  onClick={() => exportToCSV(cashFlow, 'laporan_arus_kas.csv')}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Export CSV</span>
                </button>
              </div>

              {/* Summary Cards for Cash Flow */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <ArrowUpRight className="w-8 h-8 text-green-600 mr-3" />
                    <div>
                      <p className="text-sm text-green-600 font-medium">Pemasukan</p>
                      <p className="text-xl font-bold text-green-700">
                        {formatCurrency(profitLossStats.totalIncome)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <ArrowDownRight className="w-8 h-8 text-red-600 mr-3" />
                    <div>
                      <p className="text-sm text-red-600 font-medium">Pengeluaran</p>
                      <p className="text-xl font-bold text-red-700">
                        {formatCurrency(profitLossStats.totalExpense)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`border rounded-lg p-4 ${
                  profitLossStats.profit >= 0
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-orange-50 border-orange-200'
                }`}>
                  <div className="flex items-center">
                    {profitLossStats.profit >= 0 ? (
                      <TrendingUp className="w-8 h-8 text-blue-600 mr-3" />
                    ) : (
                      <TrendingDown className="w-8 h-8 text-orange-600 mr-3" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${
                        profitLossStats.profit >= 0 ? 'text-blue-600' : 'text-orange-600'
                      }`}>
                        {profitLossStats.profit >= 0 ? 'Laba Bersih' : 'Rugi Bersih'}
                      </p>
                      <p className={`text-xl font-bold ${
                        profitLossStats.profit >= 0 ? 'text-blue-700' : 'text-orange-700'
                      }`}>
                        {formatCurrency(Math.abs(profitLossStats.profit))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deskripsi</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
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
                          {flow.category}
                        </td>
                        <td className={`px-4 py-3 text-sm font-medium ${
                          flow.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {flow.type === 'income' ? '+' : '-'}{formatCurrency(flow.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            flow.type === 'income'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {flow.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                          </span>
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
                <h3 className="text-lg font-semibold text-gray-800">Laporan Rugi Laba</h3>
                <button
                  onClick={() => exportToCSV([], 'laporan_rugi_laba.csv')}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Export CSV</span>
                </button>
              </div>

              {/* Profit/Loss Summary */}
              <div className="bg-white border rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Ringkasan Rugi Laba</h4>

                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600">Total Pemasukan</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(profitLossStats.totalIncome)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600">Total Pengeluaran</span>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(profitLossStats.totalExpense)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-3">
                    <span className="text-lg font-semibold text-gray-800">
                      {profitLossStats.profit >= 0 ? 'Laba Bersih' : 'Rugi Bersih'}
                    </span>
                    <span className={`text-xl font-bold ${
                      profitLossStats.profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {profitLossStats.profit >= 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(profitLossStats.profit))}
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Margin Profit</span>
                      <span className={`font-semibold ${
                        profitLossStats.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {profitLossStats.profitMargin.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Income Breakdown */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h5 className="font-semibold text-green-800 mb-3">Rincian Pemasukan</h5>
                    <div className="space-y-2">
                      {cashFlow
                        .filter(c => c.type === 'income')
                        .map((income) => (
                          <div key={income.id} className="flex justify-between text-sm">
                            <span className="text-gray-600">{income.description}</span>
                            <span className="text-green-700 font-medium">
                              {formatCurrency(income.amount)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Expense Breakdown */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h5 className="font-semibold text-red-800 mb-3">Rincian Pengeluaran</h5>
                    <div className="space-y-2">
                      {cashFlow
                        .filter(c => c.type === 'expense')
                        .map((expense) => (
                          <div key={expense.id} className="flex justify-between text-sm">
                            <span className="text-gray-600">{expense.description}</span>
                            <span className="text-red-700 font-medium">
                              {formatCurrency(expense.amount)}
                            </span>
                          </div>
                        ))}
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
                <h3 className="text-lg font-semibold text-gray-800">Laporan Detail Transaksi</h3>
                <button
                  onClick={() => exportToCSV(filteredTransactions, 'laporan_detail.csv')}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Export CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pelanggan</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Harga</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
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
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {formatCurrency(item.total)}
                          </td>
                          {index === 0 && (
                            <td className="px-4 py-3 text-sm" rowSpan={transaction.items.length}>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                transaction.status === 'lunas'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
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
    </div>
  );
};

export default AdminReportsPage;