import React, { useState, useEffect } from 'react';
import {
    FileText,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Clock,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Trash2
} from 'lucide-react';
import PageHeader from './PageHeader';
import { autoVerificationLogService, AutoVerificationLog } from '../services/autoVerificationLogService';
import { ordersService } from '../services/ordersService';

interface AdminAutoVerificationLogsPageProps {
    onBack: () => void;
}

const AdminAutoVerificationLogsPage: React.FC<AdminAutoVerificationLogsPageProps> = ({ onBack }) => {
    const [logs, setLogs] = useState<AutoVerificationLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'success' | 'failed' | 'dry-run'>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [stats, setStats] = useState({
        totalSuccess: 0,
        totalFailed: 0,
        totalDryRun: 0,
        totalAmount: 0
    });
    const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        loadLogs();
        loadStats();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const loadedLogs = await autoVerificationLogService.getLogs();
            setLogs(loadedLogs);
        } catch (error) {
            console.error('Error loading logs:', error);
        }
        setLoading(false);
    };

    const loadStats = async () => {
        try {
            const loadedStats = await autoVerificationLogService.getStats();
            setStats(loadedStats);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    // 🗑️ Delete single log
    const handleDeleteLog = async (logId: string) => {
        try {
            setDeletingId(logId);
            await autoVerificationLogService.deleteLog(logId);
            setLogs(logs.filter(l => l.id !== logId));
            loadStats();
        } catch (error) {
            console.error('Error deleting log:', error);
        } finally {
            setDeletingId(null);
        }
    };

    // 🗑️ Delete all logs
    const handleDeleteAllLogs = async () => {
        try {
            setLoading(true);
            await autoVerificationLogService.deleteAllLogs();
            setLogs([]);
            setStats({ totalSuccess: 0, totalFailed: 0, totalDryRun: 0, totalAmount: 0 });
            setShowDeleteAllConfirm(false);
        } catch (error) {
            console.error('Error deleting all logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = filter === 'all'
        ? logs
        : logs.filter(log => log.status === filter);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'failed':
                return <XCircle className="w-5 h-5 text-red-500" />;
            case 'dry-run':
                return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            default:
                return <Clock className="w-5 h-5 text-gray-500" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'success':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'failed':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'dry-run':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const formatTimestamp = (timestamp: any) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // 🩹 Self-Healing Component: Lazily fetches Invoice Number if log has stale ORD-ID
    const OrderRefDisplay = ({ id }: { id: string }) => {
        const [displayId, setDisplayId] = useState(id);

        useEffect(() => {
            // ✅ If ID already starts with INV-, no need to query
            if (id && id.startsWith('INV-')) {
                setDisplayId(id);
                return;
            }

            let isMounted = true;
            if (id && (id.startsWith('ORD') || id.startsWith('PG'))) {
                console.log('🔍 OrderRefDisplay: Looking up invoice for:', id);
                // 🔥 FIX: Use getOrderByInternalId which searches by 'id' field, not document ID
                ordersService.getOrderByInternalId(id).then(order => {
                    console.log('📦 OrderRefDisplay result for', id, ':', order ? `Found! Invoice: ${order.invoiceNumber || 'UNDEFINED'}` : 'NOT FOUND');
                    if (isMounted && order?.invoiceNumber) {
                        setDisplayId(order.invoiceNumber);
                    } else if (isMounted) {
                        console.warn('⚠️ OrderRefDisplay: Order found but no invoiceNumber for', id);
                    }
                }).catch((err) => {
                    console.error('❌ OrderRefDisplay error for', id, ':', err);
                });
            }
            return () => { isMounted = false; };
        }, [id]);

        return <>{displayId}</>;
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <PageHeader title="Log Pelunasan Otomatis" onBack={onBack} />

            {/* Stats - GOLD THEME */}
            <div className="px-4 py-4 bg-white border-b border-[#D4AF37]">
                <div className="grid grid-cols-4 gap-2">
                    <div className="bg-green-50 rounded-xl p-3 text-center border-2 border-[#D4AF37] shadow-[0_2px_0_0_#997B2C]">
                        <div className="text-2xl font-bold text-green-700">{stats.totalSuccess}</div>
                        <div className="text-xs text-green-600">Berhasil</div>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 text-center border-2 border-[#D4AF37] shadow-[0_2px_0_0_#997B2C]">
                        <div className="text-2xl font-bold text-red-700">{stats.totalFailed}</div>
                        <div className="text-xs text-red-600">Gagal</div>
                    </div>
                    <div className="bg-yellow-50 rounded-xl p-3 text-center border-2 border-[#D4AF37] shadow-[0_2px_0_0_#997B2C]">
                        <div className="text-2xl font-bold text-yellow-700">{stats.totalDryRun}</div>
                        <div className="text-xs text-yellow-600">Test Mode</div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 text-center border-2 border-[#D4AF37] shadow-[0_2px_0_0_#997B2C]">
                        <div className="text-lg font-bold text-blue-700">
                            {stats.totalAmount > 0 ? `${(stats.totalAmount / 1000000).toFixed(1)}jt` : '0'}
                        </div>
                        <div className="text-xs text-blue-600">Total Rp</div>
                    </div>
                </div>
            </div>

            {/* Filter & Refresh */}
            <div className="px-4 py-3 bg-white border-b flex items-center justify-between">
                <div className="flex space-x-2">
                    {(['all', 'success', 'failed', 'dry-run'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === f
                                ? 'bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white shadow-sm font-bold'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {f === 'all' ? 'Semua' : f === 'dry-run' ? 'Test' : f === 'success' ? 'Berhasil' : 'Gagal'}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    {filteredLogs.length > 0 && (
                        <button
                            onClick={() => setShowDeleteAllConfirm(true)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors flex items-center gap-1"
                            title="Hapus Semua Log"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        onClick={() => { loadLogs(); loadStats(); }}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="Refresh Log"
                    >
                        <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Logs List */}
            <div className="px-4 py-4 space-y-3">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37] mx-auto"></div>
                        <p className="text-gray-500 mt-4">Memuat log...</p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Belum Ada Log</h3>
                        <p className="text-sm text-gray-500">
                            Log pelunasan otomatis akan muncul di sini
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Back button when viewing expanded card */}
                        {expandedId && (
                            <button
                                onClick={() => setExpandedId(null)}
                                className="mb-3 flex items-center gap-2 text-sm text-[#997B2C] font-medium hover:underline"
                            >
                                ← Kembali ke Daftar ({filteredLogs.length} log)
                            </button>
                        )}
                        {/* When a card is expanded, only show that card for cleaner UI */}
                        {(expandedId ? filteredLogs.filter(log => log.id === expandedId) : filteredLogs).map((log) => (
                            <div
                                key={log.id}
                                className={`bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] overflow-hidden shine-effect ${expandedId === log.id ? 'ring-2 ring-[#D4AF37]' : ''}`}
                            >
                                {/* Log Header */}
                                <div
                                    className="p-4 cursor-pointer hover:bg-gray-50"
                                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start space-x-3">
                                            {getStatusIcon(log.status)}
                                            <div>
                                                <div className="font-semibold text-gray-900">
                                                    Order: {log.invoiceNumber || log.orderId}
                                                </div>
                                                {/* Customer Name */}
                                                <div className="text-sm text-[#997B2C] font-bold">
                                                    👤 {log.customerName || log.senderName || 'Unknown'}
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    Rp {log.detectedAmount.toLocaleString('id-ID')}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {formatTimestamp(log.timestamp)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(log.status)}`}>
                                                {log.status === 'dry-run' ? '🧪 Test' : log.status === 'success' ? '✅ OK' : '❌ Fail'}
                                            </span>
                                            {expandedId === log.id ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedId === log.id && (
                                    <div className="px-4 pb-4 border-t bg-gray-50">
                                        {/* Order List for Group Payments */}
                                        {(log as any).isGroupPayment && ((log as any).orderDetails || (log as any).orderIds) && (
                                            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                <div className="text-xs text-blue-600 font-medium mb-2">📦 Pesanan dalam Group:</div>
                                                <div className="space-y-2">
                                                    {/* Use orderDetails if available (new format), fallback to orderIds (old format) */}
                                                    {(log as any).orderDetails ? (
                                                        (log as any).orderDetails.map((order: { id: string; amount: number; customerName?: string }, index: number) => (
                                                            <div key={index} className="flex justify-between items-center bg-white rounded px-2 py-1 border border-blue-100">
                                                                <span className="text-sm font-semibold text-blue-800">• <OrderRefDisplay id={order.id} /></span>
                                                                <span className="text-sm font-bold text-green-600">
                                                                    Rp {order.amount.toLocaleString('id-ID')}
                                                                </span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        (log as any).orderIds.map((orderId: string, index: number) => (
                                                            <div key={index} className="text-sm font-semibold text-blue-800">
                                                                • <OrderRefDisplay id={orderId} />
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                                {/* Total Amount */}
                                                {(log as any).orderDetails && (
                                                    <div className="mt-2 pt-2 border-t border-blue-200 flex justify-between">
                                                        <span className="text-xs text-blue-600 font-medium">Total:</span>
                                                        <span className="text-sm font-bold text-blue-800">
                                                            Rp {(log as any).orderDetails.reduce((sum: number, o: { amount: number }) => sum + o.amount, 0).toLocaleString('id-ID')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                                            <div>
                                                <span className="text-gray-500">Pengirim:</span>
                                                <div className="font-medium">{log.senderName || '-'}</div>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Bank:</span>
                                                <div className="font-medium">{log.bank || '-'}</div>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Customer:</span>
                                                <div className="font-medium">{log.customerName || '-'}</div>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Confidence:</span>
                                                <div className="font-medium">{log.confidence}%</div>
                                            </div>
                                        </div>

                                        {log.matchReason && (
                                            <div className="mt-3">
                                                <span className="text-gray-500 text-sm">Alasan Match:</span>
                                                <div className="text-sm bg-white rounded-lg p-2 mt-1 border">
                                                    {log.matchReason}
                                                </div>
                                            </div>
                                        )}

                                        {log.rawNotification && (
                                            <div className="mt-3">
                                                <span className="text-gray-500 text-sm">Raw Notification:</span>
                                                <pre className="text-xs bg-white rounded-lg p-2 mt-1 border overflow-x-auto whitespace-pre-wrap">
                                                    {log.rawNotification}
                                                </pre>
                                            </div>
                                        )}

                                        {log.errorMessage && (
                                            <div className="mt-3">
                                                <span className="text-red-500 text-sm">Error:</span>
                                                <div className="text-sm bg-red-50 text-red-700 rounded-lg p-2 mt-1 border border-red-200">
                                                    {log.errorMessage}
                                                </div>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="mt-4 pt-4 border-t flex justify-end">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm('Yakin ingin menghapus log ini?')) {
                                                        handleDeleteLog(log.id);
                                                    }
                                                }}
                                                disabled={deletingId === log.id}
                                                className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                                            >
                                                {deletingId === log.id ? (
                                                    <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                                Hapus Log
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </>
                )}

                {/* Delete All Confirmation Modal */}
                {showDeleteAllConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl">
                            <div className="flex items-center gap-3 text-red-600 mb-4">
                                <AlertTriangle className="w-8 h-8" />
                                <h3 className="text-lg font-bold">Hapus Semua Log?</h3>
                            </div>
                            <p className="text-gray-600 mb-6">
                                Tindakan ini akan menghapus <b>{filteredLogs.length} log</b> secara permanen. Tindakan ini tidak dapat dibatalkan.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowDeleteAllConfirm(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleDeleteAllLogs}
                                    disabled={loading}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loading ? 'Menghapus...' : 'Ya, Hapus Semua'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminAutoVerificationLogsPage;
