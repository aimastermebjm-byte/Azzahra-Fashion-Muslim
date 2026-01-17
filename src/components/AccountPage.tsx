
import React, { useState } from 'react';
import { User, LogOut, Package, CreditCard, ChevronRight, MapPin, Shield, Star, RefreshCw, Layers, TrendingUp, Gift, Users, BarChart3, Eye, EyeOff, Key, ClipboardCheck, Crown, Heart, Award, ShoppingBag, Settings } from 'lucide-react';
import { useToast } from './ToastProvider';

// Import assets - v2 (White Background for Multiply Blend)
import avatarMale from '../assets/avatar_outline_male_black_v2.png';
import avatarFemale from '../assets/avatar_outline_female_black_v2.png';

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
  onNavigateToAdminBanner?: () => void;
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
  onNavigateToAddressManagement,
  onNavigateToAdminBanner
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

  // Use prop user if available
  const user = propUser;

  // Determine avatar based on gender (Moved up for Header access)
  const gender = user?.gender || 'male';
  const AvatarImage = gender === 'female' ? avatarFemale : avatarMale;

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
        return { text: 'Reseller', icon: User, color: 'text-blue-600 bg-blue-100' };
      default:
        return { text: 'Customer', icon: User, color: 'text-green-600 bg-green-100' };
    }
  };

  const roleInfo = getRoleDisplay(user.role);
  const RoleIcon = roleInfo.icon;

  // Reusable User Info Card - Floating Card Style (Matches Mockup)
  const renderUserInfo = () => {
    return (
      <div className="bg-white rounded-3xl border-2 border-[#D4AF37] shadow-[0_6px_0_0_#997B2C,0_15px_30px_-5px_rgba(153,123,44,0.3)] overflow-hidden mb-6 relative z-10 transition-all">

        {/* 1. Ubah Password */}
        <div className="border-b border-gray-50">
          <div
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="w-full py-2 px-5 flex items-center justify-between group cursor-pointer hover:bg-amber-50/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center group-hover:bg-[#D4AF37] transition-colors shadow-sm">
                <Key className="w-5 h-5 text-[#997B2C] group-hover:text-white transition-colors" />
              </div>
              <span className="font-bold text-slate-800 text-sm">Ubah Password</span>
            </div>
            <div className={`transition-transform duration-200 ${showPasswordForm ? 'rotate-90 text-[#997B2C]' : 'text-gray-300 group-hover:text-[#997B2C]'}`}>
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>

          {/* Password Form Dropdown */}
          {showPasswordForm && (
            <div className="px-5 pb-5 bg-amber-50/30">
              <form onSubmit={handlePasswordChange} className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3 animate-in slide-in-from-top-2 duration-200">
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    placeholder="Password Saat Ini"
                    className="w-full p-3 text-sm bg-gray-50 border border-gray-200 rounded-xl pr-10 focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] outline-none transition-all"
                    required
                  />
                  <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Password Baru"
                    className="w-full p-3 text-sm bg-gray-50 border border-gray-200 rounded-xl pr-10 focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] outline-none transition-all"
                    required
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Konfirmasi Password Baru"
                  className="w-full p-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] outline-none transition-all"
                  required
                />
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowPasswordForm(false)} className="flex-1 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Batal</button>
                  <button type="submit" className="flex-1 py-2.5 text-xs bg-gradient-to-r from-[#997B2C] to-[#D4AF37] text-white rounded-xl font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-all">Simpan Password</button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* 2. Alamat Pengiriman */}
        <div className="border-b border-gray-50">
          <button
            onClick={onNavigateToAddressManagement}
            className="w-full py-2 px-5 flex items-center justify-between group hover:bg-amber-50/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center group-hover:bg-[#D4AF37] transition-colors shadow-sm">
                <MapPin className="w-5 h-5 text-[#997B2C] group-hover:text-white transition-colors" />
              </div>
              <span className="font-bold text-slate-800 text-sm">Alamat Pengiriman</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#997B2C] transition-colors" />
          </button>
        </div>

        {/* 3. Voucher Saya (New Filler) */}
        <div className="border-b border-gray-50">
          <button
            onClick={() => showToast({ message: 'Fitur Voucher akan segera hadir!', type: 'info' })} // Placeholder action
            className="w-full py-2 px-5 flex items-center justify-between group hover:bg-amber-50/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center group-hover:bg-[#D4AF37] transition-colors shadow-sm">
                <Gift className="w-5 h-5 text-[#997B2C] group-hover:text-white transition-colors" />
              </div>
              <span className="font-bold text-slate-800 text-sm">Voucher Saya</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#997B2C] transition-colors" />
          </button>
        </div>

        {/* 4. Pusat Bantuan (New Filler) */}
        <div>
          <button
            onClick={() => window.open('https://wa.me/6287815990944', '_blank')} // Placeholder to Owner WA
            className="w-full py-2 px-5 flex items-center justify-between group hover:bg-amber-50/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center group-hover:bg-[#D4AF37] transition-colors shadow-sm">
                <Shield className="w-5 h-5 text-[#997B2C] group-hover:text-white transition-colors" />
              </div>
              <div className="text-left">
                <span className="font-bold text-slate-800 text-sm block">Pusat Bantuan</span>
                <span className="text-[10px] text-gray-400 font-medium">Hubungi Admin</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#997B2C] transition-colors" />
          </button>
        </div>

      </div>
    );
  };

  // Role-based settings content
  const renderSettingsContent = () => {
    switch (user.role) {
      case 'customer':
        return (
          <div className="space-y-4">
            {/* Basic Info */}
            {renderUserInfo()}

            {/* Preferences */}
            <div className="bg-white rounded-lg border-2 border-[#D4AF37] shadow-[0_6px_0_0_#997B2C,0_15px_30px_-5px_rgba(153,123,44,0.3)] p-4">
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
            <div className="bg-white rounded-lg border-2 border-[#D4AF37] shadow-[0_6px_0_0_#997B2C,0_15px_30px_-5px_rgba(153,123,44,0.3)] p-4">
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

            {/* Reseller Preferences */}
            <div className="bg-white rounded-lg border-2 border-[#D4AF37] shadow-[0_6px_0_0_#997B2C,0_15px_30px_-5px_rgba(153,123,44,0.3)] p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Preferensi Reseller</h3>
              <div className="space-y-3">
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
            <div className="bg-white rounded-lg border-2 border-[#D4AF37] shadow-[0_6px_0_0_#997B2C,0_15px_30px_-5px_rgba(153,123,44,0.3)] p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Fitur Admin</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onNavigateToAdminProducts}
                  className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Package className="w-6 h-6 mx-auto mb-2" />
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
            <div className="bg-white rounded-lg border-2 border-[#D4AF37] shadow-[0_6px_0_0_#997B2C,0_15px_30px_-5px_rgba(153,123,44,0.3)] p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Statistik Admin</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Penjualan</p>
                  <p className="text-xl font-bold text-blue-600">Rp 0</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <Package className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Pesanan</p>
                  <p className="text-xl font-bold text-green-600">0</p>
                </div>
              </div>
            </div>

            {/* Admin Preferences */}
            <div className="bg-white rounded-lg border-2 border-[#D4AF37] shadow-[0_6px_0_0_#997B2C,0_15px_30px_-5px_rgba(153,123,44,0.3)] p-4">
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
            <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_6px_0_0_#997B2C,0_15px_30px_-5px_rgba(153,123,44,0.3)] p-3">
              {/* SVG Gradient Definition for Gold Icons */}
              <svg width="0" height="0" className="absolute">
                <defs>
                  <linearGradient id="gold-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#997B2C" />
                    <stop offset="50%" stopColor="#EDD686" />
                    <stop offset="100%" stopColor="#997B2C" />
                  </linearGradient>
                </defs>
              </svg>
              <h3 className="text-base font-extrabold text-slate-900 mb-3">Kontrol Owner</h3>
              {/* Fixed 5-Column Grid - 10 menus in 2 rows */}
              <div className="grid grid-cols-5 gap-2">
                {/* Kelola Produk */}
                <button
                  onClick={onNavigateToAdminProducts}
                  className="p-3 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] hover:shadow-[0_2px_0_0_#7a6223,0_3px_15px_rgba(153,123,44,0.25)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#7a6223] active:translate-y-0.5 transition-all duration-150 shine-effect"
                >
                  <Package className="w-6 h-6 mx-auto mb-1" style={{ stroke: 'url(#gold-icon-gradient)', fill: 'none' }} />
                  <p className="text-[10px] font-bold text-slate-900 text-center leading-tight">Produk</p>
                </button>

                {/* Kelola Pesanan */}
                <button
                  onClick={onNavigateToAdminOrders}
                  className="p-3 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] hover:shadow-[0_2px_0_0_#7a6223,0_3px_15px_rgba(153,123,44,0.25)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#7a6223] active:translate-y-0.5 transition-all duration-150 shine-effect"
                >
                  <ShoppingBag className="w-6 h-6 mx-auto mb-1" style={{ stroke: 'url(#gold-icon-gradient)', fill: 'none' }} />
                  <p className="text-[10px] font-bold text-slate-900 text-center leading-tight">Pesanan</p>
                </button>

                {/* Verifikasi Pembayaran */}
                <button
                  onClick={onNavigateToAdminPaymentVerification}
                  className="p-3 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] hover:shadow-[0_2px_0_0_#7a6223,0_3px_15px_rgba(153,123,44,0.25)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#7a6223] active:translate-y-0.5 transition-all duration-150 shine-effect"
                >
                  <CreditCard className="w-6 h-6 mx-auto mb-1" style={{ stroke: 'url(#gold-icon-gradient)', fill: 'none' }} />
                  <p className="text-[10px] font-bold text-slate-900 text-center leading-tight">Payment</p>
                </button>

                {/* Laporan */}
                <button
                  onClick={onNavigateToAdminReports}
                  className="p-3 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] hover:shadow-[0_2px_0_0_#7a6223,0_3px_15px_rgba(153,123,44,0.25)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#7a6223] active:translate-y-0.5 transition-all duration-150 shine-effect"
                >
                  <BarChart3 className="w-6 h-6 mx-auto mb-1" style={{ stroke: 'url(#gold-icon-gradient)', fill: 'none' }} />
                  <p className="text-[10px] font-bold text-slate-900 text-center leading-tight">Laporan</p>
                </button>

                {/* Kelola User */}
                <button
                  onClick={onNavigateToAdminUsers}
                  className="p-3 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] hover:shadow-[0_2px_0_0_#7a6223,0_3px_15px_rgba(153,123,44,0.25)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#7a6223] active:translate-y-0.5 transition-all duration-150 shine-effect"
                >
                  <Users className="w-6 h-6 mx-auto mb-1" style={{ stroke: 'url(#gold-icon-gradient)', fill: 'none' }} />
                  <p className="text-[10px] font-bold text-slate-900 text-center leading-tight">Users</p>
                </button>

                {/* Biaya & Pendapatan */}
                <button
                  onClick={onNavigateToAdminFinancials}
                  className="p-3 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] hover:shadow-[0_2px_0_0_#7a6223,0_3px_15px_rgba(153,123,44,0.25)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#7a6223] active:translate-y-0.5 transition-all duration-150 shine-effect"
                >
                  <TrendingUp className="w-6 h-6 mx-auto mb-1" style={{ stroke: 'url(#gold-icon-gradient)', fill: 'none' }} />
                  <p className="text-[10px] font-bold text-slate-900 text-center leading-tight">Finance</p>
                </button>

                {/* Data Master */}
                <button
                  onClick={onNavigateToAdminMaster}
                  className="p-3 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] hover:shadow-[0_2px_0_0_#7a6223,0_3px_15px_rgba(153,123,44,0.25)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#7a6223] active:translate-y-0.5 transition-all duration-150 shine-effect"
                >
                  <Layers className="w-6 h-6 mx-auto mb-1" style={{ stroke: 'url(#gold-icon-gradient)', fill: 'none' }} />
                  <p className="text-[10px] font-bold text-slate-900 text-center leading-tight">Master</p>
                </button>

                {/* Stock Opname */}
                <button
                  onClick={onNavigateToAdminStockOpname}
                  className="p-3 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] hover:shadow-[0_2px_0_0_#7a6223,0_3px_15px_rgba(153,123,44,0.25)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#7a6223] active:translate-y-0.5 transition-all duration-150 shine-effect"
                >
                  <ClipboardCheck className="w-6 h-6 mx-auto mb-1" style={{ stroke: 'url(#gold-icon-gradient)', fill: 'none' }} />
                  <p className="text-[10px] font-bold text-slate-900 text-center leading-tight">Stock</p>
                </button>

                {/* Kelola Voucher */}
                <button
                  onClick={onNavigateToAdminVoucher}
                  className="p-3 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] hover:shadow-[0_2px_0_0_#7a6223,0_3px_15px_rgba(153,123,44,0.25)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#7a6223] active:translate-y-0.5 transition-all duration-150 shine-effect"
                >
                  <Gift className="w-6 h-6 mx-auto mb-1" style={{ stroke: 'url(#gold-icon-gradient)', fill: 'none' }} />
                  <p className="text-[10px] font-bold text-slate-900 text-center leading-tight">Voucher</p>
                </button>

                <button
                  onClick={onNavigateToAdminBanner}
                  className="p-3 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] hover:shadow-[0_2px_0_0_#7a6223,0_3px_15px_rgba(153,123,44,0.25)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#7a6223] active:translate-y-0.5 transition-all duration-150 shine-effect"
                >
                  <svg className="w-6 h-6 mx-auto mb-1" style={{ stroke: 'url(#gold-icon-gradient)', fill: 'none' }} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-[10px] font-bold text-slate-900 text-center leading-tight">Banner</p>
                </button>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100">
                <button
                  onClick={onNavigateToAdminCache}
                  className="w-full p-2 rounded-xl border border-dashed border-[#D4AF37]/30 hover:bg-[#D4AF37]/5 transition-all group shine-effect overflow-hidden relative"
                >
                  <div className="flex items-center justify-center space-x-2 relative z-10">
                    <svg className="w-4 h-4 text-[#997B2C] group-hover:text-[#b38f34] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                    <span className="font-bold text-xs bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] bg-clip-text text-transparent bg-[length:200%_auto] animate-shine">
                      Cache Management
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Stats & Quick Settings Panel */}
            <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_6px_0_0_#997B2C,0_15px_30px_-5px_rgba(153,123,44,0.3)] p-3">
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
                <button className="p-2.5 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] hover:shadow-[0_2px_0_0_#7a6223,0_3px_15px_rgba(153,123,44,0.25)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#7a6223] active:translate-y-0.5 transition-all duration-150 shine-effect">
                  <div className="flex flex-col items-center">
                    <Shield className="w-5 h-5 text-[#997B2C] mb-1" />
                    <p className="text-[10px] font-bold text-slate-900 leading-tight">Keamanan</p>
                  </div>
                </button>
                <button className="p-2.5 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] hover:shadow-[0_2px_0_0_#7a6223,0_3px_15px_rgba(153,123,44,0.25)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#7a6223] active:translate-y-0.5 transition-all duration-150 shine-effect">
                  <div className="flex flex-col items-center">
                    <Settings className="w-5 h-5 text-[#997B2C] mb-1" />
                    <p className="text-[10px] font-bold text-slate-900 leading-tight">Sistem</p>
                  </div>
                </button>
                <button className="p-2.5 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] hover:shadow-[0_2px_0_0_#7a6223,0_3px_15px_rgba(153,123,44,0.25)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#7a6223] active:translate-y-0.5 transition-all duration-150 shine-effect">
                  <div className="flex flex-col items-center">
                    <RefreshCw className="w-5 h-5 text-[#997B2C] mb-1" />
                    <p className="text-[10px] font-bold text-slate-900 leading-tight">Backup</p>
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
    <div className="min-h-screen bg-gray-50 pb-20 relative">
      {/* Premium Gold Header - LEFT ALIGNED PROFILE Layout */}
      <div className="h-auto min-h-[260px] bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] relative overflow-hidden rounded-b-[40px] shadow-2xl shine-effect">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        {/* Shine effects - Controlled by shine-effect class */}

        {/* Content Container - Row Layout */}
        <div className="relative z-10 px-6 pt-12 pb-16 flex items-center gap-5">

          {/* AVATAR (Left) */}
          <div className="flex-shrink-0 w-24 h-24 rounded-full border-2 border-slate-900 bg-slate-900 p-[2px] flex items-center justify-center shadow-md">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-[#EDD686] via-[#D4AF37] to-[#997B2C] flex items-center justify-center overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
              ) : (
                <img src={AvatarImage} alt="Avatar" className="w-full h-full object-cover opacity-100 drop-shadow-[2px_4px_4px_rgba(0,0,0,0.6)] transform hover:scale-105 transition-transform duration-300" />
              )}
            </div>
          </div>

          {/* INFO (Right) */}
          <div className="text-left flex-1 min-w-0">
            {/* Role Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/10 border border-slate-900/20 backdrop-blur-sm shadow-sm mb-2">
              <RoleIcon className="w-3 h-3 text-slate-900" />
              <span className="text-slate-900 text-[10px] font-bold tracking-wide uppercase">{roleInfo.text}</span>
            </div>

            {/* Name */}
            <h3 className="text-xl font-extrabold text-slate-900 leading-tight mb-0.5 truncate">{user.name || user.displayName}</h3>
            {/* Email */}
            <p className="text-xs font-medium text-slate-800/80 truncate">{user.email}</p>
          </div>

          {/* Logout Button (Absolute Top Right) */}
          <button
            onClick={handleLogout}
            className="absolute top-6 right-6 p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all active:scale-95 border border-white/20 shadow-lg"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area - Floating Card - Reduced Overlap */}
      <div className="px-5 -mt-20">
        {renderSettingsContent()}

        <div className="mt-8 text-center pb-8">
          <p className="text-xs text-gray-400">Azzahra Fashion Muslim v2.1.0</p>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;