import React, { useState } from 'react';
import { Package, Clock, Truck, CheckCircle, Search, XCircle, CreditCard, Upload, X, Copy } from 'lucide-react';
import { ordersService } from '../services/ordersService';
import { useFirebaseOrders } from '../hooks/useFirebaseOrders';

interface OrdersPageProps {
  user: any;
}

const OrdersPage: React.FC<OrdersPageProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const { orders, loading, error } = useFirebaseOrders();
  
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

  const handleCopyAccount = (accountNumber: string, bankName: string) => {
    navigator.clipboard.writeText(accountNumber);
    alert(`✅ Nomor rekening ${bankName} berhasil disalin!\n\n${accountNumber}\na.n. Fahrin`);
  };

  const handleSubmitPayment = async () => {
    if (!selectedOrder || !paymentProof) return;

    try {
      console.log('💳 Uploading payment proof to Firebase:', selectedOrder.id, paymentProof.name);

      // Update order with payment proof and change status to awaiting_verification
      const success = await ordersService.updateOrderPayment(
        selectedOrder.id,
        paymentProof, // Send File object instead of filename
        'awaiting_verification'
      );

      if (success) {
        closePaymentModal();
        const message = selectedOrder.paymentProof
          ? 'Bukti pembayaran berhasil diupload ulang! Menunggu verifikasi admin.'
          : 'Bukti pembayaran berhasil dikirim! Menunggu verifikasi admin.';
        alert(message);
        console.log('✅ Payment proof uploaded successfully, status changed to awaiting_verification');
      } else {
        alert('❌ Gagal mengupload bukti pembayaran. Silakan coba lagi.');
      }
    } catch (error) {
      console.error('❌ Error submitting payment:', error);
      alert('❌ Gagal mengupload bukti pembayaran. Silakan coba lagi.');
    }
  };

  // Filter orders by active tab (orders are already filtered by user in useFirebaseOrders)
  const filteredUserOrders = activeTab === 'all'
    ? orders
    : orders.filter(order => order.status === activeTab);

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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="p-4">
          <h1 className="text-lg font-semibold text-center">Pesanan Saya</h1>
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
            const statusInfo = statusConfig[order.status as keyof typeof statusConfig];
            const StatusIcon = statusInfo.icon;
            
            return (
              <div key={order.id} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-800">#{order.id}</p>
                    <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    <span>{statusInfo.label}</span>
                  </div>
                </div>
                
                <div className="space-y-2 mb-3">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.productName} x{item.quantity}</span>
                      <span className="font-medium">Rp {item.total.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-3 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Pesanan</span>
                  <span className="font-bold text-pink-600">Rp {order.finalTotal.toLocaleString('id-ID')}</span>
                </div>
                
                <div className="mt-3 flex space-x-2">
                  <button className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                    Detail
                  </button>
                  {order.status === 'pending' && order.paymentMethod === 'transfer' && !order.paymentProof && (
                    <button 
                      onClick={() => handlePayNow(order)}
                      className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors flex items-center justify-center space-x-1"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Bayar</span>
                    </button>
                  )}
                  {(order.status === 'pending' || order.status === 'awaiting_verification') && order.paymentProof && (
                    <div className="flex-1 flex space-x-2">
                      <div className="flex-1 bg-yellow-100 text-yellow-700 py-2 rounded-lg text-sm font-medium text-center">
                        ⏳ Menunggu Verifikasi
                      </div>
                      <button 
                        onClick={() => handlePayNow(order)}
                        className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center space-x-1"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Upload Ulang</span>
                      </button>
                    </div>
                  )}
                  {order.status === 'paid' && (
                    <div className="flex-1 bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium text-center">
                      ✅ Pembayaran Terverifikasi
                    </div>
                  )}
                  {order.status === 'delivered' && (
                    <button className="flex-1 bg-pink-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-600 transition-colors">
                      Beli Lagi
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={closePaymentModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Pembayaran</h2>
              <p className="text-sm text-gray-600">Pesanan #{selectedOrder.id}</p>
              <p className="text-lg font-bold text-pink-600 mt-2">
                Rp {selectedOrder.finalTotal.toLocaleString('id-ID')}
              </p>
              {selectedOrder.paymentProof && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm font-medium">📄 Upload Ulang Bukti Pembayaran</p>
                  <p className="text-yellow-600 text-xs mt-1">
                    Bukti sebelumnya: {selectedOrder.paymentProof}
                  </p>
                </div>
              )}
            </div>

            {/* Bank Transfer Info */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-800 mb-3">Transfer ke Rekening:</h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-blue-200">
                  <div>
                    <span className="font-medium text-gray-700">BCA</span>
                    <div className="font-mono text-xs text-gray-600">0511456494</div>
                  </div>
                  <button
                    onClick={() => handleCopyAccount('0511456494', 'BCA')}
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-xs font-medium transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Salin</span>
                  </button>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-blue-200">
                  <div>
                    <span className="font-medium text-gray-700">BRI</span>
                    <div className="font-mono text-xs text-gray-600">066301000115566</div>
                  </div>
                  <button
                    onClick={() => handleCopyAccount('066301000115566', 'BRI')}
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-xs font-medium transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Salin</span>
                  </button>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-blue-200">
                  <div>
                    <span className="font-medium text-gray-700">MANDIRI</span>
                    <div className="font-mono text-xs text-gray-600">310011008896</div>
                  </div>
                  <button
                    onClick={() => handleCopyAccount('310011008896', 'MANDIRI')}
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-xs font-medium transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Salin</span>
                  </button>
                </div>
                <div className="text-center mt-3 p-2 bg-blue-100 rounded-lg">
                  <p className="text-blue-700 font-semibold text-sm">
                    a.n. Fahrin
                  </p>
                </div>
              </div>
            </div>

            {/* Upload Payment Proof */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Bukti Pembayaran
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="payment-proof-modal"
                />
                <label htmlFor="payment-proof-modal" className="cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    {paymentProof ? paymentProof.name : 'Klik untuk upload bukti transfer'}
                  </p>
                </label>
              </div>
            </div>

            <button
              onClick={handleSubmitPayment}
              disabled={!paymentProof}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
            >
              {selectedOrder?.paymentProof ? 'Upload Ulang Bukti Pembayaran' : 'Kirim Bukti Pembayaran'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;