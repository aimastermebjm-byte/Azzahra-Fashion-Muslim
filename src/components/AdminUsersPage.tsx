
import React, { useEffect, useMemo, useState } from 'react';
import { Users, Search, Filter, Plus, Eye, Edit, Trash2, Shield, Award, AlertCircle, RefreshCcw, X, Check, Save, Settings } from 'lucide-react';
import PageHeader from './PageHeader';
import { usersService, AdminUser } from '../services/usersService';
import { pointService, PointSettings } from '../services/pointService';
import { productCategoryService, ProductCategory } from '../services/productCategoryService';

interface AdminUsersPageProps {
  onBack: () => void;
  user: any;
}

const AdminUsersPage: React.FC<AdminUsersPageProps> = ({ onBack, user }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit State
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    role: 'customer',
    status: 'active',
    gender: 'male' // Added User Gender
  });
  const [isSaving, setIsSaving] = useState(false);

  // Point Settings State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [pointSettings, setPointSettings] = useState<PointSettings | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Initial load: cache first, then subscribe
  useEffect(() => {
    const unsubscribe = usersService.subscribeToUsers((data) => {
      setUsers(data.users);
      setLoading(data.loading);
      if (data.error) setError(data.error.message);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Load settings when modal opens
  useEffect(() => {
    if (showSettingsModal) {
      const loadData = async () => {
        try {
          const [settings, cats] = await Promise.all([
            pointService.getSettings(),
            productCategoryService.listCategories()
          ]);
          setPointSettings(settings);
          setCategories(cats);
        } catch (err) {
          console.error('Failed to load settings:', err);
          alert('Gagal memuat pengaturan point');
        }
      };
      loadData();
    }
  }, [showSettingsModal]);

  const roleConfig = {
    owner: { label: 'Owner', color: 'text-red-600 bg-red-100', icon: Shield },
    admin: { label: 'Administrator', color: 'text-purple-600 bg-purple-100', icon: Shield },
    reseller: { label: 'Reseller', color: 'text-blue-600 bg-blue-100', icon: Award },
    customer: { label: 'Customer', color: 'text-green-600 bg-green-100', icon: Users }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const handleEditClick = (userToEdit: AdminUser) => {
    setEditingUser(userToEdit);
    setEditForm({
      name: userToEdit.name || '',
      phone: userToEdit.phone || '',
      role: userToEdit.role || 'customer',
      status: userToEdit.status || 'active',
      gender: userToEdit.gender || 'male' // Load existing gender
    });
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    try {
      setIsSaving(true);
      await usersService.updateUser(editingUser.id, editForm as any);
      setEditingUser(null);
      // Optional: Show success alert or toast here
    } catch (err) {
      console.error(err);
      alert('Gagal update user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus user "${userName}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      await usersService.deleteUser(userId);
      // Optional: Toast success
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus user');
    }
  };

  const handleSaveSettings = async () => {
    if (!pointSettings) return;
    try {
      setIsSavingSettings(true);
      await pointService.saveSettings(pointSettings);
      setShowSettingsModal(false);
      alert('Pengaturan point berhasil disimpan!');
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan pengaturan');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const toggleCategory = (catName: string) => {
    if (!pointSettings) return;
    const current = pointSettings.eligibleCategories || [];
    const exists = current.includes(catName);

    let newCategories;
    if (exists) {
      newCategories = current.filter(c => c !== catName);
    } else {
      newCategories = [...current, catName];
    }

    setPointSettings({ ...pointSettings, eligibleCategories: newCategories });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader
        title="Kelola Pengguna"
        subtitle="Pantau role, status, dan aktivitas pelanggan/reseller"
        onBack={onBack}
        actions={(
          <div className="flex gap-2">
            {user?.role === 'owner' && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:text-gray-900 transition hover:bg-white/90 shadow-md border border-gray-200"
              >
                <Settings className="w-4 h-4" />
                Pengaturan Point
              </button>
            )}
            <button className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#997B2C] hover:text-[#997B2C]/80 transition hover:bg-white/90 shadow-md">
              <Plus className="w-4 h-4" />
              Tambah User
            </button>
          </div>
        )}
      />

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* User Stats - GOLD THEME */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] shine-effect">
            <h4 className="text-sm font-medium text-[#997B2C] mb-1">Total User</h4>
            <p className="text-2xl font-bold text-[#997B2C]">{users.length}</p>
            <p className="text-xs text-gray-500">Semua role</p>
          </div>
          <div className="bg-white rounded-xl p-4 border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] shine-effect">
            <h4 className="text-sm font-medium text-[#997B2C] mb-1">User Aktif</h4>
            <p className="text-2xl font-bold text-[#997B2C]">{users.filter(u => u.status === 'active').length}</p>
            <p className="text-xs text-gray-500">{users.length ? Math.round((users.filter(u => u.status === 'active').length / users.length) * 100) : 0}% aktivasi</p>
          </div>
          <div className="bg-white rounded-xl p-4 border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] shine-effect">
            <h4 className="text-sm font-medium text-[#997B2C] mb-1">Reseller</h4>
            <p className="text-2xl font-bold text-[#997B2C]">{users.filter(u => u.role === 'reseller').length}</p>
            <p className="text-xs text-gray-500">Partner bisnis</p>
          </div>
          <div className="bg-white rounded-xl p-4 border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] shine-effect">
            <h4 className="text-sm font-medium text-[#997B2C] mb-1">User Baru</h4>
            <p className="text-2xl font-bold text-[#997B2C]">{users.filter(u => u.joinDate)?.length || 0}</p>
            <p className="text-xs text-gray-500">Berdasar data Firestore</p>
          </div>
        </div>

        {/* Search and Filter - GOLD THEME */}
        <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 shine-effect">
          <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Cari user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[#E2DED5] rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#997B2C] text-slate-800 placeholder-gray-400"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-[#E2DED5] rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#997B2C] text-sm text-[#997B2C] font-medium"
            >
              <option value="all">Semua Role</option>
              <option value="customer">Customer</option>
              <option value="reseller">Reseller</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-[#E2DED5] rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#997B2C] text-sm text-[#997B2C] font-medium"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Non-aktif</option>
              <option value="banned">Banned</option>
            </select>
            <button className="p-2 border border-[#E2DED5] rounded-lg hover:bg-[#D4AF37]/10 text-[#997B2C] transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <RefreshCcw className="w-4 h-4 animate-spin" /> Memuat data user...
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {!loading && !error && filteredUsers.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              Tidak ada user yang cocok dengan filter.
            </div>
          )}

          {filteredUsers.map((userItem) => {
            const roleInfo = roleConfig[userItem.role as keyof typeof roleConfig];
            const RoleIcon = roleInfo.icon;

            return (
              <div key={userItem.id} className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] p-4 shine-effect">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#D4AF37]/20 to-[#997B2C]/10 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-[#997B2C]" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{userItem.name}</p>
                      <p className="text-sm text-gray-600">{userItem.email}</p>
                      <p className="text-xs text-gray-500">{userItem.phone} • Bergabung: {userItem.joinDate}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
                      <RoleIcon className="w-3 h-3" />
                      <span>{roleInfo.label}</span>
                    </div>
                    <div className="mt-1">
                      <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${userItem.status === 'active' ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100'
                        }`}>
                        <span className="w-2 h-2 bg-current rounded-full"></span>
                        <span>{userItem.status === 'active' ? 'Aktif' : 'Non-aktif'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600">Total Order</p>
                    <p className="font-semibold">{userItem.totalOrders}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600">Total Belanja</p>
                    <p className="font-semibold">Rp {(userItem.totalSpent || 0).toLocaleString('id-ID')}</p>
                  </div>
                  {userItem.role === 'reseller' && (
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <p className="text-xs text-blue-600">Poin Reseller</p>
                      <p className="font-semibold text-blue-600">{userItem.points || 0} pts</p>
                    </div>
                  )}
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600">User ID</p>
                    <p className="font-semibold text-xs">{userItem.id}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Terakhir login: {userItem.lastLoginAt ? userItem.lastLoginAt : 'N/A'}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-1 text-blue-600 hover:text-blue-700 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEditClick(userItem)}
                      className="p-1 text-green-600 hover:text-green-700 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {user?.role === 'owner' && (
                      <button
                        onClick={() => handleDeleteUser(userItem.id, userItem.name)}
                        className="p-1 text-red-600 hover:text-red-700 transition-colors"
                        title="Hapus User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-slate-800">Edit User</h3>
              <button onClick={() => setEditingUser(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                  placeholder="Nama User"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Telepon</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                  placeholder="08xxxxxxxxxx"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="customer">Customer</option>
                  <option value="reseller">Reseller</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>

              {/* Gender (New) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Kelamin</label>
                <select
                  value={(editForm as any).gender || 'male'}
                  onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="male">Laki-laki (Peci)</option>
                  <option value="female">Perempuan (Hijab)</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Non-aktif</option>
                  <option value="banned">Banned</option>
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-3 bg-gray-50">
              <button
                onClick={() => setEditingUser(null)}
                disabled={isSaving}
                className="flex-1 py-2 px-4 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveUser}
                disabled={isSaving}
                className="flex-1 py-2 px-4 bg-gradient-to-r from-[#D4AF37] to-[#997B2C] text-white font-bold rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SETTINGS POINT */}
      {showSettingsModal && pointSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <div className="flex items-center gap-2">
                <div className="bg-yellow-100 p-2 rounded-full">
                  <Award className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800">Pengaturan Point Reseller</h3>
                  <p className="text-xs text-gray-500">Konfigurasi reward untuk reseller</p>
                </div>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-5 overflow-y-auto">
              {/* Toggle Enable */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <h4 className="font-medium text-gray-800">Aktifkan Sistem Point</h4>
                  <p className="text-xs text-gray-500">Reseller akan mendapatkan poin dari transaksi</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={pointSettings.isEnabled}
                    onChange={(e) => setPointSettings({ ...pointSettings, isEnabled: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Point Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Point per Produk (IDR)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 font-bold">Pts</span>
                  </div>
                  <input
                    type="number"
                    value={pointSettings.pointPerItem}
                    onChange={(e) => setPointSettings({ ...pointSettings, pointPerItem: Number(e.target.value) })}
                    className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg text-blue-600"
                    placeholder="1000"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Nilai point yang didapat untuk setiap 1 item eligible yang terjual.</p>
              </div>

              {/* Min Order for Redeem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min. Belanja untuk Tukar Poin</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 font-bold">Rp</span>
                  </div>
                  <input
                    type="number"
                    value={pointSettings.minOrderForRedeem || 0}
                    onChange={(e) => setPointSettings({ ...pointSettings, minOrderForRedeem: Number(e.target.value) })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg text-slate-800"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum total belanja agar reseller bisa menggunakan poinnya.</p>
              </div>

              {/* Categories */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kategori Eligible</label>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 max-h-48 overflow-y-auto space-y-2">
                  {categories.map(cat => {
                    const isSelected = pointSettings.eligibleCategories.includes(cat.name);
                    return (
                      <label key={cat.id} className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors border ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-100 border-transparent'}`}>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className={`text-sm ${isSelected ? 'font-medium text-blue-700' : 'text-gray-700'}`}>{cat.name}</span>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isSelected}
                          onChange={() => toggleCategory(cat.name)}
                        />
                      </label>
                    );
                  })}

                  {categories.length === 0 && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      Tidak ada kategori ditemukan.
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Pilih kategori produk yang akan memberikan poin.</p>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-3 bg-gray-50 shrink-0">
              <button
                onClick={() => setShowSettingsModal(false)}
                disabled={isSavingSettings}
                className="flex-1 py-2 px-4 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="flex-1 py-2 px-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                {isSavingSettings ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;