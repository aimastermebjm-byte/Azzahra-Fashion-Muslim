import React, { useState } from 'react';
import { X, Eye, EyeOff, UserPlus, Shield, Crown } from 'lucide-react';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';

interface FirebaseRegistrationProps {
  onClose: () => void;
  onSuccess: (user: any) => void;
}

const FirebaseRegistration: React.FC<FirebaseRegistrationProps> = ({ onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'owner' | 'admin' | 'reseller' | 'customer'>('customer');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // Step 1: Role selection, Step 2: Registration form

  const { register } = useFirebaseAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password || !confirmPassword || !displayName) {
      setError('Semua field harus diisi!');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password tidak cocok!');
      return;
    }

    if (password.length < 6) {
      setError('Password minimal 6 karakter!');
      return;
    }

    setLoading(true);

    try {
      console.log('🔄 Firebase registration attempt:', { email, displayName, role: selectedRole });

      const userData = await register(email, password, displayName, selectedRole);

      if (userData) {
        const appUser = {
          id: userData.uid,
          name: userData.displayName || displayName,
          email: userData.email,
          role: userData.role
        };

        console.log('✅ Firebase registration successful:', appUser);
        onSuccess(appUser);
        onClose();
      }
    } catch (err: any) {
      console.error('❌ Firebase registration error:', err);
      setError(err.message || 'Registrasi gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return Crown;
      case 'admin': return Shield;
      default: return UserPlus;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-red-500 hover:bg-red-600 text-white';
      case 'admin': return 'bg-purple-500 hover:bg-purple-600 text-white';
      case 'reseller': return 'bg-blue-500 hover:bg-blue-600 text-white';
      default: return 'bg-green-500 hover:bg-green-600 text-white';
    }
  };

  if (step === 1) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Pilih Role Akun</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="p-6">
            <p className="text-gray-600 mb-6">Pilih jenis akun yang ingin Anda daftarkan:</p>

            <div className="space-y-3">
              {[
                { role: 'owner', title: 'Owner', desc: 'Pemilik bisnis - Akses penuh' },
                { role: 'admin', title: 'Administrator', desc: 'Admin - Kelola produk dan pesanan' },
                { role: 'reseller', title: 'Reseller', desc: 'Penjual reseller - Harga khusus' },
                { role: 'customer', title: 'Customer', desc: 'Pelanggan - Belanja biasa' }
              ].map(({ role, title, desc }) => {
                const Icon = getRoleIcon(role);
                return (
                  <button
                    key={role}
                    onClick={() => {
                      setSelectedRole(role as any);
                      setStep(2);
                    }}
                    className={`w-full p-4 rounded-lg border-2 transition-all ${selectedRole === role
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${getRoleColor(role)}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-800">{title}</h3>
                        <p className="text-sm text-gray-600">{desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              Daftar {selectedRole === 'owner' ? 'Owner' : selectedRole === 'admin' ? 'Admin' : selectedRole === 'reseller' ? 'Reseller' : 'Customer'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Masukkan nama lengkap"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder={`contoh: ${selectedRole}@azzahra.com`}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                  placeholder="Minimal 6 karakter"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                  placeholder="Konfirmasi password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="bg-purple-50 p-3 rounded-lg">
              <p className="text-sm text-purple-700">
                <strong>Role:</strong> {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
              </p>
              <p className="text-xs text-purple-600 mt-1">
                {selectedRole === 'owner' && 'Akses penuh ke semua fitur admin'}
                {selectedRole === 'admin' && 'Akses kelola produk dan pesanan'}
                {selectedRole === 'reseller' && 'Harga reseller dan poin reward'}
                {selectedRole === 'customer' && 'Akses berbelanja biasa'}
              </p>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 p-3 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Kembali
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Mendaftar...' : 'Daftar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FirebaseRegistration;