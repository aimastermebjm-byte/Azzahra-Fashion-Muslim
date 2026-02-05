import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Eye,
  Settings as SettingsIcon,
  FileText,
  Search,
  AlertCircle,
  Clock,
  DollarSign,
  User,
  Calendar,
  TrendingUp,
  X
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import PageHeader from './PageHeader';
import { paymentDetectionService, PaymentDetection, PaymentDetectionSettings } from '../services/paymentDetectionService';
import { ordersService } from '../services/ordersService';
import { autoVerificationLogService } from '../services/autoVerificationLogService';
import { useToast } from './ToastProvider';
import AdminAutoVerificationLogsPage from './AdminAutoVerificationLogsPage';

interface AdminPaymentVerificationPageProps {
  onBack: () => void;
  user: any;
}

const AdminPaymentVerificationPage: React.FC<AdminPaymentVerificationPageProps> = ({ onBack, user }) => {
  const { showToast } = useToast();
  const isOwner = user?.role === 'owner';

  // Access control - Owner only
  if (!isOwner) {
    showToast({
      title: 'Akses Ditolak',
      message: 'Hanya Owner yang bisa mengakses halaman Verifikasi Pembayaran',
      type: 'error'
    });
    onBack();
    return null;
  }

  const [pendingDetections, setPendingDetections] = useState<PaymentDetection[]>([]);
  const [verifiedDetections, setVerifiedDetections] = useState<PaymentDetection[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PaymentDetectionSettings | null>(null);
  const [selectedDetection, setSelectedDetection] = useState<PaymentDetection | null>(null);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadVerifiedDetections();
    loadSettings();

    // Real-time listener for pending detections
    const unsubscribeDetections = paymentDetectionService.onPendingDetectionsChange((detections) => {
      setPendingDetections(detections);
      // Trigger match with current orders
      // Note: matchDetectionsWithOrders will be triggered by useEffect below
    });

    // Real-time listener for pending orders
    const ordersRef = collection(db, 'orders');
    const qOrders = query(
      ordersRef,
      where('status', 'in', ['pending', 'waiting_payment'])
    );

    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const loadedOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPendingOrders(loadedOrders);
    });

    return () => {
      unsubscribeDetections();
      unsubscribeOrders();
    };
  }, []);

  // Trigger matching whenever detections, orders, or settings change
  useEffect(() => {
    if (pendingDetections.length > 0 && pendingOrders.length > 0) {
      matchDetectionsWithOrders(pendingDetections, pendingOrders);
    }
  }, [pendingDetections, pendingOrders, settings]);

  const loadVerifiedDetections = async () => {
    const verified = await paymentDetectionService.getVerifiedDetections();
    setVerifiedDetections(verified);
    setLoading(false);
  };

  const loadSettings = async () => {
    // ... existing loadSettings code ...
    try {
      const loadedSettings = await paymentDetectionService.getSettings();
      console.log('🔧 Settings loaded:', loadedSettings);
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
      setSettings(null);
    }
  };

  const loadData = async () => {
    await loadVerifiedDetections();
    await loadSettings();
  };

  // Track detections currently being verified to prevent duplicate calls
  const processingRef = useRef<Set<string>>(new Set());

  const matchDetectionsWithOrders = async (
    detections: PaymentDetection[],
    orders: any[]
  ) => {
    try {
      // Use passed orders instead of refetching
      const pending = orders;
      let hasUpdates = false;

      // Match each detection
      for (const detection of detections) {
        if (!detection.matchedOrderId) {
          const matches = await paymentDetectionService.matchDetectionWithOrders(detection, pending);

          if (matches.length > 0) {
            // Update detection with best match
            detection.matchedOrderId = matches[0].orderId;
            detection.confidence = matches[0].confidence;
            hasUpdates = true;
          }
        }

        // 🤖 AUTO-VERIFICATION LOGIC
        // ⚠️ REMOVED: Auto-verify logic moved to PaymentAutoVerifier component
        // PaymentAutoVerifier handles all auto-verification with proper test mode support
        // This page is now only for MANUAL verification and monitoring
      }

      // Only update state if we actually found new matches to avoid infinite render loop
      if (hasUpdates) {
        setPendingDetections([...detections]);
      }
    } catch (error) {
      console.error('Error matching detections:', error);
    }
  };

  const handleMarkAsPaid = async (detection: PaymentDetection) => {
    if (!detection.matchedOrderId) {
      showToast({ message: 'Tidak ada order yang cocok', type: 'error' });
      return;
    }

    try {
      // Get matched order details for logging
      const matchedOrder = getMatchedOrder(detection.matchedOrderId);
      const customerName = matchedOrder?.shippingInfo?.name || matchedOrder?.userName || detection.senderName || 'Unknown';

      // Update order status to paid
      await ordersService.updateOrderStatus(detection.matchedOrderId, 'paid');

      // Mark detection as verified
      await paymentDetectionService.markAsVerified(
        detection.id,
        detection.matchedOrderId,
        user.email,
        'semi-auto'
      );

      // 🔥 NEW: Create verification log for semi-auto mode
      await autoVerificationLogService.createLog({
        orderId: detection.matchedOrderId,
        invoiceNumber: matchedOrder?.invoiceNumber || detection.matchedOrderId, // 🧾 Store invoice number
        orderAmount: matchedOrder?.finalTotal || detection.amount,
        customerName,
        detectionId: detection.id,
        detectedAmount: detection.amount,
        senderName: detection.senderName || 'Unknown',
        bank: detection.bank || 'Unknown',
        rawNotification: detection.rawText || '',
        confidence: detection.confidence || 100,
        matchReason: `Semi-auto verified by ${user.email}`,
        status: 'success',
        executedBy: user.email || 'admin'
      });

      showToast({ message: '✅ Pembayaran berhasil diverifikasi!', type: 'success' });

      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error marking as paid:', error);
      showToast({ message: 'Gagal memverifikasi pembayaran', type: 'error' });
    }
  };

  const handleIgnore = async (detection: PaymentDetection, reason: string = 'Bukan customer') => {
    try {
      await paymentDetectionService.markAsIgnored(detection.id, reason);
      showToast({ message: 'Detection diabaikan', type: 'info' });
      await loadData();
    } catch (error) {
      console.error('Error ignoring detection:', error);
      showToast({ message: 'Gagal mengabaikan detection', type: 'error' });
    }
  };

  const handleUpdateSettings = async (newSettings: PaymentDetectionSettings) => {
    try {
      await paymentDetectionService.updateSettings(newSettings);
      setSettings(newSettings);
      setShowSettings(false);
      showToast({ message: '✅ Pengaturan berhasil disimpan', type: 'success' });
    } catch (error) {
      console.error('Error updating settings:', error);
      showToast({ message: 'Gagal menyimpan pengaturan', type: 'error' });
    }
  };

  // ✨ NEW: Create test detection from order
  const handleCreateTestDetection = async (order: any) => {
    try {
      showToast({ message: '🔄 Membuat test detection...', type: 'info' });

      const amount = order.exactPaymentAmount || order.finalTotal;
      const senderName = order.shippingInfo?.name || order.userName || 'Test User';

      await paymentDetectionService.addMockDetection({
        amount,
        senderName,
        bank: 'BRI',
        timestamp: new Date().toISOString(),
        rawText: `Test Detection - Transfer Rp ${amount.toLocaleString('id-ID')} dari ${senderName}`
      });

      showToast({ message: '✅ Test detection berhasil dibuat!', type: 'success' });
      await loadData();
    } catch (error) {
      console.error('Error creating test detection:', error);
      showToast({ message: 'Gagal membuat test detection', type: 'error' });
    }
  };

  const handleInitializeSystem = async () => {
    try {
      setInitializing(true);
      showToast({ message: '🔄 Menginisialisasi system...', type: 'info' });

      // 1. Create default settings
      await paymentDetectionService.updateSettings({
        mode: 'semi-auto',
        enabled: true,
        autoConfirmThreshold: 90,
        autoConfirmRules: {
          exactAmountMatch: true,
          nameSimilarity: 80,
          maxOrderAge: 7200
        }
      });
      showToast({ message: '✅ Settings created', type: 'success' });

      // 2. Add mock payment detections
      const mockDetections = [
        {
          amount: 250000,
          senderName: 'SITI NURHALIZA',
          bank: 'BRI',
          timestamp: new Date().toISOString(),
          rawText: 'BRIMo\nTransfer Masuk\nRp250.000,00\ndari SITI NURHALIZA'
        },
        {
          amount: 180000,
          senderName: 'AHMAD DHANI',
          bank: 'Mandiri',
          timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
          rawText: "Livin' by Mandiri\nTransaksi Berhasil\nTransfer Diterima Rp 180.000\nDari: AHMAD DHANI"
        },
        {
          amount: 320000,
          senderName: 'RINA SUSANTI',
          bank: 'BCA',
          timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
          rawText: 'BCA mobile\nInfo Rekening\nTransfer masuk Rp320.000\ndari 9876543210 a.n RINA SUSANTI'
        }
      ];

      for (const detection of mockDetections) {
        await paymentDetectionService.addMockDetection(detection);
      }

      showToast({ message: '✅ System berhasil diinisialisasi!', type: 'success' });
      showToast({ message: '🔄 Memuat data...', type: 'info' });

      // Reload data
      await loadData();
      await loadSettings();
    } catch (error) {
      console.error('Error initializing system:', error);
      showToast({ message: '❌ Gagal menginisialisasi system', type: 'error' });
    } finally {
      setInitializing(false);
    }
  };

  // Get confidence badge color
  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return { color: 'bg-gray-500', text: 'No Match', icon: '❓' };

    if (confidence >= 90) return { color: 'bg-green-500', text: `${confidence}% Match`, icon: '✨' };
    if (confidence >= 70) return { color: 'bg-yellow-500', text: `${confidence}% Match`, icon: '⚠️' };
    return { color: 'bg-orange-500', text: `${confidence}% Match`, icon: '🔍' };
  };

  // Get matched order details
  const getMatchedOrder = (orderId?: string) => {
    if (!orderId) return null;
    return pendingOrders.find(order => order.id === orderId);
  };

  // Filter detections by search
  const filteredDetections = pendingDetections.filter(detection => {
    const searchLower = searchQuery.toLowerCase();
    const sender = detection.senderName || '';
    const bank = detection.bank || '';

    return (
      sender.toLowerCase().includes(searchLower) ||
      detection.amount.toString().includes(searchLower) ||
      bank.toLowerCase().includes(searchLower)
    );
  });

  // Statistics
  const todayVerified = verifiedDetections.filter(d => {
    const today = new Date().toDateString();
    const verifiedDate = d.verifiedAt?.toDate?.()?.toDateString() || new Date(d.verifiedAt).toDateString();
    return verifiedDate === today;
  });

  const todayPending = filteredDetections.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Verifikasi Pembayaran" onBack={onBack} />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37]"></div>
        </div>
      </div>
    );
  }
  // Show Logs Page
  if (showLogs) {
    return (
      <AdminAutoVerificationLogsPage onBack={() => setShowLogs(false)} />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="Verifikasi Pembayaran" onBack={onBack} />

      {/* Header Stats - GOLD THEME */}
      <div className="px-4 py-4 bg-white border-b border-[#D4AF37]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${settings?.mode === 'full-auto' ? 'bg-[#D4AF37]' : 'bg-[#997B2C]'} animate-pulse`} />
            <span className="text-sm font-bold text-gray-700">
              Mode: {settings?.mode === 'full-auto' ? 'Full Otomatis' : 'Semi-Otomatis'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowLogs(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center space-x-1"
              title="Lihat Log Pelunasan"
            >
              <FileText className="w-5 h-5 text-[#997B2C]" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <SettingsIcon className="w-5 h-5 text-[#997B2C]" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center space-x-2 mb-1">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-blue-600 font-bold">Pending</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">{todayPending}</div>
        </div>

        <div className="bg-gradient-to-br from-[#D4AF37]/20 to-[#997B2C]/10 rounded-xl p-3 border-2 border-[#D4AF37] shadow-[0_2px_0_0_#997B2C]">
          <div className="flex items-center space-x-2 mb-1">
            <CheckCircle className="w-4 h-4 text-[#997B2C]" />
            <span className="text-xs text-[#997B2C] font-bold">Verified</span>
          </div>
          <div className="text-2xl font-bold text-[#997B2C]">{todayVerified.length}</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 border-2 border-[#D4AF37] shadow-[0_2px_0_0_#997B2C]">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-purple-600 font-medium">Accuracy</span>
          </div>
          <div className="text-2xl font-bold text-purple-900">
            {todayVerified.length > 0 ? '95%' : '-'}
          </div>
        </div>
      </div>


      {/* Search Bar */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#997B2C]" />
          <input
            type="text"
            placeholder="Cari nama, jumlah, atau bank..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#d4af37]"
          />
        </div>
      </div>

      {/* ✨ NEW: Test Helper - Pending Orders with Auto Verification */}
      {
        pendingOrders.filter(o => o.verificationMode === 'auto' && o.status === 'pending').length > 0 && (
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-200">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-blue-900">🧪 Test Helper - Orders Menunggu Pembayaran</h4>
                <p className="text-xs text-blue-600">Klik "Test Match" untuk simulate transfer dari order ini</p>
              </div>
            </div>
            <div className="space-y-2 mt-3">
              {pendingOrders
                .filter(o => o.verificationMode === 'auto' && o.status === 'pending')
                .slice(0, 3)
                .map(order => (
                  <div key={order.id} className="bg-white rounded-lg p-3 shadow-sm border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{order.invoiceNumber || `#${order.id}`}</p>
                        <p className="text-xs text-gray-600">{order.shippingInfo?.name || order.userName}</p>
                        <p className="text-lg font-bold text-blue-600 mt-1">
                          Rp {(order.exactPaymentAmount || order.finalTotal).toLocaleString('id-ID')}
                        </p>
                        {order.uniquePaymentCode && (
                          <p className="text-xs text-green-600 mt-0.5">
                            ✨ Kode Unik: {order.uniquePaymentCode}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleCreateTestDetection(order)}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all whitespace-nowrap"
                      >
                        🧪 Test Match
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )
      }

      {/* Detections List */}
      <div className="px-4 py-4 space-y-4">
        {filteredDetections.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Tidak Ada Pembayaran Pending
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Pembayaran yang terdeteksi akan muncul di sini
            </p>

            {/* Initialize System Button - Always show in empty state for now */}
            <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-xl p-4 max-w-md mx-auto mt-4">
              <div className="text-sm text-[#997B2C] mb-3 font-medium">
                💡 System belum diinisialisasi atau belum ada data. Klik tombol di bawah untuk setup awal & add mock data untuk testing.
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Debug: settings = {settings === null ? 'null' : JSON.stringify(settings)}
              </div>
              <button
                onClick={handleInitializeSystem}
                disabled={initializing}
                className="px-6 py-3 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto shadow-[0_2px_0_0_#7a6223]"
              >
                {initializing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Menginisialisasi...</span>
                  </>
                ) : (
                  <>
                    <span>🚀 Initialize System</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          filteredDetections.map((detection) => {
            const badge = getConfidenceBadge(detection.confidence);
            const matchedOrder = getMatchedOrder(detection.matchedOrderId);
            const timeAgo = getTimeAgo(detection.createdAt);

            return (
              <div
                key={detection.id}
                className={`
                  rounded-2xl border-2 p-4 shadow-md
                  ${detection.confidence && detection.confidence >= 90
                    ? 'border-green-500 bg-green-50'
                    : detection.confidence && detection.confidence >= 70
                      ? 'border-yellow-500 bg-yellow-50'
                      : 'border-gray-300 bg-white'
                  }
                `}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${badge.color}`}>
                        {badge.icon} {badge.text}
                      </span>
                      <span className="text-xs text-gray-500">{timeAgo}</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-1">
                      Rp {detection.amount.toLocaleString('id-ID')}
                    </div>
                    <div className="text-sm text-gray-600">
                      dari: <span className="font-semibold">{detection.senderName || 'Unknown Sender'}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {detection.bank} • {new Date(detection.timestamp).toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                {/* Matched Order */}
                {matchedOrder && (
                  <div className="bg-white rounded-lg p-3 mb-3 border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      🎯 Matched Order:
                    </div>
                    <div className="text-lg font-bold text-[#997B2C] mb-1">
                      {matchedOrder.id}
                    </div>
                    <div className="text-sm text-gray-700">
                      Customer: {matchedOrder.customerName || matchedOrder.userName}
                    </div>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-600">
                      <div className="flex items-center space-x-1">
                        <DollarSign className="w-3 h-3" />
                        <span>Rp {matchedOrder.finalTotal.toLocaleString('id-ID')}</span>
                        {Math.abs(detection.amount - matchedOrder.finalTotal) === 0 && (
                          <CheckCircle className="w-3 h-3 text-green-500 ml-1" />
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{getTimeAgo(matchedOrder.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* No Match Warning */}
                {!matchedOrder && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                    <div className="flex items-center space-x-2 text-orange-700">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Tidak ada order yang cocok dengan amount ini
                      </span>
                    </div>
                  </div>
                )}

                {/* Raw Text (Collapsible) */}
                <details className="text-xs text-gray-500 mb-3">
                  <summary className="cursor-pointer hover:text-gray-700 font-medium">
                    Raw SMS/Notification
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto text-xs">
                    {detection.rawText}
                  </pre>
                </details>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  {matchedOrder && (
                    <button
                      onClick={() => handleMarkAsPaid(detection)}
                      className="flex-1 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white px-4 py-3 rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center space-x-2 shadow-[0_2px_0_0_#7a6223]"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>Verifikasi & Lunasi</span>
                    </button>
                  )}

                  {detection.screenshotUrl && (
                    <button
                      onClick={() => {
                        setSelectedDetection(detection);
                        setShowScreenshot(true);
                      }}
                      className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 flex items-center justify-center space-x-2"
                    >
                      <Eye className="w-5 h-5" />
                      <span>Screenshot</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleIgnore(detection)}
                    className="px-4 py-3 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 flex items-center justify-center"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Settings Modal */}
      {
        showSettings && settings && (
          <SettingsModal
            settings={settings}
            onSave={handleUpdateSettings}
            onClose={() => setShowSettings(false)}
          />
        )
      }

      {/* Screenshot Modal */}
      {
        showScreenshot && selectedDetection && (
          <ScreenshotModal
            detection={selectedDetection}
            onClose={() => {
              setShowScreenshot(false);
              setSelectedDetection(null);
            }}
          />
        )
      }
    </div >
  );
};

// Helper function for time ago
function getTimeAgo(timestamp: any): string {
  const now = new Date().getTime();
  const time = timestamp?.toDate ? timestamp.toDate().getTime() : new Date(timestamp).getTime();
  const diff = now - time;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;

  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

// Settings Modal Component
interface SettingsModalProps {
  settings: PaymentDetectionSettings;
  onSave: (settings: PaymentDetectionSettings) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose }) => {
  const [mode, setMode] = useState(settings.mode);
  const [threshold, setThreshold] = useState(settings.autoConfirmThreshold);
  const [testMode, setTestMode] = useState(settings.testMode ?? false);

  const handleSave = () => {
    onSave({
      ...settings,
      mode,
      autoConfirmThreshold: threshold,
      testMode
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Pengaturan Verifikasi</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Mode Operasi:</label>

            <div className="space-y-3">
              <label className="flex items-start space-x-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="mode"
                  value="semi-auto"
                  checked={mode === 'semi-auto'}
                  onChange={(e) => setMode(e.target.value as 'semi-auto')}
                  className="mt-1"
                />
                <div>
                  <div className="font-semibold text-gray-900">Semi-Otomatis (Recommended)</div>
                  <div className="text-sm text-gray-600">
                    System deteksi pembayaran → Admin klik "Mark Paid" untuk konfirmasi manual
                  </div>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="mode"
                  value="full-auto"
                  checked={mode === 'full-auto'}
                  onChange={(e) => setMode(e.target.value as 'full-auto')}
                  className="mt-1"
                />
                <div>
                  <div className="font-semibold text-gray-900">Full Otomatis (Advanced)</div>
                  <div className="text-sm text-gray-600">
                    System otomatis mark paid jika confidence {'>'} threshold
                  </div>
                  <div className="text-xs text-orange-600 mt-1">⚠️ Butuh monitoring ketat</div>
                </div>
              </label>
            </div>
          </div>

          {mode === 'full-auto' && (
            <>
              {/* 🧪 Test Mode Toggle */}
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-yellow-900 flex items-center space-x-2">
                      <span>🧪</span>
                      <span>Test Mode (Dry Run)</span>
                    </div>
                    <div className="text-sm text-yellow-700 mt-1">
                      Saat aktif, sistem hanya <b>mencatat log</b> tanpa benar-benar melunaskan pesanan
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTestMode(!testMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${testMode ? 'bg-yellow-500' : 'bg-gray-300'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${testMode ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>
                {testMode && (
                  <div className="mt-3 text-xs text-yellow-800 bg-yellow-100 rounded-lg p-2">
                    ✅ Test mode AKTIF - Semua pelunasan otomatis akan dicatat ke log tanpa mengubah status pesanan.
                    Periksa log untuk memverifikasi akurasi sebelum mematikan test mode.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confidence Threshold: {threshold}%
                </label>
                <input
                  type="range"
                  min="70"
                  max="99"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>70% (Lebih permisif)</span>
                  <span>99% (Sangat ketat)</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white rounded-xl font-bold hover:shadow-lg transition-all"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

// Screenshot Modal Component
interface ScreenshotModalProps {
  detection: PaymentDetection;
  onClose: () => void;
}

const ScreenshotModal: React.FC<ScreenshotModalProps> = ({ detection, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Screenshot Notification</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {detection.screenshotUrl ? (
          <img
            src={detection.screenshotUrl}
            alt="Payment notification"
            className="w-full rounded-lg"
          />
        ) : (
          <div className="text-center py-12 text-gray-500">
            Screenshot tidak tersedia
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPaymentVerificationPage;
