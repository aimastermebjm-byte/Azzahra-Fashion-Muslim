import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, X } from 'lucide-react';

interface LoginFormProps {
  onSuccess: (user: any) => void;
  onClose: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onClose }) => {
  const [selectedRole, setSelectedRole] = useState<'customer' | 'reseller' | 'admin' | 'owner'>('customer');
  const [loading, setLoading] = useState(false);

  // Fixed dummy users for easy testing
  const dummyUsers = {
    customer: {
      id: '1',
      name: 'Siti Aminah',
      email: 'customer@azzahrafashion.com',
      role: 'customer',
      points: 0
    },
    reseller: {
      id: '2',
      name: 'Fatimah Zahra',
      email: 'reseller@azzahrafashion.com',
      role: 'reseller',
      points: 1250
    },
    admin: {
      id: '3',
      name: 'Admin Azzahra',
      email: 'admin@azzahrafashion.com',
      role: 'admin',
      points: 0
    },
    owner: {
      id: '4',
      name: 'Admin Azzahra',
      email: 'owner@azzahrafashion.com',
      role: 'owner',
      points: 0
    }
  };

  const handleLogin = async (role: 'customer' | 'reseller' | 'admin' | 'owner') => {
    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const user = dummyUsers[role];
    onSuccess(user);
    setLoading(false);
  };

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
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Login Demo</h2>
          <p className="text-sm text-gray-600">Pilih role untuk testing</p>
        </div>
        
        {/* Role Selection */}
        <div className="space-y-3 mb-6">
          {/* Customer */}
          <button
            onClick={() => setSelectedRole('customer')}
            className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
              selectedRole === 'customer'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Customer</h3>
                <p className="text-sm text-gray-600">Siti Aminah - Harga Retail</p>
                <p className="text-xs text-gray-500">customer@azzahrafashion.com</p>
              </div>
              {selectedRole === 'customer' && (
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              )}
            </div>
          </button>

          {/* Reseller */}
          <button
            onClick={() => setSelectedRole('reseller')}
            className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
              selectedRole === 'reseller'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Reseller</h3>
                <p className="text-sm text-gray-600">Fatimah Zahra - Harga Reseller</p>
                <p className="text-xs text-gray-500">reseller@azzahrafashion.com</p>
                <p className="text-xs text-blue-600 font-medium">Points: 1,250</p>
              </div>
              {selectedRole === 'reseller' && (
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              )}
            </div>
          </button>

          {/* Admin */}
          <button
            onClick={() => setSelectedRole('admin')}
            className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
              selectedRole === 'admin'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Admin</h3>
                <p className="text-sm text-gray-600">Admin Azzahra - Limited Access</p>
                <p className="text-xs text-gray-500">admin@azzahrafashion.com</p>
                <p className="text-xs text-purple-600 font-medium">Order Management</p>
              </div>
              {selectedRole === 'admin' && (
                <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
              )}
            </div>
          </button>

          {/* Owner */}
          <button
            onClick={() => setSelectedRole('owner')}
            className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
              selectedRole === 'owner'
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Owner</h3>
                <p className="text-sm text-gray-600">Owner Azzahra - Full Access</p>
                <p className="text-xs text-gray-500">owner@azzahrafashion.com</p>
                <p className="text-xs text-red-600 font-medium">Full Dashboard Access</p>
              </div>
              {selectedRole === 'owner' && (
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              )}
            </div>
          </button>
        </div>
        
        <button
          onClick={() => handleLogin(selectedRole)}
          disabled={loading}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
        >
          {loading ? 'Memproses...' : `Login sebagai ${
            selectedRole === 'customer' ? 'Customer' : 
            selectedRole === 'reseller' ? 'Reseller' : 
            selectedRole === 'admin' ? 'Admin' : 'Owner'
          }`}
        </button>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 text-center">
            <strong>Demo Mode:</strong> Pilih role untuk test fitur berbeda
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;