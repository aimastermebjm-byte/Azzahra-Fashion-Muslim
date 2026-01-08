import React, { useState } from 'react';
import { User, Package, Heart, MapPin, LogOut, Crown, Star, User as UserIcon, Shield, Eye, EyeOff, RefreshCw, Award, BarChart3, Users, TrendingUp, Package as PackageIcon, Mail, Phone, Key, Layers, CreditCard, Edit2, Check, X, ClipboardCheck, Gift } from 'lucide-react';
import { usersService } from '../services/usersService';
import { auth, updateProfile } from '../utils/firebaseClient';
import { useToast } from './ToastProvider';

interface AccountPageProps {
  user: any;
  onLogout: () => void;
  onNavigateToAdminProducts?: () => void;
  onNavigateToAdminOrders?: () => void;
  onNavigateToAdminReports?: () => void;
  onNavigateToAdminUsers?: () => void;
  onNavigateToAdminCache?: () => void;
  onNavigateToAdminFinancials?: () => void;
  onNavigateToAdminMaster?: () => void;
  onNavigateToAdminPaymentVerification?: () => void;
  onNavigateToAdminStockOpname?: () => void;
  onNavigateToAdminVoucher?: () => void;
  onNavigateToAddressManagement?: () => void;
}

const AccountPage: React.FC<AccountPageProps> = ({
  user: propUser,
  onLogout,
  onNavigateToAdminProducts,
  onNavigateToAdminOrders,
  onNavigateToAdminReports,
  onNavigateToAdminUsers,
  onNavigateToAdminCache,
  onNavigateToAdminFinancials,
  onNavigateToAdminMaster,
  onNavigateToAdminPaymentVerification,
  onNavigateToAdminStockOpname,
  onNavigateToAdminVoucher,
  onNavigateToAddressManagement
}) => {
  const { showToast } = useToast();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Username edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [loadingName, setLoadingName] = useState(false);

  // Use prop user if available
  const user = propUser;

  const handleLogout = () => {
    onLogout();
  };

  const startEditingName = () => {
    setNewName(user?.name || user?.displayName || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      showToast('Nama tidak boleh kosong', 'error');
      return;
    }

    try {
      setLoadingName(true);

      // 1. Update Firestore
      await usersService.updateUser(user.uid, { name: newName });

      // 2. Update Firebase Auth Profile (for immediate consistency)
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: newName });
      }

      showToast('✅ Username berhasil diperbarui!', 'success');
      setIsEditingName(false);

      // Reload page to reflect changes across app (simple way)
      // Or we can assume parent hook updates automatically via auth listener
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      console.error('Error updating name:', error);
      showToast('Gagal mengubah nama: ' + error.message, 'error');
    } finally {
      setLoadingName(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('Password baru tidak cocok!');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      alert('Password minimal 6 karakter!');
      return;
    }

    // TODO: Implement password change with Supabase/Firebase
    try {
      alert('⚠️ Fitur ubah password belum terhubung ke backend dalam demo ini.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    } catch (error: any) {
      alert('❌ Gagal mengubah password: ' + error.message);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Silakan login terlebih dahulu</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Muat Ulang Halaman
          </button>
        </div>
      </div>
    );
  }

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'owner':
        return { text: 'Owner', icon: Crown, color: 'text-red-600 bg-red-100' };
      case 'admin':
        return { text: 'Administrator', icon: Star, color: 'text-purple-600 bg-purple-100' };
      case 'reseller':
        return { text: 'Reseller', icon: UserIcon, color: 'text-blue-600 bg-blue-100' };
      default:
        return { text: 'Customer', icon: UserIcon, color: 'text-green-600 bg-green-100' };
    }
  };

  const roleInfo = getRoleDisplay(user.role);
  const RoleIcon = roleInfo.icon;

  // Reusable User Info Card - Matches Mockup
  const renderUserInfo = () => (
    <div className="space-y-3">
      {/* Info Card with Gold Left Border */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <div className="flex">
          {/* Gold Left Accent */}
          <div className="w-1.5 bg-gradient-to-b from-[#997B2C] via-[#EDD686] to-[#997B2C]"></div>
          <div className="flex-1 p-4">
            {/* Username Row */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-500">Username</p>
                {isEditingName ? (
                  <div className="flex items-center space-x-2 mt-1">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="flex-1 p-1.5 border border-[#D4AF37] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                      autoFocus
                    />
                    <button onClick={handleSaveName} disabled={loadingName} className="p-1.5 bg-gradient-to-br from-[#997B2C] to-[#D4AF37] text-white rounded-lg">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsEditingName(false)} disabled={loadingName} className="p-1.5 bg-gray-100 text-gray-600 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="font-semibold text-slate-900">{user.name || user.displayName}</p>
                )}
              </div>
              {!isEditingName && (
                <button onClick={startEditingName} className="p-2 text-[#997B2C] hover:bg-amber-50 rounded-lg transition-colors">
                  <Edit2 className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Email Row */}
            <div className="mb-3">
              <p className="text-xs text-slate-500">Email</p>
              <p className="font-semibold text-slate-900">{user.email}</p>
            </div>

            {/* Phone Row */}
            <div className="mb-3">
              <p className="text-xs text-slate-500">Phone</p>
              <p className="font-semibold text-slate-900">{user.phone || 'Belum diisi'}</p>
            </div>

            {/* Password Row */}
            <div>
              <p className="text-xs text-slate-500">Password</p>
              <button
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="font-semibold text-slate-900 hover:text-[#997B2C] transition-colors"
              >
                Ubah Password →
              </button>
            </div>

            {/* Password Form (expandable) */}
            {showPasswordForm && (
              <form onSubmit={handlePasswordChange} className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    placeholder="Password Saat Ini"
                    className="w-full p-2 text-sm border border-gray-300 rounded-lg pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Password Baru"
                    className="w-full p-2 text-sm border border-gray-300 rounded-lg pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Konfirmasi Password"
                  className="w-full p-2 text-sm border border-gray-300 rounded-lg"
                  required
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowPasswordForm(false)} className="flex-1 p-2 text-sm border border-gray-300 rounded-lg text-gray-600">Batal</button>
                  <button type="submit" className="flex-1 p-2 text-sm bg-gradient-to-r from-[#997B2C] to-[#D4AF37] text-white rounded-lg font-medium">Simpan</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Address Management Button - Centered */}
      <button
        onClick={onNavigateToAddressManagement}
        className="w-full py-3 px-4 bg-white border-2 border-[#D4AF37] rounded-xl text-center hover:bg-amber-50 transition-all"
      >
        <span className="font-semibold text-[#997B2C]">Address Management</span>
      </button>
    </div>
  );

  // Role-based settings content
  const renderSettingsContent = () => {
    switch (user.role) {
      case 'customer':
        return (
          <div className="space-y-4">
            {/* Basic Info */}
            {renderUserInfo()}

            {/* Password Management */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Keamanan</h3>
              <button
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="w-full p-3 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Key className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="font-medium">Ubah Password</p>
                    <p className="text-sm text-gray-500">Keamanan akun Anda</p>
                  </div>
                </div>
              </button>

              {showPasswordForm && (
                <form onSubmit={handlePasswordChange} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password Saat Ini</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      >
                        {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm(false)}
                      className="flex-1 p-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex-1 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Simpan
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Preferences */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Preferensi</h3>
              <div className="space-y-3">
                <button className="w-full p-3 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Heart className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium">Wishlist</p>
                      <p className="text-sm text-gray-500">Produk favorit Anda</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        );

      case 'reseller':
        return (
          <div className="space-y-4">
            {/* Basic Info */}
            {renderUserInfo()}

            {/* Reseller Points */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Point Reseller</h3>
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm opacity-90">Total Poin</span>
                  <Award className="w-6 h-6" />
                </div>
                <div className="text-3xl font-bold">{user.points || 0} pts</div>
                <div className="mt-2 text-sm opacity-90">
                  Tukar dengan diskon khusus!
                </div>
              </div>
            </div>

            {/* Password Management */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Keamanan</h3>
              <button
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="w-full p-3 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Key className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="font-medium">Ubah Password</p>
                    <p className="text-sm text-gray-500">Keamanan akun Anda</p>
                  </div>
                </div>
              </button>

              {showPasswordForm && (
                <form onSubmit={handlePasswordChange} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password Saat Ini</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      >
                        {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm(false)}
                      className="flex-1 p-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex-1 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Simpan
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Reseller Preferences */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Preferensi Reseller</h3>
              <div className="space-y-3">
                <button className="w-full p-3 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Heart className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium">Wishlist</p>
                      <p className="text-sm text-gray-500">Produk favorit Anda</p>
                    </div>
                  </div>
                </button>
                <button className="w-full p-3 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Award className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium">Riwayat Poin</p>
                      <p className="text-sm text-gray-500">Lihat transaksi poin</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        );

      case 'admin':
        return (
          <div className="space-y-4">
            {/* Basic Info */}
            {renderUserInfo()}

            {/* Admin Features */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Fitur Admin</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onNavigateToAdminProducts}
                  className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <PackageIcon className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Kelola Produk</p>
                </button>
                <button
                  onClick={onNavigateToAdminOrders}
                  className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Package className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Kelola Pesanan</p>
                </button>
                {user?.role === 'owner' && (
                  <button
                    onClick={onNavigateToAdminPaymentVerification}
                    className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <CreditCard className="w-6 h-6 mx-auto mb-2" />
                    <p className="text-sm">Verifikasi Pembayaran</p>
                  </button>
                )}
                <button
                  onClick={onNavigateToAdminReports}
                  className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <BarChart3 className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Laporan</p>
                </button>
                <button
                  onClick={onNavigateToAdminUsers}
                  className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Users className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Pelanggan</p>
                </button>
              </div>
            </div>

            {/* Admin Stats */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Statistik Admin</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Penjualan</p>
                  <p className="text-xl font-bold text-blue-600">Rp 0</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <PackageIcon className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Pesanan</p>
                  <p className="text-xl font-bold text-green-600">0</p>
                </div>
              </div>
            </div>

            {/* Password Management */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Keamanan Admin</h3>
              <button
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="w-full p-3 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Key className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="font-medium">Ubah Password</p>
                    <p className="text-sm text-gray-500">Keamanan akun admin</p>
                  </div>
                </div>
              </button>

              {showPasswordForm && (
                <form onSubmit={handlePasswordChange} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password Saat Ini</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      >
                        {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm(false)}
                      className="flex-1 p-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex-1 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Simpan
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Admin Preferences */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Preferensi Admin</h3>
              <div className="space-y-3">
                <button className="w-full p-3 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium">Keamanan</p>
                      <p className="text-sm text-gray-500">Pengaturan keamanan</p>
                    </div>
                  </div>
                </button>
                <button className="w-full p-3 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium">Pengaturan Sistem</p>
                      <p className="text-sm text-gray-500">Konfigurasi aplikasi</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        );

      case 'owner':
        return (
          <div className="space-y-4">
            {/* Owner Info */}
            {renderUserInfo()}

            {/* Owner Controls - Premium Gold Theme */}
            <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100">
              <h3 className="font-bold text-slate-900 mb-3">Kontrol Owner</h3>
              {/* 2-Row Scrollable Menu Grid */}
              <div className="overflow-x-auto pb-2 scrollbar-hide">
                <div className="grid grid-rows-2 grid-flow-col gap-2" style={{ width: 'max-content' }}>
                  {/* Kelola Produk */}
                  <button
                    onClick={onNavigateToAdminProducts}
                    className="w-16 p-2 bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-[0_6px_0_0_#d1d5db,0_8px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_0_0_#d4af37,0_6px_25px_rgba(212,175,55,0.35)] hover:-translate-y-0.5 active:shadow-[0_2px_0_0_#997b2c,0_3px_10px_rgba(0,0,0,0.1)] active:translate-y-0.5 transition-all duration-150 group"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:bg-[radial-gradient(ellipse_at_top_left,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] transition-all relative overflow-hidden">
                      <PackageIcon className="w-6 h-6 text-slate-800" />
                    </div>
                    <p className="text-[10px] font-medium text-slate-700 text-center">Produk</p>
                  </button>

                  {/* Kelola Pesanan */}
                  <button
                    onClick={onNavigateToAdminOrders}
                    className="w-16 p-2 bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-[0_6px_0_0_#d1d5db,0_8px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_0_0_#d4af37,0_6px_25px_rgba(212,175,55,0.35)] hover:-translate-y-0.5 active:shadow-[0_2px_0_0_#997b2c,0_3px_10px_rgba(0,0,0,0.1)] active:translate-y-0.5 transition-all duration-150 group"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:bg-[radial-gradient(ellipse_at_top_left,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] transition-all">
                      <Package className="w-6 h-6 text-slate-800" />
                    </div>
                    <p className="text-[10px] font-medium text-slate-700 text-center">Pesanan</p>
                  </button>

                  {/* Verifikasi Pembayaran */}
                  <button
                    onClick={onNavigateToAdminPaymentVerification}
                    className="w-16 p-2 bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-[0_6px_0_0_#d1d5db,0_8px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_0_0_#d4af37,0_6px_25px_rgba(212,175,55,0.35)] hover:-translate-y-0.5 active:shadow-[0_2px_0_0_#997b2c,0_3px_10px_rgba(0,0,0,0.1)] active:translate-y-0.5 transition-all duration-150 group"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:bg-[radial-gradient(ellipse_at_top_left,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] transition-all">
                      <CreditCard className="w-6 h-6 text-slate-800" />
                    </div>
                    <p className="text-[10px] font-medium text-slate-700 text-center">Payment</p>
                  </button>

                  {/* Laporan */}
                  <button
                    onClick={onNavigateToAdminReports}
                    className="w-16 p-2 bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-[0_6px_0_0_#d1d5db,0_8px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_0_0_#d4af37,0_6px_25px_rgba(212,175,55,0.35)] hover:-translate-y-0.5 active:shadow-[0_2px_0_0_#997b2c,0_3px_10px_rgba(0,0,0,0.1)] active:translate-y-0.5 transition-all duration-150 group"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:bg-[radial-gradient(ellipse_at_top_left,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] transition-all">
                      <BarChart3 className="w-6 h-6 text-slate-800" />
                    </div>
                    <p className="text-[10px] font-medium text-slate-700 text-center">Laporan</p>
                  </button>

                  {/* Kelola User */}
                  <button
                    onClick={onNavigateToAdminUsers}
                    className="w-16 p-2 bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-[0_6px_0_0_#d1d5db,0_8px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_0_0_#d4af37,0_6px_25px_rgba(212,175,55,0.35)] hover:-translate-y-0.5 active:shadow-[0_2px_0_0_#997b2c,0_3px_10px_rgba(0,0,0,0.1)] active:translate-y-0.5 transition-all duration-150 group"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:bg-[radial-gradient(ellipse_at_top_left,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] transition-all">
                      <Users className="w-6 h-6 text-slate-800" />
                    </div>
                    <p className="text-[10px] font-medium text-slate-700 text-center">Users</p>
                  </button>

                  {/* Biaya & Pendapatan */}
                  <button
                    onClick={onNavigateToAdminFinancials}
                    className="w-16 p-2 bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-[0_6px_0_0_#d1d5db,0_8px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_0_0_#d4af37,0_6px_25px_rgba(212,175,55,0.35)] hover:-translate-y-0.5 active:shadow-[0_2px_0_0_#997b2c,0_3px_10px_rgba(0,0,0,0.1)] active:translate-y-0.5 transition-all duration-150 group"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:bg-[radial-gradient(ellipse_at_top_left,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] transition-all">
                      <TrendingUp className="w-6 h-6 text-slate-800" />
                    </div>
                    <p className="text-[10px] font-medium text-slate-700 text-center">Finance</p>
                  </button>

                  {/* Data Master */}
                  <button
                    onClick={onNavigateToAdminMaster}
                    className="w-16 p-2 bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-[0_6px_0_0_#d1d5db,0_8px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_0_0_#d4af37,0_6px_25px_rgba(212,175,55,0.35)] hover:-translate-y-0.5 active:shadow-[0_2px_0_0_#997b2c,0_3px_10px_rgba(0,0,0,0.1)] active:translate-y-0.5 transition-all duration-150 group"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:bg-[radial-gradient(ellipse_at_top_left,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] transition-all">
                      <Layers className="w-6 h-6 text-slate-800" />
                    </div>
                    <p className="text-[10px] font-medium text-slate-700 text-center">Master</p>
                  </button>

                  {/* Stock Opname */}
                  <button
                    onClick={onNavigateToAdminStockOpname}
                    className="w-16 p-2 bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-[0_6px_0_0_#d1d5db,0_8px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_0_0_#d4af37,0_6px_25px_rgba(212,175,55,0.35)] hover:-translate-y-0.5 active:shadow-[0_2px_0_0_#997b2c,0_3px_10px_rgba(0,0,0,0.1)] active:translate-y-0.5 transition-all duration-150 group"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:bg-[radial-gradient(ellipse_at_top_left,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] transition-all">
                      <ClipboardCheck className="w-6 h-6 text-slate-800" />
                    </div>
                    <p className="text-[10px] font-medium text-slate-700 text-center">Stock</p>
                  </button>

                  {/* Kelola Voucher */}
                  <button
                    onClick={onNavigateToAdminVoucher}
                    className="w-16 p-2 bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-[0_6px_0_0_#d1d5db,0_8px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_0_0_#d4af37,0_6px_25px_rgba(212,175,55,0.35)] hover:-translate-y-0.5 active:shadow-[0_2px_0_0_#997b2c,0_3px_10px_rgba(0,0,0,0.1)] active:translate-y-0.5 transition-all duration-150 group"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:bg-[radial-gradient(ellipse_at_top_left,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] transition-all">
                      <Gift className="w-6 h-6 text-slate-800" />
                    </div>
                    <p className="text-[10px] font-medium text-slate-700 text-center">Voucher</p>
                  </button>

                  {/* Atur Banner - NEW */}
                  <button
                    onClick={() => {/* TODO: Navigate to Banner Management */ }}
                    className="w-16 p-2 bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-[0_6px_0_0_#d1d5db,0_8px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_0_0_#d4af37,0_6px_25px_rgba(212,175,55,0.35)] hover:-translate-y-0.5 active:shadow-[0_2px_0_0_#997b2c,0_3px_10px_rgba(0,0,0,0.1)] active:translate-y-0.5 transition-all duration-150 group"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-1 group-hover:bg-[radial-gradient(ellipse_at_top_left,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] transition-all">
                      <svg className="w-6 h-6 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-[10px] font-medium text-slate-700 text-center">Banner</p>
                  </button>
                </div>
              </div>
              {user?.role === 'owner' && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={onNavigateToAdminCache}
                    className="w-full p-3 bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-xl hover:shadow-lg transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                      </svg>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm">Cache Management</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Stats & Quick Settings Panel */}
            <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100">
              {/* Stats Row */}
              <div className="flex items-center justify-around pb-3 border-b border-gray-100">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">Rp 0</p>
                  <p className="text-[10px] text-slate-500">Revenue</p>
                </div>
                <div className="w-px h-8 bg-gray-200"></div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">0</p>
                  <p className="text-[10px] text-slate-500">Pesanan</p>
                </div>
              </div>

              {/* Quick Actions Row - 3D Style */}
              <div className="grid grid-cols-3 gap-2 pt-3">
                <button className="p-2 bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-[0_4px_0_0_#d1d5db,0_6px_15px_rgba(0,0,0,0.1)] hover:shadow-[0_3px_0_0_#d4af37,0_4px_20px_rgba(212,175,55,0.3)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#997b2c] active:translate-y-0.5 transition-all duration-150 text-center group">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center mx-auto mb-0.5 group-hover:bg-[radial-gradient(ellipse_at_top_left,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] transition-all">
                    <Shield className="w-5 h-5 text-slate-700" />
                  </div>
                  <p className="text-[9px] text-slate-600">Keamanan</p>
                </button>
                <button className="p-2 bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-[0_4px_0_0_#d1d5db,0_6px_15px_rgba(0,0,0,0.1)] hover:shadow-[0_3px_0_0_#d4af37,0_4px_20px_rgba(212,175,55,0.3)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#997b2c] active:translate-y-0.5 transition-all duration-150 text-center group">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center mx-auto mb-0.5 group-hover:bg-[radial-gradient(ellipse_at_top_left,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] transition-all">
                    <Shield className="w-5 h-5 text-slate-700" />
                  </div>
                  <p className="text-[9px] text-slate-600">Sistem</p>
                </button>
                <button className="p-2 bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-[0_4px_0_0_#d1d5db,0_6px_15px_rgba(0,0,0,0.1)] hover:shadow-[0_3px_0_0_#d4af37,0_4px_20px_rgba(212,175,55,0.3)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#997b2c] active:translate-y-0.5 transition-all duration-150 text-center group">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center mx-auto mb-0.5 group-hover:bg-[radial-gradient(ellipse_at_top_left,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] transition-all">
                    <RefreshCw className="w-5 h-5 text-slate-700" />
                  </div>
                  <p className="text-[9px] text-slate-600">Backup</p>
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header Profile - Premium Gold Theme */}
      <div className="bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-slate-900 p-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-14 h-14 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/50 shadow-md">
            <User className="w-7 h-7 text-slate-800" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
            <p className="text-slate-700">{user.email}</p>
            <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold mt-2 ${user.role === 'owner'
              ? 'bg-slate-900 text-[#EDD686]'
              : user.role === 'admin'
                ? 'bg-purple-100 text-purple-700'
                : user.role === 'reseller'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
              }`}>
              <RoleIcon className="w-3 h-3" />
              <span>{roleInfo.text}</span>
            </div>
          </div>
        </div>

        {/* Points for Reseller */}
        {user.role === 'reseller' && (
          <div className="mt-4 bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-800">Total Poin</span>
              <span className="text-lg font-bold text-slate-900">{user.points || 0} pts</span>
            </div>
          </div>
        )}
      </div>

      {/* Settings Content */}
      <div className="p-4">
        {renderSettingsContent()}
      </div>

      {/* Logout */}
      <div className="p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full p-4 flex items-center space-x-3 text-red-500 hover:bg-red-50 transition-colors rounded-xl"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Keluar dari Akun</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;