import React, { useState } from 'react';
import { User, Package, Heart, MapPin, Settings, LogOut, Crown, Star } from 'lucide-react';

interface AccountPageProps {
  user: any;
  onLogout: () => void;
  onNavigateToAdmin?: () => void;
}

const AccountPage: React.FC<AccountPageProps> = ({ user, onLogout, onNavigateToAdmin }) => {
  const [activeTab, setActiveTab] = useState('profile');

  // Debug log
  console.log('AccountPage rendered - User role:', user?.role);
  console.log('User:', user);

  const handleLogout = () => {
    onLogout();
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
        return { text: 'Reseller', icon: User, color: 'text-blue-600 bg-blue-100' };
      default:
        return { text: 'Customer', icon: User, color: 'text-green-600 bg-green-100' };
    }
  };

  const roleInfo = getRoleDisplay(user.role);
  const RoleIcon = roleInfo.icon;

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

      {/* Menu Items */}
      <div className="p-4 space-y-4">
        {/* Order History */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Pesanan Saya</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-orange-600" />
                </div>
                <span className="text-xs text-gray-600">Belum Bayar</span>
                <span className="text-sm font-semibold">0</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-xs text-gray-600">Dikemas</span>
                <span className="text-sm font-semibold">0</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-xs text-gray-600">Dikirim</span>
                <span className="text-sm font-semibold">0</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-xs text-gray-600">Selesai</span>
                <span className="text-sm font-semibold">0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Menu Options */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="divide-y divide-gray-100">
            <button className="w-full p-4 flex items-center space-x-3 hover:bg-gray-50 transition-colors">
              <Heart className="w-5 h-5 text-gray-400" />
              <span className="flex-1 text-left">Wishlist</span>
            </button>
            <button className="w-full p-4 flex items-center space-x-3 hover:bg-gray-50 transition-colors">
              <MapPin className="w-5 h-5 text-gray-400" />
              <span className="flex-1 text-left">Alamat Saya</span>
            </button>
            <button className="w-full p-4 flex items-center space-x-3 hover:bg-gray-50 transition-colors">
              <Settings className="w-5 h-5 text-gray-400" />
              <span className="flex-1 text-left">Pengaturan</span>
            </button>
          </div>
        </div>

        {/* Admin Quick Access */}
        {(user.role === 'admin' || user.role === 'owner') && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Admin Panel</h3>
            </div>
            <div className="p-4">
              <button
                onClick={onNavigateToAdmin}
                className={`w-full text-white py-3 rounded-lg font-semibold transition-all ${
                  user.role === 'owner' 
                    ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                }`}
              >
                Buka Dashboard Admin
              </button>
            </div>
          </div>
        )}

        {/* Logout */}
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