
import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, Clock, Check, X } from 'lucide-react';
import { StockAdjustmentRequest, stockAdjustmentService } from '../services/stockAdjustmentService';

interface AdminStockAdjustmentPageProps {
    user: any;
    onBack: () => void;
}

const AdminStockAdjustmentPage: React.FC<AdminStockAdjustmentPageProps> = ({ user, onBack }) => {
    const [requests, setRequests] = useState<StockAdjustmentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const data = await stockAdjustmentService.getPendingRequests();
            setRequests(data);
        } catch (error) {
            console.error('Error loading requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (request: StockAdjustmentRequest) => {
        if (!window.confirm(`Setujui perubahan stok untuk ${request.productName}?`)) return;

        setProcessingId(request.id);
        try {
            await stockAdjustmentService.approveRequest(
                request.id,
                user.uid,
                user.displayName || 'Owner'
            );

            // Remove from list
            setRequests(prev => prev.filter(r => r.id !== request.id));
            alert('✅ Request disetujui, stok telah diperbarui.');
        } catch (error: any) {
            console.error('Approval failed:', error);
            alert('Gagal menyetujui: ' + error.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (requestId: string) => {
        const reason = prompt('Alasan penolakan:');
        if (reason === null) return; // Cancelled

        setProcessingId(requestId);
        try {
            await stockAdjustmentService.rejectRequest(
                requestId,
                user.uid,
                reason || 'Ditolak tanpa alasan spesifik'
            );

            // Remove from list
            setRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (error: any) {
            console.error('Rejection failed:', error);
            alert('Gagal menolak: ' + error.message);
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header - GOLD THEME */}
            <div className="bg-gradient-to-r from-[#997B2C] via-[#D4AF37] to-[#997B2C] shadow-sm sticky top-0 z-10 px-4 py-3 flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div>
                    <h1 className="text-lg font-bold text-white">Persetujuan Stok</h1>
                    <p className="text-xs text-white/80">Menunggu tinjauan Owner</p>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 max-w-3xl mx-auto space-y-4">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">Semua Beres!</h3>
                        <p className="text-gray-500">Tidak ada permintaan adjustment yang tertunda.</p>
                    </div>
                ) : (
                    requests.map((req) => (
                        <div key={req.id} className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] overflow-hidden shine-effect">
                            {/* Request Header */}
                            <div className="p-4 flex justify-between items-start bg-slate-50 border-b border-gray-100">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold uppercase rounded-full tracking-wide">
                                            Request Adjustment
                                        </span>
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {req.createdAt ? new Date(req.createdAt).toLocaleString('id-ID') : '-'}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-gray-800 text-sm">{req.productName}</h3>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        Varian: <span className="font-medium text-gray-700">{req.size} / {req.variant}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-400">Oleh</div>
                                    <div className="font-medium text-sm text-gray-700">{req.requesterName}</div>
                                </div>
                            </div>

                            {/* Comparison */}
                            <div className="p-4 grid grid-cols-3 gap-4 items-center border-b border-gray-100">
                                <div className="text-center p-2 bg-gray-50 rounded-lg">
                                    <div className="text-xs text-gray-500 mb-1">Stok Awal</div>
                                    <div className="font-bold text-gray-600 text-lg">{req.currentStock}</div>
                                </div>
                                <div className="flex justify-center flex-col items-center">
                                    <div className={`text-sm font-bold ${req.proposedStock > req.currentStock ? 'text-green-600' : 'text-red-500'}`}>
                                        {req.proposedStock > req.currentStock ? '+' : ''}{req.proposedStock - req.currentStock}
                                    </div>
                                    <div className="text-[10px] text-gray-400">perubahan</div>
                                </div>
                                <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-100">
                                    <div className="text-xs text-blue-600 mb-1">Stok Baru</div>
                                    <div className="font-bold text-blue-700 text-lg">{req.proposedStock}</div>
                                </div>
                            </div>

                            {/* Reason */}
                            <div className="p-4 bg-white/50">
                                <p className="text-xs text-gray-500 mb-1">Alasan:</p>
                                <p className="text-sm text-gray-700 italic">"{req.reason}"</p>
                            </div>

                            {/* Actions */}
                            <div className="p-3 bg-gray-50 flex gap-3">
                                <button
                                    onClick={() => handleReject(req.id)}
                                    disabled={!!processingId}
                                    className="flex-1 py-2 px-4 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <X className="w-4 h-4" /> Tolak
                                </button>
                                <button
                                    onClick={() => handleApprove(req)}
                                    disabled={!!processingId}
                                    className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {processingId === req.id ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" /> Setujui
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AdminStockAdjustmentPage;
