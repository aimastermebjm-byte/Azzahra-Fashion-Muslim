import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from './PageHeader';
import {
  Download, Calendar, BarChart3, PieChart, TrendingUp, TrendingDown, Package, Users,
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

  const financialBreakdown = useMemo(() => {
    const modalCost = filteredTransactions.reduce((sum, transaction) => {
      const transactionModal = transaction.totalModal || (transaction.subtotal * 0.6);
      return sum + transactionModal;
    }, 0);

    const pendapatanPenjualan = summaryStats.totalRevenue;
    const pendapatanOngkir = summaryStats.totalShipping;
    const pendapatanTotal = pendapatanPenjualan + pendapatanOngkir;

    const ongkirPembelian = cashFlow
      .filter(flow => flow.type === 'expense' && (flow.category || '').toLowerCase() === 'ongkir pembelian')
      .reduce((sum, flow) => sum + flow.amount, 0);

    const nonShippingExpenses = cashFlow.filter(
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
    const pembelian = profitLossStats.totalExpense;
    const penjualan = profitLossStats.totalIncome;
    const total = penjualan - pembelian;
    const saldoAkhir = saldoSebelum + total;

    return {
      saldoSebelum,
      pembelian,
      penjualan,
      total,
      saldoAkhir
    };
  }, [profitLossStats]);

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
      <PageHeader
        title="Laporan Penjualan"
        subtitle="Pantau performa penjualan, persediaan, dan arus kas dalam satu tempat"
        onBack={onBack}
        variant="gradient"
        align="between"
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-white">
            <p className="text-xs uppercase tracking-wide text-white/70">Periode</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { value: 'hari_ini', label: 'Hari ini' },
                { value: 'kemaren', label: 'Kemarin' },
                { value: 'bulan_ini', label: 'Bulan ini' },
                { value: 'bulan_kemaren', label: 'Bulan lalu' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDateFilter(option.value as any)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    dateFilter === option.value ? 'bg-white text-brand-primary shadow-sm' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                onClick={() => setDateFilter('custom')}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  dateFilter === 'custom' ? 'bg-white text-brand-primary shadow-sm' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Custom
              </button>
            </div>
            {dateFilter === 'custom' && (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl border border-white/20 bg-white/90 px-3 py-2 text-sm text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl border border-white/20 bg-white/90 px-3 py-2 text-sm text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-white">
            <p className="text-xs uppercase tracking-wide text-white/70">Status</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'Semua' },
                { value: 'lunas', label: 'Lunas' },
                { value: 'belum_lunas', label: 'Belum lunas' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setStatusFilter(option.value as any)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    statusFilter === option.value ? 'bg-white text-brand-primary shadow-sm' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-white">
            <p className="text-xs uppercase tracking-wide text-white/70">Cari Pelanggan</p>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/20 bg-white/90 px-3 py-2 text-brand-primary">
              <Search className="h-4 w-4 text-brand-primary" />
              <input
                type="text"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="w-full bg-transparent text-sm placeholder-brand-primary/60 focus:outline-none"
                placeholder="Nama atau no. HP"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-white">
            <p className="text-xs uppercase tracking-wide text-white/70">Filter Tambahan</p>
            <div className="mt-2 grid gap-2">
              <button
                onClick={() => exportToCSV(filteredTransactions, 'laporan_penjualan.csv')}
                className="flex items-center justify-between rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25"
              >
                <span>Ekspor data</span>
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setCustomerFilter('');
                  setDateFilter('bulan_ini');
                }}
                className="rounded-xl border border-white/30 px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-white hover:text-white"
              >
                Reset filter
              </button>
            </div>
          </div>
        </div>
      </PageHeader>

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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Laba</th>
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
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatCurrency(modal)}
                          </td>
                          <td className="px-4 py-3 text-sm text-green-600">
                            {formatCurrency(laba)}
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terjual</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Harga</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Laba</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {products.map((product) => {
                      const averagePrice = product.totalSold > 0 ? product.totalRevenue / product.totalSold : 0;
                      const modal = product.totalRevenue - product.profit;

                      return (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {product.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {product.totalSold}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatCurrency(averagePrice)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatCurrency(modal)}
                          </td>
                          <td className="px-4 py-3 text-sm text-brand-success">
                            {formatCurrency(product.profit)}
                          </td>
                        </tr>
                      );
                    })}
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stok</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Modal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {inventory.map((item) => {
                      const stock = Number(item.stock) || 0;
                      const modalPerUnit = stock > 0 ? (Number(item.value) || 0) / stock : 0;
                      const totalModal = modalPerUnit * stock;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {item.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {stock}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatCurrency(modalPerUnit)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatCurrency(totalModal)}
                          </td>
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
              <div className="card-elevated p-5 mb-6">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Saldo Sebelum</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(cashflowRecap.saldoSebelum)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Pembelian</span>
                    <span className="font-semibold text-brand-warning">{formatCurrency(cashflowRecap.pembelian)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Penjualan</span>
                    <span className="font-semibold text-brand-success">{formatCurrency(cashflowRecap.penjualan)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total</span>
                    <span className="font-semibold text-brand-primary">{formatCurrency(cashflowRecap.total)}</span>
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
                        <td className={`px-4 py-3 text-sm font-medium ${
                          flow.type === 'income' ? 'text-brand-success' : 'text-brand-warning'
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
                <h3 className="text-lg font-semibold text-gray-800">Laporan Rugi Laba</h3>
                <button
                  onClick={() => exportToCSV([], 'laporan_rugi_laba.csv')}
                  className="flex items-center space-x-2 btn-brand"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Export CSV</span>
                </button>
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

                <div className={`card-elevated p-6 border ${
                  financialBreakdown.labaRugi >= 0 ? 'border-brand-success/40' : 'border-brand-warning/40'
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