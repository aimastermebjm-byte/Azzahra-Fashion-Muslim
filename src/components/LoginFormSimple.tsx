import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, X } from 'lucide-react';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';

interface LoginFormProps {
  onSuccess: (user: any) => void;
  onClose: () => void;
  onShowRegister?: () => void;
}

const LoginFormSimple: React.FC<LoginFormProps> = ({ onSuccess, onClose, onShowRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, loginWithGoogle, loading, error: authError } = useFirebaseAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      return;
    }

    try {

      // Use Firebase Authentication
      const userData = await login(email, password);

      if (userData) {
        // Convert Firebase user to app user format
        const appUser = {
          id: userData.uid,
          name: userData.displayName || userData.email?.split('@')[0] || '',
          email: userData.email,
          role: userData.role
        };

        onSuccess(appUser);
      }
    } catch (err) {
      console.error('❌ Firebase login error:', err);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const userData = await loginWithGoogle();

      if (userData) {
        const appUser = {
          id: userData.uid,
          name: userData.displayName || userData.email?.split('@')[0] || '',
          email: userData.email,
          role: userData.role
        };

        onSuccess(appUser);
      }
    } catch (err) {
      console.error('❌ Google login error:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Login</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Lanjutkan dengan Google
        </button>

        {/* Divider */}
        <div className="flex items-center my-5">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="px-4 text-sm text-gray-500">atau</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="email@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {authError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pink-600 text-white py-2 px-4 rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Loading...' : 'Login dengan Email'}
          </button>
        </form>

        {onShowRegister && (
          <div className="mt-4 text-center">
            <button
              onClick={onShowRegister}
              className="text-pink-600 hover:text-pink-700 text-sm font-medium transition-colors"
            >
              Belum punya akun? Daftar di sini
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginFormSimple;