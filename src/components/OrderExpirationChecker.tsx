/**
 * OrderExpirationChecker - Background component to auto-expire unpaid orders
 * 
 * Rules:
 * - Customer: 6 hours to pay
 * - Reseller (Ready Stock): 1 day to pay
 * - Reseller (PO only): No limit
 * - Timer stops when payment proof is uploaded
 * - Notification 15 minutes before expiry
 */

import { useEffect, useRef, useState } from 'react';
import { ordersService, Order } from '../services/ordersService';
import { Clock, AlertTriangle, X } from 'lucide-react';

interface ExpiringOrder {
    id: string;
    expiresAt: number;
    timeRemaining: number;
}

interface OrderExpirationCheckerProps {
    userId?: string;
    onOrderExpired?: (orderId: string) => void;
}

export default function OrderExpirationChecker({ userId, onOrderExpired }: OrderExpirationCheckerProps) {
    const [expiringOrders, setExpiringOrders] = useState<ExpiringOrder[]>([]);
    const [showWarning, setShowWarning] = useState(false);
    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const ordersRef = useRef<Order[]>([]);

    useEffect(() => {
        // Subscribe to orders
        const unsubscribe = ordersService.subscribeToOrders((orders) => {
            ordersRef.current = orders;
        });

        // Check every 30 seconds for better UX
        checkIntervalRef.current = setInterval(() => {
            checkExpiredOrders();
        }, 30 * 1000);

        // Initial check
        setTimeout(checkExpiredOrders, 2000);

        return () => {
            unsubscribe();
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
        };
    }, [userId]);

    const checkExpiredOrders = async () => {
        const now = Date.now();
        const orders = ordersRef.current;
        const newExpiringOrders: ExpiringOrder[] = [];

        for (const order of orders) {
            // Skip if no expiry set or already paid/cancelled
            if (!order.expiresAt || order.status !== 'pending') continue;

            // Filter by userId if provided
            if (userId && order.userId !== userId) continue;

            const timeRemaining = order.expiresAt - now;

            // Already expired - auto-cancel
            if (timeRemaining <= 0) {
                console.log('⏰ AUTO-EXPIRE: Order expired, cancelling:', order.id);
                try {
                    // This will also restore stock via updateOrderStatus
                    await ordersService.updateOrderStatus(order.id, 'cancelled');
                    console.log('✅ Order cancelled and stock restored:', order.id);
                    onOrderExpired?.(order.id);
                } catch (err) {
                    console.error('❌ Failed to expire order:', order.id, err);
                }
                continue;
            }

            // ≤15 minutes remaining - send notification
            const fifteenMinutes = 15 * 60 * 1000;
            if (timeRemaining <= fifteenMinutes && !order.expiryNotified) {
                newExpiringOrders.push({
                    id: order.id,
                    expiresAt: order.expiresAt,
                    timeRemaining
                });

                // Mark as notified in Firestore
                try {
                    await ordersService.updateOrder(order.id, { expiryNotified: true });
                } catch (err) {
                    console.error('Failed to mark expiry notified:', err);
                }
            }
        }

        if (newExpiringOrders.length > 0) {
            setExpiringOrders(newExpiringOrders);
            setShowWarning(true);
        }
    };

    const formatTimeRemaining = (ms: number): string => {
        const minutes = Math.floor(ms / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);
        return `${minutes}m ${seconds}s`;
    };

    // Warning UI
    if (!showWarning || expiringOrders.length === 0) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-300">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-4 shadow-lg">
                <div className="flex items-start gap-3">
                    <div className="bg-white/20 rounded-full p-2">
                        <AlertTriangle className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-white mb-1">Pesanan Akan Expired!</h4>
                        <p className="text-white/90 text-sm">
                            {expiringOrders.length} pesanan akan expired dalam 15 menit. Segera lakukan pembayaran!
                        </p>
                        {expiringOrders.map(order => (
                            <div key={order.id} className="mt-2 flex items-center gap-2 text-white/80 text-xs">
                                <Clock className="w-3 h-3" />
                                <span>Order {order.id}: {formatTimeRemaining(order.timeRemaining)}</span>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowWarning(false)}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
}
