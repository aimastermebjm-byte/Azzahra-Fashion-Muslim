import React, { useEffect, useState, useRef } from 'react';
import { useAdmin } from '../contexts/AdminContext';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { paymentDetectionService } from '../services/paymentDetectionService';
import { PaymentDetection } from '../services/paymentDetectionService';
import { useToast } from './ToastProvider';
import { ordersService } from '../services/ordersService';

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
 */
const PaymentAutoVerifier: React.FC = () => {
    const { user } = useFirebaseAuth();
    const { showToast } = useToast();

    // Local state for data
    const [detections, setDetections] = useState<PaymentDetection[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);

    // Guard untuk mencegah infinite loop / duplicate processing
    // Set ini menyimpan ID detection yang sedang atau sudah diproses
    const processingRef = useRef<Set<string>>(new Set());

    // Hanya jalankan untuk OWNER
    const isOwner = user?.role === 'owner';

    // 1. Load Settings
    useEffect(() => {
        if (!isOwner) return;

        const unsubscribe = paymentDetectionService.subscribeToSettings((newSettings) => {
            // console.log('🤖 AutoVerifier: Settings loaded', newSettings?.mode);
            setSettings(newSettings);
        });

        return () => unsubscribe();
    }, [isOwner]);

    // 2. Load Detections (Unverified only)
    useEffect(() => {
        if (!isOwner) return;

        // Kita subscribe ke UNVERIFIED detections
        // Note: service.subscribeToDetections biasanya return all or filter.
        // Untuk efisiensi, kita pakai poll atau subscribe yang sudah ada.
        // Di sini asumsi kita pakai subscribeToPendingDetections jika ada, atau filter manual.

        // Tapi karena logic subscribeToDetections di service mungkin return semua,
        // kita filter di sini.
        const unsubscribe = paymentDetectionService.subscribeToDetections((allDetections) => {
            const pending = allDetections.filter(d => d.status === 'unverified');
            // Hanya update jika panjang array berubah untuk mengurangi render
            // (Simplified check, idealnya deep compare tapi ini cukup untuk MVP)
            setDetections(prev => {
                if (prev.length !== pending.length) return pending;
                // Check IDs
                const prevIds = prev.map(d => d.id).join(',');
                const newIds = pending.map(d => d.id).join(',');
                return prevIds === newIds ? prev : pending;
            });
        });

        return () => unsubscribe();
    }, [isOwner]);

    // 3. Load Pending Orders
    useEffect(() => {
        if (!isOwner) return;

        // Subscribe khusus waiting_payment
        const unsubscribe = ordersService.subscribeToOrders((allOrders) => {
            const pending = allOrders.filter(o => o.status === 'pending' || o.status === 'waiting_payment');
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
                            console.log(`🤖 AutoVerifier: MATCH FOUND! ${detection.id} -> ${bestMatch.orderId} (${bestMatch.confidence}%)`);

                            // Kunci detection ini biar gak diproses 2x
                            processingRef.current.add(detection.id);

                            // EKSEKUSI: Update Detection jadi Verified & Link Order
                            await paymentDetectionService.markAsVerified(
                                detection.id,
                                bestMatch.orderId,
                                'auto',
                                `Auto-verified by System (Confidence: ${bestMatch.confidence}%)`
                            );

                            // EKSEKUSI: Update Order jadi Paid
                            await ordersService.updateOrderStatus(bestMatch.orderId, 'paid');

                            // Notifikasi Petir ⚡
                            showToast({
                                title: '🤖 Pembayaran Otomatis Diterima!',
                                message: `Order ${bestMatch.orderId} telah dilunaskan otomatis.`,
                                type: 'success',
                                duration: 5000
                            });

                            // Play sound effect (optional)
                            const audio = new Audio('/sounds/success.mp3'); // Pastikan file ada atau ignore error
                            audio.play().catch(() => { });
                        }
                    }
                } catch (error) {
                    console.error('🤖 AutoVerifier Error:', error);
                    // Lepas kunci jika error, biar bisa dicoba lagi next cycle (atau biarkan terkunci manual)
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
