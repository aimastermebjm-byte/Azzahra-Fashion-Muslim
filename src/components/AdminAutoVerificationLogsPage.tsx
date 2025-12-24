import React, { useState, useEffect } from 'react';
import {
    FileText,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Clock,
    RefreshCw,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import PageHeader from './PageHeader';
import { autoVerificationLogService, AutoVerificationLog } from '../services/autoVerificationLogService';

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

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <PageHeader title="Log Pelunasan Otomatis" onBack={onBack} />

            {/* Stats */}
            <div className="px-4 py-4 bg-white border-b">
                <div className="grid grid-cols-4 gap-2">
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-green-700">{stats.totalSuccess}</div>
                        <div className="text-xs text-green-600">Berhasil</div>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-red-700">{stats.totalFailed}</div>
                        <div className="text-xs text-red-600">Gagal</div>
                    </div>
                    <div className="bg-yellow-50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-yellow-700">{stats.totalDryRun}</div>
                        <div className="text-xs text-yellow-600">Test Mode</div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
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
                                ? 'bg-brand-primary text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {f === 'all' ? 'Semua' : f === 'dry-run' ? 'Test' : f === 'success' ? 'Berhasil' : 'Gagal'}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => { loadLogs(); loadStats(); }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                >
                    <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Logs List */}
            <div className="px-4 py-4 space-y-3">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
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
                    filteredLogs.map((log) => (
                        <div
                            key={log.id}
                            className="bg-white rounded-xl border shadow-sm overflow-hidden"
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
                                                Order: {log.orderId}
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
                                                            <span className="text-sm font-semibold text-blue-800">• {order.id}</span>
                                                            <span className="text-sm font-bold text-green-600">
                                                                Rp {order.amount.toLocaleString('id-ID')}
                                                            </span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    (log as any).orderIds.map((orderId: string, index: number) => (
                                                        <div key={index} className="text-sm font-semibold text-blue-800">
                                                            • {orderId}
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
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AdminAutoVerificationLogsPage;
