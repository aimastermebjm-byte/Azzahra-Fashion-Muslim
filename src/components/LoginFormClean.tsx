import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, X, UserPlus, Crown, User, ArrowLeft } from 'lucide-react';
// import { useSupabaseAuthSimple } from '../hooks/useSupabaseAuthSimple';
// import CustomerRegistration from './CustomerRegistration';
// import OwnerAdminRegistration from './OwnerAdminRegistration';

interface LoginFormProps {
  onSuccess: (user: any) => void;
  onClose: () => void;
}

const LoginFormClean: React.FC<LoginFormProps> = ({ onSuccess, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCustomerRegistration, setShowCustomerRegistration] = useState(false);
  const [showOwnerRegistration, setShowOwnerRegistration] = useState(false);
  const { login } = useSupabaseAuthSimple();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Email dan password harus diisi');
      setLoading(false);
      return;
    }

    try {
      
      // Login via Supabase Auth
      const result = await login(email, password);

      if (result.success) {
                // Create user object for success callback
        const userData = {
          id: result.data?.user?.id || '',
          name: result.data?.user?.user_metadata?.name || email.split('@')[0],
          email: email,
          role: result.data?.user?.user_metadata?.role || 'customer',
          phone: result.data?.user?.user_metadata?.phone || null,
          points: 0,
          created_at: result.data?.user?.created_at || new Date().toISOString()
        };
        onSuccess(userData);
      } else {
        console.error('❌ Login failed:', result.error);
        setError(result.error || 'Login gagal. Periksa email dan password anda.');
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      setError('Terjadi kesalahan saat login: ' + error.message);
    }

    setLoading(false);
  };

  const handleCustomerRegistrationSuccess = (userData: any) => {
    setShowCustomerRegistration(false);
    onSuccess(userData);
    onClose();
  };

  const handleOwnerRegistrationSuccess = (userData: any) => {
    setShowOwnerRegistration(false);
    onSuccess(userData);
    onClose();
  };

  // Show customer registration form
  if (showCustomerRegistration) {
    return (
      <CustomerRegistration
        onBack={() => setShowCustomerRegistration(false)}
        onSuccess={handleCustomerRegistrationSuccess}
      />
    );
  }

  // Show owner registration form
  if (showOwnerRegistration) {
    return (
      <OwnerAdminRegistration
        onBack={() => setShowOwnerRegistration(false)}
        onSuccess={handleOwnerRegistrationSuccess}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-brand-gradient rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Login</h2>
          <p className="text-sm text-gray-600">Masuk ke akun Azzahra Fashion</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
                placeholder="nama@gmail.com"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
                placeholder="Masukkan password"
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

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Masuk...
              </div>
            ) : (
              'Masuk'
            )}
          </button>
        </form>

        {/* Registration Buttons */}
        <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
          <div className="text-center text-sm text-gray-600 mb-3">
            Belum punya akun? Daftar dulu:
          </div>

          {/* Customer Registration Button */}
          <button
            onClick={() => setShowCustomerRegistration(true)}
            className="w-full btn-brand-outline flex items-center justify-center space-x-2"
          >
            <UserPlus className="w-5 h-5" />
            <span>Registrasi Customer</span>
          </button>

          {/* Owner/Admin Registration Button */}
          <button
            onClick={() => setShowOwnerRegistration(true)}
            className="w-full bg-brand-accent text-white py-3 px-4 rounded-xl hover:bg-brand-accent/90 font-semibold transition-all flex items-center justify-center space-x-2"
          >
            <Crown className="w-5 h-5" />
            <span>Registrasi Owner/Admin</span>
          </button>

          <p className="text-xs text-gray-500 text-center">
            Gunakan email Gmail/Yahoo untuk registrasi
          </p>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 text-center">
            <strong>Login Real:</strong> Gunakan email dan password yang sudah terdaftar
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginFormClean;