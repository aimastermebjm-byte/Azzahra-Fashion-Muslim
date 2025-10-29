import React, { useState, useEffect } from 'react';
import { ArrowLeft, Package, Clock, CheckCircle, Truck, XCircle, Eye, Search, Filter, Calendar, Download, X, Upload, CreditCard, MapPin, Phone, Mail, Edit2, Check, User } from 'lucide-react';
import { useFirebaseAdminOrders } from '../hooks/useFirebaseAdminOrders';
import { ordersService } from '../services/ordersService';

interface AdminOrdersPageProps {
  onBack: () => void;
  user: any;
}

const AdminOrdersPage: React.FC<AdminOrdersPageProps> = ({ onBack, user }) => {
  const { orders, loading, error } = useFirebaseAdminOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [paymentProof, setPaymentProof] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Firebase order management functions
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    return await ordersService.updateOrderStatus(orderId, newStatus);
  };

  const updateOrderPayment = async (orderId: string, proof: string, status?: string) => {
    return await ordersService.updateOrderPayment(orderId, proof, status);
  };

  const deleteOrder = async (orderId: string) => {
    return await ordersService.deleteOrder(orderId);
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
      console.log('AdminOrdersPage: Order update received', event.detail);
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

  // Filter and search orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === '' ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.userEmail.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const handleVerifyPayment = (order: any) => {
    setSelectedOrder(order);
    setShowVerificationModal(true);
  };

  const handleUpdateStatus = (orderId: string, status: string) => {
    updateOrderStatus(orderId, status as any);
  };

  const handleConfirmVerification = async (status: 'paid' | 'cancelled') => {
    if (selectedOrder) {
      try {
        if (status === 'paid') {
          await updateOrderPayment(selectedOrder.id, paymentProof || 'payment_verified', 'paid');
        } else {
          await updateOrderStatus(selectedOrder.id, status);
        }
        setShowVerificationModal(false);
        setSelectedOrder(null);
        setPaymentProof('');
        setVerificationNotes('');
      } catch (error) {
        console.error('❌ Error confirming verification:', error);
        alert('Gagal memperbarui verifikasi pesanan');
      }
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus pesanan ini?')) {
      deleteOrder(orderId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Kelola Pesanan</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Orders Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-1">Total Pesanan</h4>
            <p className="text-2xl font-bold text-blue-600">{orders.length}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-orange-800 mb-1">Menunggu</h4>
            <p className="text-2xl font-bold text-orange-600">
              {getOrdersByStatus('pending').length + getOrdersByStatus('awaiting_verification').length}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-800 mb-1">Selesai</h4>
            <p className="text-2xl font-bold text-green-600">{getOrdersByStatus('delivered').length}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-purple-800 mb-1">Total Revenue</h4>
            <p className="text-2xl font-bold text-purple-600">
              {Math.round(getTotalRevenue() / 1000)}K
            </p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4">
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua Status</option>
              {Object.entries(statusConfig).map(([status, config]) => (
                <option key={status} value={status}>{config.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

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

              return (
                <div key={order.id} className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
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
                      {order.items.length} item • {order.paymentMethod === 'transfer' ? 'Transfer Bank' : 'COD'}
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
                        <button
                          onClick={() => handleVerifyPayment(order)}
                          className="flex items-center space-x-1 text-green-600 hover:text-green-700 text-sm font-medium"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Verifikasi</span>
                        </button>
                      ) : null}

                      {order.status === 'paid' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'processing')}
                          className="flex items-center space-x-1 text-purple-600 hover:text-purple-700 text-sm font-medium"
                        >
                          <Package className="w-4 h-4" />
                          <span>Proses</span>
                        </button>
                      )}

                      {order.status === 'processing' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'shipped')}
                          className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                        >
                          <Truck className="w-4 h-4" />
                          <span>Kirim</span>
                        </button>
                      )}

                      {order.status === 'shipped' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'delivered')}
                          className="flex items-center space-x-1 text-green-600 hover:text-green-700 text-sm font-medium"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Selesai</span>
                        </button>
                      )}

                      {(user?.role === 'owner' || user?.role === 'admin') && (
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="flex items-center space-x-1 text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Batal</span>
                        </button>
                      )}
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
                      <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-gray-600">
                          {item.selectedVariant?.size}, {item.selectedVariant?.color} • {item.quantity} pcs
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Rp {item.price.toLocaleString('id-ID')}</p>
                        <p className="text-sm text-gray-600">Total: Rp {item.total.toLocaleString('id-ID')}</p>
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

              {/* Payment Proof */}
              {selectedOrder.paymentProof && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Bukti Pembayaran
                  </h3>
                  {selectedOrder.paymentProofUrl ? (
                    <img
                      src={selectedOrder.paymentProofUrl}
                      alt="Payment Proof"
                      className="w-full max-w-md rounded-lg border-2 border-green-200"
                    />
                  ) : (
                    <p className="text-sm text-green-800">Bukti pembayaran telah tersimpan</p>
                  )}
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
                {(selectedOrder.status === 'pending' || selectedOrder.status === 'awaiting_verification') && (
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
    </div>
  );
};

export default AdminOrdersPage;