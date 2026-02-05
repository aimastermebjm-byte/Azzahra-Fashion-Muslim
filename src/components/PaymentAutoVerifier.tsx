import React, { useEffect, useState, useRef } from 'react';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { paymentDetectionService, PaymentDetection, PaymentDetectionSettings } from '../services/paymentDetectionService';
import { autoVerificationLogService } from '../services/autoVerificationLogService';
import { useToast } from './ToastProvider';
import { ordersService } from '../services/ordersService';
import { checkAndUpgradeRole } from '../services/roleUpgradeService';

/**
 * 🤖 PaymentAutoVerifier
 * 
 * Component "Headless" (Tanpa tampilan) yang berjalan di background
 * selama aplikasi dibuka oleh Owner.
 * 
 * Fungsinya:
 * 1. Memantau pembayaran masuk (Payment Detections)
 * 2. Memantau order pending
 * 3. JIKA settingan 'Full Auto' aktif
 * 4. DAN ada kecocokan 100% (Kode Unik)
 * 5. MAKA otomatis tandai LUNAS (Verified)
 * 
 * 🛡️ Safety Features:
 * - Test Mode: Hanya log, tidak benar-benar lunaskan
 * - Audit Log: Setiap aksi tercatat lengkap
 */
const PaymentAutoVerifier: React.FC = () => {
    const { user } = useFirebaseAuth();
    const { showToast } = useToast();

    // Local state for data
    const [detections, setDetections] = useState<PaymentDetection[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [settings, setSettings] = useState<PaymentDetectionSettings | null>(null);

    // Guard untuk mencegah infinite loop / duplicate processing
    // Set ini menyimpan ID detection yang sedang atau sudah diproses
    const processingRef = useRef<Set<string>>(new Set());

    // Hanya jalankan untuk OWNER
    const isOwner = user?.role === 'owner';



    // 1. Load Settings (Real-time subscription)
    useEffect(() => {
        if (!isOwner) return;

        const unsubscribe = paymentDetectionService.subscribeToSettings((newSettings) => {

            setSettings(newSettings);
        });

        return () => unsubscribe();
    }, [isOwner]);

    // 2. Load Pending Detections (Real-time subscription)
    useEffect(() => {
        if (!isOwner) return;

        // ✅ FIX: Use correct method name - onPendingDetectionsChange
        const unsubscribe = paymentDetectionService.onPendingDetectionsChange((pendingDetections) => {
            // ✅ FIX: No need to filter - already pending from source

            setDetections(pendingDetections);
        });

        return () => unsubscribe();
    }, [isOwner]);

    // 3. Load Pending Orders
    useEffect(() => {
        if (!isOwner) return;

        // Subscribe khusus pending orders (waiting_payment not in interface but included for safety)
        const unsubscribe = ordersService.subscribeToOrders((allOrders: any[]) => {
            const pending = allOrders.filter((o: any) => o.status === 'pending');
            setOrders(prev => {
                if (prev.length !== pending.length) return pending;
                const prevIds = prev.map(o => o.id).join(',');
                const newIds = pending.map(o => o.id).join(',');
                return prevIds === newIds ? prev : pending;
            });
        });

        return () => unsubscribe();
    }, [isOwner]);

    // 4. THE EXECUTOR LOOP ⚙️
    useEffect(() => {
        const executeVerification = async () => {
            // Safety checks
            if (!isOwner || !settings || settings.mode !== 'full-auto') return;
            if (detections.length === 0 || orders.length === 0) return;

            const isTestMode = settings.testMode === true;
            if (isTestMode) {

            }

            // Loop semua detection yang belum diproses
            for (const detection of detections) {
                // Skip jika sedang diproses
                if (processingRef.current.has(detection.id)) continue;

                // Coba matching
                try {
                    // Gunakan logic matching yang sama dengan halaman Admin
                    const matches = await paymentDetectionService.matchDetectionWithOrders(detection, orders);

                    if (matches.length > 0) {
                        const bestMatch = matches[0];
                        const threshold = settings.autoConfirmThreshold || 90;

                        // JIKA Confidence cukup tinggi (misal 100% dari kode unik)
                        if (bestMatch.confidence >= threshold) {


                            // Kunci detection ini biar gak diproses 2x
                            processingRef.current.add(detection.id);

                            // 🔄 FETCH FRESH DATA from Firestore (Bypass stale state)
                            // Ini penting untuk memastikan invoiceNumber terbaca meskipun local state belum update
                            // Helper to validate invoice format strictly
                            const isValidInvoice = (inv: any) => typeof inv === 'string' && inv.startsWith('INV');

                            const isPaymentGroup = bestMatch.orderId.startsWith('PG');
                            let freshGroupOrders: any[] = [];
                            let freshMatchedOrder: any = null;
                            let localOrderMatch = null;

                            if (isPaymentGroup) {
                                freshGroupOrders = await ordersService.getOrdersByPaymentGroupId(bestMatch.orderId);
                                freshMatchedOrder = freshGroupOrders[0];

                                // RETRY MECHANISM: If invoiceNumber missing or invalid, wait 2s and retry
                                if (!isValidInvoice(freshMatchedOrder?.invoiceNumber)) {
                                    console.log('⏳ Invoice number missing or invalid, retrying fetch in 2s...');
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                    freshGroupOrders = await ordersService.getOrdersByPaymentGroupId(bestMatch.orderId);
                                    freshMatchedOrder = freshGroupOrders[0];
                                }

                                // 🚑 DATA SCAVENGING: If fresh fetch missing valid invoice, try local state
                                if (!isValidInvoice(freshMatchedOrder?.invoiceNumber)) {
                                    const localGroupMatch = orders.find(o => o.paymentGroupId === bestMatch.orderId);
                                    if (isValidInvoice(localGroupMatch?.invoiceNumber)) {
                                        console.log('🚑 Recovered Valid Invoice from Local State:', localGroupMatch?.invoiceNumber);
                                        if (freshMatchedOrder) freshMatchedOrder.invoiceNumber = localGroupMatch?.invoiceNumber;
                                        if (freshGroupOrders[0]) freshGroupOrders[0].invoiceNumber = localGroupMatch?.invoiceNumber;
                                    }
                                }

                            } else {
                                freshMatchedOrder = await ordersService.getOrderById(bestMatch.orderId);
                                localOrderMatch = orders.find(o => o.id === bestMatch.orderId);

                                // RETRY MECHANISM
                                if (!isValidInvoice(freshMatchedOrder?.invoiceNumber)) {
                                    console.log('⏳ Invoice number missing or invalid, retrying fetch in 2s...');
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                    freshMatchedOrder = await ordersService.getOrderById(bestMatch.orderId);
                                    localOrderMatch = orders.find(o => o.id === bestMatch.orderId); // Refresh local too
                                }

                                // 🚑 DATA SCAVENGING: Merge with local data manually
                                if (freshMatchedOrder && localOrderMatch) {
                                    if (!isValidInvoice(freshMatchedOrder.invoiceNumber) && isValidInvoice(localOrderMatch.invoiceNumber)) {
                                        console.log('🚑 Recovered Valid Invoice from Local State:', localOrderMatch.invoiceNumber);
                                        freshMatchedOrder.invoiceNumber = localOrderMatch.invoiceNumber;
                                    }
                                }

                                if (freshMatchedOrder) {
                                    freshGroupOrders = [freshMatchedOrder];
                                }
                            }

                            // Fallback ke local state jika fetch gagal total (safety net)
                            if (!freshMatchedOrder) {
                                console.warn('⚠️ Fresh fetch failed/empty, using local state fallback for:', bestMatch.orderId);
                                freshMatchedOrder = isPaymentGroup
                                    ? orders.find(o => o.paymentGroupId === bestMatch.orderId)
                                    : orders.find(o => o.id === bestMatch.orderId);
                                freshGroupOrders = isPaymentGroup
                                    ? orders.filter(o => o.paymentGroupId === bestMatch.orderId)
                                    : (freshMatchedOrder ? [freshMatchedOrder] : []);
                            }

                            const matchedOrder = freshMatchedOrder;
                            const groupOrders = freshGroupOrders;

                            const customerName = matchedOrder?.shippingInfo?.name || matchedOrder?.userName || 'Unknown';

                            // Use data AS IS - DO NOT REGENERATE INVOICE NUMBERS
                            const orderDetails = groupOrders.map(o => ({
                                id: isValidInvoice(o.invoiceNumber) ? o.invoiceNumber : o.id, // Prefer Valid Invoice
                                amount: o.finalTotal || 0,
                                customerName: o.shippingInfo?.name || o.userName
                            }));

                            if (isTestMode) {
                                // 🧪 TEST MODE: Only log, don't execute
                                await autoVerificationLogService.createLog({
                                    orderId: bestMatch.orderId,
                                    invoiceNumber: matchedOrder?.invoiceNumber, // 🧾 Store invoice number (first order)
                                    orderAmount: matchedOrder?.finalTotal || detection.amount,
                                    customerName,
                                    detectionId: detection.id,
                                    detectedAmount: detection.amount,
                                    senderName: detection.senderName || 'Unknown',
                                    bank: detection.bank,
                                    rawNotification: detection.rawText,
                                    confidence: bestMatch.confidence,
                                    matchReason: `Auto-match (Confidence: ${bestMatch.confidence}%)`,
                                    status: 'dry-run',
                                    executedBy: 'system',
                                    paymentGroupId: isPaymentGroup ? bestMatch.orderId : matchedOrder?.paymentGroupId,
                                    orderIds: groupOrders.map(o => isValidInvoice(o.invoiceNumber) ? o.invoiceNumber : o.id), // 🧾 Use valid invoice numbers
                                    isGroupPayment: isPaymentGroup || groupOrders.length > 1,
                                    orderDetails // 🧾 Include all order details with invoice numbers
                                } as any);

                                showToast({
                                    title: '🧪 [TEST] Pembayaran Terdeteksi',
                                    message: `Order ${bestMatch.orderId} AKAN dilunaskan (mode test aktif)`,
                                    type: 'info',
                                    duration: 5000
                                });


                            } else {
                                // 🚀 PRODUCTION MODE: Execute verification
                                try {
                                    // EKSEKUSI: Update Detection jadi Verified & Link Order
                                    await paymentDetectionService.markAsVerified(
                                        detection.id,
                                        bestMatch.orderId,
                                        'auto',
                                        'full-auto'
                                    );

                                    // EKSEKUSI: Update Order jadi Paid
                                    await ordersService.updateOrderStatus(bestMatch.orderId, 'paid');

                                    // Auto upgrade role if eligible (Customer -> Reseller)
                                    try {
                                        const orderItems = (matchedOrder?.items || []).map((item: any) => ({
                                            productId: item.productId || item.id,
                                            productName: item.name || item.productName || '',
                                            productStatus: item.productStatus || item.status || 'ready',
                                            quantity: item.quantity || 1
                                        }));

                                        const upgradeResult = await checkAndUpgradeRole(matchedOrder?.userId, orderItems);
                                        if (upgradeResult.upgraded) {

                                        }
                                    } catch (upgradeError) {
                                        console.error('Role upgrade check failed (non-blocking):', upgradeError);
                                    }

                                    // 📋 Log success
                                    await autoVerificationLogService.createLog({
                                        orderId: bestMatch.orderId,
                                        invoiceNumber: matchedOrder?.invoiceNumber, // 🧾 Store invoice number (first order)
                                        orderAmount: matchedOrder?.finalTotal || detection.amount,
                                        customerName,
                                        detectionId: detection.id,
                                        detectedAmount: detection.amount,
                                        senderName: detection.senderName || 'Unknown',
                                        bank: detection.bank,
                                        rawNotification: detection.rawText,
                                        confidence: bestMatch.confidence,
                                        matchReason: `Auto-verified by System (Confidence: ${bestMatch.confidence}%)`,
                                        status: 'success',
                                        executedBy: 'system',
                                        paymentGroupId: isPaymentGroup ? bestMatch.orderId : matchedOrder?.paymentGroupId,
                                        orderIds: groupOrders.map(o => o.invoiceNumber || o.id), // 🧾 Use invoice numbers
                                        isGroupPayment: isPaymentGroup || groupOrders.length > 1,
                                        orderDetails // 🧾 Include all order details with invoice numbers
                                    } as any);

                                    // Notifikasi Petir ⚡
                                    showToast({
                                        title: '🤖 Pembayaran Otomatis Diterima!',
                                        message: `Order ${bestMatch.orderId} telah dilunaskan otomatis.`,
                                        type: 'success',
                                        duration: 5000
                                    });

                                    // Play sound effect (optional)
                                    const audio = new Audio('/sounds/success.mp3');
                                    audio.play().catch(() => { });

                                } catch (execError) {
                                    // 📋 Log failure
                                    await autoVerificationLogService.createLog({
                                        orderId: bestMatch.orderId,
                                        orderAmount: matchedOrder?.finalTotal || detection.amount,
                                        customerName,
                                        detectionId: detection.id,
                                        detectedAmount: detection.amount,
                                        senderName: detection.senderName || 'Unknown',
                                        bank: detection.bank,
                                        rawNotification: detection.rawText,
                                        confidence: bestMatch.confidence,
                                        matchReason: `Auto-verification attempted`,
                                        status: 'failed',
                                        executedBy: 'system',
                                        errorMessage: execError instanceof Error ? execError.message : 'Unknown error'
                                    });

                                    throw execError;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('🤖 AutoVerifier Error:', error);
                    // Lepas kunci jika error, biar bisa dicoba lagi next cycle
                    processingRef.current.delete(detection.id);
                }
            }
        };

        // Jalankan executor
        executeVerification();

    }, [detections, orders, settings, isOwner, showToast]);

    // Headless component, renders nothing
    return null;
};

export default PaymentAutoVerifier;
