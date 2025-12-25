import React, { useState } from 'react';
import { User, Package, Heart, MapPin, LogOut, Crown, Star, User as UserIcon, Shield, Eye, EyeOff, RefreshCw, Award, BarChart3, Users, TrendingUp, Package as PackageIcon, Mail, Phone, Key, Layers, CreditCard, Edit2, Check, X, ClipboardCheck } from 'lucide-react';
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

  // Reusable User Info Card
  const renderUserInfo = (title: string = "Informasi Akun") => (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <User className="w-5 h-5 text-gray-400" />
          <div className="flex-1">
            <p className="text-sm text-gray-500">Username</p>
            {isEditingName ? (
              <div className="flex items-center space-x-2 mt-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 p-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={loadingName}
                  className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  disabled={loadingName}
                  className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="font-medium">{user.name || user.displayName}</p>
                <button
                  onClick={startEditingName}
                  className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Mail className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Phone className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-sm text-gray-500">Telepon</p>
            <p className="font-medium">{user.phone || 'Belum diisi'}</p>
          </div>
        </div>
        <button
          onClick={onNavigateToAddressManagement}
          className="flex items-center space-x-3 w-full p-3 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors"
        >
          <MapPin className="w-5 h-5 text-gray-400" />
          <div className="flex-1">
            <p className="font-medium">Alamat Saya</p>
            <p className="text-sm text-gray-500">Kelola alamat pengiriman</p>
          </div>
        </button>
      </div>
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
            {renderUserInfo("Informasi Akun Admin")}

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
            {renderUserInfo("Informasi Akun Owner")}

            {/* Owner Controls */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Kontrol Owner</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onNavigateToAdminProducts}
                  className="p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <PackageIcon className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Kelola Produk</p>
                </button>
                <button
                  onClick={onNavigateToAdminOrders}
                  className="p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Package className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Kelola Pesanan</p>
                </button>
                <button
                  onClick={onNavigateToAdminPaymentVerification}
                  className="p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <CreditCard className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Verifikasi Pembayaran</p>
                </button>
                <button
                  onClick={onNavigateToAdminReports}
                  className="p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <BarChart3 className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Laporan</p>
                </button>
                <button
                  onClick={onNavigateToAdminUsers}
                  className="p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Users className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Kelola User</p>
                </button>
                <button
                  onClick={onNavigateToAdminFinancials}
                  className="p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <TrendingUp className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Biaya & Pendapatan</p>
                </button>
                <button
                  onClick={onNavigateToAdminMaster}
                  className="p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Layers className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Data Master</p>
                </button>
                <button
                  onClick={onNavigateToAdminStockOpname}
                  className="p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <ClipboardCheck className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Stock Opname</p>
                </button>
              </div>

              {/* Owner-only Cache Management */}
              {user?.role === 'owner' && (
                <div className="mt-4">
                  <h3 className="font-semibold text-gray-800 mb-3">Owner Tools</h3>
                  <button
                    onClick={onNavigateToAdminCache}
                    className="w-full p-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors mb-3"
                  >
                    <div className="flex items-center space-x-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                      </svg>
                      <div className="flex-1 text-left">
                        <p className="font-medium">Cache Management</p>
                        <p className="text-sm opacity-90">Kelola cache ongkir & alamat</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Owner Stats */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Statistik Bisnis</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-red-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-xl font-bold text-red-600">Rp 0</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <PackageIcon className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Pesanan</p>
                  <p className="text-xl font-bold text-green-600">0</p>
                </div>
              </div>
            </div>

            {/* Security Settings */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Keamanan Owner</h3>
              <button
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="w-full p-3 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Key className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="font-medium">Ubah Password</p>
                    <p className="text-sm text-gray-500">Keamanan akun owner</p>
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

            {/* Owner Preferences */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Pengaturan Owner</h3>
              <div className="space-y-3">
                <button className="w-full p-3 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium">Keamanan</p>
                      <p className="text-sm text-gray-500">Pengaturan keamanan tingkat lanjut</p>
                    </div>
                  </div>
                </button>
                <button className="w-full p-3 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium">Sistem</p>
                      <p className="text-sm text-gray-500">Konfigurasi aplikasi</p>
                    </div>
                  </div>
                </button>
                <button className="w-full p-3 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <RefreshCw className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium">Backup & Restore</p>
                      <p className="text-sm text-gray-500">Cadangkan data</p>
                    </div>
                  </div>
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
      {/* Header Profile */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <User className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{user.name}</h2>
            <p className="text-pink-100">{user.email}</p>
            <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium mt-2 ${roleInfo.color}`}>
              <RoleIcon className="w-3 h-3" />
              <span className="text-gray-800">{roleInfo.text}</span>
            </div>
          </div>
        </div>

        {/* Points for Reseller */}
        {user.role === 'reseller' && (
          <div className="mt-4 bg-white/10 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Total Poin</span>
              <span className="text-lg font-bold">{user.points || 0} pts</span>
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
        <div className="bg-white rounded-lg shadow-sm">
          <button
            onClick={handleLogout}
            className="w-full p-4 flex items-center space-x-3 text-red-600 hover:bg-red-50 transition-colors rounded-lg"
          >
            <LogOut className="w-5 h-5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;