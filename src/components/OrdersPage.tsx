import React, { useState } from 'react';
import { Package, Clock, Truck, CheckCircle, Search, XCircle, CreditCard, Upload, X, Copy, ArrowLeft, Check } from 'lucide-react';
import { ordersService } from '../services/ordersService';
import { paymentGroupService } from '../services/paymentGroupService';
import { useFirebaseOrders } from '../hooks/useFirebaseOrders';
import { useToast } from './ToastProvider';
import BackButton from './BackButton';

interface OrdersPageProps {
  user: any;
  onBack?: () => void;
}

const OrdersPage: React.FC<OrdersPageProps> = ({ user, onBack }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const { orders, loading, error } = useFirebaseOrders();
  const { showToast } = useToast();
  
  // ✨ NEW: Multi-select state
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  // ✨ NEW: Toggle order selection
  const handleToggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  // ✨ NEW: Select all pending orders
  const handleSelectAll = () => {
    const pendingOrderIds = orders
      .filter(o => o.status === 'pending')
      .map(o => o.id);
    
    if (selectedOrderIds.length === pendingOrderIds.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(pendingOrderIds);
    }
  };

  // ✨ NEW: Handle "Bayar Sekarang" button
  const handleBayarSekarang = async () => {
    const selected = orders.filter(o => selectedOrderIds.includes(o.id));
    const subtotal = selected.reduce((sum, o) => sum + o.finalTotal, 0);
    
    // ✅ CHECK: Apakah order pertama sudah punya paymentGroupId?
    const firstOrder = selected[0];
    let existingPaymentGroup = null;
    
    if (firstOrder?.paymentGroupId) {
      try {
        console.log('🔍 Checking existing payment group:', firstOrder.paymentGroupId);
        
        // Load existing payment group
        existingPaymentGroup = await paymentGroupService.getPaymentGroup(firstOrder.paymentGroupId);
        
        if (existingPaymentGroup && existingPaymentGroup.status === 'pending') {
          console.log('✅ Found existing payment group! Using existing code:', existingPaymentGroup.uniquePaymentCode);
          showToast('💡 Menggunakan kode pembayaran yang sudah dibuat', 'info');
          
          // Go directly to instructions with existing payment group
          setPaymentData({
            orderIds: selectedOrderIds,
            subtotal,
            orders: selected,
            paymentGroup: existingPaymentGroup
          });
          
          if (existingPaymentGroup.verificationMode === 'auto') {
            setShowInstructionsModal(true);
          } else if (existingPaymentGroup.verificationMode === 'manual') {
            setShowUploadModal(true);
          } else {
            // No mode selected yet, show method modal
            setShowMethodModal(true);
          }
          
          return; // Exit early - don't show method modal
        } else {
          console.log('⚠️ Payment group not found or already paid/cancelled');
        }
      } catch (error) {
        console.error('❌ Error loading existing payment group:', error);
      }
    }
    
    // No existing payment group, show method selection
    setPaymentData({
      orderIds: selectedOrderIds,
      subtotal,
      orders: selected,
      paymentGroup: null
    });
    
    setShowMethodModal(true);
  };

  // ✨ NEW: User chooses payment method
  const handleChooseMethod = async (mode: 'auto' | 'manual') => {
    try {
      if (mode === 'auto') {
        showToast('🔄 Membuat pembayaran otomatis...', 'info');
        
        // Create payment group with unique code
        const paymentGroup = await paymentGroupService.createPaymentGroup({
          userId: user.uid,
          userName: user.displayName || 'User',
          userEmail: user.email || '',
          orderIds: paymentData.orderIds,
          originalTotal: paymentData.subtotal,
          verificationMode: 'auto'
        });
        
        // Update orders with payment group ID
        for (const orderId of paymentData.orderIds) {
          await ordersService.updateOrder(orderId, {
            paymentGroupId: paymentGroup.id,
            groupPaymentAmount: paymentGroup.exactPaymentAmount,
            verificationMode: 'auto'
          });
        }
        
        setPaymentData({
          ...paymentData,
          paymentGroup
        });
        
        setShowMethodModal(false);
        setShowInstructionsModal(true);
        showToast('✅ Instruksi pembayaran siap!', 'success');
        
      } else {
        // Manual mode - no code generation needed
        setPaymentData({
          ...paymentData,
          verificationMode: 'manual'
        });
        
        setShowMethodModal(false);
        setShowUploadModal(true);
      }
    } catch (error) {
      console.error('Error choosing method:', error);
      showToast('❌ Gagal membuat pembayaran', 'error');
    }
  };

  // ✨ NEW: Handle back from instructions (mode switching)
  const handleBackFromInstructions = async () => {
    const confirmed = window.confirm(
      'Ubah metode pembayaran?\n\nKode unik sudah dibuat, tapi Anda bisa pilih metode lain.'
    );
    
    if (confirmed && paymentData.paymentGroup) {
      try {
        // Update payment group to pending_selection
        await paymentGroupService.updatePaymentGroup(paymentData.paymentGroup.id, {
          status: 'pending_selection',
          verificationMode: null,
          originalMode: 'auto'
        });
        
        setShowInstructionsModal(false);
        setShowMethodModal(true);
        showToast('💡 Silakan pilih metode pembayaran lagi', 'info');
      } catch (error) {
        console.error('Error updating payment group:', error);
        showToast('❌ Gagal mengubah metode', 'error');
      }
    }
  };

  // ✨ NEW: Handle close instructions (cancel payment)
  const handleCloseInstructions = async () => {
    const confirmed = window.confirm(
      'Batalkan pembayaran ini?\n\nKode unik akan dibatalkan dan Anda kembali ke daftar pesanan.'
    );
    
    if (confirmed && paymentData.paymentGroup) {
      try {
        // Cancel payment group
        await paymentGroupService.cancelPaymentGroup(paymentData.paymentGroup.id);
        
        // Remove payment group links from orders
        for (const orderId of paymentData.orderIds) {
          await ordersService.updateOrder(orderId, {
            paymentGroupId: null,
            groupPaymentAmount: null,
            verificationMode: undefined
          });
        }
        
        setShowInstructionsModal(false);
        setPaymentData(null);
        setSelectedOrderIds([]);
        showToast('Pembayaran dibatalkan', 'info');
      } catch (error) {
        console.error('Error cancelling payment:', error);
        showToast('❌ Gagal membatalkan pembayaran', 'error');
      }
    }
  };

  // ✨ NEW: Handle upload bukti payment (manual mode)
  const handleSubmitManualPayment = async () => {
    if (!paymentProof) {
      showToast('❌ Pilih bukti transfer terlebih dahulu', 'error');
      return;
    }

    try {
      setUploadingProof(true);
      
      // Upload bukti for each selected order
      for (const orderId of paymentData.orderIds) {
        await ordersService.updateOrderPayment(
          orderId,
          paymentProof,
          'awaiting_verification'
        );
      }

      setShowUploadModal(false);
      setPaymentData(null);
      setSelectedOrderIds([]);
      setPaymentProof(null);
      
      showToast(`✅ Bukti pembayaran berhasil dikirim untuk ${paymentData.orderIds.length} pesanan!`, 'success');
    } catch (error) {
      console.error('Error submitting payment:', error);
      showToast('❌ Gagal mengupload bukti pembayaran', 'error');
    } finally {
      setUploadingProof(false);
    }
  };

  // Copy to clipboard helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`✅ ${label} berhasil disalin!`, 'success');
  };

  // OLD: Single order payment (legacy - keep for backward compatibility)
  const handlePayNow = (order: any) => {
    setSelectedOrder(order);
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedOrder(null);
    setPaymentProof(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPaymentProof(e.target.files[0]);
    }
  };

  const handleSubmitPayment = async () => {
    if (!selectedOrder || !paymentProof) return;

    try {
      const success = await ordersService.updateOrderPayment(
        selectedOrder.id,
        paymentProof,
        'awaiting_verification'
      );

      if (success) {
        closePaymentModal();
        showToast('✅ Bukti pembayaran berhasil dikirim!', 'success');
      } else {
        showToast('❌ Gagal mengupload bukti pembayaran', 'error');
      }
    } catch (error) {
      console.error('Error submitting payment:', error);
      showToast('❌ Gagal mengupload bukti pembayaran', 'error');
    }
  };

  // Filter orders by active tab
  const filteredUserOrders = activeTab === 'all'
    ? orders
    : orders.filter(order => order.status === activeTab);

  // Get pending orders for selection
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const selectedCount = selectedOrderIds.length;
  const selectedTotal = orders
    .filter(o => selectedOrderIds.includes(o.id))
    .reduce((sum, o) => sum + o.finalTotal, 0);

  const statusConfig = {
    pending: { label: 'Menunggu Pembayaran', icon: Clock, color: 'text-orange-600 bg-orange-100' },
    awaiting_verification: { label: 'Menunggu Verifikasi', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
    paid: { label: 'Dibayar', icon: CheckCircle, color: 'text-blue-600 bg-blue-100' },
    processing: { label: 'Dikemas', icon: Package, color: 'text-blue-600 bg-blue-100' },
    shipped: { label: 'Dikirim', icon: Truck, color: 'text-purple-600 bg-purple-100' },
    delivered: { label: 'Selesai', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
    cancelled: { label: 'Dibatalkan', icon: XCircle, color: 'text-red-600 bg-red-100' }
  };

  const tabs = [
    { id: 'all', label: 'Semua' },
    { id: 'pending', label: 'Belum Bayar' },
    { id: 'awaiting_verification', label: 'Menunggu Verifikasi' },
    { id: 'processing', label: 'Dikemas' },
    { id: 'shipped', label: 'Dikirim' },
    { id: 'delivered', label: 'Selesai' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="p-4 flex items-center gap-4">
          {onBack && <BackButton onClick={onBack} />}
          <h1 className="text-lg font-semibold flex-1 text-center">Pesanan Saya</h1>
        </div>
        
        {/* Search */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari pesanan..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto px-4 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2 mr-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ✨ NEW: Select All Button (only show on pending tab) */}
        {activeTab === 'pending' && pendingOrders.length > 0 && (
          <div className="px-4 pb-3">
            <button
              onClick={handleSelectAll}
              className="text-sm text-pink-600 font-medium hover:text-pink-700"
            >
              {selectedOrderIds.length === pendingOrders.length ? '✓ Batal Pilih Semua' : '□ Pilih Semua'}
            </button>
          </div>
        )}
      </div>

      {/* Orders List */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
            <p className="text-gray-500">Memuat pesanan...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Pesanan</h3>
            <p className="text-gray-500">{error}</p>
          </div>
        ) : filteredUserOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Belum Ada Pesanan</h3>
            <p className="text-gray-500">Pesanan Anda akan muncul di sini</p>
          </div>
        ) : (
          filteredUserOrders.map((order) => {
            const status = statusConfig[order.status as keyof typeof statusConfig];
            const StatusIcon = status?.icon || Package;
            const isPending = order.status === 'pending';
            const isSelected = selectedOrderIds.includes(order.id);

            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
                  isSelected ? 'border-pink-500 ring-2 ring-pink-200' : 'border-gray-100'
                }`}
              >
                {/* ✨ NEW: Checkbox for pending orders */}
                {isPending && (
                  <div className="px-4 pt-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleOrderSelection(order.id)}
                        className="w-5 h-5 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                      />
                      <span className="ml-3 text-sm font-medium text-gray-700">
                        Pilih untuk pembayaran
                      </span>
                    </label>
                  </div>
                )}

                <div className="p-4">
                  {/* Order Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-900">#{order.id}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(order.timestamp).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status?.color || 'text-gray-600 bg-gray-100'}`}>
                      {status?.label || order.status}
                    </span>
                  </div>

                  {/* Order Items Preview */}
                  <div className="space-y-2 mb-3">
                    {order.items?.slice(0, 2).map((item: any, idx: number) => (
                      <div key={idx} className="flex gap-3">
                        <img
                          src={item.productImage || item.imageUrl || '/placeholder.png'}
                          alt={item.productName || item.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.productName || item.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.quantity}x • Rp {(item.price || 0).toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>
                    ))}
                    {(order.items?.length || 0) > 2 && (
                      <p className="text-xs text-gray-500">
                        +{(order.items?.length || 0) - 2} produk lainnya
                      </p>
                    )}
                  </div>

                  {/* Order Total */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-sm text-gray-600">Total Pesanan</span>
                    <span className="text-lg font-bold text-pink-600">
                      Rp {(order.finalTotal || 0).toLocaleString('id-ID')}
                    </span>
                  </div>

                  {/* Action Button (old single payment - keep for non-pending) */}
                  {!isPending && order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <button
                      onClick={() => handlePayNow(order)}
                      className="w-full mt-3 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors font-medium text-sm"
                    >
                      {order.status === 'awaiting_verification' ? 'Upload Ulang Bukti' : 'Bayar Sekarang'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ✨ NEW: Floating "Bayar Sekarang" Button */}
      {selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-20 p-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-gray-600">
                  {selectedCount} pesanan dipilih
                </p>
                <p className="text-xl font-bold text-gray-900">
                  Rp {selectedTotal.toLocaleString('id-ID')}
                </p>
              </div>
              <button
                onClick={handleBayarSekarang}
                className="px-8 py-3 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                Bayar Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ Phase 2: Beautiful Payment Method Modal */}
      {showMethodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold text-gray-900 text-center">
                💳 Pilih Metode Pembayaran
              </h2>
              <p className="text-sm text-gray-600 text-center mt-2">
                Pilih cara verifikasi pembayaran Anda
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Orders Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                <p className="text-sm font-semibold text-blue-900 mb-3">
                  📦 Pesanan Yang Akan Dibayar:
                </p>
                <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                  {paymentData?.orders.map((order: any) => (
                    <div key={order.id} className="flex justify-between items-center text-sm">
                      <span className="text-blue-700">#{order.id.substring(0, 12)}...</span>
                      <span className="font-semibold text-blue-900">
                        Rp {order.finalTotal.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-blue-900">Total:</span>
                    <span className="text-xl font-bold text-blue-900">
                      Rp {paymentData?.subtotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Auto Verification Option */}
              <button
                onClick={() => handleChooseMethod('auto')}
                className="w-full text-left border-2 border-green-500 rounded-xl p-5 hover:shadow-lg transition-all bg-gradient-to-br from-green-50 to-emerald-50"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">✨ Verifikasi Otomatis</h3>
                      <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-semibold rounded-full">
                        RECOMMENDED
                      </span>
                    </div>
                    <ul className="space-y-1.5 mb-3">
                      <li className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span>Cepat (1-5 menit otomatis terverifikasi)</span>
                      </li>
                      <li className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span>Tidak perlu upload bukti transfer</span>
                      </li>
                      <li className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span>Pesanan langsung diproses</span>
                      </li>
                    </ul>
                    <div className="bg-white rounded-lg p-3 border border-green-200">
                      <p className="text-xs text-green-700 mb-1">Transfer dengan kode unik:</p>
                      <p className="text-lg font-bold text-green-900">
                        Rp {paymentData?.subtotal.toLocaleString('id-ID')}.XX
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        (Kode unik akan dibuat otomatis)
                      </p>
                    </div>
                  </div>
                </div>
              </button>

              {/* Manual Verification Option */}
              <button
                onClick={() => handleChooseMethod('manual')}
                className="w-full text-left border-2 border-gray-300 rounded-xl p-5 hover:border-blue-500 hover:shadow-lg transition-all bg-white"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">📸 Verifikasi Manual</h3>
                    <ul className="space-y-1.5 mb-3">
                      <li className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>Upload bukti transfer setelah bayar</span>
                      </li>
                      <li className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>Verifikasi dalam 1-24 jam (saat jam kerja)</span>
                      </li>
                      <li className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>Nominal transfer bisa dibulatkan</span>
                      </li>
                    </ul>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <p className="text-xs text-blue-700 mb-1">Transfer:</p>
                      <p className="text-lg font-bold text-blue-900">
                        Rp {paymentData?.subtotal.toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        (Tanpa kode unik)
                      </p>
                    </div>
                  </div>
                </div>
              </button>

              {/* Cancel Button */}
              <button
                onClick={() => {
                  setShowMethodModal(false);
                  setPaymentData(null);
                  setSelectedOrderIds([]);
                }}
                className="w-full px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ Phase 2: Beautiful Payment Instructions Modal (Auto Mode) */}
      {showInstructionsModal && paymentData?.paymentGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <button
                  onClick={handleBackFromInstructions}
                  className="p-2 hover:bg-white/20 rounded-full transition-all"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <h2 className="text-xl font-bold text-white flex-1 text-center">
                  💳 Instruksi Pembayaran
                </h2>
                <button
                  onClick={handleCloseInstructions}
                  className="p-2 hover:bg-white/20 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* PENTING Warning */}
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                <p className="text-sm font-bold text-amber-900 mb-2">
                  ⚠️ PENTING: Transfer PERSIS sesuai nominal!
                </p>
                <p className="text-xs text-amber-700">
                  Jangan dibulatkan! 2 angka terakhir adalah kode unik untuk verifikasi otomatis.
                </p>
              </div>

              {/* Exact Amount */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-300">
                <p className="text-sm font-semibold text-green-800 mb-2">Total Transfer:</p>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-4xl font-bold text-green-900">
                      Rp {paymentData.paymentGroup.exactPaymentAmount.toLocaleString('id-ID')}
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      = Rp {paymentData.paymentGroup.originalTotal.toLocaleString('id-ID')} 
                      <span className="font-mono font-bold text-green-900"> + {paymentData.paymentGroup.uniquePaymentCode}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(paymentData.paymentGroup.exactPaymentAmount.toString(), 'Nominal')}
                  className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Nominal
                </button>
              </div>

              {/* Bank Accounts */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-900">Transfer ke salah satu rekening:</p>
                
                {/* BCA */}
                <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-blue-700 font-medium mb-1">🏦 Bank BCA</p>
                      <p className="text-lg font-bold text-blue-900 font-mono">0511456494</p>
                      <p className="text-xs text-blue-700 mt-0.5">a.n. Fahrin</p>
                    </div>
                    <button
                      onClick={() => handleCopy('0511456494', 'Nomor rekening BCA')}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-all flex-shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* BRI */}
                <div className="border-2 border-cyan-200 rounded-xl p-4 bg-cyan-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-cyan-700 font-medium mb-1">🏦 Bank BRI</p>
                      <p className="text-lg font-bold text-cyan-900 font-mono">066301000115566</p>
                      <p className="text-xs text-cyan-700 mt-0.5">a.n. Fahrin</p>
                    </div>
                    <button
                      onClick={() => handleCopy('066301000115566', 'Nomor rekening BRI')}
                      className="px-3 py-2 bg-cyan-600 text-white rounded-lg text-xs font-semibold hover:bg-cyan-700 transition-all flex-shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Mandiri */}
                <div className="border-2 border-yellow-200 rounded-xl p-4 bg-yellow-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-yellow-700 font-medium mb-1">🏦 Bank Mandiri</p>
                      <p className="text-lg font-bold text-yellow-900 font-mono">310011008896</p>
                      <p className="text-xs text-yellow-700 mt-0.5">a.n. Fahrin</p>
                    </div>
                    <button
                      onClick={() => handleCopy('310011008896', 'Nomor rekening Mandiri')}
                      className="px-3 py-2 bg-yellow-600 text-white rounded-lg text-xs font-semibold hover:bg-yellow-700 transition-all flex-shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Orders Being Paid */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  📦 Pesanan Yang Dibayar ({paymentData.orders.length}):
                </p>
                <div className="space-y-1.5">
                  {paymentData.orders.map((order: any) => (
                    <div key={order.id} className="flex justify-between text-xs">
                      <span className="text-gray-600">#{order.id}</span>
                      <span className="font-semibold text-gray-900">
                        Rp {order.finalTotal.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">📋 Cara Pembayaran:</p>
                <ol className="text-xs text-blue-800 space-y-1.5 list-decimal list-inside">
                  <li>Copy nominal transfer di atas</li>
                  <li>Copy nomor rekening (BCA atau Mandiri)</li>
                  <li>Buka aplikasi mobile banking Anda</li>
                  <li>Transfer PERSIS Rp {paymentData.paymentGroup.exactPaymentAmount.toLocaleString('id-ID')}</li>
                  <li>Selesai! Pembayaran akan terverifikasi otomatis dalam 1-5 menit</li>
                </ol>
              </div>

              {/* Confirm Button */}
              <button
                onClick={() => {
                  setShowInstructionsModal(false);
                  setPaymentData(null);
                  setSelectedOrderIds([]);
                  showToast('✅ Silakan lakukan transfer sesuai instruksi', 'success');
                }}
                className="w-full px-6 py-4 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-xl font-bold hover:shadow-lg transition-all text-lg"
              >
                Saya Mengerti, Akan Transfer Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ Phase 2: Beautiful Upload Bukti Modal (Manual Mode) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setShowMethodModal(true);
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition-all"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <h2 className="text-xl font-bold text-white flex-1 text-center">
                  📸 Upload Bukti Transfer
                </h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setPaymentData(null);
                    setSelectedOrderIds([]);
                    setPaymentProof(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Orders Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                <p className="text-sm font-semibold text-blue-900 mb-3">
                  📦 Pesanan Yang Akan Dibayar ({paymentData?.orders.length}):
                </p>
                <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                  {paymentData?.orders.map((order: any) => (
                    <div key={order.id} className="flex justify-between text-sm">
                      <span className="text-blue-700">#{order.id.substring(0, 12)}...</span>
                      <span className="font-semibold text-blue-900">
                        Rp {order.finalTotal.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-blue-900">Total:</span>
                    <span className="text-xl font-bold text-blue-900">
                      Rp {paymentData?.subtotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bank Accounts */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-900">Transfer ke salah satu rekening:</p>
                
                <div className="border border-blue-200 rounded-xl p-3 bg-blue-50">
                  <p className="text-xs text-blue-700 font-medium mb-1">🏦 Bank BCA</p>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-base font-bold text-blue-900 font-mono">0511456494</p>
                      <p className="text-xs text-blue-700 mt-0.5">a.n. Fahrin</p>
                    </div>
                    <button
                      onClick={() => handleCopy('0511456494', 'Nomor rekening BCA')}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex-shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="border border-cyan-200 rounded-xl p-3 bg-cyan-50">
                  <p className="text-xs text-cyan-700 font-medium mb-1">🏦 Bank BRI</p>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-base font-bold text-cyan-900 font-mono">066301000115566</p>
                      <p className="text-xs text-cyan-700 mt-0.5">a.n. Fahrin</p>
                    </div>
                    <button
                      onClick={() => handleCopy('066301000115566', 'Nomor rekening BRI')}
                      className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-semibold hover:bg-cyan-700 flex-shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="border border-yellow-200 rounded-xl p-3 bg-yellow-50">
                  <p className="text-xs text-yellow-700 font-medium mb-1">🏦 Bank Mandiri</p>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-base font-bold text-yellow-900 font-mono">310011008896</p>
                      <p className="text-xs text-yellow-700 mt-0.5">a.n. Fahrin</p>
                    </div>
                    <button
                      onClick={() => handleCopy('310011008896', 'Nomor rekening Mandiri')}
                      className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-xs font-semibold hover:bg-yellow-700 flex-shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Upload Section */}
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-semibold text-gray-900 mb-2 block">
                    Upload Bukti Transfer:
                  </span>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-pink-500 transition-all cursor-pointer bg-gray-50">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="payment-proof-upload"
                    />
                    <label htmlFor="payment-proof-upload" className="cursor-pointer block text-center">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-700">
                        {paymentProof ? paymentProof.name : 'Klik untuk pilih gambar'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        PNG, JPG, atau JPEG (max 5MB)
                      </p>
                    </label>
                  </div>
                </label>

                {paymentProof && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-700 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Gambar siap diupload: {paymentProof.name}
                    </p>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">📋 Instruksi:</p>
                <ol className="text-xs text-blue-800 space-y-1.5 list-decimal list-inside">
                  <li>Transfer total di atas ke salah satu rekening</li>
                  <li>Screenshot/foto bukti transfer</li>
                  <li>Upload bukti di atas</li>
                  <li>Klik "Kirim Bukti Transfer"</li>
                  <li>Admin akan verifikasi dalam 1-24 jam</li>
                </ol>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmitManualPayment}
                disabled={!paymentProof || uploadingProof}
                className="w-full px-6 py-4 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-xl font-bold hover:shadow-lg transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploadingProof ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Mengupload...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Kirim Bukti Transfer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OLD: Legacy Single Order Payment Modal (Keep for backward compatibility) */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Upload Bukti Transfer</h2>
              <button onClick={closePaymentModal} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Total Pembayaran</p>
                <p className="text-2xl font-bold text-pink-600">
                  Rp {selectedOrder.finalTotal.toLocaleString('id-ID')}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Bukti Transfer
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <button
                onClick={handleSubmitPayment}
                disabled={!paymentProof}
                className="w-full px-4 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                Kirim Bukti Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
