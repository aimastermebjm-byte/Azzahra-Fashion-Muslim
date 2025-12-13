import React, { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, Truck, XCircle, Eye, Search, Filter, Calendar, Download, X, Upload, CreditCard, MapPin, Phone, Mail, Edit2, Check, User, AlertTriangle, Info, Trash2, Copy, ArrowLeft } from 'lucide-react';
import PageHeader from './PageHeader';
import { useFirebaseAdminOrders } from '../hooks/useFirebaseAdminOrders';
import { ordersService } from '../services/ordersService';
import { paymentGroupService } from '../services/paymentGroupService';

interface AdminOrdersPageProps {
  onBack: () => void;
  user: any;
  onRefreshProducts?: () => void;
  onNavigateToHome?: () => void;
}

const AdminOrdersPage: React.FC<AdminOrdersPageProps> = ({ onBack, user, onRefreshProducts, onNavigateToHome }) => {
  const { orders, loading, error, initialLoad } = useFirebaseAdminOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [paymentProof, setPaymentProof] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [uploadingPaymentProof, setUploadingPaymentProof] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedOrderForUpload, setSelectedOrderForUpload] = useState<any>(null);

  // ✨ NEW: Bulk operations state
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);

  // ✨ NEW: Payment assistance state (for Owner to help customer)
  const [showPaymentAssistModal, setShowPaymentAssistModal] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showAutoInstructionsModal, setShowAutoInstructionsModal] = useState(false);
  const [showManualUploadModal, setShowManualUploadModal] = useState(false);
  const [assistPaymentData, setAssistPaymentData] = useState<any>(null);
  const [assistPaymentProof, setAssistPaymentProof] = useState<File | null>(null);

  // Modern confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Ya, Lanjutkan',
    cancelText: 'Batal',
    type: 'warning' // 'warning', 'success', 'error', 'info'
  });

  // Firebase order management functions
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    return await ordersService.updateOrderStatus(orderId, newStatus);
  };

  const updateOrderPayment = async (orderId: string, proof: string, status?: string) => {
    return await ordersService.updateOrderPayment(orderId, proof, status);
  };

  // Modern confirmation modal helper
  const showModernConfirm = (title: string, message: string, onConfirm: () => void, options: any = {}) => {
    setConfirmModalData({
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setShowConfirmModal(false);
      },
      confirmText: options.confirmText || 'Ya, Lanjutkan',
      cancelText: options.cancelText || 'Batal',
      type: options.type || 'warning'
    });
    setShowConfirmModal(true);
  };

  // Modern alert modal helper
  const showModernAlert = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setConfirmModalData({
      title,
      message,
      onConfirm: () => setShowConfirmModal(false),
      confirmText: 'OK',
      cancelText: '',
      type
    });
    setShowConfirmModal(true);
  };

  const deleteOrder = async (orderId: string) => {
    return await ordersService.deleteOrder(orderId);
  };

  // ✨ NEW: Bulk operations functions
  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(order => order.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedOrderIds.length === 0) {
      showModernAlert('Peringatan', 'Pilih minimal 1 pesanan untuk dihapus', 'warning');
      return;
    }

    showModernConfirm(
      'Konfirmasi Bulk Delete', 
      `Apakah Anda yakin ingin menghapus ${selectedOrderIds.length} pesanan sekaligus? Stock akan dikembalikan.`,
      async () => {
        let successCount = 0;
        let failCount = 0;

        for (const orderId of selectedOrderIds) {
          try {
            const order = orders.find(o => o.id === orderId);
            if (order) {
              await ordersService.restoreStockForOrderManually(order);
            }
            await deleteOrder(orderId);
            successCount++;
          } catch (error) {
            console.error(`Failed to delete order ${orderId}:`, error);
            failCount++;
          }
        }

        setSelectedOrderIds([]);

        if (failCount === 0) {
          showModernAlert('Berhasil', `${successCount} pesanan berhasil dihapus`, 'success');
        } else {
          showModernAlert('Selesai dengan Error', `${successCount} berhasil, ${failCount} gagal`, 'warning');
        }

        // Trigger refresh
        window.dispatchEvent(new CustomEvent('orderCancelled', {
          detail: { action: 'bulkDeleted', count: successCount }
        }));

        if (onRefreshProducts) {
          onRefreshProducts();
        }
      },
      { type: 'error', confirmText: 'Ya, Hapus Semua', cancelText: 'Batal' }
    );
  };

  const handleEditOrder = (order: any) => {
    setEditingOrder({ ...order });
    setShowEditModal(true);
  };

  const handleSaveEditOrder = async () => {
    if (!editingOrder) return;

    try {
      // Update order in Firebase
      await ordersService.updateOrder(editingOrder.id, {
        shippingInfo: editingOrder.shippingInfo,
        notes: editingOrder.notes,
        status: editingOrder.status
      });

      showModernAlert('Berhasil', 'Pesanan berhasil diupdate', 'success');
      setShowEditModal(false);
      setEditingOrder(null);

      // Trigger refresh
      window.dispatchEvent(new CustomEvent('orderUpdated'));
    } catch (error) {
      console.error('Error updating order:', error);
      showModernAlert('Error', 'Gagal mengupdate pesanan', 'error');
    }
  };

  // Get orders by status
  const getOrdersByStatus = (status: string) => {
    return orders.filter(order => order.status === status);
  };

  // Get total revenue
  const getTotalRevenue = () => {
    return orders.reduce((total, order) => total + order.finalTotal, 0);
  };

  // Get today's orders
  const getTodayOrders = () => {
    const today = new Date().toISOString().split('T')[0];
    return orders.filter(order => order.createdAt.startsWith(today));
  };

  // Listen for order updates
  useEffect(() => {
    const handleOrderUpdate = (event: any) => {
            // Force re-render by updating state
      setSearchQuery(prev => prev + ' ');
      setTimeout(() => setSearchQuery(prev => prev.trim()), 100);
    };

    window.addEventListener('orderUpdated', handleOrderUpdate);
    return () => window.removeEventListener('orderUpdated', handleOrderUpdate);
  }, []);

  const statusConfig = {
    pending: { label: 'Menunggu Pembayaran', icon: Clock, color: 'text-orange-600 bg-orange-100' },
    awaiting_verification: { label: 'Menunggu Verifikasi', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
    paid: { label: 'Dibayar', icon: CheckCircle, color: 'text-blue-600 bg-blue-100' },
    processing: { label: 'Diproses', icon: Package, color: 'text-purple-600 bg-purple-100' },
    shipped: { label: 'Dikirim', icon: Truck, color: 'text-indigo-600 bg-indigo-100' },
    delivered: { label: 'Selesai', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
    cancelled: { label: 'Dibatalkan', icon: XCircle, color: 'text-red-600 bg-red-100' }
  };

  // Get unique users for filter
  const getUniqueUsers = () => {
    const users = new Set();
    orders.forEach(order => {
      if (order.userName && order.userEmail) {
        users.add(`${order.userName} (${order.userEmail})`);
      }
    });
    return Array.from(users).sort();
  };

  // Get unique products for filter
  const getUniqueProducts = () => {
    const products = new Set();
    orders.forEach(order => {
      if (order.items) {
        order.items.forEach((item: any) => {
          if (item.productName) {
            products.add(item.productName);
          }
        });
      }
    });
    return Array.from(products).sort();
  };

  // Filter and search orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === '' ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.userEmail.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    const matchesUser = userFilter === 'all' || `${order.userName} (${order.userEmail})` === userFilter;

    const matchesProduct = productFilter === 'all' ||
      (order.items && order.items.some((item: any) => item.productName === productFilter));

    return matchesSearch && matchesStatus && matchesUser && matchesProduct;
  });

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const handleVerifyPayment = (order: any) => {
    setSelectedOrder(order);
    setShowVerificationModal(true);
  };

  const handleUpdateStatus = (orderId: string, status: string, orderName: string = '') => {
    let confirmMessage = '';
    let confirmTitle = '';

    switch (status) {
      case 'processing':
        confirmTitle = 'Proses Pesanan';
        confirmMessage = `Apakah barang sudah datang dan siap untuk diproses?\n\nPesanan #${orderName} akan diproses.`;
        break;
      case 'shipped':
        confirmTitle = 'Kirim Pesanan';
        confirmMessage = `Apakah barang sudah dikirim ke pelanggan?\n\nPesanan #${orderName} akan ditandai sebagai terkirim.`;
        break;
      case 'delivered':
        confirmTitle = 'Selesaikan Pesanan';
        confirmMessage = `Apakah barang sudah diterima pelanggan dan selesai?\n\nPesanan #${orderName} akan ditandai sebagai selesai.`;
        break;
      default:
        confirmMessage = `Apakah Anda yakin ingin mengubah status pesanan #${orderName}?`;
    }

    showModernConfirm(confirmTitle, confirmMessage, () => {
      updateOrderStatus(orderId, status as any);
    }, { type: 'warning' });
  };

  const handleConfirmVerification = async (status: 'paid' | 'cancelled') => {
    if (selectedOrder) {
      try {
        if (status === 'paid') {
          await updateOrderPayment(selectedOrder.id, paymentProof || 'payment_verified', 'paid');
        } else {
          console.log('🔄 CANCELLING ORDER - Status will be set to:', status);
          await updateOrderStatus(selectedOrder.id, status);

          // After cancelling, refresh products and navigate to home
          console.log('✅ Order cancelled, refreshing products...');
          if (onRefreshProducts) {
            onRefreshProducts();
          }

          if (onNavigateToHome) {
            console.log('🏠 Navigating to home after order cancellation...');
            setTimeout(() => {
              onNavigateToHome();
            }, 1000); // Small delay to ensure products are refreshed
          }
        }
        setShowVerificationModal(false);
        setSelectedOrder(null);
        setPaymentProof('');
        setVerificationNotes('');
      } catch (error) {
        console.error('❌ Error confirming verification:', error);
        showModernAlert('Error', 'Gagal memperbarui verifikasi pesanan', 'error');
      }
    }
  };

  const handleUploadPaymentProof = (order: any) => {
    setSelectedOrderForUpload(order);
    setShowUploadModal(true);
  };

  // ✨ NEW: Payment Assistance Handlers (Owner helps customer)
  const handlePaymentAssist = async (order: any) => {
    // Check if order already has payment group
    if (order.paymentGroupId) {
      try {
        const existingGroup = await paymentGroupService.getPaymentGroup(order.paymentGroupId);
        
        if (existingGroup && existingGroup.status === 'pending') {
          // Reuse existing payment group
          setAssistPaymentData({
            order,
            paymentGroup: existingGroup
          });
          
          if (existingGroup.verificationMode === 'auto') {
            setShowAutoInstructionsModal(true);
          } else if (existingGroup.verificationMode === 'manual') {
            setShowManualUploadModal(true);
          } else {
            setShowPaymentMethodModal(true);
          }
          return;
        }
      } catch (error) {
        console.error('Error loading existing payment group:', error);
      }
    }
    
    // No existing payment group, show method selection
    setAssistPaymentData({ order, paymentGroup: null });
    setShowPaymentMethodModal(true);
  };

  const handleAssistChooseMethod = async (mode: 'auto' | 'manual') => {
    try {
      if (mode === 'auto') {
        // Create payment group for this single order
        const paymentGroup = await paymentGroupService.createPaymentGroup({
          userId: assistPaymentData.order.userId,
          userName: assistPaymentData.order.userName,
          userEmail: assistPaymentData.order.userEmail,
          orderIds: [assistPaymentData.order.id],
          originalTotal: assistPaymentData.order.finalTotal,
          verificationMode: 'auto'
        });
        
        // Update order with payment group
        await ordersService.updateOrder(assistPaymentData.order.id, {
          paymentGroupId: paymentGroup.id,
          groupPaymentAmount: paymentGroup.exactPaymentAmount,
          verificationMode: 'auto'
        });
        
        setAssistPaymentData({
          ...assistPaymentData,
          paymentGroup
        });
        
        setShowPaymentMethodModal(false);
        setShowAutoInstructionsModal(true);
        showModernAlert('Berhasil', 'Instruksi pembayaran otomatis telah dibuat', 'success');
      } else {
        // Manual mode - go to upload
        setAssistPaymentData({
          ...assistPaymentData,
          verificationMode: 'manual'
        });
        
        setShowPaymentMethodModal(false);
        setShowManualUploadModal(true);
      }
    } catch (error) {
      console.error('Error creating payment assistance:', error);
      showModernAlert('Error', 'Gagal membuat bantuan pembayaran', 'error');
    }
  };

  const handleAssistCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showModernAlert('Tersalin', `${label} berhasil disalin!`, 'success');
  };

  const handleAssistFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAssistPaymentProof(e.target.files[0]);
    }
  };

  const handleAssistSubmitManualPayment = async () => {
    if (!assistPaymentProof) {
      showModernAlert('Error', 'Pilih bukti transfer terlebih dahulu', 'error');
      return;
    }

    try {
      // Upload payment proof for the order
      await ordersService.updateOrderPayment(
        assistPaymentData.order.id,
        assistPaymentProof,
        'awaiting_verification'
      );

      setShowManualUploadModal(false);
      setAssistPaymentData(null);
      setAssistPaymentProof(null);
      
      showModernAlert('Berhasil', 'Bukti pembayaran berhasil diupload untuk customer', 'success');
    } catch (error) {
      console.error('Error submitting manual payment:', error);
      showModernAlert('Error', 'Gagal mengupload bukti pembayaran', 'error');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedOrderForUpload) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showModernAlert('Error', 'Harap upload file gambar (JPG, PNG, dll)', 'error');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showModernAlert('Error', 'Ukuran file maksimal 5MB', 'error');
      return;
    }

    setUploadingPaymentProof(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result as string;
        // Remove data URL prefix to get clean base64 data
        const base64Data = result.split(',')[1] || result;

        try {
          // Update order with base64 payment proof
          // Change status to 'awaiting_verification' when admin uploads proof
          const newStatus = selectedOrderForUpload.status === 'pending' ? 'awaiting_verification' : selectedOrderForUpload.status;
          await updateOrderPayment(selectedOrderForUpload.id, base64Data, newStatus);

          showModernAlert('Berhasil', '✅ Bukti pembayaran berhasil diupload! Status diubah menjadi "Menunggu Verifikasi".', 'success');
          setShowUploadModal(false);
          setSelectedOrderForUpload(null);

          // Refresh the orders
          setSearchQuery(prev => prev + ' ');
          setTimeout(() => setSearchQuery(prev => prev.trim()), 100);

        } catch (error) {
          console.error('❌ Error uploading payment proof:', error);
          showModernAlert('Error', 'Gagal mengupload bukti pembayaran', 'error');
        } finally {
          setUploadingPaymentProof(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('❌ Error reading file:', error);
      showModernAlert('Error', 'Gagal membaca file', 'error');
      setUploadingPaymentProof(false);
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    showModernConfirm('Konfirmasi Hapus', 'Apakah Anda yakin ingin menghapus pesanan ini? Stock akan dikembalikan.', () => {
      // Get order data first to restore stock before deleting
      const order = orders.find(o => o.id === orderId);
      if (order) {
        console.log('🔄 RESTORING STOCK BEFORE DELETING ORDER:', orderId);
        ordersService.restoreStockForOrderManually(order).then(() => {
          console.log('✅ Stock restored, deleting order:', orderId);
          deleteOrder(orderId);

          // Trigger event untuk refresh otomatis di semua device
          window.dispatchEvent(new CustomEvent('orderCancelled', {
            detail: { action: 'cancelled', orderId, restoredStock: true }
          }));

          // Refresh products and navigate to home
          if (onRefreshProducts) {
            console.log('🔄 Refreshing products after stock restoration...');
            onRefreshProducts();
          }

          if (onNavigateToHome) {
            console.log('🏠 Navigating to home page...');
            setTimeout(() => {
              onNavigateToHome();
            }, 1000); // Small delay to ensure products are refreshed
          }
        }).catch(error => {
          console.error('❌ Error restoring stock before deletion:', error);
          // Still delete order even if stock restoration fails
          deleteOrder(orderId);

          // Still refresh products even if stock restoration failed
          if (onRefreshProducts) {
            onRefreshProducts();
          }
        });
      } else {
        deleteOrder(orderId);
      }
    }, { type: 'error', confirmText: 'Ya, Hapus', cancelText: 'Batal' });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader
        title="Kelola Pesanan"
        subtitle="Kelola status order, cek bukti bayar, dan tindak lanjuti pengiriman"
        onBack={onBack}
        variant="gradient"
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/30 bg-white/15 p-4 text-white">
            <p className="text-xs uppercase tracking-wide text-white/70">Total Pesanan</p>
            <p className="mt-1 text-2xl font-bold">{orders.length}</p>
            <p className="text-xs text-white/70">Semua status</p>
          </div>
          <div className="rounded-2xl border border-white/30 bg-white/15 p-4 text-white">
            <p className="text-xs uppercase tracking-wide text-white/70">Menunggu</p>
            <p className="mt-1 text-2xl font-bold">
              {getOrdersByStatus('pending').length + getOrdersByStatus('awaiting_verification').length}
            </p>
            <p className="text-xs text-white/70">Butuh aksi</p>
          </div>
          <div className="rounded-2xl border border-white/30 bg-white/15 p-4 text-white">
            <p className="text-xs uppercase tracking-wide text-white/70">Selesai</p>
            <p className="mt-1 text-2xl font-bold">{getOrdersByStatus('delivered').length}</p>
            <p className="text-xs text-white/70">Berhasil dikirim</p>
          </div>
          <div className="rounded-2xl border border-white/30 bg-white/15 p-4 text-white">
            <p className="text-xs uppercase tracking-wide text-white/70">Total Revenue</p>
            <p className="mt-1 text-2xl font-bold">{Math.round(getTotalRevenue() / 1000)}K</p>
            <p className="text-xs text-white/70">Perkiraan angka kasar</p>
          </div>
        </div>
      </PageHeader>

      {/* Content */}
      <div className="p-4 space-y-4">

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="space-y-3">
            {/* First Row - Search */}
            <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cari pesanan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Second Row - Filters */}
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="all">Semua Status</option>
                {Object.entries(statusConfig).map(([status, config]) => (
                  <option key={status} value={status}>{config.label}</option>
                ))}
              </select>

              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-[200px]"
              >
                <option value="all">Semua Pelanggan</option>
                {getUniqueUsers().map((user, index) => (
                  <option key={index} value={user}>{user}</option>
                ))}
              </select>

              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-[150px]"
              >
                <option value="all">Semua Produk</option>
                {getUniqueProducts().map((product, index) => (
                  <option key={index} value={product}>{product}</option>
                ))}
              </select>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />

              <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" />
              </button>

              {/* Reset Filters Button */}
              {(statusFilter !== 'all' || userFilter !== 'all' || productFilter !== 'all' || searchQuery || dateFilter) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setUserFilter('all');
                    setProductFilter('all');
                    setDateFilter('');
                  }}
                  className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ✨ NEW: Bulk Operations Toolbar */}
        {user?.role === 'owner' && filteredOrders.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedOrderIds.length > 0 
                      ? `${selectedOrderIds.length} dipilih` 
                      : 'Pilih Semua'}
                  </span>
                </label>
              </div>
              
              {selectedOrderIds.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus {selectedOrderIds.length} Pesanan</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Orders List */}
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Belum ada pesanan</p>
              <p className="text-sm text-gray-400">Pesanan akan muncul di sini ketika ada checkout</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const statusInfo = statusConfig[order.status as keyof typeof statusConfig];
              const StatusIcon = statusInfo.icon;
              const paymentMethodLabel = (order.paymentMethodName || order.paymentMethod || 'Metode tidak diketahui').trim();

              return (
                <div key={order.id} className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start space-x-3">
                    {/* ✨ NEW: Checkbox for bulk selection (Owner only) */}
                    {user?.role === 'owner' && (
                      <div className="pt-1">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(order.id)}
                          onChange={() => toggleSelectOrder(order.id)}
                          className="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                        />
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-lg">#{order.id}</p>
                          <p className="text-sm text-gray-600">{order.userName} • {order.userEmail}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            <span>{statusInfo.label}</span>
                          </div>
                          <p className="text-lg font-semibold text-pink-600 mt-1">
                            Rp {order.finalTotal.toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        {order.items.length} item • {paymentMethodLabel}
                      </div>
                        <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewOrder(order)}
                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Detail</span>
                      </button>

                      {order.status === 'pending' || order.status === 'awaiting_verification' ? (
                        user?.role === 'owner' ? (
                          <button
                            onClick={() => handleVerifyPayment(order)}
                            className="flex items-center space-x-1 text-green-600 hover:text-green-700 text-sm font-medium"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Verifikasi</span>
                          </button>
                        ) : (
                          <div className="flex items-center space-x-1 text-gray-400 text-sm font-medium">
                            <CheckCircle className="w-4 h-4" />
                            <span>Verifikasi (Owner Only)</span>
                          </div>
                        )
                      ) : order.status === 'paid' && (order.paymentProof || order.paymentProofData) ? (
                        <div className="flex items-center space-x-1 text-blue-600 text-sm font-medium">
                          <CreditCard className="w-4 h-4" />
                          <span>Sudah Diverifikasi</span>
                        </div>
                      ) : null}

                      {order.status === 'paid' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'processing', order.id)}
                          className="flex items-center space-x-1 text-purple-600 hover:text-purple-700 text-sm font-medium"
                        >
                          <Package className="w-4 h-4" />
                          <span>Proses</span>
                        </button>
                      )}

                      {order.status === 'processing' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'shipped', order.id)}
                          className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                        >
                          <Truck className="w-4 h-4" />
                          <span>Kirim</span>
                        </button>
                      )}

                      {order.status === 'shipped' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'delivered', order.id)}
                          className="flex items-center space-x-1 text-green-600 hover:text-green-700 text-sm font-medium"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Selesai</span>
                        </button>
                      )}

                      {/* ✨ NEW: Edit button (Owner only) */}
                      {user?.role === 'owner' && (
                        <>
                          <button
                            onClick={() => handleEditOrder(order)}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            <Edit2 className="w-4 h-4" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="flex items-center space-x-1 text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Hapus</span>
                          </button>
                        </>
                      )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Order Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Detail Pesanan #{selectedOrder.id}</h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Informasi Pelanggan
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Nama</p>
                    <p className="font-medium">{selectedOrder.userName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Email</p>
                    <p className="font-medium">{selectedOrder.userEmail}</p>
                  </div>
                </div>
              </div>

              {/* Shipping Info */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  Informasi Pengiriman
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-gray-600">Nama Penerima</p>
                    <p className="font-medium">{selectedOrder.shippingInfo?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">No. Telepon</p>
                    <p className="font-medium flex items-center">
                      <Phone className="w-3 h-3 mr-1" />
                      {selectedOrder.shippingInfo?.phone || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Alamat</p>
                    <p className="font-medium">{selectedOrder.shippingInfo?.address || '-'}</p>
                  </div>
                  {selectedOrder.shippingInfo?.isDropship && (
                    <div className="mt-2 p-2 bg-yellow-100 rounded">
                      <p className="text-xs text-yellow-800">
                        <strong>Dropship:</strong> {selectedOrder.shippingInfo.dropshipName} ({selectedOrder.shippingInfo.dropshipPhone})
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Detail Produk</h3>
                <div className="space-y-3">
                  {selectedOrder.items?.map((item: any, index: number) => (
                    <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                        {(item.productImage || item.image) ? (
                          <img
                            src={item.productImage || item.image}
                            alt={item.productName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              if (target.nextElementSibling) {
                                (target.nextElementSibling as HTMLElement).style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <Package className="w-8 h-8 text-gray-400" style={{ display: (item.productImage || item.image) ? 'none' : 'flex' }} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-gray-600">
                          {item.selectedVariant?.size}, {item.selectedVariant?.color} • {item.quantity} pcs
                        </p>
                        <p className="text-xs text-gray-500">
                          Rp {item.price.toLocaleString('id-ID')} × {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-lg">Rp {item.total.toLocaleString('id-ID')}</p>
                        <p className="text-sm text-gray-600">Subtotal</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment & Total */}
              <div className="border-t pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">Rp {selectedOrder.totalAmount?.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ongkos Kirim</span>
                    <span className="font-medium">Rp {selectedOrder.shippingCost?.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total</span>
                    <span className="text-pink-600">Rp {selectedOrder.finalTotal?.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Payment Proof Section */}
              <div className={`${selectedOrder.paymentProof || selectedOrder.paymentProofData ? (selectedOrder.status === 'paid' ? 'bg-blue-50' : 'bg-green-50') : 'bg-gray-50'} rounded-lg p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800 flex items-center">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Bukti Pembayaran {selectedOrder.status === 'paid' && '(Terverifikasi)'}
                  </h3>
                  {!selectedOrder.paymentProof && !selectedOrder.paymentProofData && (
                    <button
                      onClick={() => handleUploadPaymentProof(selectedOrder)}
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload</span>
                    </button>
                  )}
                </div>

                {(selectedOrder.paymentProof || selectedOrder.paymentProofData) ? (
                  <div>
                    {selectedOrder.paymentProofData ? (
                      // Display from base64 data (both admin and user uploads)
                      <div>
                        <img
                          src={`data:image/*;base64,${selectedOrder.paymentProofData}`}
                          alt="Payment Proof"
                          className="w-full max-w-md rounded-lg border-2 border-green-200"
                          onClick={() => {
                            const newWindow = window.open('', '_blank');
                            if (newWindow) {
                              newWindow.document.write(`
                                <html>
                                  <body style="margin:0;padding:20px;background:#f3f4f6;">
                                    <img src="data:image/*;base64,${selectedOrder.paymentProofData}"
                                         style="max-width:100%;height:auto;display:block;margin:0 auto;"
                                         alt="Payment Proof" />
                                  </body>
                                </html>
                              `);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <p className="text-xs text-gray-600 mt-2 text-center">
                          💡 Klik gambar untuk memperbesar
                        </p>
                      </div>
                    ) : selectedOrder.paymentProofUrl ? (
                      // Display from Storage URL (fallback)
                      <div>
                        <img
                          src={selectedOrder.paymentProofUrl}
                          alt="Payment Proof"
                          className="w-full max-w-md rounded-lg border-2 border-green-200"
                          onClick={() => window.open(selectedOrder.paymentProofUrl, '_blank')}
                          style={{ cursor: 'pointer' }}
                        />
                        <p className="text-xs text-gray-600 mt-2 text-center">
                          💡 Klik gambar untuk memperbesar
                        </p>
                      </div>
                    ) : (
                      // Display from text/filename only
                      <div className="text-sm text-green-800">
                        <p className="font-medium">📎 File Bukti Pembayaran:</p>
                        <p className="bg-white p-2 rounded border border-green-200 mt-1">
                          {selectedOrder.paymentProof}
                        </p>
                        <p className="text-xs mt-2 text-gray-600">
                          (File tersimpan di Firebase Firestore - Gratis!)
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 text-center py-4">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>Belum ada bukti pembayaran</p>
                    <p className="text-xs">Klik tombol "Upload" untuk menambahkan bukti pembayaran</p>
                  </div>
                )}
              </div>

              {/* Payment verification status */}
              {selectedOrder.status === 'paid' && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-blue-600" />
                    Status Pembayaran
                  </h3>
                  <p className="text-sm text-blue-800">
                    ✅ Pembayaran telah diverifikasi pada {new Date(selectedOrder.updatedAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Catatan</h3>
                  <p className="text-sm text-gray-700">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Tutup
                </button>
                {/* ✨ NEW: Payment Assistance Button (Owner only, pending orders) */}
                {selectedOrder.status === 'pending' && user?.role === 'owner' && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handlePaymentAssist(selectedOrder);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Bantu Pembayaran</span>
                  </button>
                )}
                {(selectedOrder.status === 'pending' || selectedOrder.status === 'awaiting_verification') && user?.role === 'owner' && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleVerifyPayment(selectedOrder);
                    }}
                    className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Verifikasi Pembayaran</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Verification Modal */}
      {showVerificationModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Verifikasi Pembayaran</h2>
                <button
                  onClick={() => setShowVerificationModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <h3 className="font-medium text-gray-800 mb-2">Pesanan #{selectedOrder.id}</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Total: Rp {selectedOrder.finalTotal?.toLocaleString('id-ID')}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Catatan Verifikasi
                  </label>
                  <textarea
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Tambahkan catatan jika diperlukan..."
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Periksa:</strong> Pastikan bukti pembayaran sudah sesuai dengan jumlah yang dibayarkan.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => handleConfirmVerification('cancelled')}
                  className="px-4 py-2 text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                >
                  Tolak
                </button>
                <button
                  onClick={() => handleConfirmVerification('paid')}
                  className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Konfirmasi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Payment Proof Modal */}
      {showUploadModal && selectedOrderForUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Upload Bukti Pembayaran</h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={uploadingPaymentProof}
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center">
                <Upload className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                <h3 className="font-medium text-gray-800 mb-2">Pesanan #{selectedOrderForUpload.id}</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Total: Rp {selectedOrderForUpload.finalTotal?.toLocaleString('id-ID')}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih File Bukti Pembayaran
                  </label>
                  <input
                    id="payment-proof-file"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploadingPaymentProof}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Format: JPG, PNG, maksimal 5MB
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Informasi:</strong> Upload bukti pembayaran dari pelanggan jika belum ada.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploadingPaymentProof}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Batal
                </button>
                <button
                  onClick={() => document.getElementById('payment-proof-file')?.click()}
                  disabled={uploadingPaymentProof}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingPaymentProof ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-2xl transform transition-all">
            {/* Header with icon */}
            <div className={`px-6 py-5 rounded-t-2xl ${
              confirmModalData.type === 'error' ? 'bg-red-50' :
              confirmModalData.type === 'success' ? 'bg-green-50' :
              confirmModalData.type === 'warning' ? 'bg-yellow-50' : 'bg-blue-50'
            }`}>
              <div className="flex items-center space-x-3">
                {confirmModalData.type === 'error' && (
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <X className="w-6 h-6 text-red-600" />
                  </div>
                )}
                {confirmModalData.type === 'success' && (
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                )}
                {confirmModalData.type === 'warning' && (
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-yellow-600" />
                  </div>
                )}
                {confirmModalData.type === 'info' && (
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Info className="w-6 h-6 text-blue-600" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className={`text-xl font-bold ${
                    confirmModalData.type === 'error' ? 'text-red-800' :
                    confirmModalData.type === 'success' ? 'text-green-800' :
                    confirmModalData.type === 'warning' ? 'text-yellow-800' : 'text-blue-800'
                  }`}>
                    {confirmModalData.title}
                  </h3>
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="px-6 py-5">
              <p className="text-gray-700 text-base leading-relaxed whitespace-pre-line">
                {confirmModalData.message}
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end space-x-3">
              {confirmModalData.cancelText && (
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl font-medium transition-all hover:shadow-md"
                >
                  {confirmModalData.cancelText}
                </button>
              )}
              <button
                onClick={confirmModalData.onConfirm}
                className={`px-5 py-2.5 text-white rounded-xl font-medium transition-all hover:shadow-lg transform hover:scale-105 ${
                  confirmModalData.type === 'error' ? 'bg-red-600 hover:bg-red-700' :
                  confirmModalData.type === 'success' ? 'bg-green-600 hover:bg-green-700' :
                  confirmModalData.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmModalData.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ NEW: Edit Order Modal */}
      {showEditModal && editingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="text-xl font-bold text-gray-900">Edit Pesanan #{editingOrder.id}</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingOrder(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-4">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status Pesanan</label>
                <select
                  value={editingOrder.status}
                  onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                >
                  <option value="pending">Menunggu Pembayaran</option>
                  <option value="awaiting_verification">Menunggu Verifikasi</option>
                  <option value="paid">Dibayar</option>
                  <option value="processing">Diproses</option>
                  <option value="shipped">Dikirim</option>
                  <option value="delivered">Selesai</option>
                  <option value="cancelled">Dibatalkan</option>
                </select>
              </div>

              {/* Shipping Info */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <span>Informasi Pengiriman</span>
                </h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Penerima</label>
                  <input
                    type="text"
                    value={editingOrder.shippingInfo?.name || ''}
                    onChange={(e) => setEditingOrder({
                      ...editingOrder,
                      shippingInfo: { ...editingOrder.shippingInfo, name: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
                  <input
                    type="text"
                    value={editingOrder.shippingInfo?.phone || ''}
                    onChange={(e) => setEditingOrder({
                      ...editingOrder,
                      shippingInfo: { ...editingOrder.shippingInfo, phone: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Lengkap</label>
                  <textarea
                    value={editingOrder.shippingInfo?.address || ''}
                    onChange={(e) => setEditingOrder({
                      ...editingOrder,
                      shippingInfo: { ...editingOrder.shippingInfo, address: e.target.value }
                    })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Pesanan</label>
                <textarea
                  value={editingOrder.notes || ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="Tambahkan catatan (opsional)"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end space-x-3 sticky bottom-0">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingOrder(null);
                }}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl font-medium transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEditOrder}
                className="px-5 py-2.5 bg-brand-primary text-white rounded-xl font-medium hover:bg-brand-primary/90 transition-all hover:shadow-lg"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ NEW: Payment Assistance - Method Selection Modal */}
      {showPaymentMethodModal && assistPaymentData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-pink-500 to-pink-600 p-4 rounded-t-2xl">
              <h2 className="text-xl font-bold text-white text-center">
                💳 Pilih Metode Pembayaran
              </h2>
              <p className="text-sm text-white/90 text-center mt-1">
                Pesanan #{assistPaymentData.order.id} - Rp {assistPaymentData.order.finalTotal.toLocaleString('id-ID')}
              </p>
            </div>

            <div className="p-4 space-y-3">
              <button
                onClick={() => handleAssistChooseMethod('auto')}
                className="w-full text-left border-2 border-green-500 rounded-xl p-4 hover:shadow-lg transition-all bg-gradient-to-br from-green-50 to-emerald-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-900">✨ Verifikasi Otomatis</h3>
                    <p className="text-sm text-gray-700 mt-0.5">
                      Generate kode unik untuk customer
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleAssistChooseMethod('manual')}
                className="w-full text-left border-2 border-gray-300 rounded-xl p-4 hover:border-blue-500 hover:shadow-lg transition-all bg-white"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-900">📸 Verifikasi Manual</h3>
                    <p className="text-sm text-gray-700 mt-0.5">
                      Upload bukti transfer untuk customer
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowPaymentMethodModal(false);
                  setAssistPaymentData(null);
                }}
                className="w-full px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ NEW: Payment Assistance - Auto Instructions Modal */}
      {showAutoInstructionsModal && assistPaymentData?.paymentGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setShowAutoInstructionsModal(false);
                    setShowPaymentMethodModal(true);
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition-all"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <h2 className="text-lg font-bold text-white flex-1 text-center">
                  ✨ Kode Pembayaran Otomatis
                </h2>
                <button
                  onClick={() => {
                    setShowAutoInstructionsModal(false);
                    setAssistPaymentData(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                <p className="text-xs font-bold text-amber-900">
                  ⚠️ Beritahu customer untuk transfer PERSIS sesuai nominal
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-300 text-center">
                <p className="text-xs font-semibold text-green-800 mb-2">Total Transfer:</p>
                <p className="text-4xl font-bold text-green-900 mb-2">
                  Rp {assistPaymentData.paymentGroup.exactPaymentAmount.toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-green-700 mb-3">
                  Rp {assistPaymentData.paymentGroup.originalTotal.toLocaleString('id-ID')} + <span className="font-mono font-bold">{assistPaymentData.paymentGroup.uniquePaymentCode}</span> (kode unik)
                </p>
                <button
                  onClick={() => handleAssistCopy(assistPaymentData.paymentGroup.exactPaymentAmount.toString(), 'Nominal')}
                  className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Nominal
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-900">Transfer ke salah satu rekening:</p>
                
                <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-700 font-medium">🏦 BCA - Fahrin</p>
                    <p className="text-base font-bold text-blue-900 font-mono">0511456494</p>
                  </div>
                  <button
                    onClick={() => handleAssistCopy('0511456494', 'Nomor rekening BCA')}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="border border-cyan-200 rounded-lg p-3 bg-cyan-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-cyan-700 font-medium">🏦 BRI - Fahrin</p>
                    <p className="text-base font-bold text-cyan-900 font-mono">066301000115566</p>
                  </div>
                  <button
                    onClick={() => handleAssistCopy('066301000115566', 'Nomor rekening BRI')}
                    className="px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="border border-yellow-200 rounded-lg p-3 bg-yellow-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-yellow-700 font-medium">🏦 Mandiri - Fahrin</p>
                    <p className="text-base font-bold text-yellow-900 font-mono">310011008896</p>
                  </div>
                  <button
                    onClick={() => handleAssistCopy('310011008896', 'Nomor rekening Mandiri')}
                    className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-900">
                  Beritahu customer untuk transfer sesuai nominal + kode unik, verifikasi otomatis dalam 1-5 menit
                </p>
              </div>

              <button
                onClick={() => {
                  setShowAutoInstructionsModal(false);
                  setAssistPaymentData(null);
                }}
                className="w-full px-6 py-3 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ NEW: Payment Assistance - Manual Upload Modal */}
      {showManualUploadModal && assistPaymentData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setShowManualUploadModal(false);
                    setShowPaymentMethodModal(true);
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition-all"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <h2 className="text-lg font-bold text-white flex-1 text-center">
                  📸 Upload untuk Customer
                </h2>
                <button
                  onClick={() => {
                    setShowManualUploadModal(false);
                    setAssistPaymentData(null);
                    setAssistPaymentProof(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200 text-center">
                <p className="text-xs font-semibold text-blue-800 mb-2">Total Transfer:</p>
                <p className="text-3xl font-bold text-blue-900 mb-3">
                  Rp {assistPaymentData.order.finalTotal.toLocaleString('id-ID')}
                </p>
                <button
                  onClick={() => handleAssistCopy(assistPaymentData.order.finalTotal.toString(), 'Nominal')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2 mx-auto"
                >
                  <Copy className="w-4 h-4" />
                  Copy Nominal
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-900">Transfer ke salah satu rekening:</p>
                
                <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-700 font-medium">🏦 BCA - Fahrin</p>
                    <p className="text-base font-bold text-blue-900 font-mono">0511456494</p>
                  </div>
                  <button
                    onClick={() => handleAssistCopy('0511456494', 'Nomor rekening BCA')}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="border border-cyan-200 rounded-lg p-3 bg-cyan-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-cyan-700 font-medium">🏦 BRI - Fahrin</p>
                    <p className="text-base font-bold text-cyan-900 font-mono">066301000115566</p>
                  </div>
                  <button
                    onClick={() => handleAssistCopy('066301000115566', 'Nomor rekening BRI')}
                    className="px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="border border-yellow-200 rounded-lg p-3 bg-yellow-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-yellow-700 font-medium">🏦 Mandiri - Fahrin</p>
                    <p className="text-base font-bold text-yellow-900 font-mono">310011008896</p>
                  </div>
                  <button
                    onClick={() => handleAssistCopy('310011008896', 'Nomor rekening Mandiri')}
                    className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-900 mb-2 block">
                    Upload Bukti Transfer (dari Customer):
                  </span>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-pink-500 transition-all cursor-pointer bg-gray-50">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAssistFileChange}
                      className="hidden"
                      id="assist-payment-proof-upload"
                    />
                    <label htmlFor="assist-payment-proof-upload" className="cursor-pointer block text-center">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-700">
                        {assistPaymentProof ? assistPaymentProof.name : 'Klik untuk pilih gambar'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        PNG, JPG, atau JPEG (max 5MB)
                      </p>
                    </label>
                  </div>
                </label>

                {assistPaymentProof && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2 mt-2">
                    <p className="text-xs text-green-700 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Siap upload: {assistPaymentProof.name}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-900">
                  Upload bukti transfer dari customer, verifikasi dalam 1-24 jam
                </p>
              </div>

              <button
                onClick={handleAssistSubmitManualPayment}
                disabled={!assistPaymentProof}
                className="w-full px-6 py-3 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Kirim Bukti Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrdersPage;