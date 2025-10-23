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
  const { login, loading, error: authError } = useFirebaseAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      return;
    }

    try {
      console.log('🔄 Firebase login attempt:', email);

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

        console.log('✅ Firebase login successful:', appUser);
        onSuccess(appUser);
      }
    } catch (err) {
      console.error('❌ Firebase login error:', err);
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
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded">
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading...' : 'Login'}
          </button>
        </form>

        {onShowRegister && (
          <div className="mt-4 text-center">
            <button
              onClick={onShowRegister}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
            >
              Belum punya akun? Daftar di sini
            </button>
          </div>
        )}

        <div className="mt-4 text-center text-sm text-gray-600">
          <p className="font-semibold mb-2">🔥 Firebase Authentication</p>
          <div className="space-y-1 text-xs">
            <p><strong>Owner:</strong> v4hrin@gmail.com / (password Anda)</p>
            <p><strong>Admin:</strong> admin@azzahra.com / admin123</p>
            <p><strong>Reseller:</strong> reseller@azzahra.com / reseller123</p>
            <p><strong>Customer:</strong> [email lain] / [password]</p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            * Email harus terdaftar di Firebase Authentication
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginFormSimple;