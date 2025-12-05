import React, { useState } from 'react';
import { Users, Search, Filter, Plus, Eye, Edit, Trash2, Shield, Award } from 'lucide-react';
import PageHeader from './PageHeader';

interface AdminUsersPageProps {
  onBack: () => void;
  user: any;
}

const AdminUsersPage: React.FC<AdminUsersPageProps> = ({ onBack, user }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Sample users data
  const users = [
    {
      id: 'USR001',
      name: 'Siti Nurhaliza',
      email: 'siti@email.com',
      phone: '08123456789',
      role: 'customer',
      status: 'active',
      joinDate: '2024-01-10',
      totalOrders: 5,
      totalSpent: 1250000
    },
    {
      id: 'USR002',
      name: 'Ahmad Fauzi',
      email: 'ahmad@email.com',
      phone: '08234567890',
      role: 'reseller',
      status: 'active',
      joinDate: '2024-01-05',
      totalOrders: 12,
      totalSpent: 2400000,
      points: 450
    },
    {
      id: 'USR003',
      name: 'Ratna Dewi',
      email: 'ratna@email.com',
      phone: '08345678901',
      role: 'customer',
      status: 'active',
      joinDate: '2024-01-08',
      totalOrders: 3,
      totalSpent: 675000
    },
    {
      id: 'USR004',
      name: 'Budi Santoso',
      email: 'budi@email.com',
      phone: '08456789012',
      role: 'admin',
      status: 'active',
      joinDate: '2024-01-01',
      totalOrders: 0,
      totalSpent: 0
    }
  ];

  const roleConfig = {
    owner: { label: 'Owner', color: 'text-red-600 bg-red-100', icon: Shield },
    admin: { label: 'Administrator', color: 'text-purple-600 bg-purple-100', icon: Shield },
    reseller: { label: 'Reseller', color: 'text-blue-600 bg-blue-100', icon: Award },
    customer: { label: 'Customer', color: 'text-green-600 bg-green-100', icon: Users }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

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
            <p className="text-xs text-green-600">{Math.round((users.filter(u => u.status === 'active').length / users.length) * 100)}% aktivasi</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-purple-800 mb-1">Reseller</h4>
            <p className="text-2xl font-bold text-purple-600">{users.filter(u => u.role === 'reseller').length}</p>
            <p className="text-xs text-purple-600">Partner bisnis</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-orange-800 mb-1">User Baru</h4>
            <p className="text-2xl font-bold text-orange-600">2</p>
            <p className="text-xs text-orange-600">Bulan ini</p>
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
                      <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                        userItem.status === 'active' ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100'
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
                    Terakhir login: 2 hari yang lalu
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-1 text-blue-600 hover:text-blue-700 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-green-600 hover:text-green-700 transition-colors">
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
    </div>
  );
};

export default AdminUsersPage;