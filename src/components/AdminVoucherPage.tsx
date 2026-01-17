import React, { useState, useEffect } from 'react';
import {
    ArrowLeft, Gift, Plus, Search, Trash2, User, Calendar,
    CheckCircle, XCircle
} from 'lucide-react';
import { Voucher, CreateVoucherInput } from '../types/voucher';
import { voucherService } from '../services/voucherService';
import { collection, getDocs } from 'firebase/firestore';
import { db, storage } from '../utils/firebaseClient';
import { useToast } from './ToastProvider';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface AdminVoucherPageProps {
    onBack: () => void;
    user: any;
}

interface AppUser {
    id: string;
    name: string;
    email: string;
    phone?: string;
}

const AdminVoucherPage: React.FC<AdminVoucherPageProps> = ({ onBack, user }) => {
    const { showToast } = useToast();

    // State
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'used' | 'expired'>('all');

    // Create form state
    const [createForm, setCreateForm] = useState<{
        selectedUsers: { id: string; name: string }[];
        discountAmount: number;
        minPurchase: number;
        validDays: number;
        description: string;
        imageFile: File | null;
    }>({
        selectedUsers: [],
        discountAmount: 25000,
        minPurchase: 100000,
        validDays: 30,
        description: '',
        imageFile: null
    });
    const [creating, setCreating] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');

    // Load vouchers and users
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load vouchers
            const vouchersData = await voucherService.getAllVouchers();
            setVouchers(vouchersData);

            // Load users
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersData = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name || doc.data().displayName || 'Unknown',
                email: doc.data().email || '',
                phone: doc.data().phone || doc.data().phoneNumber || ''
            }));
            setUsers(usersData);
        } catch (error) {
            console.error('Failed to load data:', error);
            showToast({ message: 'Gagal memuat data', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Create voucher for multiple users
    const handleCreateVoucher = async () => {
        if (createForm.selectedUsers.length === 0) {
            showToast({ message: 'Pilih minimal 1 user', type: 'error' });
            return;
        }

        setCreating(true);
        try {
            let imageUrl = '';

            // Upload image if provided (shared across all vouchers)
            if (createForm.imageFile) {
                const imageRef = ref(storage, `vouchers/${Date.now()}_${createForm.imageFile.name}`);
                await uploadBytes(imageRef, createForm.imageFile);
                imageUrl = await getDownloadURL(imageRef);
            }

            // Create voucher for each selected user
            let successCount = 0;
            for (const selectedUser of createForm.selectedUsers) {
                const input: CreateVoucherInput = {
                    assignedTo: selectedUser.id,
                    assignedToName: selectedUser.name,
                    discountAmount: createForm.discountAmount,
                    minPurchase: createForm.minPurchase,
                    validDays: createForm.validDays,
                    description: createForm.description,
                    imageUrl,
                    assignmentReason: 'manual'
                };

                await voucherService.createVoucher(input, user.uid);
                successCount++;
            }

            showToast({ message: `${successCount} voucher berhasil dibuat & notifikasi terkirim!`, type: 'success' });
            setShowCreateModal(false);
            resetCreateForm();
            loadData();
        } catch (error) {
            console.error('Failed to create voucher:', error);
            showToast({ message: 'Gagal membuat voucher', type: 'error' });
        } finally {
            setCreating(false);
        }
    };

    const resetCreateForm = () => {
        setCreateForm({
            selectedUsers: [],
            discountAmount: 25000,
            minPurchase: 100000,
            validDays: 30,
            description: '',
            imageFile: null
        });
        setUserSearchQuery('');
    };

    // Toggle user selection
    const toggleUserSelection = (userId: string, userName: string) => {
        const isSelected = createForm.selectedUsers.some(u => u.id === userId);
        if (isSelected) {
            setCreateForm({
                ...createForm,
                selectedUsers: createForm.selectedUsers.filter(u => u.id !== userId)
            });
        } else {
            setCreateForm({
                ...createForm,
                selectedUsers: [...createForm.selectedUsers, { id: userId, name: userName }]
            });
        }
    };

    // Delete voucher
    const handleDeleteVoucher = async (voucherId: string) => {
        if (!confirm('Hapus voucher ini?')) return;

        try {
            await voucherService.deleteVoucher(voucherId);
            showToast({ message: 'Voucher dihapus', type: 'success' });
            loadData();
        } catch (error) {
            showToast({ message: 'Gagal menghapus voucher', type: 'error' });
        }
    };

    // Filter vouchers
    const filteredVouchers = vouchers.filter(v => {
        const matchesSearch = v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (v.assignedToName || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === 'all' || v.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    // Filter users for selection
    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        (u.phone || '').includes(userSearchQuery)
    );

    // Get status badge
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Aktif</span>;
            case 'used':
                return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Terpakai</span>;
            case 'expired':
                return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs flex items-center gap-1"><XCircle className="w-3 h-3" /> Expired</span>;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header - GOLD THEME */}
            <div className="bg-gradient-to-r from-[#997B2C] via-[#D4AF37] to-[#997B2C] text-white px-4 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-lg">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold">Kelola Voucher</h1>
                        <p className="text-xs text-white/80">{vouchers.length} voucher total</p>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="p-4 space-y-3">
                {/* Create Button */}
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="w-full py-3 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-[0_4px_0_0_#7A6223] hover:shadow-lg active:scale-95 transition-all shine-effect"
                >
                    <Plus className="w-5 h-5" />
                    Buat Voucher Baru
                </button>

                {/* Search & Filter */}
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#997B2C]" />
                        <input
                            type="text"
                            placeholder="Cari kode atau nama user..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37] focus:border-[#d4af37]"
                        />
                    </div>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D4AF37] focus:border-[#d4af37]"
                    >
                        <option value="all">Semua</option>
                        <option value="active">Aktif</option>
                        <option value="used">Terpakai</option>
                        <option value="expired">Expired</option>
                    </select>
                </div>
            </div>

            {/* Voucher List */}
            <div className="px-4 pb-20 space-y-3">
                {loading ? (
                    <div className="text-center py-10 text-gray-500">Memuat...</div>
                ) : filteredVouchers.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        <Gift className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Belum ada voucher</p>
                    </div>
                ) : (
                    filteredVouchers.map(voucher => (
                        <div key={voucher.id} className="bg-white rounded-xl p-4 border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] shine-effect">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono font-bold text-[#997B2C] text-lg">{voucher.code}</span>
                                        {getStatusBadge(voucher.status)}
                                    </div>
                                    <p className="text-sm text-gray-600 flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        {voucher.assignedToName || 'Unknown User'}
                                    </p>
                                </div>
                                {voucher.imageUrl && (
                                    <img src={voucher.imageUrl} alt="Voucher" className="w-16 h-16 rounded-lg object-cover" />
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                <div className="bg-green-50 rounded-lg p-2 text-center">
                                    <p className="text-gray-500 text-xs">Diskon</p>
                                    <p className="font-bold text-green-600">Rp {voucher.discountAmount.toLocaleString('id-ID')}</p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-2 text-center">
                                    <p className="text-gray-500 text-xs">Min Belanja</p>
                                    <p className="font-bold text-blue-600">Rp {voucher.minPurchase.toLocaleString('id-ID')}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Berlaku sampai: {voucher.validUntil.toDate().toLocaleDateString('id-ID')}
                                </span>
                                {voucher.status === 'active' && (
                                    <button
                                        onClick={() => handleDeleteVoucher(voucher.id)}
                                        className="text-red-500 hover:text-red-700 p-1"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {voucher.status === 'used' && voucher.usedInOrderId && (
                                <p className="text-xs text-blue-600 mt-2">
                                    Digunakan di order: {voucher.usedInOrderId}
                                </p>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
                            <h2 className="font-bold text-lg">Buat Voucher Baru</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-500">✕</button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Select Users (Multi-select) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Pilih User <span className="text-red-500">*</span>
                                    {createForm.selectedUsers.length > 0 && (
                                        <span className="ml-2 text-purple-600">({createForm.selectedUsers.length} dipilih)</span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    placeholder="Cari user..."
                                    value={userSearchQuery}
                                    onChange={(e) => setUserSearchQuery(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                                />
                                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                                    {filteredUsers.slice(0, 30).map(u => {
                                        const isSelected = createForm.selectedUsers.some(su => su.id === u.id);
                                        return (
                                            <button
                                                key={u.id}
                                                onClick={() => toggleUserSelection(u.id, u.name)}
                                                className={`w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 flex items-center gap-2 ${isSelected ? 'bg-purple-50' : ''
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    readOnly
                                                    className="w-4 h-4 text-purple-600 rounded"
                                                />
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{u.name}</p>
                                                    <p className="text-xs text-gray-500">{u.email || u.phone}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                {createForm.selectedUsers.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {createForm.selectedUsers.map(u => (
                                            <span key={u.id} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                                                {u.name}
                                                <button
                                                    onClick={() => toggleUserSelection(u.id, u.name)}
                                                    className="text-purple-500 hover:text-purple-700"
                                                >
                                                    ✕
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Discount Amount */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nilai Diskon (Rp)
                                </label>
                                <input
                                    type="number"
                                    value={createForm.discountAmount}
                                    onChange={(e) => setCreateForm({ ...createForm, discountAmount: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>

                            {/* Min Purchase */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Minimum Belanja (Rp)
                                </label>
                                <input
                                    type="number"
                                    value={createForm.minPurchase}
                                    onChange={(e) => setCreateForm({ ...createForm, minPurchase: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>

                            {/* Valid Days */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Berlaku (hari)
                                </label>
                                <input
                                    type="number"
                                    value={createForm.validDays}
                                    onChange={(e) => setCreateForm({ ...createForm, validDays: parseInt(e.target.value) || 1 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Deskripsi (Opsional)
                                </label>
                                <input
                                    type="text"
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                                    placeholder="Voucher spesial untuk pelanggan setia"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>

                            {/* Image Upload */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Gambar Voucher (Opsional)
                                </label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setCreateForm({ ...createForm, imageFile: e.target.files?.[0] || null })}
                                    className="w-full"
                                />
                                {createForm.imageFile && (
                                    <p className="text-xs text-green-600 mt-1">✓ {createForm.imageFile.name}</p>
                                )}
                            </div>

                            <button
                                onClick={handleCreateVoucher}
                                disabled={creating || createForm.selectedUsers.length === 0}
                                className="w-full py-3 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white rounded-xl font-bold dark:shadow-[0_4px_0_0_#7A6223] disabled:opacity-50 hover:shadow-lg transition-all"
                            >
                                {creating ? 'Membuat...' : `Buat & Kirim ${createForm.selectedUsers.length > 0 ? createForm.selectedUsers.length : ''} Voucher`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminVoucherPage;
