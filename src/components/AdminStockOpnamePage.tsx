import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, Search, CheckCircle, AlertCircle, Clock, Loader2, Trash2 } from 'lucide-react';
import { stockOpnameService } from '../services/stockOpnameService';
import { StockOpnameSession, StockOpnameItem } from '../types/stockOpname';
import StockInputModal from './StockInputModal';
import { useToast } from './ToastProvider';

interface AdminStockOpnamePageProps {
    onBack: () => void;
    user: any;
}

type TabType = 'active' | 'history';
type FilterType = 'all' | 'counted' | 'uncounted' | 'difference';

const AdminStockOpnamePage: React.FC<AdminStockOpnamePageProps> = ({ onBack, user }) => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<TabType>('active');
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    // Active session state
    const [activeSession, setActiveSession] = useState<StockOpnameSession | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<FilterType>('all');

    // History state
    const [sessions, setSessions] = useState<StockOpnameSession[]>([]);

    // Modal state
    const [selectedItem, setSelectedItem] = useState<StockOpnameItem | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    // Detail view state
    const [viewSession, setViewSession] = useState<StockOpnameSession | null>(null);

    // Load sessions on mount
    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        setLoading(true);
        try {
            const history = await stockOpnameService.getSessionHistory();
            setSessions(history);

            // Check for active draft session
            const draftSession = history.find(s => s.status === 'draft');
            if (draftSession) {
                setActiveSession(draftSession);
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
            showToast({ message: 'Gagal memuat data', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSession = async () => {
        if (!user?.uid) {
            showToast({ message: 'Anda harus login', type: 'error' });
            return;
        }

        setCreating(true);
        try {
            const sessionId = await stockOpnameService.createSession(
                user.uid,
                user.displayName || user.name || 'Unknown'
            );
            const session = await stockOpnameService.getSession(sessionId);
            setActiveSession(session);
            setActiveTab('active');
            showToast({ message: `Opname dimulai dengan ${session?.totalItems || 0} item`, type: 'success' });
            loadSessions();
        } catch (error) {
            console.error('Error creating session:', error);
            showToast({ message: 'Gagal membuat sesi opname', type: 'error' });
        } finally {
            setCreating(false);
        }
    };

    const handleItemClick = (item: StockOpnameItem) => {
        // Determine the session we are working with (active or viewed)
        const session = viewSession || activeSession;
        if (!session) return;

        // Allow edit if status is 'draft' OR 'pending_approval'
        const isEditable = session.status === 'draft' || session.status === 'pending_approval';

        if (isEditable) {
            setSelectedItem(item);
            setModalOpen(true);
        }
    };

    const handleSaveItem = async (actualStock: number, notes?: string) => {
        // Determine target session
        const session = viewSession || activeSession;
        if (!session || !selectedItem) return;

        try {
            await stockOpnameService.updateItemCount(
                session.id,
                selectedItem.productId,
                selectedItem.size,
                selectedItem.variant,
                actualStock,
                notes
            );

            // Refresh session
            const updated = await stockOpnameService.getSession(session.id);

            // Update state based on which view is active
            if (activeSession?.id === session.id) {
                setActiveSession(updated);
            }
            if (viewSession?.id === session.id) {
                setViewSession(updated);
            }

            showToast({ message: 'Stok tersimpan', type: 'success' });
        } catch (error) {
            console.error('Error saving item:', error);
            showToast({ message: 'Gagal menyimpan', type: 'error' });
        }
    };

    const handleSubmitForApproval = async () => {
        if (!activeSession) return;

        if (activeSession.countedItems === 0) {
            showToast({ message: 'Belum ada item yang dihitung', type: 'error' });
            return;
        }

        try {
            await stockOpnameService.submitForApproval(activeSession.id);
            showToast({ message: 'Opname diajukan untuk approval', type: 'success' });
            setActiveSession(null);
            loadSessions();
        } catch (error) {
            console.error('Error submitting:', error);
            showToast({ message: 'Gagal mengajukan approval', type: 'error' });
        }
    };

    const handleApprove = async (sessionId: string) => {
        if (!user?.uid) return;

        if (!confirm('Apakah Anda yakin ingin menyetujui hasil opname ini? Stok sistem akan diperbarui.')) return;

        try {
            await stockOpnameService.approveAndApply(
                sessionId,
                user.uid,
                user.displayName || user.name || 'Owner'
            );
            showToast({ message: 'Opname disetujui dan stok diperbarui', type: 'success' });
            setViewSession(null); // Close detail view
            loadSessions();
        } catch (error) {
            console.error('Error approving:', error);
            showToast({ message: 'Gagal menyetujui opname', type: 'error' });
        }
    };

    const handleReject = async (sessionId: string) => {
        const reason = prompt('Alasan penolakan:');
        if (!reason) return;

        try {
            await stockOpnameService.rejectOpname(sessionId, reason);
            showToast({ message: 'Opname ditolak', type: 'success' });
            setViewSession(null); // Close detail view
            loadSessions();
        } catch (error) {
            console.error('Error rejecting:', error);
            showToast({ message: 'Gagal menolak opname', type: 'error' });
        }
    };

    const handleDeleteDraft = async (sessionId: string) => {
        if (!confirm('Hapus draft opname ini?')) return;

        try {
            await stockOpnameService.deleteSession(sessionId);
            if (activeSession?.id === sessionId) {
                setActiveSession(null);
            }
            showToast({ message: 'Draft dihapus', type: 'success' });
            loadSessions();
        } catch (error) {
            console.error('Error deleting:', error);
            showToast({ message: 'Gagal menghapus', type: 'error' });
        }
    };

    // Filter items logic shared for both active and view session
    const getFilteredItems = (session: StockOpnameSession | null) => {
        if (!session) return [];

        let items = session.items;

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            items = items.filter(item =>
                item.productName.toLowerCase().includes(query) ||
                item.size.toLowerCase().includes(query) ||
                item.variant.toLowerCase().includes(query)
            );
        }

        // Status filter
        switch (filter) {
            case 'counted':
                items = items.filter(i => i.actualStock !== null);
                break;
            case 'uncounted':
                items = items.filter(i => i.actualStock === null);
                break;
            case 'difference':
                items = items.filter(i => i.difference !== null && i.difference !== 0);
                break;
        }

        return items;
    };

    const filteredItems = useMemo(() => {
        // If viewing details, use that session, otherwise use active session
        return getFilteredItems(viewSession || activeSession);
    }, [activeSession, viewSession, searchQuery, filter]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft':
                return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Draft</span>;
            case 'pending_approval':
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">Menunggu Approval</span>;
            case 'approved':
                return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Disetujui</span>;
            case 'rejected':
                return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Ditolak</span>;
            default:
                return null;
        }
    };

    const getDifferenceDisplay = (item: StockOpnameItem) => {
        if (item.actualStock === null) return <span className="text-gray-400">-</span>;

        const diff = item.difference || 0;
        if (diff === 0) {
            return <span className="text-green-600 font-medium">0 ✓</span>;
        } else if (diff > 0) {
            return <span className="text-yellow-600 font-medium">+{diff}</span>;
        } else {
            return <span className="text-red-600 font-medium">{diff}</span>;
        }
    };

    // Render detailed session view (Active or View Mode)
    const renderSessionItems = (session: StockOpnameSession, isReadOnly: boolean = false) => (
        <div className="space-y-4">
            {/* Session Info Header (Only in View Mode) */}
            {isReadOnly && (
                <div className="bg-white p-4 rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] shine-effect">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Detail Opname</h2>
                            <p className="text-sm text-gray-600">
                                Dibuat oleh: <span className="font-medium">{session.createdByName}</span> pada {new Date(session.createdAt).toLocaleString('id-ID')}
                            </p>
                            {session.rejectedReason && (
                                <p className="text-sm text-red-600 mt-1 font-medium bg-red-50 p-2 rounded">
                                    Alasan Penolakan: {session.rejectedReason}
                                </p>
                            )}
                        </div>
                        {getStatusBadge(session.status)}
                    </div>
                </div>
            )}

            {/* Search & Filter */}
            <div className="flex space-x-2">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Cari produk..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37]"
                    />
                </div>
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as FilterType)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37]"
                >
                    <option value="all">Semua</option>
                    <option value="uncounted">Belum Dihitung</option>
                    <option value="counted">Sudah Dihitung</option>
                    <option value="difference">Ada Selisih</option>
                </select>
            </div>

            {/* Progress */}
            <div className="bg-white p-4 rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] shine-effect">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Progress</span>
                    <span className="text-sm font-medium">
                        {session.countedItems} / {session.totalItems}
                    </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] transition-all"
                        style={{ width: `${(session.countedItems / session.totalItems) * 100}%` }}
                    />
                </div>
                {session.itemsWithDifference > 0 && (
                    <p className="text-xs text-orange-600 mt-2 font-medium flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {session.itemsWithDifference} item memiliki selisih stok
                    </p>
                )}
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] overflow-hidden shine-effect">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-[#D4AF37]/10 border-b border-[#D4AF37]/20">
                            <tr>
                                <th className="px-3 py-3 text-left font-bold text-[#997B2C]">Produk</th>
                                <th className="px-2 py-3 text-center font-bold text-[#997B2C]">Size</th>
                                <th className="px-2 py-3 text-center font-bold text-[#997B2C]">Varian</th>
                                <th className="px-2 py-3 text-center font-bold text-[#997B2C]">Sistem</th>
                                <th className="px-2 py-3 text-center font-bold text-[#997B2C]">Fisik</th>
                                <th className="px-2 py-3 text-center font-bold text-[#997B2C]">Selisih</th>
                                {isReadOnly && <th className="px-3 py-3 text-left font-bold text-[#997B2C]">Catatan</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredItems.map((item, idx) => {
                                const isItemEditable = session.status === 'draft' || session.status === 'pending_approval';
                                return (
                                    <tr
                                        key={`${item.productId}-${item.size}-${item.variant}`}
                                        onClick={() => handleItemClick(item)}
                                        className={`transition-colors ${isItemEditable ? 'hover:bg-[#D4AF37]/10 cursor-pointer' : ''} ${item.difference !== null && item.difference !== 0 ? 'bg-orange-50' : ''}`}
                                    >
                                        <td className="px-3 py-3">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-xs text-gray-400">{idx + 1}</span>
                                                <div>
                                                    <div className="font-medium truncate max-w-[150px]">{item.productName}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-3 text-center">{item.size}</td>
                                        <td className="px-2 py-3 text-center">{item.variant}</td>
                                        <td className="px-2 py-3 text-center text-blue-600 font-medium">{item.systemStock}</td>
                                        <td className="px-2 py-3 text-center">
                                            {item.actualStock !== null ? (
                                                <span className="font-medium">{item.actualStock}</span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-2 py-3 text-center">{getDifferenceDisplay(item)}</td>
                                        {isReadOnly && (
                                            <td className="px-3 py-3 text-gray-500 italic truncate max-w-[150px]">
                                                {item.notes || '-'}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredItems.length === 0 && (
                    <div className="py-8 text-center text-gray-500">
                        Tidak ada item ditemukan dengan filter ini
                    </div>
                )}
            </div>

            {/* Actions for Active Session */}
            {!isReadOnly && (
                <div className="flex space-x-3">
                    <button
                        onClick={() => handleDeleteDraft(session.id)}
                        className="px-4 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleSubmitForApproval}
                        disabled={session.countedItems === 0}
                        className="flex-1 py-3 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white rounded-lg hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:shadow-none font-bold"
                    >
                        Submit untuk Approval
                    </button>
                </div>
            )}

            {/* Actions for Approval (Owner only in View Mode) */}
            {isReadOnly && session.status === 'pending_approval' && user?.role === 'owner' && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex space-x-3 z-20">
                    <button
                        onClick={() => handleReject(session.id)}
                        className="flex-1 py-3 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 border border-red-200"
                    >
                        Tolak Hasil
                    </button>
                    <button
                        onClick={() => handleApprove(session.id)}
                        className="flex-[2] py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md"
                    >
                        Setujui & Perbarui Stok
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="flex items-center p-4">
                    <button
                        onClick={() => {
                            if (viewSession) {
                                setViewSession(null);
                            } else {
                                onBack();
                            }
                        }}
                        className="mr-3 p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-semibold flex-1">
                        {viewSession ? 'Detail Hasil Opname' : 'Stock Opname'}
                    </h1>
                    {!activeSession && !viewSession && activeTab === 'active' && (
                        <button
                            onClick={handleCreateSession}
                            disabled={creating}
                            className="flex items-center space-x-1 px-3 py-2 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-70 shadow-[0_2px_0_0_#7a6223]"
                        >
                            {creating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4" />
                            )}
                            <span className="text-sm">Mulai Opname</span>
                        </button>
                    )}
                </div>

                {/* Tabs - hide when viewing details */}
                {!viewSession && (
                    <div className="flex border-t">
                        <button
                            onClick={() => setActiveTab('active')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'active'
                                ? 'border-[#D4AF37] text-[#997B2C] font-bold'
                                : 'border-transparent text-gray-500 hover:text-[#997B2C]'
                                }`}
                        >
                            Opname Aktif
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history'
                                ? 'border-[#D4AF37] text-[#997B2C] font-bold'
                                : 'border-transparent text-gray-500 hover:text-[#997B2C]'
                                }`}
                        >
                            Riwayat
                        </button>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
                    </div>
                ) : viewSession ? (
                    // VIEW SESSION DETAILS
                    renderSessionItems(viewSession, true)
                ) : activeTab === 'active' ? (
                    // ACTIVE TAB
                    activeSession ? (
                        renderSessionItems(activeSession, false)
                    ) : (
                        <div className="bg-white rounded-xl p-8 text-center mt-8 border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] shine-effect">
                            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600 mb-4">Belum ada opname aktif</p>
                            <button
                                onClick={handleCreateSession}
                                disabled={creating}
                                className="px-6 py-3 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white rounded-lg hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70 font-bold"
                            >
                                {creating ? 'Memuat...' : 'Mulai Opname Baru'}
                            </button>
                        </div>
                    )
                ) : (
                    // HISTORY TAB
                    <div className="space-y-3">
                        {sessions.length === 0 ? (
                            <div className="bg-white rounded-lg p-8 text-center">
                                <p className="text-gray-500">Belum ada riwayat opname</p>
                            </div>
                        ) : (
                            sessions.map((session) => (
                                <div
                                    key={session.id}
                                    onClick={() => {
                                        setFilter('all'); // Reset filter
                                        setSearchQuery('');
                                        setViewSession(session);
                                    }}
                                    className="bg-white rounded-xl p-4 border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] hover:shadow-md transition-shadow cursor-pointer shine-effect"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                Opname {new Date(session.createdAt).toLocaleDateString('id-ID')}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Oleh: {session.createdByName}
                                            </p>
                                        </div>
                                        {getStatusBadge(session.status)}
                                    </div>

                                    <div className="flex items-center justify-between mt-3">
                                        <div className="text-sm text-gray-600">
                                            <span>{session.countedItems}/{session.totalItems} item</span>
                                        </div>

                                        {session.itemsWithDifference > 0 ? (
                                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-md font-medium">
                                                {session.itemsWithDifference} selisih
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md font-medium">
                                                Aman
                                            </span>
                                        )}
                                    </div>

                                    {session.status === 'pending_approval' && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-center text-[#997B2C] text-sm font-bold">
                                            Lihat Detail untuk Approval →
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Stock Input Modal */}
            <StockInputModal
                isOpen={modalOpen}
                item={selectedItem}
                onClose={() => {
                    setModalOpen(false);
                    setSelectedItem(null);
                }}
                onSave={handleSaveItem}
            />
        </div>
    );
};

export default AdminStockOpnamePage;
