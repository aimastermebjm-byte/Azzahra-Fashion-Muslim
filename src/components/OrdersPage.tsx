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
  const handleBayarSekarang = () => {
    const selected = orders.filter(o => selectedOrderIds.includes(o.id));
    const subtotal = selected.reduce((sum, o) => sum + o.finalTotal, 0);
    
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

      {/* ✨ NEW: Simple Test Modal (Temporary - Phase 1) */}
      {showMethodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                🎉 Multi-Select Works!
              </h2>
              <p className="text-sm text-gray-600">
                Foundation tested successfully. Beautiful payment modals coming in Phase 2!
              </p>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">Selected Orders:</p>
              <ul className="space-y-1">
                {paymentData?.orders.map((order: any) => (
                  <li key={order.id} className="text-xs text-blue-700">
                    • #{order.id} - Rp {order.finalTotal.toLocaleString('id-ID')}
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-lg font-bold text-blue-900">
                  Total: Rp {paymentData?.subtotal.toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleChooseMethod('auto')}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                ✨ Test Auto Mode (Coming Soon!)
              </button>
              <button
                onClick={() => handleChooseMethod('manual')}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                📸 Test Manual Mode (Coming Soon!)
              </button>
              <button
                onClick={() => {
                  setShowMethodModal(false);
                  setPaymentData(null);
                  setSelectedOrderIds([]);
                }}
                className="w-full px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ NEW: Temporary Instructions Modal */}
      {showInstructionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              💳 Payment Instructions (Test)
            </h2>
            <div className="bg-green-50 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-green-900 mb-2">
                Auto Mode Activated!
              </p>
              {paymentData?.paymentGroup && (
                <>
                  <p className="text-xs text-green-700 mb-2">
                    Payment Group ID: {paymentData.paymentGroup.id}
                  </p>
                  <p className="text-2xl font-bold text-green-900 mb-1">
                    Rp {paymentData.paymentGroup.exactPaymentAmount.toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-green-600">
                    Code: {paymentData.paymentGroup.uniquePaymentCode}
                  </p>
                </>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-4">
              ✅ Payment group created successfully!<br/>
              📋 Beautiful instructions modal coming in Phase 2!
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowInstructionsModal(false);
                  setPaymentData(null);
                  setSelectedOrderIds([]);
                  showToast('✅ Test complete! Payment group created.', 'success');
                }}
                className="w-full px-4 py-3 bg-pink-500 text-white rounded-xl font-semibold hover:bg-pink-600"
              >
                Close (Test Complete)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ NEW: Temporary Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              📸 Upload Bukti (Test)
            </h2>
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                Manual Mode Activated!
              </p>
              <p className="text-lg font-bold text-blue-900">
                Total: Rp {paymentData?.subtotal.toLocaleString('id-ID')}
              </p>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              ✅ Manual mode works!<br/>
              📋 Beautiful upload form coming in Phase 2!
            </p>
            <button
              onClick={() => {
                setShowUploadModal(false);
                setPaymentData(null);
                setSelectedOrderIds([]);
                showToast('✅ Test complete! Manual mode activated.', 'success');
              }}
              className="w-full px-4 py-3 bg-pink-500 text-white rounded-xl font-semibold hover:bg-pink-600"
            >
              Close (Test Complete)
            </button>
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
