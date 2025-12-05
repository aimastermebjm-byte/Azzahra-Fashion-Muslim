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
      const { start, end } = getDateRange;
      const productData = await ReportsService.getProductsReport({
        startDate: start,
        endDate: end,
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
      const { start, end } = getDateRange;
      const cashFlowData = await ReportsService.getCashFlowReports({
        startDate: start,
        endDate: end,
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

  // Load data based on active report type
  useEffect(() => {
    const loadData = async () => {
      switch (reportType) {
        case 'sales':
        case 'invoice':
        case 'detail':
          await loadTransactions();
          break;
        case 'products':
          await loadProductsReport();
          break;
        case 'inventory':
          await loadInventoryReport();
          break;
        case 'cashflow':
          await loadCashFlowReport();
          break;
        case 'profitloss':
          await loadCashFlowReport();
          await loadSummaryStats();
          break;
        default:
          await loadTransactions();
      }
    };

    loadData();
  }, [reportType, statusFilter, customerFilter, getDateRange.start, getDateRange.end]);

  // Remove mock loader - rely on real data above

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
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-accent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Memuat data laporan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface">
      {/* Header */}
      <div className="bg-brand-gradient text-white p-6 shadow-brand-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6" />
            <h1 className="text-xl font-bold">Laporan Penjualan</h1>
          </div>
          <button
            onClick={onBack}
            className="bg-white/15 px-4 py-2 rounded-full text-sm font-semibold hover:bg-white/25 transition-colors"
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
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/50 appearance-none"
            >
              <option value="hari_ini">Hari Ini</option>
              <option value="kemaren">Kemaren</option>
              <option value="bulan_ini">Bulan Ini</option>
              <option value="bulan_kemaren">Bulan Kemaren</option>
              <option value="custom">Custom Tanggal</option>
            </select>
            <Calendar className="absolute left-3 top-3 text-white/70 w-5 h-5 pointer-events-none" />
          </div>

          {/* Custom Date Range */}
          {dateFilter === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-3 rounded-2xl bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="Dari tanggal"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-3 rounded-2xl bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="Sampai tanggal"
              />
            </>
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-3 rounded-2xl bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
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
            className="px-3 py-3 rounded-2xl bg-white/10 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
            placeholder="Cari pelanggan..."
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="p-4">
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
                    ? 'bg-brand-accent text-white shadow-brand-card'
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
                  className="flex items-center space-x-2 btn-brand"
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
                      const modal = transaction.totalModal || (transaction.subtotal * 0.6); // Use real modal or fallback 60%
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
                            <span className={transaction.status === 'lunas' ? 'badge-brand-success' : 'badge-brand-warning'}>
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
                  className="flex items-center space-x-2 btn-brand"
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
                          {product.name}
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
                  className="flex items-center space-x-2 btn-brand"
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
                          <span className={transaction.status === 'lunas' ? 'badge-brand-success' : 'badge-brand-warning'}>
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
                  className="flex items-center space-x-2 btn-brand"
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
                        <td className="px-4 py-3 text-sm text-brand-warning">
                          {item.reserved}
                        </td>
                        <td className="px-4 py-3 text-sm text-brand-success">
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
                  className="flex items-center space-x-2 btn-brand"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Export CSV</span>
                </button>
              </div>

              {/* Summary Cards for Cash Flow */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card-elevated border border-brand-success/30">
                  <div className="flex items-center">
                    <ArrowUpRight className="w-8 h-8 text-brand-success mr-3" />
                    <div>
                      <p className="text-sm text-brand-success font-medium">Pemasukan</p>
                      <p className="text-xl font-bold text-brand-success">
                        {formatCurrency(profitLossStats.totalIncome)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated border border-brand-warning/30">
                  <div className="flex items-center">
                    <ArrowDownRight className="w-8 h-8 text-brand-warning mr-3" />
                    <div>
                      <p className="text-sm text-brand-warning font-medium">Pengeluaran</p>
                      <p className="text-xl font-bold text-brand-warning">
                        {formatCurrency(profitLossStats.totalExpense)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`card-elevated border ${
                  profitLossStats.profit >= 0
                    ? 'border-brand-accent/40'
                    : 'border-brand-warning/40'
                }`}>
                  <div className="flex items-center">
                    {profitLossStats.profit >= 0 ? (
                      <TrendingUp className="w-8 h-8 text-brand-accent mr-3" />
                    ) : (
                      <TrendingDown className="w-8 h-8 text-brand-warning mr-3" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${
                        profitLossStats.profit >= 0 ? 'text-brand-accent' : 'text-brand-warning'
                      }`}>
                        {profitLossStats.profit >= 0 ? 'Laba Bersih' : 'Rugi Bersih'}
                      </p>
                      <p className={`text-xl font-bold ${
                        profitLossStats.profit >= 0 ? 'text-brand-accent' : 'text-brand-warning'
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
                          flow.type === 'income' ? 'text-brand-success' : 'text-brand-warning'
                        }`}>
                          {flow.type === 'income' ? '+' : '-'}{formatCurrency(flow.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={flow.type === 'income' ? 'badge-brand-success' : 'badge-brand-warning'}>
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
                  className="flex items-center space-x-2 btn-brand"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Export CSV</span>
                </button>
              </div>

              {/* Profit/Loss Summary */}
              <div className="card-elevated p-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Ringkasan Rugi Laba</h4>

                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600">Total Pemasukan</span>
                    <span className="font-semibold text-brand-success">
                      {formatCurrency(profitLossStats.totalIncome)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600">Total Pengeluaran</span>
                    <span className="font-semibold text-brand-warning">
                      {formatCurrency(profitLossStats.totalExpense)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-3">
                    <span className="text-lg font-semibold text-gray-800">
                      {profitLossStats.profit >= 0 ? 'Laba Bersih' : 'Rugi Bersih'}
                    </span>
                    <span className={`text-xl font-bold ${
                      profitLossStats.profit >= 0 ? 'text-brand-success' : 'text-brand-warning'
                    }`}>
                      {profitLossStats.profit >= 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(profitLossStats.profit))}
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Margin Profit</span>
                      <span className={`font-semibold ${
                        profitLossStats.profitMargin >= 0 ? 'text-brand-success' : 'text-brand-warning'
                      }`}>
                        {profitLossStats.profitMargin.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Income Breakdown */}
                  <div className="card-elevated border border-brand-success/30">
                    <h5 className="font-semibold text-brand-success mb-3">Rincian Pemasukan</h5>
                    <div className="space-y-2">
                      {cashFlow
                        .filter(c => c.type === 'income')
                        .map((income) => (
                          <div key={income.id} className="flex justify-between text-sm">
                            <span className="text-gray-600">{income.description}</span>
                            <span className="text-brand-success font-medium">
                              {formatCurrency(income.amount)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Expense Breakdown */}
                  <div className="card-elevated border border-brand-warning/30">
                    <h5 className="font-semibold text-brand-warning mb-3">Rincian Pengeluaran</h5>
                    <div className="space-y-2">
                      {cashFlow
                        .filter(c => c.type === 'expense')
                        .map((expense) => (
                          <div key={expense.id} className="flex justify-between text-sm">
                            <span className="text-gray-600">{expense.description}</span>
                            <span className="text-brand-warning font-medium">
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
                  className="flex items-center space-x-2 btn-brand"
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Harga</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Laba</th>
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
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatCurrency(item.modal || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {formatCurrency(item.total)}
                          </td>
                          <td className="px-4 py-3 text-sm text-green-600">
                            {formatCurrency(item.total - (item.modal || 0) * item.quantity)}
                          </td>
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
    </div>
  );
};

export default AdminReportsPage;