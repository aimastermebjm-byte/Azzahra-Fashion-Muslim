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
        setSelectedItem(item);
        setModalOpen(true);
    };

    const handleSaveItem = async (actualStock: number, notes?: string) => {
        if (!activeSession || !selectedItem) return;

        try {
            await stockOpnameService.updateItemCount(
                activeSession.id,
                selectedItem.productId,
                selectedItem.size,
                selectedItem.variant,
                actualStock,
                notes
            );

            // Refresh session
            const updated = await stockOpnameService.getSession(activeSession.id);
            setActiveSession(updated);
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

        try {
            await stockOpnameService.approveAndApply(sessionId, user.uid);
            showToast({ message: 'Opname disetujui dan stok diperbarui', type: 'success' });
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

    // Filter items
    const filteredItems = useMemo(() => {
        if (!activeSession) return [];

        let items = activeSession.items;

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
    }, [activeSession, searchQuery, filter]);

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

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="flex items-center p-4">
                    <button onClick={onBack} className="mr-3 p-2 hover:bg-gray-100 rounded-lg">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-semibold flex-1">Stock Opname</h1>
                    {!activeSession && (
                        <button
                            onClick={handleCreateSession}
                            disabled={creating}
                            className="flex items-center space-x-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
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

                {/* Tabs */}
                <div className="flex border-t">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'active'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-500'
                            }`}
                    >
                        Opname Aktif
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-500'
                            }`}
                    >
                        Riwayat
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    </div>
                ) : activeTab === 'active' ? (
                    // Active Opname Tab
                    activeSession ? (
                        <div className="space-y-4">
                            {/* Search & Filter */}
                            <div className="flex space-x-2">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Cari produk..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <select
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value as FilterType)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                >
                                    <option value="all">Semua</option>
                                    <option value="uncounted">Belum Dihitung</option>
                                    <option value="counted">Sudah Dihitung</option>
                                    <option value="difference">Ada Selisih</option>
                                </select>
                            </div>

                            {/* Progress */}
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-gray-600">Progress</span>
                                    <span className="text-sm font-medium">
                                        {activeSession.countedItems} / {activeSession.totalItems}
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-purple-600 transition-all"
                                        style={{ width: `${(activeSession.countedItems / activeSession.totalItems) * 100}%` }}
                                    />
                                </div>
                                {activeSession.itemsWithDifference > 0 && (
                                    <p className="text-xs text-orange-600 mt-2">
                                        ⚠️ {activeSession.itemsWithDifference} item ada selisih
                                    </p>
                                )}
                            </div>

                            {/* Items Table */}
                            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Produk</th>
                                                <th className="px-2 py-2 text-center font-medium text-gray-600">Size</th>
                                                <th className="px-2 py-2 text-center font-medium text-gray-600">Varian</th>
                                                <th className="px-2 py-2 text-center font-medium text-gray-600">Sistem</th>
                                                <th className="px-2 py-2 text-center font-medium text-gray-600">Opname</th>
                                                <th className="px-2 py-2 text-center font-medium text-gray-600">Selisih</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {filteredItems.map((item, idx) => (
                                                <tr
                                                    key={`${item.productId}-${item.size}-${item.variant}`}
                                                    onClick={() => handleItemClick(item)}
                                                    className="hover:bg-purple-50 cursor-pointer transition-colors"
                                                >
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-xs text-gray-400">{idx + 1}</span>
                                                            <span className="font-medium truncate max-w-[150px]">{item.productName}</span>
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
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {filteredItems.length === 0 && (
                                    <div className="py-8 text-center text-gray-500">
                                        Tidak ada item ditemukan
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => handleDeleteDraft(activeSession.id)}
                                    className="px-4 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleSubmitForApproval}
                                    disabled={activeSession.countedItems === 0}
                                    className="flex-1 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 font-medium"
                                >
                                    Submit untuk Approval
                                </button>
                            </div>
                        </div>
                    ) : (
                        // No active session
                        <div className="bg-white rounded-lg p-8 text-center">
                            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600 mb-4">Belum ada opname aktif</p>
                            <button
                                onClick={handleCreateSession}
                                disabled={creating}
                                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                            >
                                {creating ? 'Memuat...' : 'Mulai Opname Baru'}
                            </button>
                        </div>
                    )
                ) : (
                    // History Tab
                    <div className="space-y-3">
                        {sessions.length === 0 ? (
                            <div className="bg-white rounded-lg p-8 text-center">
                                <p className="text-gray-500">Belum ada riwayat opname</p>
                            </div>
                        ) : (
                            sessions.map((session) => (
                                <div key={session.id} className="bg-white rounded-lg p-4 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-medium">
                                                Opname {new Date(session.createdAt).toLocaleDateString('id-ID')}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Oleh: {session.createdByName}
                                            </p>
                                        </div>
                                        {getStatusBadge(session.status)}
                                    </div>

                                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                                        <span>{session.countedItems}/{session.totalItems} item</span>
                                        {session.itemsWithDifference > 0 && (
                                            <span className="text-orange-600">
                                                {session.itemsWithDifference} selisih
                                            </span>
                                        )}
                                    </div>

                                    {/* Actions for pending approval (Owner only) */}
                                    {session.status === 'pending_approval' && user?.role === 'owner' && (
                                        <div className="flex space-x-2 pt-2 border-t">
                                            <button
                                                onClick={() => handleApprove(session.id)}
                                                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                                            >
                                                <CheckCircle className="w-4 h-4 inline mr-1" /> Setujui
                                            </button>
                                            <button
                                                onClick={() => handleReject(session.id)}
                                                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                                            >
                                                <AlertCircle className="w-4 h-4 inline mr-1" /> Tolak
                                            </button>
                                        </div>
                                    )}

                                    {/* Draft actions */}
                                    {session.status === 'draft' && (
                                        <div className="flex space-x-2 pt-2 border-t">
                                            <button
                                                onClick={() => {
                                                    setActiveSession(session);
                                                    setActiveTab('active');
                                                }}
                                                className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm"
                                            >
                                                Lanjutkan
                                            </button>
                                            <button
                                                onClick={() => handleDeleteDraft(session.id)}
                                                className="py-2 px-3 border border-red-300 text-red-600 rounded-lg text-sm"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Rejected reason */}
                                    {session.status === 'rejected' && session.rejectedReason && (
                                        <p className="text-sm text-red-600 mt-2">
                                            Alasan: {session.rejectedReason}
                                        </p>
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
