import React, { useState } from 'react';
import { User, Package, Heart, MapPin, Settings, LogOut, Crown, Star, User as UserIcon, Shield, Eye, EyeOff, RefreshCw, Award, BarChart3, Users, TrendingUp, Package as PackageIcon, Mail, Phone, Key } from 'lucide-react';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';

interface AccountPageProps {
  user: any;
  onLogout: () => void;
  onNavigateToAdminProducts?: () => void;
  onNavigateToAdminOrders?: () => void;
  onNavigateToAdminReports?: () => void;
  onNavigateToAdminUsers?: () => void;
  // Flash sale and featured products are now managed in AdminProductsPage
}

const AccountPage: React.FC<AccountPageProps> = ({
  user,
  onLogout,
  onNavigateToAdminProducts,
  onNavigateToAdminOrders,
  onNavigateToAdminReports,
  onNavigateToAdminUsers
}) => {
    const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Debug log
  console.log('AccountPage rendered - User role:', user?.role);
  console.log('User:', user);

  const { updateProfile } = useSupabaseAuth();

  const handleLogout = () => {
    onLogout();
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

    // TODO: Implement password change with Supabase
    try {
      // const { error } = await supabase.auth.updateUser({
      //   password: passwordForm.newPassword
      // });
      // if (error) throw error;

      alert('✅ Password berhasil diubah!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    } catch (error: any) {
      alert('❌ Gagal mengubah password: ' + error.message);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Silakan login terlebih dahulu</p>
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

  // Role-based settings content
  const renderSettingsContent = () => {
    switch (user.role) {
      case 'customer':
        return (
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Informasi Akun</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Username</p>
                    <p className="font-medium">{user.name}</p>
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
                        onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
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
                        onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
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
                      onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
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
                <button className="w-full p-3 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium">Alamat Pengiriman</p>
                      <p className="text-sm text-gray-500">Kelola alamat Anda</p>
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
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Informasi Akun</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Username</p>
                    <p className="font-medium">{user.name}</p>
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
              </div>
            </div>

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
                        onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
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
                        onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
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
                      onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
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
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium">Alamat Pengiriman</p>
                      <p className="text-sm text-gray-500">Kelola alamat Anda</p>
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
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Informasi Akun Admin</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Username</p>
                    <p className="font-medium">{user.name}</p>
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
              </div>
            </div>

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
                        onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
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
                        onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
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
                      onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
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
                    <Settings className="w-5 h-5 text-gray-400" />
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
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Informasi Akun Owner</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Username</p>
                    <p className="font-medium">{user.name}</p>
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
              </div>
            </div>

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
              </div>
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
                        onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
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
                        onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
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
                      onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
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
                    <Settings className="w-5 h-5 text-gray-400" />
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