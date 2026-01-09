
import React, { useEffect, useMemo, useState } from 'react';
import { Users, Search, Filter, Plus, Eye, Edit, Trash2, Shield, Award, AlertCircle, RefreshCcw, X, Check, Save } from 'lucide-react';
import PageHeader from './PageHeader';
import { usersService, AdminUser } from '../services/usersService';

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
      await usersService.updateUser(editingUser.id, editForm);
      setEditingUser(null);
      // Optional: Show success alert or toast here
    } catch (err) {
      console.error(err);
      alert('Gagal update user');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader
        title="Kelola Pengguna"
        subtitle="Pantau role, status, dan aktivitas pelanggan/reseller"
        onBack={onBack}
        variant="gradient"
        actions={(
          <button className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-white/90">
            <Plus className="w-4 h-4" />
            Tambah User
          </button>
        )}
      />

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* User Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-1">Total User</h4>
            <p className="text-2xl font-bold text-blue-600">{users.length}</p>
            <p className="text-xs text-blue-600">Semua role</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-800 mb-1">User Aktif</h4>
            <p className="text-2xl font-bold text-green-600">{users.filter(u => u.status === 'active').length}</p>
            <p className="text-xs text-green-600">{users.length ? Math.round((users.filter(u => u.status === 'active').length / users.length) * 100) : 0}% aktivasi</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-purple-800 mb-1">Reseller</h4>
            <p className="text-2xl font-bold text-purple-600">{users.filter(u => u.role === 'reseller').length}</p>
            <p className="text-xs text-purple-600">Partner bisnis</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-orange-800 mb-1">User Baru</h4>
            <p className="text-2xl font-bold text-orange-600">{users.filter(u => u.joinDate)?.length || 0}</p>
            <p className="text-xs text-orange-600">Berdasar data Firestore</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Cari user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Non-aktif</option>
              <option value="banned">Banned</option>
            </select>
            <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
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
              <div key={userItem.id} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
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
                    <p className="font-semibold">Rp {userItem.totalSpent.toLocaleString('id-ID')}</p>
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
                      <button className="p-1 text-red-600 hover:text-red-700 transition-colors">
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
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                className="flex-1 py-2 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;