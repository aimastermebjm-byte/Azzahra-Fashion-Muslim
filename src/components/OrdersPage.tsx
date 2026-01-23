import React, { useState } from 'react';
import { Package, Clock, Truck, CheckCircle, Search, XCircle, CreditCard, Upload, X, Copy, ArrowLeft, Check, MapPin } from 'lucide-react';
import { ordersService } from '../services/ordersService';
import { paymentGroupService } from '../services/paymentGroupService';
import { useFirebaseOrders } from '../hooks/useFirebaseOrders';
import { useToast } from './ToastProvider';
import BackButton from './BackButton';
import ShippingEditModal from './ShippingEditModal';

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

  // ✨ NEW: Shipping edit modal state
  const [shippingEditOrder, setShippingEditOrder] = useState<any>(null);
  const [bulkAddressMode, setBulkAddressMode] = useState(false); // For applying address to all selected Keep orders

  // ✨ Toggle order selection - PREVENT mixing orders needing address with orders not needing address
  const handleToggleOrderSelection = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Helper: Check if order NEEDS address setup (keep mode + not configured)
    const needsAddressSetup = (o: any) => {
      return o.shippingMode === 'keep' && !o.shippingConfigured;
    };

    const currentOrderNeedsAddress = needsAddressSetup(order);

    // If deselecting, just remove
    if (selectedOrderIds.includes(orderId)) {
      setSelectedOrderIds(prev => prev.filter(id => id !== orderId));
      return;
    }

    // If currently no selection, allow any selection
    if (selectedOrderIds.length === 0) {
      // If selecting order that doesn't need address, show info toast
      if (!currentOrderNeedsAddress) {
        showToast({
          type: 'info',
          title: 'Pesanan Siap Bayar',
          message: 'Pesanan ini sudah siap untuk pembayaran.'
        });
      }
      setSelectedOrderIds([orderId]);
      return;
    }

    // Check current selection type
    const currentlySelectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
    const currentSelectionHasNeedsAddress = currentlySelectedOrders.some(o => needsAddressSetup(o));
    const currentSelectionHasReady = currentlySelectedOrders.some(o => !needsAddressSetup(o));

    // Prevent mixing: order needing address with orders already ready
    if (currentOrderNeedsAddress && currentSelectionHasReady) {
      showToast({
        type: 'warning',
        title: 'Tidak bisa digabung',
        message: 'Pesanan yang belum ada alamat tidak bisa digabung dengan pesanan yang sudah siap bayar.'
      });
      return;
    }

    // Prevent mixing: order already ready with orders needing address
    if (!currentOrderNeedsAddress && currentSelectionHasNeedsAddress) {
      showToast({
        type: 'warning',
        title: 'Tidak bisa digabung',
        message: 'Pesanan yang sudah siap bayar tidak bisa digabung dengan pesanan yang belum ada alamat.'
      });
      return;
    }

    // Allow selection
    setSelectedOrderIds(prev => [...prev, orderId]);
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

  // ✨ Handle "Bayar Sekarang" button
  const handleBayarSekarang = async () => {
    try {
      const selected = orders.filter(o => selectedOrderIds.includes(o.id));
      const subtotal = selected.reduce((sum, o) => sum + o.finalTotal, 0);

      if (selected.length === 0) {
        showToast({ title: 'Error', message: 'Pilih minimal satu pesanan', type: 'error' });
        return;
      }

      // Show loading feedback
      // showToast('Memuat pembayaran...', 'info'); // Optional: can be annoying if fast

      // ✅ CHECK: Apakah order pertama sudah punya paymentGroupId?
      const firstOrder = selected[0];
      let existingPaymentGroup = null;

      if (firstOrder?.paymentGroupId) {
        try {
          console.log('🔍 Checking existing payment group:', firstOrder.paymentGroupId);

          // Load existing payment group
          existingPaymentGroup = await paymentGroupService.getPaymentGroup(firstOrder.paymentGroupId);

          if (existingPaymentGroup && existingPaymentGroup.status === 'pending') {
            // ✅ VALIDATE: Check if existing payment group matches current selection
            const isSameOrders =
              existingPaymentGroup.orderIds.length === selectedOrderIds.length &&
              existingPaymentGroup.orderIds.every(id => selectedOrderIds.includes(id));

            const isSameTotal = existingPaymentGroup.originalTotal === subtotal;

            if (isSameOrders && isSameTotal) {
              console.log('✅ Matches existing group!');
              showToast('💡 Menggunakan kode pembayaran yang sudah dibuat', 'info');

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
                setShowMethodModal(true);
              }
              return;
            } else {
              // Mismatch - ask to cancel
              const shouldCancelOld = window.confirm(
                `Ada pembayaran lama yang belum selesai. Batalkan dan buat baru?`
              );

              if (shouldCancelOld) {
                await paymentGroupService.cancelPaymentGroup(existingPaymentGroup.id);
                // Remove payment group links from OLD orders in background to save time?
                // Let's await to be safe but show toast first
                showToast('✅ Pembayaran lama dibatalkan', 'success');

                for (const orderId of existingPaymentGroup.orderIds) {
                  await ordersService.updateOrder(orderId, {
                    paymentGroupId: null,
                    groupPaymentAmount: undefined,
                    verificationMode: undefined
                  });
                }
              } else {
                return;
              }
            }
          }
        } catch (error) {
          console.error('❌ Error checking payment group (ignoring and opening new payment):', error);
          // Fall through to open modal
        }
      }

      // No existing payment group (or cancelled), show method selection
      console.log('🔓 Opening Payment Method Modal');

      setPaymentData({
        orderIds: selectedOrderIds,
        subtotal,
        orders: selected,
        paymentGroup: null
      });

      setShowMethodModal(true);

    } catch (error) {
      console.error('🔥 CRITICAL ERROR in handleBayarSekarang:', error);
      alert('Error Sistem: ' + (error instanceof Error ? error.message : String(error)));
    }
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
        // Update orders with payment group ID
        for (const orderId of paymentData.orderIds) {
          const updateData: any = {
            paymentGroupId: paymentGroup.id,
            groupPaymentAmount: paymentGroup.exactPaymentAmount,
            verificationMode: 'auto'
          };

          // If single order, also update the order's own exact amount for display/matching
          if (paymentData.orderIds.length === 1) {
            updateData.exactPaymentAmount = paymentGroup.exactPaymentAmount;
            updateData.uniquePaymentCode = paymentGroup.uniquePaymentCode;
            updateData.finalTotal = paymentGroup.exactPaymentAmount; // Update final total to include unique code
          }

          await ordersService.updateOrder(orderId, updateData);
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
      showToast({ message: '❌ Pilih bukti transfer terlebih dahulu', type: 'error' });
      return;
    }

    try {
      setUploadingProof(true);
      let successCount = 0;

      // Upload bukti for each selected order
      for (const orderId of paymentData.orderIds) {
        const success = await ordersService.updateOrderPayment(
          orderId,
          paymentProof,
          'awaiting_verification'
        );
        if (success) successCount++;
      }

      if (successCount > 0) {
        setShowUploadModal(false);
        setPaymentData(null);
        setSelectedOrderIds([]);
        setPaymentProof(null);

        showToast({ message: `✅ Bukti pembayaran berhasil dikirim untuk ${successCount} pesanan!`, type: 'success' });
      } else {
        showToast({ message: '❌ Gagal mengupload bukti pembayaran. Coba lagi atau gunakan gambar lebih kecil.', type: 'error' });
      }
    } catch (error) {
      console.error('Error submitting payment:', error);
      showToast({ message: '❌ Gagal mengupload bukti pembayaran', type: 'error' });
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
      {/* Header - Premium Minimalist */}
      <div className="bg-white shadow-sm sticky top-0 z-10 border-b border-gray-100">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && <BackButton onClick={onBack} />}
            <h1 className="text-xl font-display font-bold text-slate-900 tracking-wide">Pesanan Saya</h1>
          </div>
        </div>

        {/* Search - Refined */}
        <div className="px-4 pb-3">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-[#B8860B] transition-colors w-5 h-5" />
            <input
              type="text"
              placeholder="Cari pesanan..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all text-sm font-medium text-slate-900 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Tabs - Gradient Gold Premium Style */}
        <div className="flex overflow-x-auto px-4 pb-3 scrollbar-none gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-bold tracking-wide transition-all duration-300 border ${activeTab === tab.id
                ? 'bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-black shadow-[0_4px_10px_rgba(153,123,44,0.3)] border-[#EDD686]/50 scale-105 shine-effect'
                : 'bg-white text-gray-500 border-gray-200 hover:border-[#D4AF37]/50 hover:text-[#B8860B]'
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
                className={`bg-white rounded-xl shadow-sm border transition-all duration-300 ${isSelected
                  ? 'border-[#D4AF37] ring-1 ring-[#D4AF37] bg-yellow-50/10'
                  : 'border-gray-100 hover:border-[#D4AF37]/30 hover:shadow-md'
                  }`}
              >
                {/* ✨ NEW: Checkbox for pending orders */}
                {isPending && (
                  <div className="px-4 pt-4">
                    <label className="flex items-center cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-[#D4AF37] border-[#D4AF37] shine-effect' : 'border-gray-300 group-hover:border-[#D4AF37]'}`}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleOrderSelection(order.id)}
                        className="hidden"
                      />
                      <span className="ml-3 text-sm font-bold text-slate-800">
                        Pilih untuk pembayaran
                      </span>
                    </label>
                  </div>
                )}

                <div className="p-4">
                  {/* Order Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-gray-50 rounded-lg">
                          <Package className="w-4 h-4 text-[#D4AF37]" />
                        </div>
                        <span className="text-sm font-bold text-slate-900 tracking-wide">#{order.id.slice(0, 8)}...</span>
                      </div>
                      <p className="text-xs font-medium text-gray-500 pl-9">
                        {new Date(order.timestamp).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider ${status?.color.replace('text-pink-600', 'text-[#D4AF37]').replace('bg-pink-100', 'bg-yellow-50') || 'text-gray-600 bg-gray-100'
                        }`}>
                        {status?.label || order.status}
                      </span>
                      {/* ✨ NEW: Keep Mode Badge */}
                      {(order as any).shippingMode === 'keep' && !(order as any).shippingConfigured && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          Alamat Belum Diatur
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Order Items Preview - Clean Premium Look */}
                  <div className="space-y-4 mb-4 mt-2">
                    {order.items?.slice(0, 2).map((item: any, idx: number) => (
                      <div key={idx} className="flex gap-4 p-2 hover:bg-gray-50 rounded-xl transition-colors -mx-2">
                        <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                          <img
                            src={item.productImage || item.imageUrl || '/placeholder.png'}
                            alt={item.productName || item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                          <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-tight">
                            {item.productName || item.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            {item.selectedVariant?.color && (
                              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-medium">
                                {item.selectedVariant.color}
                              </span>
                            )}
                            {item.selectedVariant?.size && (
                              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-medium">
                                {item.selectedVariant.size}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-500">{item.quantity} barang</span>
                            <span className="text-sm font-semibold text-slate-900">
                              Rp {(item.price || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(order.items?.length || 0) > 2 && (
                      <button className="text-xs font-medium text-[#B8860B] hover:underline pl-1">
                        + Lihat {(order.items?.length || 0) - 2} produk lainnya...
                      </button>
                    )}
                  </div>

                  {/* Order Total */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 border-dashed">
                    <span className="text-xs sm:text-sm font-medium text-gray-500">Total Pesanan</span>
                    <span className="text-base sm:text-lg font-bold text-[#997B2C]">
                      Rp {(order.finalTotal || 0).toLocaleString('id-ID')}
                    </span>
                  </div>

                  {/* ✨ NEW: Edit Shipping Button for Keep Mode */}
                  {(() => {
                    const isKeepMode = (order as any).shippingMode === 'keep';
                    const notConfigured = !(order as any).shippingConfigured;
                    const noAddress = !(order as any).shippingInfo?.address;

                    if (isKeepMode && (notConfigured || noAddress)) {
                      return (
                        <button
                          onClick={() => setShippingEditOrder(order)}
                          className="w-full mt-4 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl shadow-sm hover:shadow-lg hover:from-amber-600 hover:to-orange-600 transition-all font-bold text-sm flex items-center justify-center gap-2"
                        >
                          <MapPin className="w-4 h-4" />
                          Atur Alamat & Kurir
                        </button>
                      );
                    }
                    return null;
                  })()}

                  {/* Action Button (only for awaiting verification) */}
                  {!isPending && order.status === 'awaiting_verification' && (
                    <button
                      onClick={() => {
                        const isKeepUnconfigured = (order as any).shippingMode === 'keep' && !(order as any).shippingConfigured;
                        if (isKeepUnconfigured) {
                          showToast({
                            type: 'warning',
                            title: 'Alamat belum diatur',
                            message: 'Silahkan atur alamat pengiriman terlebih dahulu sebelum melakukan pembayaran.'
                          });
                          return;
                        }
                        handlePayNow(order);
                      }}
                      className="w-full mt-4 px-4 py-2.5 bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-black rounded-xl hover:shadow-[0_4px_14px_0_rgba(153,123,44,0.39)] transition-all font-bold text-sm shadow-sm shine-effect"
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
        <div className="fixed bottom-16 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-[60] px-4 py-4">
          <div className="max-w-2xl mx-auto">
            {/* Check if any selected order is Keep mode and not configured */}
            {(() => {
              const selectedKeepOrders = pendingOrders.filter(
                (o: any) => selectedOrderIds.includes(o.id) &&
                  o.shippingMode === 'keep' && !o.shippingConfigured
              );
              const hasUnconfiguredKeep = selectedKeepOrders.length > 0;

              return (
                <>
                  {/* Warning and Apply Address button for Keep orders */}
                  {hasUnconfiguredKeep && (
                    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-sm text-amber-800 mb-2">
                        ⚠️ <strong>{selectedKeepOrders.length} pesanan</strong> belum diatur alamatnya
                      </p>
                      <button
                        onClick={() => {
                          // Open modal with first unconfigured order, but in bulk mode
                          setBulkAddressMode(true);
                          setShippingEditOrder(selectedKeepOrders[0]);
                        }}
                        className="w-full py-2 bg-amber-500 text-white rounded-lg font-medium text-sm hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <MapPin className="w-4 h-4" />
                        Terapkan Alamat ke Semua ({selectedKeepOrders.length} pesanan)
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">
                        {selectedCount} pesanan dipilih
                      </p>
                      <p className="text-xl font-bold text-[#997B2C]">
                        Rp {selectedTotal.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <button
                      onClick={handleBayarSekarang}
                      disabled={hasUnconfiguredKeep}
                      className={`flex-1 px-6 py-3 rounded-full font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${hasUnconfiguredKeep
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-black shadow-[0_4px_14px_0_rgba(153,123,44,0.39)] hover:scale-[1.02] hover:shadow-[0_6px_20px_rgba(153,123,44,0.23)] shine-effect'
                        }`}
                    >
                      <CreditCard className="w-5 h-5" />
                      Bayar Sekarang
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ✨ Simplified Payment Method Modal */}
      {showMethodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] p-4 rounded-t-2xl shadow-md shine-effect">
              <h2 className="text-xl font-bold text-slate-900 text-center">
                💳 Pilih Metode Pembayaran
              </h2>
              <p className="text-sm text-slate-800 font-medium text-center mt-1">
                Total: Rp {paymentData?.subtotal?.toLocaleString('id-ID') ?? 0}
              </p>
            </div>

            <div className="p-4 space-y-3">
              {/* Auto Verification Option - Premium Gold (Recommended) */}
              <button
                onClick={() => handleChooseMethod('auto')}
                className="w-full text-left border-2 border-[#D4AF37] rounded-xl p-4 hover:shadow-lg transition-all bg-gradient-to-br from-yellow-50 to-amber-50 relative overflow-hidden shine-effect"
              >
                {/* Recommended Badge */}
                <div className="absolute top-0 right-0 bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-black text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                  REKOMENDASI
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#997B2C] via-[#EDD686] to-[#997B2C] rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                    <Check className="w-6 h-6 text-black" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-slate-900">⚡ Verifikasi Otomatis</h3>
                    <p className="text-sm text-slate-600 mt-0.5">
                      Cepat (1-5 menit), bayar sesuai angka + kode unik
                    </p>
                  </div>
                </div>
              </button>

              {/* Manual Verification Option - Subtle/Secondary */}
              <button
                onClick={() => handleChooseMethod('manual')}
                className="w-full text-left border-2 border-gray-200 rounded-xl p-4 hover:border-[#D4AF37] hover:shadow-md transition-all bg-white"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Upload className="w-6 h-6 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-slate-700">📸 Verifikasi Manual</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Upload bukti transfer, verifikasi 1-24 jam
                    </p>
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
                className="w-full px-4 py-2.5 border border-gray-200 text-slate-500 rounded-xl font-medium hover:bg-gray-50 transition-all text-sm"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ Simplified Auto Payment Instructions Modal */}
      {showInstructionsModal && paymentData?.paymentGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header - Gold Theme */}
            <div className="bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] p-4 rounded-t-2xl shadow-md shine-effect">
              <div className="flex items-center justify-between">
                <button
                  onClick={handleBackFromInstructions}
                  className="p-2 hover:bg-black/10 rounded-full transition-all"
                >
                  <ArrowLeft className="w-5 h-5 text-black" />
                </button>
                <h2 className="text-lg font-bold text-slate-900 flex-1 text-center">
                  ⚡ Verifikasi Otomatis
                </h2>
                <button
                  onClick={handleCloseInstructions}
                  className="p-2 hover:bg-black/10 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-black" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Warning - Compact */}
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                <p className="text-xs font-bold text-amber-900">
                  ⚠️ Transfer PERSIS sesuai nominal (jangan dibulatkan)
                </p>
              </div>

              {/* Exact Amount - Gold Theme */}
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-4 border-2 border-[#D4AF37] text-center">
                <p className="text-xs font-semibold text-[#997B2C] mb-2">Total Transfer:</p>
                <p className="text-4xl font-bold text-slate-900 mb-2">
                  Rp {paymentData.paymentGroup.exactPaymentAmount.toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-slate-600 mb-3">
                  Rp {paymentData.paymentGroup.originalTotal.toLocaleString('id-ID')} + <span className="font-mono font-bold text-[#997B2C]">{paymentData.paymentGroup.uniquePaymentCode}</span> (kode unik)
                </p>
                <button
                  onClick={() => handleCopy(paymentData.paymentGroup.exactPaymentAmount.toString(), 'Nominal')}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-black rounded-lg font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Nominal
                </button>
              </div>

              {/* Bank Accounts - Clean Uniform Style */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-900">Transfer ke salah satu rekening:</p>

                {/* BCA */}
                <div className="border border-gray-200 rounded-lg p-3 bg-white flex items-center justify-between hover:border-[#D4AF37] transition-colors">
                  <div>
                    <p className="text-xs text-slate-600 font-medium">🏦 BCA - Fahrin</p>
                    <p className="text-base font-bold text-slate-900 font-mono">0511456494</p>
                  </div>
                  <button
                    onClick={() => handleCopy('0511456494', 'Nomor rekening BCA')}
                    className="px-3 py-2 bg-gradient-to-r from-[#997B2C] to-[#D4AF37] text-white rounded-lg hover:shadow-md transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                {/* BRI */}
                <div className="border border-gray-200 rounded-lg p-3 bg-white flex items-center justify-between hover:border-[#D4AF37] transition-colors">
                  <div>
                    <p className="text-xs text-slate-600 font-medium">🏦 BRI - Fahrin</p>
                    <p className="text-base font-bold text-slate-900 font-mono">066301000115566</p>
                  </div>
                  <button
                    onClick={() => handleCopy('066301000115566', 'Nomor rekening BRI')}
                    className="px-3 py-2 bg-gradient-to-r from-[#997B2C] to-[#D4AF37] text-white rounded-lg hover:shadow-md transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                {/* Mandiri */}
                <div className="border border-gray-200 rounded-lg p-3 bg-white flex items-center justify-between hover:border-[#D4AF37] transition-colors">
                  <div>
                    <p className="text-xs text-slate-600 font-medium">🏦 Mandiri - Fahrin</p>
                    <p className="text-base font-bold text-slate-900 font-mono">310011008896</p>
                  </div>
                  <button
                    onClick={() => handleCopy('310011008896', 'Nomor rekening Mandiri')}
                    className="px-3 py-2 bg-gradient-to-r from-[#997B2C] to-[#D4AF37] text-white rounded-lg hover:shadow-md transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Simple Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-700">
                  Transfer sesuai nominal + kode unik, verifikasi otomatis dalam 1-5 menit
                </p>
              </div>

              {/* Confirm Button - Gold */}
              <button
                onClick={() => {
                  setShowInstructionsModal(false);
                  setPaymentData(null);
                  setSelectedOrderIds([]);
                  showToast('✅ Silakan lakukan transfer sesuai instruksi', 'success');
                }}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-black rounded-xl font-bold hover:shadow-lg transition-all"
              >
                Mengerti, Transfer Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ Simplified Manual Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header - Gold Theme */}
            <div className="bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] p-4 rounded-t-2xl shadow-md">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setShowMethodModal(true);
                  }}
                  className="p-2 hover:bg-black/10 rounded-full transition-all"
                >
                  <ArrowLeft className="w-5 h-5 text-black" />
                </button>
                <h2 className="text-lg font-bold text-slate-900 flex-1 text-center">
                  📸 Verifikasi Manual
                </h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setPaymentData(null);
                    setSelectedOrderIds([]);
                    setPaymentProof(null);
                  }}
                  className="p-2 hover:bg-black/10 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-black" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Total Amount - Gold Theme */}
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-4 border-2 border-[#D4AF37] text-center">
                <p className="text-xs font-semibold text-[#997B2C] mb-2">Total Transfer:</p>
                <p className="text-3xl font-bold text-slate-900 mb-3">
                  Rp {paymentData?.subtotal.toLocaleString('id-ID')}
                </p>
                <button
                  onClick={() => handleCopy(paymentData?.subtotal.toString() || '', 'Nominal')}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-black rounded-lg font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 mx-auto"
                >
                  <Copy className="w-4 h-4" />
                  Copy Nominal
                </button>
              </div>

              {/* Bank Accounts - Clean Uniform Style */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-900">Transfer ke salah satu rekening:</p>

                <div className="border border-gray-200 rounded-lg p-3 bg-white flex items-center justify-between hover:border-[#D4AF37] transition-colors">
                  <div>
                    <p className="text-xs text-slate-600 font-medium">🏦 BCA - Fahrin</p>
                    <p className="text-base font-bold text-slate-900 font-mono">0511456494</p>
                  </div>
                  <button
                    onClick={() => handleCopy('0511456494', 'Nomor rekening BCA')}
                    className="px-3 py-2 bg-gradient-to-r from-[#997B2C] to-[#D4AF37] text-white rounded-lg hover:shadow-md transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg p-3 bg-white flex items-center justify-between hover:border-[#D4AF37] transition-colors">
                  <div>
                    <p className="text-xs text-slate-600 font-medium">🏦 BRI - Fahrin</p>
                    <p className="text-base font-bold text-slate-900 font-mono">066301000115566</p>
                  </div>
                  <button
                    onClick={() => handleCopy('066301000115566', 'Nomor rekening BRI')}
                    className="px-3 py-2 bg-gradient-to-r from-[#997B2C] to-[#D4AF37] text-white rounded-lg hover:shadow-md transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg p-3 bg-white flex items-center justify-between hover:border-[#D4AF37] transition-colors">
                  <div>
                    <p className="text-xs text-slate-600 font-medium">🏦 Mandiri - Fahrin</p>
                    <p className="text-base font-bold text-slate-900 font-mono">310011008896</p>
                  </div>
                  <button
                    onClick={() => handleCopy('310011008896', 'Nomor rekening Mandiri')}
                    className="px-3 py-2 bg-gradient-to-r from-[#997B2C] to-[#D4AF37] text-white rounded-lg hover:shadow-md transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Upload Section - Gold Accent */}
              <div>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-900 mb-2 block">
                    Upload Bukti Transfer:
                  </span>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-[#D4AF37] transition-all cursor-pointer bg-gray-50">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="payment-proof-upload"
                    />
                    <label htmlFor="payment-proof-upload" className="cursor-pointer block text-center">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-700">
                        {paymentProof ? paymentProof.name : 'Klik untuk pilih gambar'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        PNG, JPG, atau JPEG (max 5MB)
                      </p>
                    </label>
                  </div>
                </label>

                {paymentProof && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                    <p className="text-xs text-amber-800 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Siap upload: {paymentProof.name}
                    </p>
                  </div>
                )}
              </div>

              {/* Simple Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-700">
                  Upload bukti transfer, verifikasi dalam 1-24 jam
                </p>
              </div>

              {/* Submit Button - Gold */}
              <button
                onClick={handleSubmitManualPayment}
                disabled={!paymentProof || uploadingProof}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-black rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

      {/* ✨ NEW: Shipping Edit Modal */}
      <ShippingEditModal
        isOpen={!!shippingEditOrder}
        onClose={() => {
          setShippingEditOrder(null);
          setBulkAddressMode(false);
        }}
        order={shippingEditOrder}
        bulkOrders={bulkAddressMode
          ? pendingOrders.filter((o: any) =>
            selectedOrderIds.includes(o.id) &&
            o.shippingMode === 'keep' &&
            !o.shippingConfigured
          )
          : undefined
        }
        onSuccess={() => {
          // Refresh orders will happen via real-time listener
          setShippingEditOrder(null);
          setBulkAddressMode(false);
        }}
      />
    </div>
  );
};

export default OrdersPage;
