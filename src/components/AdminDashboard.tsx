import React, { useState } from 'react';
import { ArrowLeft, Package, DollarSign, Users, TrendingUp, Clock, CheckCircle, Truck, XCircle, Eye, CreditCard as Edit, Search, Filter, Calendar, Download, PieChart, BarChart3, Star } from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';
import FlashSaleManagement from './FlashSaleManagement';
import FeaturedProductsManagement from './FeaturedProductsManagement';

interface AdminDashboardProps {
  onBack: () => void;
  user: any;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, user }) => {
  // Debug log
  console.log('AdminDashboard rendered - User role:', user?.role);
  console.log('User object:', user);
  console.log('Is owner?', user?.role === 'owner');
  console.log('Tabs to show:', user?.role === 'owner' ? ['overview', 'orders', 'reports', 'featured', 'flashsale'] : ['overview', 'orders', 'reports']);

  const {
    orders,
    updateOrderStatus,
    updateOrderPayment,
    getOrdersByStatus,
    getTotalRevenue,
    getTodayOrders
  } = useAdmin();

  const [activeTab, setActiveTab] = useState('overview');
  const [reportType, setReportType] = useState('sales'); // sales, products, inventory, cashflow, profit-loss
  const [reportPeriod, setReportPeriod] = useState('today');
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [productFilter, setProductFilter] = useState('all'); // all, category, product
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('delivered');
  const [userFilter, setUserFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [showFlashSaleManagement, setShowFlashSaleManagement] = useState(false);
  const [showFeaturedManagement, setShowFeaturedManagement] = useState(false);

  const statusConfig = {
    pending: { label: 'Menunggu Pembayaran', icon: Clock, color: 'text-orange-600 bg-orange-100' },
    awaiting_verification: { label: 'Menunggu Verifikasi', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
    paid: { label: 'Dibayar', icon: CheckCircle, color: 'text-blue-600 bg-blue-100' },
    processing: { label: 'Diproses', icon: Package, color: 'text-purple-600 bg-purple-100' },
    shipped: { label: 'Dikirim', icon: Truck, color: 'text-indigo-600 bg-indigo-100' },
    delivered: { label: 'Selesai', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
    cancelled: { label: 'Dibatalkan', icon: XCircle, color: 'text-red-600 bg-red-100' }
  };

  const stats = {
    totalOrders: orders.length,
    todayOrders: getTodayOrders().length,
    totalRevenue: getTotalRevenue(),
    pendingOrders: getOrdersByStatus('pending').length,
    awaitingVerification: getOrdersByStatus('awaiting_verification').length,
    processingOrders: getOrdersByStatus('processing').length,
    completedOrders: getOrdersByStatus('delivered').length
  };

  // Report calculations
  const getReportData = () => {
    const now = new Date();
    let startDate = new Date();
    
    switch (reportPeriod) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    const filteredOrders = orders.filter(order => order.createdAt >= startDate);
    const completedOrders = filteredOrders.filter(order => order.status === 'delivered');
    
    // Sales Report
    const totalSales = completedOrders.reduce((sum, order) => sum + order.finalTotal, 0);
    const totalOrders = filteredOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    // Product Report
    const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
    completedOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            name: item.productName,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.total;
      });
    });
    
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    
    // Customer Report
    const customerData: { [key: string]: { name: string; orders: number; revenue: number } } = {};
    completedOrders.forEach(order => {
      if (!customerData[order.userId]) {
        customerData[order.userId] = {
          name: order.userName,
          orders: 0,
          revenue: 0
        };
      }
      customerData[order.userId].orders += 1;
      customerData[order.userId].revenue += order.finalTotal;
    });
    
    const topCustomers = Object.values(customerData)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    
    // Status breakdown
    const statusBreakdown = {
      pending: filteredOrders.filter(o => o.status === 'pending').length,
      awaiting_verification: filteredOrders.filter(o => o.status === 'awaiting_verification').length,
      paid: filteredOrders.filter(o => o.status === 'paid').length,
      processing: filteredOrders.filter(o => o.status === 'processing').length,
      shipped: filteredOrders.filter(o => o.status === 'shipped').length,
      delivered: filteredOrders.filter(o => o.status === 'delivered').length,
      cancelled: filteredOrders.filter(o => o.status === 'cancelled').length
    };
    
    return {
      totalSales,
      totalOrders,
      avgOrderValue,
      topProducts,
      topCustomers,
      statusBreakdown,
      completedOrdersCount: completedOrders.length
    };
  };
  
  const reportData = getReportData();
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.userName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (showFlashSaleManagement) {
    return <FlashSaleManagement onBack={() => setShowFlashSaleManagement(false)} />;
  }

  if (showFeaturedManagement) {
    return <FeaturedProductsManagement onBack={() => setShowFeaturedManagement(false)} />;
  }

  const handleStatusUpdate = (orderId: string, newStatus: any) => {
    updateOrderStatus(orderId, newStatus);
    setSelectedOrder(null);
  };

  // Get filtered orders for reports
  const getFilteredOrdersForReport = () => {
    const start = new Date(reportStartDate);
    const end = new Date(reportEndDate);
    end.setHours(23, 59, 59, 999);
    
    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      const matchesDate = orderDate >= start && orderDate <= end;
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesUser = userFilter === 'all' || order.userId === userFilter;
      const matchesPayment = paymentMethodFilter === 'all' || order.paymentMethod === paymentMethodFilter;
      
      return matchesDate && matchesStatus && matchesUser && matchesPayment;
    });
  };

  // Sales Report Data
  const getSalesReportData = () => {
    const filteredOrders = getFilteredOrdersForReport();
    return filteredOrders.map(order => ({
      invoice: order.id,
      date: order.createdAt.toLocaleDateString('id-ID'),
      subtotal: order.totalAmount,
      modal: order.items.reduce((sum, item) => sum + (item.quantity * 45000), 0), // Mock cost price
      laba: order.totalAmount - order.items.reduce((sum, item) => sum + (item.quantity * 45000), 0)
    }));
  };

  // Products Report Data
  const getProductsReportData = () => {
    const filteredOrders = getFilteredOrdersForReport();
    const productSales: { [key: string]: any } = {};
    
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const key = productFilter === 'category' ? item.productName.split(' ')[0] : item.productName;
        if (!productSales[key]) {
          productSales[key] = {
            product: key,
            quantity: 0,
            harga: item.price,
            modal: 45000, // Mock cost price
            laba: 0
          };
        }
        productSales[key].quantity += item.quantity;
        productSales[key].laba += (item.price - 45000) * item.quantity;
      });
    });
    
    return Object.values(productSales);
  };

  // Inventory Report Data
  const getInventoryReportData = () => {
    // Mock inventory data - in real app, this would come from products
    const mockInventory = [
      { product: 'Hijab Segi Empat Premium', stok: 25, modal: 45000, category: 'hijab' },
      { product: 'Gamis Syari Elegant', stok: 15, modal: 150000, category: 'gamis' },
      { product: 'Khimar Instant Premium', stok: 8, modal: 70000, category: 'khimar' },
      { product: 'Tunik Casual Modern', stok: 20, modal: 110000, category: 'tunik' },
      { product: 'Abaya Dubai Premium', stok: 12, modal: 220000, category: 'abaya' },
      { product: 'Hijab Pashmina Silk', stok: 30, modal: 55000, category: 'hijab' }
    ];
    
    if (categoryFilter === 'all') {
      return mockInventory;
    }
    return mockInventory.filter(item => item.category === categoryFilter);
  };

  // Cash Flow Report Data
  const getCashFlowReportData = () => {
    const filteredOrders = getFilteredOrdersForReport();
    const previousBalance = 5000000; // Mock previous balance
    const totalSales = filteredOrders.reduce((sum, order) => sum + order.finalTotal, 0);
    
    return {
      previousBalance,
      sales: totalSales,
      total: previousBalance + totalSales,
      finalBalance: previousBalance + totalSales,
      transactions: filteredOrders.map(order => ({
        invoice: order.id,
        date: order.createdAt.toLocaleDateString('id-ID'),
        amount: order.finalTotal,
        method: order.paymentMethod === 'transfer' ? 'Transfer' : 'Cash'
      }))
    };
  };

  // Profit Loss Report Data
  const getProfitLossReportData = () => {
    const filteredOrders = getFilteredOrdersForReport().filter(order => order.status === 'delivered');
    const totalSales = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalCost = filteredOrders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum, item) => itemSum + (item.quantity * 45000), 0), 0
    );
    const totalShipping = filteredOrders.reduce((sum, order) => sum + order.shippingCost, 0);
    const operationalCost = 500000; // Mock operational cost
    
    const totalRevenue = totalSales + totalShipping;
    const totalExpenses = totalCost + totalShipping + operationalCost;
    const profitLoss = totalRevenue - totalExpenses;
    
    return {
      revenue: {
        sales: totalSales,
        modal: totalCost,
        shipping: totalShipping,
        total: totalRevenue
      },
      expenses: {
        shipping: totalShipping,
        operational: operationalCost,
        total: totalExpenses
      },
      profitLoss
    };
  };
  if (selectedOrder) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="flex items-center p-4">
            <button onClick={() => setSelectedOrder(null)} className="mr-4">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-lg font-semibold">Detail Pesanan #{selectedOrder.id}</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Order Status */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-semibold mb-3">Status Pesanan</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(statusConfig)
                .filter(([status]) => {
                  // Owner can access all statuses
                  if (user?.role === 'owner') return true;
                  // Admin can only access processing, shipped, delivered, cancelled
                  // Admin cannot verify payments or set to paid
                  if (user?.role === 'admin') {
                    return ['processing', 'shipped', 'delivered', 'cancelled'].includes(status);
                  }
                  return true;
                })
                .map(([status, config]) => {
                const StatusIcon = config.icon;
                const isDisabled = user?.role === 'admin' && 
                  (['processing', 'shipped', 'delivered', 'cancelled'].includes(status) && 
                   selectedOrder.status !== 'paid');
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusUpdate(selectedOrder.id, status)}
                    disabled={isDisabled}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedOrder.status === status
                        ? 'border-pink-500 bg-pink-50'
                        : isDisabled
                          ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <StatusIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">{config.label}</span>
                      {isDisabled && selectedOrder.status !== 'paid' && (
                        <span className="text-xs text-gray-400">(Belum Diverifikasi)</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {user?.role === 'admin' && selectedOrder.status !== 'paid' && (
              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-yellow-800 text-sm font-medium">⚠️ Pesanan harus diverifikasi Owner terlebih dahulu</p>
              </div>
            )}
          </div>

          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-semibold mb-3">Informasi Pelanggan</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Nama:</span>
                <span className="font-medium">{selectedOrder.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium">{selectedOrder.userEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Telepon:</span>
                <span className="font-medium">{selectedOrder.shippingInfo.phone}</span>
              </div>
            </div>
          </div>

          {/* Shipping Info */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-semibold mb-3">Informasi Pengiriman</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Alamat:</span>
                <p className="font-medium mt-1">{selectedOrder.shippingInfo.address}</p>
              </div>
              {selectedOrder.shippingInfo.isDropship && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-blue-800 font-medium text-sm">Dropship Order</p>
                  <p className="text-blue-600 text-sm">
                    Pengirim: {selectedOrder.shippingInfo.dropshipName} ({selectedOrder.shippingInfo.dropshipPhone})
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-semibold mb-3">Produk Pesanan</h3>
            <div className="space-y-3">
              {selectedOrder.items.map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex-1">
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-sm text-gray-600">
                      {item.selectedVariant.size} - {item.selectedVariant.color} × {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">Rp {item.total.toLocaleString('id-ID')}</p>
                    <p className="text-sm text-gray-600">@Rp {item.price.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-semibold mb-3">Ringkasan Pembayaran</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rp {selectedOrder.totalAmount.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Ongkir:</span>
                <span>Rp {selectedOrder.shippingCost.toLocaleString('id-ID')}</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span className="text-pink-600">Rp {selectedOrder.finalTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span>Metode Pembayaran:</span>
                <span className="capitalize">{selectedOrder.paymentMethod === 'transfer' ? 'Transfer Bank' : 'Cash on Delivery'}</span>
              </div>
              {selectedOrder.paymentProof && (
                <div className="border-t pt-2 mt-2">
                  <span className="text-gray-600 block mb-2">Bukti Pembayaran:</span>
                  {selectedOrder.paymentProof && !selectedOrder.paymentProofUrl && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
                      <p className="text-yellow-800 text-sm font-medium">⏳ Bukti pembayaran telah diupload</p>
                      <p className="text-yellow-600 text-xs">File: {selectedOrder.paymentProof}</p>
                      <p className="text-yellow-600 text-xs">Menunggu verifikasi admin</p>
                    </div>
                  )}
                  {selectedOrder.paymentProofUrl && (
                    <div>
                      <img 
                        src={selectedOrder.paymentProofUrl || 'https://images.pexels.com/photos/4386321/pexels-photo-4386321.jpeg?auto=compress&cs=tinysrgb&w=400'} 
                        alt="Bukti Pembayaran" 
                        className="w-full max-w-xs rounded-lg border"
                      />
                      <p className="text-xs text-gray-500 mt-1">{selectedOrder.paymentProof}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Terakhir diupdate: {selectedOrder.updatedAt.toLocaleString('id-ID')}
                      </p>
                      <div className="mt-2">
                        {(selectedOrder.status === 'awaiting_verification') && user?.role === 'owner' && (
                          <button
                            onClick={() => handleStatusUpdate(selectedOrder.id, 'paid')}
                            className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                          >
                            ✅ Verifikasi Pembayaran
                          </button>
                        )}
                        {(selectedOrder.status === 'awaiting_verification') && user?.role === 'admin' && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <p className="text-yellow-800 text-sm font-medium">⚠️ Hanya Owner yang dapat memverifikasi pembayaran</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
          <div className="w-10"></div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5" />
              <div>
                <p className="text-sm opacity-90">Total Pesanan</p>
                <p className="text-lg font-bold">{stats.totalOrders}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5" />
              <div>
                <p className="text-sm opacity-90">Total Revenue</p>
                <p className="text-lg font-bold">Rp {(stats.totalRevenue / 1000000).toFixed(1)}M</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/10 rounded-lg p-2">
            <p className="text-xs opacity-90">Hari Ini</p>
            <p className="font-bold">{stats.todayOrders}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2">
            <p className="text-xs opacity-90">Verifikasi</p>
            <p className="font-bold">{stats.awaitingVerification}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2">
            <p className="text-xs opacity-90">Selesai</p>
            <p className="font-bold">{stats.completedOrders}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow-sm">
        <div className="flex overflow-x-auto px-4">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'orders', label: 'Pesanan' },
            { id: 'reports', label: 'Laporan' },
            ...(user?.role === 'owner' ? [
              { id: 'featured', label: 'Produk Unggulan' },
              { id: 'flashsale', label: 'Flash Sale' }
            ] : [])
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-pink-500 text-pink-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Recent Orders */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold mb-3">Pesanan Terbaru</h3>
              <div className="space-y-3">
                {orders.slice(0, 5).map((order) => {
                  const statusInfo = statusConfig[order.status as keyof typeof statusConfig];
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <div key={order.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">#{order.id}</p>
                        <p className="text-sm text-gray-600">{order.userName}</p>
                        <p className="text-sm font-semibold text-pink-600">
                          Rp {order.finalTotal.toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          <span>{statusInfo.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {order.createdAt.toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Search and Filter */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex space-x-3 mb-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Cari pesanan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                >
                  <option value="all">Semua Status</option>
                  {Object.entries(statusConfig).map(([status, config]) => (
                    <option key={status} value={status}>{config.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Orders List */}
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const statusInfo = statusConfig[order.status as keyof typeof statusConfig];
                const StatusIcon = statusInfo.icon;
                
                return (
                  <div key={order.id} className="bg-white rounded-lg shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold">#{order.id}</p>
                        <p className="text-sm text-gray-600">{order.userName} • {order.userEmail}</p>
                        <p className="text-xs text-gray-500">{order.createdAt.toLocaleDateString('id-ID')}</p>
                      </div>
                      <div className="text-right">
                        <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          <span>{statusInfo.label}</span>
                        </div>
                        <p className="text-sm font-semibold text-pink-600 mt-1">
                          Rp {order.finalTotal.toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        {order.items.length} item • {order.paymentMethod === 'transfer' ? 'Transfer' : 'COD'}
                      </div>
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="flex items-center space-x-1 text-pink-600 hover:text-pink-700 text-sm font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Detail</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-4">
            {/* Report Controls */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Laporan</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  >
                    <option value="sales">Laporan Penjualan</option>
                    <option value="products">Laporan Produk Terjual</option>
                    <option value="inventory">Laporan Persediaan</option>
                    <option value="cashflow">Laporan Arus Kas</option>
                    <option value="profit-loss">Laporan Rugi Laba</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Akhir</label>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              {/* Additional Filters */}
              {(reportType === 'products' || reportType === 'cashflow') && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  {reportType === 'products' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        >
                          <option value="all">Semua Status</option>
                          <option value="delivered">Selesai</option>
                          <option value="processing">Diproses</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                        <select
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        >
                          <option value="all">Semua Kategori</option>
                          <option value="hijab">Hijab</option>
                          <option value="gamis">Gamis</option>
                          <option value="khimar">Khimar</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                        <select
                          value={userFilter}
                          onChange={(e) => setUserFilter(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        >
                          <option value="all">Semua User</option>
                          <option value="1">Customer</option>
                          <option value="2">Reseller</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tampilan</label>
                        <select
                          value={productFilter}
                          onChange={(e) => setProductFilter(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        >
                          <option value="all">Per Produk</option>
                          <option value="category">Per Kategori</option>
                        </select>
                      </div>
                    </>
                  )}
                  {reportType === 'cashflow' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
                      <select
                        value={paymentMethodFilter}
                        onChange={(e) => setPaymentMethodFilter(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      >
                        <option value="all">Semua Metode</option>
                        <option value="transfer">Transfer</option>
                        <option value="cash">Cash</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
              
              {reportType === 'inventory' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    >
                      <option value="all">Semua Kategori</option>
                      <option value="hijab">Hijab</option>
                      <option value="gamis">Gamis</option>
                      <option value="khimar">Khimar</option>
                      <option value="tunik">Tunik</option>
                      <option value="abaya">Abaya</option>
                    </select>
                  </div>
                </div>
              )}
              
              <button className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Export Laporan</span>
              </button>
            </div>

            {/* Sales Report */}
            {reportType === 'sales' && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="font-semibold mb-4">Laporan Penjualan Per Invoice</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-semibold">No Invoice</th>
                        <th className="text-left p-3 font-semibold">Tanggal</th>
                        <th className="text-right p-3 font-semibold">Subtotal</th>
                        <th className="text-right p-3 font-semibold">Modal</th>
                        <th className="text-right p-3 font-semibold">Laba</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSalesReportData().map((item, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="p-3 font-medium">{item.invoice}</td>
                          <td className="p-3">{item.date}</td>
                          <td className="p-3 text-right">Rp {item.subtotal.toLocaleString('id-ID')}</td>
                          <td className="p-3 text-right">Rp {item.modal.toLocaleString('id-ID')}</td>
                          <td className="p-3 text-right font-semibold text-green-600">
                            Rp {item.laba.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Products Report */}
            {reportType === 'products' && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="font-semibold mb-4">Laporan Produk Terjual</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-semibold">Produk</th>
                        <th className="text-right p-3 font-semibold">Quantity</th>
                        <th className="text-right p-3 font-semibold">Harga</th>
                        <th className="text-right p-3 font-semibold">Modal</th>
                        <th className="text-right p-3 font-semibold">Laba</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getProductsReportData().map((item, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="p-3 font-medium">{item.product}</td>
                          <td className="p-3 text-right">{item.quantity}</td>
                          <td className="p-3 text-right">Rp {item.harga.toLocaleString('id-ID')}</td>
                          <td className="p-3 text-right">Rp {item.modal.toLocaleString('id-ID')}</td>
                          <td className="p-3 text-right font-semibold text-green-600">
                            Rp {item.laba.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Inventory Report */}
            {reportType === 'inventory' && (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">Total Produk</h4>
                    <p className="text-2xl font-bold text-blue-600">
                      {getInventoryReportData().length}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">Total Stok</h4>
                    <p className="text-2xl font-bold text-green-600">
                      {getInventoryReportData().reduce((sum, item) => sum + item.stok, 0)}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-800 mb-2">Total Modal</h4>
                    <p className="text-2xl font-bold text-purple-600">
                      Rp {getInventoryReportData().reduce((sum, item) => sum + (item.stok * item.modal), 0).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <h3 className="font-semibold mb-4">Laporan Persediaan</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-3 font-semibold">Produk</th>
                          <th className="text-right p-3 font-semibold">Stok</th>
                          <th className="text-right p-3 font-semibold">Modal/Unit</th>
                          <th className="text-right p-3 font-semibold">Total Modal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getInventoryReportData().map((item, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="p-3 font-medium">{item.product}</td>
                            <td className="p-3 text-right">{item.stok}</td>
                            <td className="p-3 text-right">Rp {item.modal.toLocaleString('id-ID')}</td>
                            <td className="p-3 text-right font-semibold">
                              Rp {(item.stok * item.modal).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Cash Flow Report */}
            {reportType === 'cashflow' && (
              <div className="space-y-4">
                {(() => {
                  const cashFlowData = getCashFlowReportData();
                  return (
                    <>
                      {/* Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 rounded-lg p-4">
                          <h4 className="font-semibold text-blue-800 mb-2">Saldo Sebelumnya</h4>
                          <p className="text-xl font-bold text-blue-600">
                            Rp {cashFlowData.previousBalance.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4">
                          <h4 className="font-semibold text-green-800 mb-2">Penjualan</h4>
                          <p className="text-xl font-bold text-green-600">
                            Rp {cashFlowData.sales.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4">
                          <h4 className="font-semibold text-purple-800 mb-2">Total</h4>
                          <p className="text-xl font-bold text-purple-600">
                            Rp {cashFlowData.total.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-4">
                          <h4 className="font-semibold text-orange-800 mb-2">Saldo Akhir</h4>
                          <p className="text-xl font-bold text-orange-600">
                            Rp {cashFlowData.finalBalance.toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg shadow-sm p-4">
                        <h3 className="font-semibold mb-4">Detail Transaksi</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left p-3 font-semibold">Invoice</th>
                                <th className="text-left p-3 font-semibold">Tanggal</th>
                                <th className="text-left p-3 font-semibold">Metode</th>
                                <th className="text-right p-3 font-semibold">Jumlah</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cashFlowData.transactions.map((transaction, index) => (
                                <tr key={index} className="border-b border-gray-100">
                                  <td className="p-3 font-medium">{transaction.invoice}</td>
                                  <td className="p-3">{transaction.date}</td>
                                  <td className="p-3">{transaction.method}</td>
                                  <td className="p-3 text-right font-semibold text-green-600">
                                    Rp {transaction.amount.toLocaleString('id-ID')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Profit Loss Report */}
            {reportType === 'profit-loss' && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="font-semibold mb-4">Laporan Rugi Laba</h3>
                {(() => {
                  const profitLossData = getProfitLossReportData();
                  return (
                    <div className="space-y-6">
                      {/* Revenue Section */}
                      <div>
                        <h4 className="font-semibold text-lg mb-3 text-green-700">PENDAPATAN</h4>
                        <div className="space-y-2 ml-4">
                          <div className="flex justify-between">
                            <span>Penjualan</span>
                            <span>Rp {profitLossData.revenue.sales.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Modal</span>
                            <span>Rp {profitLossData.revenue.modal.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Ongkir Penjualan</span>
                            <span>Rp {profitLossData.revenue.shipping.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between font-semibold border-t pt-2">
                            <span>Total Pendapatan</span>
                            <span>Rp {profitLossData.revenue.total.toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Expenses Section */}
                      <div>
                        <h4 className="font-semibold text-lg mb-3 text-red-700">BIAYA</h4>
                        <div className="space-y-2 ml-4">
                          <div className="flex justify-between">
                            <span>Ongkir Penjualan</span>
                            <span>Rp {profitLossData.expenses.shipping.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Biaya Operasional</span>
                            <span>Rp {profitLossData.expenses.operational.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between font-semibold border-t pt-2">
                            <span>Total Biaya</span>
                            <span>Rp {profitLossData.expenses.total.toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Profit/Loss */}
                      <div className="border-t-2 border-gray-300 pt-4">
                        <div className={`flex justify-between text-xl font-bold ${
                          profitLossData.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <span>{profitLossData.profitLoss >= 0 ? 'LABA' : 'RUGI'}</span>
                          <span>Rp {Math.abs(profitLossData.profitLoss).toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {activeTab === 'featured' && user?.role === 'owner' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-6 text-center">
              <div className="flex justify-center mb-4">
                <Star className="w-16 h-16 text-yellow-500" />
              </div>
              <h3 className="text-lg font-semibold mb-4">Kelola Produk Unggulan</h3>
              <p className="text-gray-600 mb-6">
                Pilih hingga 4 produk untuk ditampilkan di halaman utama sebagai produk unggulan
              </p>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">Maksimal Produk</h4>
                  <p className="text-2xl font-bold text-blue-600">4</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">Penempatan</h4>
                  <p className="text-sm text-green-700">Halaman Utama</p>
                  <p className="text-xs text-green-600">Di atas semua produk</p>
                </div>
              </div>
              <button
                onClick={() => setShowFeaturedManagement(true)}
                className="bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 transition-colors flex items-center space-x-2 mx-auto"
              >
                <Star className="w-5 h-5" />
                <span>Kelola Produk Unggulan</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'flashsale' && user?.role === 'owner' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-6 text-center">
              <h3 className="text-lg font-semibold mb-4">Kelola Flash Sale</h3>
              <p className="text-gray-600 mb-6">
                Buat dan kelola flash sale untuk meningkatkan penjualan
              </p>
              <button
                onClick={() => setShowFlashSaleManagement(true)}
                className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors"
              >
                Buka Kelola Flash Sale
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;