import React, { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, Truck, XCircle, Eye, Search, Filter, Calendar, Download, X, Upload, CreditCard, MapPin, Phone, Mail, Edit2, Check, User, AlertTriangle, Info, Trash2, Copy, ArrowLeft, Printer } from 'lucide-react';
import PageHeader from './PageHeader';
import { useFirebaseAdminOrders } from '../hooks/useFirebaseAdminOrders';
import { ordersService } from '../services/ordersService';
import { paymentGroupService } from '../services/paymentGroupService';
import { checkAndUpgradeRole, OrderItemForUpgrade, queueWhatsAppNotification } from '../services/roleUpgradeService';
import ShippingEditModal from './ShippingEditModal';

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

  //  NEW: Bulk operations state
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);

  //  NEW: Payment assistance state (for Owner to help customer)
  const [showPaymentAssistModal, setShowPaymentAssistModal] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showAutoInstructionsModal, setShowAutoInstructionsModal] = useState(false);
  const [showManualUploadModal, setShowManualUploadModal] = useState(false);
  const [assistPaymentData, setAssistPaymentData] = useState<any>(null);
  const [assistPaymentProof, setAssistPaymentProof] = useState<File | null>(null);

  //  NEW: Shipping edit state for admin/owner
  const [shippingEditOrder, setShippingEditOrder] = useState<any>(null);

  //  NEW: Unaddressed Orders Filter
  const [showUnaddressedOnly, setShowUnaddressedOnly] = useState(false);

  // Modern confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState({
    title: '',
    message: '',
    onConfirm: () => { },
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

  //  NEW: Bulk operations functions
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
      { type: 'warning', confirmText: 'Ya, Hapus Semua', cancelText: 'Batal' }
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
    shipped: { label: 'Dikirim', icon: Truck, color: 'text-indigo-900 bg-indigo-100 border border-indigo-200' },
    delivered: { label: 'Selesai', icon: CheckCircle, color: 'text-[#997B2C] bg-[#D4AF37]/10 border border-[#D4AF37]/20' },
    cancelled: { label: 'Dibatalkan', icon: XCircle, color: 'text-red-900 bg-red-100 border border-red-200' }
  };

  // Get unique users for filter
  const getUniqueUsers = () => {
    const users = new Set<string>();
    orders.forEach(order => {
      if (order.userName && order.userEmail) {
        users.add(`${order.userName} (${order.userEmail})`);
      }
    });
    return Array.from(users).sort();
  };

  // Get unique products for filter
  const getUniqueProducts = () => {
    const products = new Set<string>();
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

    //  NEW: Unaddressed Filter Logic
    // Show if: shippingMode is 'keep' AND not configured (legacy) OR shippingConfigured is explicitly false/undefined
    const matchesUnaddressed = !showUnaddressedOnly || (
      ((order as any).shippingMode === 'keep' && !(order as any).shippingConfigured) ||
      (!(order as any).shippingConfigured && !order.shippingInfo?.address)
    );

    return matchesSearch && matchesStatus && matchesUser && matchesProduct && matchesUnaddressed;
  });

  //  NEW: WhatsApp Billing Function
  const handleWhatsAppBilling = (order: any) => {
    // SMART FEATURE: If this order is part of a selection (checked), use Bulk Billing instead
    if (selectedOrderIds.includes(order.id) && selectedOrderIds.length > 1) {
      handleBulkWhatsAppBilling();
      return;
    }

    if (!order.shippingInfo?.phone && !order.phone) {
      showModernAlert('Error', 'Nomor telepon tidak tersedia', 'error');
      return;
    }

    const phone = order.shippingInfo?.phone || order.phone;
    // Format phone: remove 0 or +62, add 62
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) formattedPhone = '62' + formattedPhone.substring(1);
    if (!formattedPhone.startsWith('62')) formattedPhone = '62' + formattedPhone;

    const message = `Halo Kak ${order.userName || 'Pelanggan'},\n\nBerikut tagihan untuk pesanan Kakak di Azzahra Fashion Muslim:\nNo. Pesanan: *#${order.id}*\nTotal Tagihan: *Rp ${order.finalTotal.toLocaleString('id-ID')}*\n\nMohon segera melakukan pembayaran ya Kak. Terima kasih `;

    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  //  NEW: Bulk WhatsApp Billing (Aggregated)
  const handleBulkWhatsAppBilling = () => {
    const selected = orders.filter(o => selectedOrderIds.includes(o.id));
    const eligible = selected.filter(o => ['pending', 'awaiting_verification'].includes(o.status));

    if (eligible.length === 0) {
      showModernAlert('Peringatan', 'Pilih pesanan status Pending/Menunggu Verifikasi.', 'warning');
      return;
    }

    // Group by phone number to ensure we only message one user at a time or warn
    const uniqueUsers = new Set(eligible.map(o => (o.shippingInfo?.phone || (o as any).phone || '').replace(/\D/g, '')));
    if (uniqueUsers.size > 1) {
      showModernAlert('Peringatan', 'Fitur Tagih Gabungan hanya bisa digunakan untuk 1 customer (no. hp sama). Mohon filter per user dulu.', 'warning');
      return;
    }

    const firstOrder = eligible[0];
    const phone = firstOrder.shippingInfo?.phone || (firstOrder as any).phone;
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) formattedPhone = '62' + formattedPhone.substring(1);
    if (!formattedPhone.startsWith('62')) formattedPhone = '62' + formattedPhone;

    const totalBill = eligible.reduce((acc, curr) => acc + curr.finalTotal, 0);

    // Use standard newlines and encodeURIComponent for reliable implementation
    const orderList = eligible.map(o => {
      const price = o.finalTotal ? o.finalTotal.toLocaleString('id-ID') : '0';
      return `- Order #${o.id} (Rp ${price})`;
    }).join('\n');

    const header = `Halo Kak ${firstOrder.userName || 'Pelanggan'},\n\nBerikut rekap tagihan untuk ${eligible.length} pesanan Kakak di Azzahra Fashion Muslim:`;
    const footer = `*TOTAL TAGIHAN: Rp ${totalBill.toLocaleString('id-ID')}*\n\nMohon segera melakukan pembayaran ya Kak. Terima kasih `;

    // Construct full message and encode
    const fullMessage = `${header}\n\n${orderList}\n\n${footer}`;

    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(fullMessage)}`, '_blank');
  };

  //  NEW: Print Label Function (Single)
  const handlePrintLabel = (order: any) => {
    // Prepare full address
    const fullAddress = [
      order.shippingInfo?.address,
      order.shippingInfo?.subdistrict ? `Kel. ${order.shippingInfo.subdistrict}` : '',
      order.shippingInfo?.district ? `Kec. ${order.shippingInfo.district}` : '',
      order.shippingInfo?.cityName || '',
      order.shippingInfo?.provinceName
    ].filter(Boolean).join(', ');

    // Prepare JSON data for Android (Android will format for 32-char printer)
    const printData = {
      name: order.shippingInfo?.name || order.userName || '-',
      phone: order.shippingInfo?.phone || (order as any).phone || '-',
      address: fullAddress || order.shippingInfo?.address || '-',
      items: order.items?.map((item: any) => `${item.productName} x${item.quantity}`).join(', ') || '-',
      courier: order.shippingInfo?.courier?.toUpperCase() || 'JNE',
      orderId: order.id
    };

    // Check if AndroidPrint interface is available (running in native app WebView)
    if (typeof (window as any).AndroidPrint !== 'undefined') {
      // Call Android native print - 1-click direct print!
      (window as any).AndroidPrint.printLabel(JSON.stringify(printData));
      showModernAlert('Print', 'Mengirim ke printer...', 'success');
      return;
    }

    // Check if on mobile (Android) - try custom URL scheme first as fallback
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      // Format nota text manual for URL Scheme (Native app expects raw text for URL scheme now)
      // Note: printData is for JS Interface. For Deep Link we send pre-formatted text.
      // Format nota text manual for URL Scheme (Compact Version)
      // Optimized to prevent Broken Pipe on Android Intent limit
      const itemsText = order.items?.map((item: any) => {
        // Truncate long product names to 30 chars
        const pName = item.productName.length > 30 ? item.productName.substring(0, 30) + '...' : item.productName;
        return `${pName} x${item.quantity}`;
      }).join('\n') || '-';

      const notaText = [
        '--------------------------------',
        'AZZAHRA FASHION',
        '--------------------------------',
        `Kpd: ${order.shippingInfo?.name?.substring(0, 25) || order.userName?.substring(0, 25) || '-'}`,
        `Tel: ${order.shippingInfo?.phone || (order as any).phone || '-'}`,
        `Almt: ${fullAddress}`, // Full Address is priority, keep it
        '--------------------------------',
        itemsText,
        '--------------------------------',
        `Eks: ${order.shippingInfo?.courier?.toUpperCase() || 'JNE'}`,
        `#${order.id}`,
        '--------------------------------\n' // Extra newline at end
      ].join('\n');

      // Use custom URL scheme for Android native app with Base64 encoding (SafeArea)
      // btoa() encodes string to Base64, safe for URLs
      // Encode URI Component to ensure Base64 chars like '+' or '=' don't break URL parsing
      const base64Data = encodeURIComponent(btoa(notaText));
      const printUrl = `azzahra-print://print?data=${base64Data}`;

      // Attempt to open deep link
      window.location.href = printUrl;
      showModernAlert('Print', 'Mencetak label...', 'success');
      return;
    }

    // Fallback to browser print for desktop/browser
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showModernAlert('Error', 'Pop-up terblokir. Izinkan pop-up untuk mencetak label.', 'error');
      return;
    }

    const htmlContent = generateShippingLabelHtml([order]);
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  //  NEW: Print Label Function (Bulk)
  const handleBulkPrintLabel = () => {
    const selected = orders.filter(o => selectedOrderIds.includes(o.id));
    // Filter only eligible orders (paid, processing, shipped, delivered)
    const eligible = selected.filter(o => ['paid', 'processing', 'shipped', 'delivered'].includes(o.status));

    if (eligible.length === 0) {
      showModernAlert('Peringatan', 'Pilih pesanan yang sudah lunas/diproses untuk dicetak labelnya.', 'warning');
      return;
    }

    // Check if on mobile (Android) - try custom URL scheme first
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      // Aggregate all orders into one long text
      // Aggregate all orders into one compact text
      // Optimized to stay within Android Intent transaction limit (~1MB total, ideally <500KB)
      const bulkText = eligible.map(order => {
        const fullAddress = [
          order.shippingInfo?.address,
          order.shippingInfo?.subdistrict ? `Kel. ${order.shippingInfo.subdistrict}` : '',
          order.shippingInfo?.district ? `Kec. ${order.shippingInfo.district}` : '',
          order.shippingInfo?.cityName || '',
          order.shippingInfo?.provinceName
        ].filter(Boolean).join(', ');

        const itemsText = order.items?.map((item: any) => {
          // Truncate long product names to 30 chars
          const pName = item.productName.length > 30 ? item.productName.substring(0, 30) + '...' : item.productName;
          return `${pName} x${item.quantity}`;
        }).join('\n') || '-';

        return [
          '--------------------------------',
          'AZZAHRA FASHION',
          '--------------------------------',
          `Kpd: ${order.shippingInfo?.name?.substring(0, 25) || order.userName?.substring(0, 25) || '-'}`,
          `Tel: ${order.shippingInfo?.phone || (order as any).phone || '-'}`,
          `Almt: ${fullAddress}`,
          '--------------------------------',
          itemsText,
          '--------------------------------',
          `Eks: ${order.shippingInfo?.courier?.toUpperCase() || 'JNE'}`,
          `#${order.id}`,
          '--------------------------------\n\n' // Double newline between orders
        ].join('\n');
      }).join('\n');

      // Use custom URL scheme for Android native app with Base64 encoding
      const base64Data = btoa(bulkText);
      const printUrl = `azzahra-print://print?data=${base64Data}`;

      // Attempt to open deep link
      window.location.href = printUrl;
      showModernAlert('Print', `Mencetak ${eligible.length} label...`, 'success');
      return;
    }

    // Fallback to browser print for desktop/browser
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showModernAlert('Error', 'Pop-up terblokir. Izinkan pop-up untuk mencetak label.', 'error');
      return;
    }

    const htmlContent = generateShippingLabelHtml(eligible);
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Helper to generate Label HTML for 58mm Thermal Printer
  const generateShippingLabelHtml = (ordersList: any[]) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cetak Label Pengiriman</title>
        <style>
          @page { size: 58mm auto; margin: 0mm; } 
          body { 
            font-family: sans-serif; 
            margin: 0; 
            padding: 0; 
            width: 48mm; 
            font-size: 16px; /* MAXIMIZED FONT */
            color: black;
          }
          .label-container { 
            border-bottom: 3px dashed #000; 
            padding-bottom: 10px; 
            margin-bottom: 10px; 
            page-break-inside: avoid;
            padding-top: 5px;
          }
          .header { 
            text-align: center;
            margin-bottom: 5px;
            border-bottom: 3px solid #000; 
            padding-bottom: 5px;
          }
          .header h1 { 
            margin: 0; 
            font-size: 22px; /* JUMBO HEADER */
            font-weight: 900; 
            text-transform: uppercase;
            line-height: 1;
          }
          .info-table {
            width: 100%;
            border-collapse: collapse;
          }
          .info-table td {
            vertical-align: top;
            padding-bottom: 5px;
            font-size: 16px; /* BIG TEXT */
            line-height: 1.2;
            color: #000;
          }
          .label-col {
            width: 50px;
            white-space: nowrap;
            font-weight: normal;
            font-size: 14px;
            color: #000;
          }
          .sep-col {
            width: 5px;
            text-align: center;
          }
          .value-col {
            word-wrap: break-word;
            font-weight: 800; 
            font-size: 17px; 
          }
          .dropship-badge {
            border: 3px solid #000;
            padding: 4px;
            font-weight: 900;
            font-size: 16px;
            display: inline-block;
            margin-top: 5px;
            text-align: center;
            width: 100%;
            box-sizing: border-box;
          }
          .footer { 
            font-size: 12px; 
            text-align: center; 
            margin-top: 5px;
            border-top: 1px dashed #000;
            padding-top: 5px;
          }
          @media print {
            body { padding: 0; margin: 0; width: 100%; }
            .label-container { page-break-after: always; border-bottom: none; }
            .label-container:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body onload="window.print()">
        ${ordersList.map(o => {
      // Construct Full Address - use correct field names
      const fullAddress = [
        o.shippingInfo?.address,
        o.shippingInfo?.subdistrict ? `Kel. ${o.shippingInfo.subdistrict}` : '',
        o.shippingInfo?.district ? `Kec. ${o.shippingInfo.district}` : '',
        o.shippingInfo?.cityName || '',
        o.shippingInfo?.provinceName,
        o.shippingInfo?.postalCode
      ].filter(Boolean).join(', ');

      return `
          <div class="label-container">
            <div class="header">
              <h1>AZZAHRA</h1>
            </div>
            
            <table class="info-table">
              <tr>
                <td class="label-col">Kpd</td>
                <td class="sep-col">:</td>
                <td class="value-col">${o.shippingInfo?.name || o.userName || '-'}</td>
              </tr>
              <tr>
                <td class="label-col">Telp</td>
                <td class="sep-col">:</td>
                <td class="value-col">${o.shippingInfo?.phone || (o as any).phone || '-'}</td>
              </tr>
              <tr>
                <td class="label-col">Almt</td>
                <td class="sep-col">:</td>
                <td class="value-col">${fullAddress || '-'}</td>
              </tr>
              <tr>
                <td class="label-col">Item</td>
                <td class="sep-col">:</td>
                <td class="value-col">
                  ${o.items?.map((item: any) => `- ${item.productName} x${item.quantity} ${item.variantName ? `(${item.variantName})` : ''}`).join('<br>') || '-'}
                </td>
              </tr>
              <tr>
                <td class="label-col">Exp</td>
                <td class="sep-col">:</td>
                <td class="value-col">${o.shippingInfo?.courier ? o.shippingInfo.courier.toUpperCase() : 'JNE'}</td>
              </tr>
            </table>

            ${(o as any).isDropship ? `
              <div class="dropship-badge">DROPSHIP</div>
              <table class="info-table" style="margin-top: 5px;">
                 <tr>
                  <td class="label-col">Dari</td>
                  <td class="sep-col">:</td>
                  <td class="value-col">${(o as any).dropshipName || '-'}</td>
                </tr>
                 <tr>
                  <td class="label-col">Telp</td>
                  <td class="sep-col">:</td>
                  <td class="value-col">${(o as any).dropshipPhone || '-'}</td>
                </tr>
              </table>
            ` : ''}

            <div class="footer">
              #${o.id}
            </div>
          </div>
        `;
    }).join('')}
      </body>
      </html>
    `;
  };

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
        confirmMessage = `Apakah barang sudah datang dan siap untuk diproses ?\n\nPesanan #${orderName} akan diproses.`;
        break;
      case 'shipped':
        confirmTitle = 'Kirim Pesanan';
        confirmMessage = `Apakah barang sudah dikirim ke pelanggan ?\n\nPesanan #${orderName} akan ditandai sebagai terkirim.`;
        break;
      case 'delivered':
        confirmTitle = 'Selesaikan Pesanan';
        confirmMessage = `Apakah barang sudah diterima pelanggan dan selesai ?\n\nPesanan #${orderName} akan ditandai sebagai selesai.`;
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

          // Auto upgrade role if eligible (Customer -> Reseller)
          try {
            const orderItems: OrderItemForUpgrade[] = (selectedOrder.items || []).map((item: any) => ({
              productId: item.productId || item.id,
              productName: item.name || item.productName || '',
              productStatus: item.productStatus || item.status || 'ready',
              quantity: item.quantity || 1
            }));

            const result = await checkAndUpgradeRole(selectedOrder.userId, orderItems);
            if (result.upgraded) {
              console.log('Ž‰ User upgraded to Reseller:', result.reason);

              // Queue WhatsApp notification for upgrade
              const customerPhone = selectedOrder.shippingInfo?.phone || selectedOrder.phone;
              const customerName = selectedOrder.shippingInfo?.name || selectedOrder.userName || 'Pelanggan';
              if (customerPhone) {
                await queueWhatsAppNotification(
                  selectedOrder.userId,
                  customerPhone,
                  customerName,
                  'upgrade'
                );
              }
            }
          } catch (upgradeError) {
            console.error('Role upgrade check failed (non-blocking):', upgradeError);
            // Non-blocking: don't fail the payment verification if upgrade fails
          }
        } else {
          console.log('”„ CANCELLING ORDER - Status will be set to:', status);
          await updateOrderStatus(selectedOrder.id, status);

          // After cancelling, refresh products and navigate to home
          console.log('… Order cancelled, refreshing products...');
          if (onRefreshProducts) {
            onRefreshProducts();
          }

          if (onNavigateToHome) {
            console.log('  Navigating to home after order cancellation...');
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
        console.error('âŒ Error confirming verification:', error);
        showModernAlert('Error', 'Gagal memperbarui verifikasi pesanan', 'error');
      }
    }
  };

  const handleUploadPaymentProof = (order: any) => {
    setSelectedOrderForUpload(order);
    setShowUploadModal(true);
  };

  //  NEW: Payment Assistance Handlers (Owner helps customer)
  // Single order assistance
  const handlePaymentAssist = async (order: any) => {
    // Check if order already has payment group
    if (order.paymentGroupId) {
      try {
        const existingGroup = await paymentGroupService.getPaymentGroup(order.paymentGroupId);

        if (existingGroup && existingGroup.status === 'pending') {
          // Reuse existing payment group
          setAssistPaymentData({
            order,
            orders: [order],
            subtotal: order.finalTotal,
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
    setAssistPaymentData({
      order,
      orders: [order],
      subtotal: order.finalTotal,
      paymentGroup: null
    });
    setShowPaymentMethodModal(true);
  };

  //  NEW: Bulk payment assistance (multiple orders)
  const handleBulkPaymentAssist = async () => {
    if (selectedOrderIds.length === 0) {
      showModernAlert('Peringatan', 'Pilih minimal 1 pesanan untuk dibantu pembayaran', 'warning');
      return;
    }

    // Filter only pending orders
    const selected = orders.filter(o => selectedOrderIds.includes(o.id) && o.status === 'pending');

    if (selected.length === 0) {
      showModernAlert('Peringatan', 'Hanya pesanan pending yang bisa dibantu pembayaran', 'warning');
      return;
    }

    if (selected.length !== selectedOrderIds.length) {
      showModernAlert('Info', `Hanya ${selected.length} pesanan pending yang akan diproses(dari ${selectedOrderIds.length} terpilih)`, 'info');
    }

    const subtotal = selected.reduce((sum, o) => sum + o.finalTotal, 0);

    // Check if first order has payment group
    const firstOrder = selected[0];
    let existingPaymentGroup = null;

    if (firstOrder?.paymentGroupId) {
      try {
        existingPaymentGroup = await paymentGroupService.getPaymentGroup(firstOrder.paymentGroupId);

        if (existingPaymentGroup && existingPaymentGroup.status === 'pending') {
          // Validate if matches current selection
          const isSameOrders =
            existingPaymentGroup.orderIds.length === selected.length &&
            existingPaymentGroup.orderIds.every(id => selected.find(o => o.id === id));

          const isSameTotal = existingPaymentGroup.originalTotal === subtotal;

          if (isSameOrders && isSameTotal) {
            // Reuse existing
            setAssistPaymentData({
              orders: selected,
              subtotal,
              paymentGroup: existingPaymentGroup
            });

            if (existingPaymentGroup.verificationMode === 'auto') {
              setShowAutoInstructionsModal(true);
            } else {
              setShowPaymentMethodModal(true);
            }
            return;
          } else {
            // Different selection - ask to cancel old
            const shouldCancel = window.confirm(
              `Pesanan pertama sudah punya payment group: \n\n` +
              `Group lama: ${existingPaymentGroup.orderIds.length} pesanan(Rp ${existingPaymentGroup.originalTotal.toLocaleString('id-ID')}) \n` +
              `Selection baru: ${selected.length} pesanan(Rp ${subtotal.toLocaleString('id-ID')}) \n\n` +
              `Batalkan payment group lama dan buat baru ? `
            );

            if (shouldCancel) {
              await paymentGroupService.cancelPaymentGroup(existingPaymentGroup.id);
              for (const orderId of existingPaymentGroup.orderIds) {
                await ordersService.updateOrder(orderId, {
                  paymentGroupId: null,
                  groupPaymentAmount: null,
                  verificationMode: undefined
                });
              }
              showModernAlert('Berhasil', 'Payment group lama dibatalkan', 'success');
            } else {
              return;
            }
          }
        }
      } catch (error) {
        console.error('Error loading existing payment group:', error);
      }
    }

    // No existing payment group (or cancelled), show method selection
    setAssistPaymentData({
      orders: selected,
      subtotal,
      paymentGroup: null
    });

    setShowPaymentMethodModal(true);
  };

  const handleAssistChooseMethod = async (mode: 'auto' | 'manual') => {
    try {
      if (mode === 'auto') {
        // Support both single order (backward compatible) and multiple orders
        const targetOrders = assistPaymentData.orders || [assistPaymentData.order];
        const firstOrder = targetOrders[0];
        const totalAmount = assistPaymentData.subtotal || assistPaymentData.order.finalTotal;

        // Create payment group for selected order(s)
        const paymentGroup = await paymentGroupService.createPaymentGroup({
          userId: firstOrder.userId,
          userName: firstOrder.userName,
          userEmail: firstOrder.userEmail,
          orderIds: targetOrders.map((o: any) => o.id),
          originalTotal: totalAmount,
          verificationMode: 'auto'
        });

        // Update all orders with payment group
        for (const order of targetOrders) {
          await ordersService.updateOrder(order.id, {
            paymentGroupId: paymentGroup.id,
            groupPaymentAmount: paymentGroup.exactPaymentAmount,
            verificationMode: 'auto'
          });
        }

        setAssistPaymentData({
          ...assistPaymentData,
          paymentGroup
        });

        setShowPaymentMethodModal(false);
        setShowAutoInstructionsModal(true);
        setSelectedOrderIds([]); // Clear bulk selection
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
      // Support both single and multiple orders
      const targetOrders = assistPaymentData.orders || [assistPaymentData.order];

      // Upload payment proof for all selected orders
      for (const order of targetOrders) {
        await ordersService.updateOrderPayment(
          order.id,
          assistPaymentProof,
          'awaiting_verification'
        );
      }

      setShowManualUploadModal(false);
      setAssistPaymentData(null);
      setAssistPaymentProof(null);
      setSelectedOrderIds([]); // Clear bulk selection

      showModernAlert(
        'Berhasil',
        `Bukti pembayaran berhasil diupload untuk ${targetOrders.length} pesanan`,
        'success'
      );
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

          showModernAlert('Berhasil', '… Bukti pembayaran berhasil diupload! Status diubah menjadi "Menunggu Verifikasi".', 'success');
          setShowUploadModal(false);
          setSelectedOrderForUpload(null);

          // Refresh the orders
          setSearchQuery(prev => prev + ' ');
          setTimeout(() => setSearchQuery(prev => prev.trim()), 100);

        } catch (error) {
          console.error('âŒ Error uploading payment proof:', error);
          showModernAlert('Error', 'Gagal mengupload bukti pembayaran', 'error');
        } finally {
          setUploadingPaymentProof(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('âŒ Error reading file:', error);
      showModernAlert('Error', 'Gagal membaca file', 'error');
      setUploadingPaymentProof(false);
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    showModernConfirm('Konfirmasi Hapus', 'Apakah Anda yakin ingin menghapus pesanan ini? Stock akan dikembalikan.', () => {
      // Get order data first to restore stock before deleting
      const order = orders.find(o => o.id === orderId);
      if (order) {
        console.log('”„ RESTORING STOCK BEFORE DELETING ORDER:', orderId);
        ordersService.restoreStockForOrderManually(order).then(() => {
          console.log('… Stock restored, deleting order:', orderId);
          deleteOrder(orderId);

          // Trigger event untuk refresh otomatis di semua device
          window.dispatchEvent(new CustomEvent('orderCancelled', {
            detail: { action: 'cancelled', orderId, restoredStock: true }
          }));

          // Refresh products and navigate to home
          if (onRefreshProducts) {
            console.log('”„ Refreshing products after stock restoration...');
            onRefreshProducts();
          }

          if (onNavigateToHome) {
            console.log('  Navigating to home page...');
            setTimeout(() => {
              onNavigateToHome();
            }, 1000); // Small delay to ensure products are refreshed
          }
        }).catch(error => {
          console.error('âŒ Error restoring stock before deletion:', error);
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
    }, { type: 'warning', confirmText: 'Ya, Hapus', cancelText: 'Batal' });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader
        title="Kelola Pesanan"
        subtitle="Kelola status order, cek bukti bayar, dan tindak lanjuti pengiriman"
        onBack={onBack}
        className="pb-24"
      >
        <div className="grid grid-cols-4 gap-4">
          {/* Card 1: Total Orders */}
          <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 relative overflow-hidden group hover:shadow-[0_6px_0_0_#997B2C,0_12px_24px_rgba(153,123,44,0.25)] hover:-translate-y-1 transition-all duration-300 shine-effect">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-[#D4AF37]/20 to-transparent rounded-full blur-2xl group-hover:bg-[#D4AF37]/30 transition-all duration-500" />
            <div className="relative z-10">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Total</p>
              <p className="text-2xl font-bold text-gray-800">{orders.length}</p>
              <p className="text-[10px] text-gray-400 mt-1">Order Masuk</p>
            </div>
          </div>

          {/* Card 2: Pending Actions */}
          <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 relative overflow-hidden group hover:shadow-[0_6px_0_0_#997B2C,0_12px_24px_rgba(153,123,44,0.25)] hover:-translate-y-1 transition-all duration-300 shine-effect">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-[#D4AF37]/20 to-transparent rounded-full blur-2xl group-hover:bg-[#D4AF37]/30 transition-all duration-500" />
            <div className="relative z-10">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Pending</p>
              <p className="text-2xl font-bold text-[#D4AF37]">
                {getOrdersByStatus('pending').length + getOrdersByStatus('awaiting_verification').length}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Butuh Tindakan</p>
            </div>
          </div>

          {/* Card 3: Selesai */}
          <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 relative overflow-hidden group hover:shadow-[0_6px_0_0_#997B2C,0_12px_24px_rgba(153,123,44,0.25)] hover:-translate-y-1 transition-all duration-300 shine-effect">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-[#D4AF37]/20 to-transparent rounded-full blur-2xl group-hover:bg-[#D4AF37]/30 transition-all duration-500" />
            <div className="relative z-10">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Selesai</p>
              <p className="text-2xl font-bold text-green-600">{getOrdersByStatus('delivered').length}</p>
              <p className="text-[10px] text-gray-400 mt-1">Terkirim Sukses</p>
            </div>
          </div>

          {/* Card 4: Omset */}
          <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 relative overflow-hidden group hover:shadow-[0_6px_0_0_#997B2C,0_12px_24px_rgba(153,123,44,0.25)] hover:-translate-y-1 transition-all duration-300 shine-effect">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-[#D4AF37]/20 to-transparent rounded-full blur-2xl group-hover:bg-[#D4AF37]/30 transition-all duration-500" />
            <div className="relative z-10">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Omset</p>
              <p className="text-2xl font-bold text-gray-800">
                {getTotalRevenue() >= 1000000
                  ? `${(getTotalRevenue() / 1000000).toFixed(1)} jt`
                  : `${Math.round(getTotalRevenue() / 1000)} K`}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Estimasi</p>
            </div>
          </div>
        </div>
      </PageHeader>

      {/* Content */}
      < div className="px-4 pb-20 -mt-12 relative z-10 space-y-4" >

        {/* Search and Filter - GOLD THEME */}
        < div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 shine-effect" >
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
                  className="w-full pl-10 pr-4 py-2 border border-[#E2DED5] rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#997B2C] text-gray-800 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Second Row - Filters */}
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-[#E2DED5] rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#997B2C] text-sm text-[#997B2C] font-medium"
              >
                <option value="all">Semua Status</option>
                {Object.entries(statusConfig).map(([status, config]) => (
                  <option key={status} value={status}>{config.label}</option>
                ))}
              </select>

              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="px-3 py-2 border border-[#E2DED5] rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#997B2C] text-sm text-[#997B2C] font-medium min-w-[200px]"
              >
                <option value="all">Semua Pelanggan</option>
                {getUniqueUsers().map((user, index) => (
                  <option key={index} value={user}>{user}</option>
                ))}
              </select>

              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="px-3 py-2 border border-[#E2DED5] rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#997B2C] text-sm text-[#997B2C] font-medium min-w-[150px]"
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
                className="px-3 py-2 border border-[#E2DED5] rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#997B2C] text-sm text-[#997B2C]"
              />

              <button className="p-2 border border-[#E2DED5] rounded-lg hover:bg-gray-50 transition-colors text-[#997B2C]">
                <Download className="w-4 h-4" />
              </button>

              {/*  NEW: Unaddressed Filter Button */}
              <button
                onClick={() => setShowUnaddressedOnly(!showUnaddressedOnly)}
                className={`flex items - center space - x - 2 px - 3 py - 2 border rounded - lg transition - colors text - sm font - medium ${showUnaddressedOnly
                  ? 'bg-amber-100 border-amber-300 text-amber-800'
                  : 'border-[#E2DED5] text-gray-600 hover:bg-gray-50'
                  } `}
              >
                <MapPin className="w-4 h-4" />
                <span>Belum Atur Alamat</span>
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
        </div >

        {/*  NEW: Bulk Operations Toolbar - GOLD THEME */}
        {
          user?.role === 'owner' && filteredOrders.length > 0 && (
            <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 mb-4 shine-effect">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                      onChange={toggleSelectAll}
                      className="w-5 h-5 text-[#D4AF37] border-gray-300 rounded focus:ring-[#D4AF37]"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {selectedOrderIds.length > 0
                        ? `${selectedOrderIds.length} dipilih`
                        : 'Pilih Semua'}
                    </span>
                  </label>
                </div>

                {selectedOrderIds.length > 0 && (
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto mt-3 md:mt-0">
                    <button
                      onClick={handleBulkPaymentAssist}
                      className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 bg-white border border-[#D4AF37] text-[#997B2C] rounded-lg shadow-[0_2px_0_0_#997B2C] active:shadow-none active:translate-y-1 transition-all font-medium text-sm"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Bantu Pembayaran ({selectedOrderIds.length})</span>
                    </button>

                    <button
                      onClick={handleBulkWhatsAppBilling}
                      className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 bg-green-50 border border-green-500 text-green-700 rounded-lg shadow-[0_2px_0_0_#15803d] active:shadow-none active:translate-y-1 transition-all font-medium text-sm"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Tagih ({selectedOrderIds.length})</span>
                    </button>

                    <button
                      onClick={handleBulkDelete}
                      className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 bg-white border border-[#D4AF37] text-[#997B2C] rounded-lg shadow-[0_2px_0_0_#997B2C] active:shadow-none active:translate-y-1 transition-all font-medium text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Hapus</span>
                    </button>

                    <button
                      onClick={handleBulkPrintLabel}
                      className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 bg-white border border-[#D4AF37] text-[#997B2C] rounded-lg shadow-[0_2px_0_0_#997B2C] active:shadow-none active:translate-y-1 transition-all font-medium text-sm"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Label ({selectedOrderIds.length})</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        }

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
                <div key={order.id} className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] p-4 hover:shadow-lg transition-shadow shine-effect">
                  <div className="flex items-start space-x-3">
                    {/*  NEW: Checkbox for bulk selection (Owner only) */}
                    {user?.role === 'owner' && (
                      <div className="pt-1">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(order.id)}
                          onChange={() => toggleSelectOrder(order.id)}
                          className="w-4 h-4 text-[#D4AF37] border-gray-300 rounded focus:ring-[#D4AF37]"
                        />
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-lg">#{order.id}</p>
                          <p className="text-sm text-gray-600">{order.userName} â€¢ {order.userEmail}</p>
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
                          <div className={`inline - flex items - center space - x - 1 px - 3 py - 1 rounded - full text - xs font - medium ${statusInfo.color} `}>
                            <StatusIcon className="w-3 h-3" />
                            <span>{statusInfo.label}</span>
                          </div>
                          <p className="text-lg font-bold text-[#997B2C] mt-1">
                            Rp {order.finalTotal.toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          {order.items.length} item â€¢ {paymentMethodLabel}
                        </div>
                        <div className="mt-4 grid grid-cols-2 lg:flex lg:flex-row items-center gap-2 pt-3 border-t border-gray-100">
                          {/*  NEW: Atur Alamat Button for Unaddressed Orders */}
                          {(!order.shippingConfigured || (order.shippingMode === 'keep' && !order.shippingInfo?.address)) && (
                            <button
                              onClick={() => setShippingEditOrder(order)}
                              className="px-2.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-all flex items-center justify-center gap-1 whitespace-nowrap animate-pulse"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              Atur Alamat
                            </button>
                          )}

                          {/*  NEW: WhatsApp Billing Button for Pending/Unpaid */}
                          {(order.status === 'pending' || order.status === 'awaiting_verification') && (
                            <button
                              onClick={() => handleWhatsAppBilling(order)}
                              className="px-2.5 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-100 transition-all flex items-center justify-center gap-1 whitespace-nowrap"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              Tagih
                            </button>
                          )}

                          <button
                            onClick={() => handleViewOrder(order)}
                            className="px-2.5 py-1.5 rounded-full bg-gradient-to-r from-[#F9F5EB] to-[#FEF9E7] border border-[#D4AF37]/30 text-[#997B2C] text-xs font-semibold hover:border-[#D4AF37] hover:shadow-md transition-all flex items-center justify-center gap-1 whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detail
                          </button>

                          {/*  NEW: Print Label Button for Paid/Processed */}
                          {['paid', 'processing', 'shipped', 'delivered'].includes(order.status) && (
                            <button
                              onClick={() => handlePrintLabel(order)}
                              className="px-2.5 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-100 transition-all flex items-center justify-center gap-1 whitespace-nowrap"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Label
                            </button>
                          )}

                          {(order.status === 'pending' || order.status === 'awaiting_verification') && (
                            <button
                              onClick={() => handleVerifyPayment(order)}
                              className="px-2.5 py-1.5 rounded-full bg-white border border-[#D4AF37] text-[#997B2C] text-xs font-semibold hover:bg-[#F9F5EB] hover:shadow-md transition-all flex items-center justify-center gap-1 whitespace-nowrap"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Verifikasi
                            </button>
                          )}

                          {!['canceled', 'delivered'].includes(order.status) && (
                            <button
                              onClick={() => handleEditOrder(order)}
                              className="px-2.5 py-1.5 rounded-full bg-white border border-[#D4AF37] text-[#997B2C] text-xs font-semibold hover:bg-[#F9F5EB] hover:shadow-md transition-all flex items-center justify-center gap-1 whitespace-nowrap"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="px-2.5 py-1.5 rounded-full bg-white border border-[#D4AF37] text-[#997B2C] text-xs font-semibold hover:bg-[#F9F5EB] hover:shadow-md transition-all flex items-center justify-center gap-1 whitespace-nowrap"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div >

      {/* Order Detail Modal */}
      {
        showDetailModal && selectedOrder && (
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
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800 flex items-center">
                      <MapPin className="w-4 h-4 mr-2" />
                      Informasi Pengiriman
                      {/*  NEW: Keep mode badge */}
                      {(selectedOrder as any).shippingMode === 'keep' && !(selectedOrder as any).shippingConfigured && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                          Belum diatur
                        </span>
                      )}
                    </h3>
                    {/*  NEW: Edit button for admin/owner */}
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        setShippingEditOrder(selectedOrder);
                      }}
                      className="text-xs px-3 py-1 bg-[#D4AF37]/10 text-[#997B2C] rounded-lg hover:bg-[#D4AF37]/20 transition flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit Alamat
                    </button>
                  </div>
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
                          <p className="font-medium">
                            {item.productName}
                            {item.selectedVariant?.color && ` - ${item.selectedVariant.color} `}
                            {item.selectedVariant?.size && ` (${item.selectedVariant.size})`}
                          </p>
                          <p className="text-sm text-gray-600">
                            Qty: {item.quantity} pcs
                          </p>
                          <p className="text-xs text-gray-500">
                            Rp {item.price.toLocaleString('id-ID')} Ã— {item.quantity}
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
                <div className={`${selectedOrder.paymentProof || selectedOrder.paymentProofData ? (selectedOrder.status === 'paid' ? 'bg-blue-50' : 'bg-green-50') : 'bg-gray-50'} rounded - lg p - 4`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800 flex items-center">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Bukti Pembayaran {selectedOrder.status === 'paid' && '(Terverifikasi)'}
                    </h3>
                    {!selectedOrder.paymentProof && !selectedOrder.paymentProofData && (
                      <button
                        onClick={() => handleUploadPaymentProof(selectedOrder)}
                        className="flex items-center space-x-1 text-[#997B2C] hover:text-[#D4AF37] text-sm font-bold"
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
                            src={`data: image/*;base64,${selectedOrder.paymentProofData}`}
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
                            ’¡ Klik gambar untuk memperbesar
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
                            ’¡ Klik gambar untuk memperbesar
                          </p>
                        </div>
                      ) : (
                        // Display from text/filename only
                        <div className="text-sm text-green-800">
                          <p className="font-medium">“Ž File Bukti Pembayaran:</p>
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
                {
                  selectedOrder.status === 'paid' && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2 text-blue-600" />
                        Status Pembayaran
                      </h3>
                      <p className="text-sm text-blue-800">
                        … Pembayaran telah diverifikasi pada {new Date(selectedOrder.updatedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )
                }

                {/* Notes */}
                {
                  selectedOrder.notes && (
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-800 mb-2">Catatan</h3>
                      <p className="text-sm text-gray-700">{selectedOrder.notes}</p>
                    </div>
                  )
                }

                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Tutup
                  </button>
                  {/*  NEW: Payment Assistance Button (Owner only, pending orders) */}
                  {selectedOrder.status === 'pending' && user?.role === 'owner' && (
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        handlePaymentAssist(selectedOrder);
                      }}
                      className="px-4 py-2 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white hover:shadow-lg rounded-lg transition-all flex items-center space-x-2"
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
                      className="px-4 py-2 bg-gradient-to-r from-[#D4AF37] to-[#997B2C] text-white hover:shadow-lg rounded-lg transition-all flex items-center space-x-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Verifikasi Pembayaran</span>
                    </button>
                  )}
                </div>
              </div >
            </div >
          </div >
        )
      }

      {/* Payment Verification Modal */}
      {
        showVerificationModal && selectedOrder && (
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
                  <CheckCircle className="w-12 h-12 text-[#997B2C] mx-auto mb-3" />
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
                      placeholder="Tambahkan catatan jika diperlukan..."
                    />
                  </div>
                </div>

                <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-lg p-3">
                  <p className="text-sm text-[#997B2C]">
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
                    className="px-4 py-2 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white hover:shadow-lg rounded-lg transition-all flex items-center space-x-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Konfirmasi</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Upload Payment Proof Modal */}
      {
        showUploadModal && selectedOrderForUpload && (
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
        )
      }

      {/* Modern Confirmation Modal */}
      {
        showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-2xl transform transition-all">
              {/* Header with icon */}
              <div className={`px-6 py-5 rounded-t-2xl ${confirmModalData.type === 'error' ? 'bg-red-50' :
                confirmModalData.type === 'success' ? 'bg-green-50' :
                  confirmModalData.type === 'warning' ? 'bg-[#D4AF37]/10' : 'bg-[#D4AF37]/5'
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
                    <div className="w-12 h-12 bg-[#D4AF37]/20 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-[#997B2C]" />
                    </div>
                  )}
                  {confirmModalData.type === 'info' && (
                    <div className="w-12 h-12 bg-[#D4AF37]/20 rounded-full flex items-center justify-center">
                      <Info className="w-6 h-6 text-[#997B2C]" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className={`text-xl font-bold ${confirmModalData.type === 'error' ? 'text-red-800' :
                      confirmModalData.type === 'success' ? 'text-green-800' :
                        confirmModalData.type === 'warning' ? 'text-[#997B2C]' : 'text-[#997B2C]'
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
                  className={`px-5 py-2.5 text-white rounded-xl font-medium transition-all hover:shadow-lg transform hover:scale-105 ${confirmModalData.type === 'error' ? 'bg-red-600 hover:bg-red-700' :
                    confirmModalData.type === 'success' ? 'bg-green-600 hover:bg-green-700' :
                      'bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)]'
                    }`}
                >
                  {confirmModalData.confirmText}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/*  NEW: Edit Order Modal */}
      {
        showEditModal && editingOrder && (
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
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

                  {/* Info: Alamat diedit via modal khusus agar lengkap dengan data Provinsi/Kota */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div className="flex-1">
                        <h5 className="text-sm font-semibold text-amber-800 mb-1">Alamat Pengiriman</h5>
                        <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                          {editingOrder.shippingInfo?.name} ({editingOrder.shippingInfo?.phone})<br />
                          {editingOrder.shippingInfo?.address}
                        </p>
                        <button
                          onClick={() => {
                            // Close this modal and open Shipping Edit Modal
                            const orderToEdit = { ...editingOrder };
                            setShowEditModal(false);
                            setEditingOrder(null);
                            setShippingEditOrder(orderToEdit);
                          }}
                          className="px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg text-sm font-semibold hover:bg-amber-100 transition-colors flex items-center gap-2"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Atur Alamat Lengkap (Provinsi/Kota)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Pesanan</label>
                  <textarea
                    value={editingOrder.notes || ''}
                    onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
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
                  className="px-5 py-2.5 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white rounded-xl font-bold hover:shadow-lg transition-all"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/*  NEW: Payment Assistance - Method Selection Modal */}
      {
        showPaymentMethodModal && assistPaymentData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full">
              <div className="bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] p-4 rounded-t-2xl shadow-lg">
                <h2 className="text-xl font-bold text-white text-center">
                  ’³ Pilih Metode Pembayaran
                </h2>
                <p className="text-sm text-white/90 text-center mt-1">
                  {assistPaymentData.orders ? (
                    `${assistPaymentData.orders.length} Pesanan - Rp ${assistPaymentData.subtotal.toLocaleString('id-ID')}`
                  ) : (
                    `Pesanan #{assistPaymentData.order.id} - Rp ${assistPaymentData.order.finalTotal.toLocaleString('id-ID')}`
                  )}
                </p>
              </div>

              <div className="p-4 space-y-3">
                {/* Verifikasi Otomatis Button */}
                <button
                  onClick={() => handleAssistChooseMethod('auto')}
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
                      <h3 className="text-base font-bold text-slate-900">âš¡ Verifikasi Otomatis</h3>
                      <p className="text-sm text-slate-600 mt-0.5">
                        Cepat (1-5 menit), bayar sesuai angka + kode unik
                      </p>
                    </div>
                  </div>
                </button>

                {/* Verifikasi Manual Button */}
                <button
                  onClick={() => handleAssistChooseMethod('manual')}
                  className="w-full text-left border-2 border-gray-200 rounded-xl p-4 hover:border-[#D4AF37] hover:shadow-md transition-all bg-white"
                >

                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Upload className="w-6 h-6 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-slate-700">“¸ Verifikasi Manual</h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Upload bukti transfer, verifikasi 1-24 jam
                      </p>
                    </div>
                  </div>
                </button>

                {/* Cancel Button */}
                <button
                  onClick={() => {
                    setShowPaymentMethodModal(false);
                    setAssistPaymentData(null);
                  }}
                  className="w-full px-4 py-2.5 border border-gray-200 text-slate-500 rounded-xl font-medium hover:bg-gray-50 transition-all text-sm"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/*  NEW: Payment Assistance - Auto Instructions Modal */}
      {
        showAutoInstructionsModal && assistPaymentData?.paymentGroup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] p-4 rounded-t-2xl shadow-lg">
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
                    Kode Pembayaran Otomatis
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
                    âš ï¸ Beritahu customer untuk transfer PERSIS sesuai nominal
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-300 text-center">
                  <p className="text-xs font-semibold text-green-800 mb-2">Total Transfer:</p>
                  <p className="text-4xl font-bold text-[#997B2C] mb-2">
                    Rp {assistPaymentData.paymentGroup.exactPaymentAmount.toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-gray-700 mb-3">
                    Rp {assistPaymentData.paymentGroup.originalTotal.toLocaleString('id-ID')} + <span className="font-mono font-bold text-[#997B2C]">{assistPaymentData.paymentGroup.uniquePaymentCode}</span> (kode unik)
                  </p>
                  <button
                    onClick={() => handleAssistCopy(assistPaymentData.paymentGroup.exactPaymentAmount.toString(), 'Nominal')}
                    className="w-full px-4 py-2 bg-gradient-to-r from-[#D4AF37] to-[#997B2C] text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Nominal
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-900">Transfer ke salah satu rekening:</p>

                  <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-700 font-medium">¦ BCA - Fahrin</p>
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
                      <p className="text-xs text-cyan-700 font-medium">¦ BRI - Fahrin</p>
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
                      <p className="text-xs text-yellow-700 font-medium">¦ Mandiri - Fahrin</p>
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
                  className="w-full px-6 py-3 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white rounded-xl font-bold hover:shadow-lg transition-all"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/*  NEW: Payment Assistance - Manual Upload Modal */}
      {
        showManualUploadModal && assistPaymentData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] p-4 rounded-t-2xl shadow-lg">
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
                    “¸ Upload untuk Customer
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
                <div className="bg-[#D4AF37]/5 rounded-xl p-4 border border-[#D4AF37]/20 text-center">
                  <p className="text-xs font-semibold text-[#997B2C] mb-2">Total Transfer:</p>
                  <p className="text-3xl font-bold text-[#997B2C] mb-3">
                    Rp {(assistPaymentData.subtotal || assistPaymentData.order.finalTotal).toLocaleString('id-ID')}
                  </p>
                  {assistPaymentData.orders && assistPaymentData.orders.length > 1 && (
                    <p className="text-xs text-blue-700 mb-2">
                      {assistPaymentData.orders.length} pesanan digabung
                    </p>
                  )}
                  <button
                    onClick={() => handleAssistCopy((assistPaymentData.subtotal || assistPaymentData.order.finalTotal).toString(), 'Nominal')}
                    className="px-4 py-2 bg-gradient-to-r from-[#D4AF37] to-[#997B2C] text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2 mx-auto"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Nominal
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-900">Transfer ke salah satu rekening:</p>

                  <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-700 font-medium">¦ BCA - Fahrin</p>
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
                      <p className="text-xs text-cyan-700 font-medium">¦ BRI - Fahrin</p>
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
                      <p className="text-xs text-yellow-700 font-medium">¦ Mandiri - Fahrin</p>
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
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-[#D4AF37] transition-all cursor-pointer bg-gray-50">
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
                  className="w-full px-6 py-3 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Kirim Bukti Transfer
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/*  NEW: Shipping Edit Modal for Admin/Owner */}
      <ShippingEditModal
        isOpen={!!shippingEditOrder}
        onClose={() => setShippingEditOrder(null)}
        order={shippingEditOrder}
        onSuccess={() => {
          setShippingEditOrder(null);
        }}
      />
    </div >
  );
};

export default AdminOrdersPage;
