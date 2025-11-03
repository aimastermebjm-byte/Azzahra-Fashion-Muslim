import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';

interface CacheSettings {
  // Legacy property for backward compatibility
  cache_ttl_hours: number;
  max_cache_age_days: number;
  auto_cleanup_expired: boolean;
  refresh_all_couriers: boolean;
  notify_on_price_change: boolean;
  updated_at?: string;
  updated_by?: string;

  // Shipping cache specific settings
  shipping_cache_ttl_hours?: number;
  shipping_max_cache_age_days?: number;
  shipping_auto_cleanup_expired?: boolean;
  shipping_refresh_all_couriers?: boolean;
  shipping_notify_on_price_change?: boolean;

  // Address cache specific settings
  address_provinces_ttl_hours?: number;
  address_cities_ttl_hours?: number;
  address_districts_ttl_hours?: number;
  address_subdistricts_ttl_hours?: number;
  address_auto_cleanup_expired?: boolean;
}

interface CacheInfo {
  cacheKey: string;
  origin: string;
  destination: string;
  weight: number;
  courier: string;
  cached_at: string;
  expires_at: string;
  hit_count: number;
  refresh_version: number;
  results_count: number;
  is_expired: boolean;
  age_days: number;
  cache_ttl_hours: number;
}

interface CacheSummary {
  total: number;
  expired: number;
  active: number;
  oldest_cache: number;
  newest_cache: number;
}

const AdminCacheManagement: React.FC<{ user: any; onBack: () => void }> = ({ user, onBack }) => {
  const [activeTab, setActiveTab] = useState<'shipping-settings' | 'shipping-list' | 'shipping-actions' | 'address-settings' | 'address-list'>('shipping-settings');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Cache type: 'shipping' or 'address'
  const [cacheType, setCacheType] = useState<'shipping' | 'address'>('shipping');

  // Settings state
  const [settings, setSettings] = useState<CacheSettings>({
    // Legacy settings
    cache_ttl_hours: 30 * 24, // 1 month default
    max_cache_age_days: 60,
    auto_cleanup_expired: true,
    refresh_all_couriers: true,
    notify_on_price_change: false,

    // Shipping cache settings with defaults
    shipping_cache_ttl_hours: 7 * 24, // 7 days (revenue critical)
    shipping_max_cache_age_days: 14,
    shipping_auto_cleanup_expired: true,
    shipping_refresh_all_couriers: true,
    shipping_notify_on_price_change: true,

    // Address cache settings with defaults
    address_provinces_ttl_hours: 24 * 30 * 6, // 6 months
    address_cities_ttl_hours: 24 * 30, // 1 month
    address_districts_ttl_hours: 24 * 30, // 1 month
    address_subdistricts_ttl_hours: 24 * 30, // 1 month
    address_auto_cleanup_expired: true
  });

  // Cache list state
  const [cacheList, setCacheList] = useState<CacheInfo[]>([]);
  const [cacheSummary, setCacheSummary] = useState<CacheSummary | null>(null);

  // Actions state
  const [refreshForm, setRefreshForm] = useState({
    origin: '',
    destination: '',
    weight: 1000,
    courier: 'all'
  });

  // Get auth token for API calls
  const getAuthToken = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (user) {
        const token = await user.getIdToken();
        console.log('🔐 Firebase auth token obtained for cache management');
        return token;
      } else {
        console.error('❌ No Firebase user found');
        return '';
      }
    } catch (error) {
      console.error('❌ Error getting Firebase auth token:', error);
      return '';
    }
  };

  // Load cache settings
  const loadCacheSettings = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      // TEMPORARY: Use bypass endpoint for testing
      const response = await fetch('/api/admin/cache-settings-temp?action=settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSettings(data.data.settings);
        setMessage({ type: 'success', text: 'Cache settings loaded' });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load cache settings' });
    } finally {
      setLoading(false);
    }
  };

  // Load cache list
  const loadCacheList = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      // TEMPORARY: Use bypass endpoint for testing
      const response = await fetch('/api/admin/cache-settings-temp?action=list', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setCacheList(data.data.caches);
        setCacheSummary(data.data.summary);
        setMessage({ type: 'success', text: `Found ${data.data.caches.length} cache entries` });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load cache list' });
    } finally {
      setLoading(false);
    }
  };

  // Update cache settings
  const updateSettings = async (newSettings: Partial<CacheSettings>) => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/admin/cache-settings-temp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'update_settings',
          settings: newSettings
        })
      });

      const data = await response.json();

      if (data.success) {
        setSettings(data.data.updated_settings);
        setMessage({ type: 'success', text: 'Cache settings updated successfully' });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update settings' });
    } finally {
      setLoading(false);
    }
  };

  // Refresh specific cache
  const refreshCache = async () => {
    if (!refreshForm.origin || !refreshForm.destination) {
      setMessage({ type: 'error', text: 'Origin and destination are required' });
      return;
    }

    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/admin/cache-settings-temp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'refresh_cache',
          ...refreshForm
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Cache refresh initiated successfully' });
        setRefreshForm({ origin: '', destination: '', weight: 1000, courier: 'all' });
        // Reload cache list if on list tab
        if (activeTab === 'list') {
          loadCacheList();
        }
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to refresh cache' });
    } finally {
      setLoading(false);
    }
  };

  // Clear expired cache
  const clearExpiredCache = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus semua cache yang kadaluarsa?')) return;

    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/admin/cache-settings-temp?action=clear_expired', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `Cleared ${data.data.deleted} expired cache entries` });
        loadCacheList();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clear expired cache' });
    } finally {
      setLoading(false);
    }
  };

  // Clear all cache
  const clearAllCache = async () => {
    if (!confirm('⚠️ BAHAYA: Ini akan menghapus SEMUA cache dan memaksa panggilan API baru. Lanjutkan?')) return;

    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/admin/cache-settings-temp?action=clear_all', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `Cleared all ${data.data.deleted} cache entries` });
        loadCacheList();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clear all cache' });
    } finally {
      setLoading(false);
    }
  };

  // Hapus specific cache entry
  const deleteCacheEntry = async (cacheKey: string) => {
    if (!confirm(`Hapus cache entry: ${cacheKey}?`)) return;

    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/admin/cache-settings-temp?action=clear_specific&cache_key=${encodeURIComponent(cacheKey)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `Cache entry ${cacheKey} deleted` });
        loadCacheList();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete cache entry' });
    }
  };

  // Format duration
  const formatDuration = (hours: number) => {
    if (hours < 24) return `${hours} jam`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days} hari`;
    return `${days} hari ${remainingHours} jam`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID');
  };

  // Load data on component mount
  useEffect(() => {
    if (user?.role === 'owner') {
      loadCacheSettings();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'list' && user?.role === 'owner') {
      loadCacheList();
    }
  }, [activeTab, user]);

  if (user?.role !== 'owner') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 text-xl font-semibold mb-2">Akses Ditolak</h2>
            <p className="text-red-600">Hanya pengguna dengan role 'owner' yang bisa mengakses manajemen cache.</p>
            <button
              onClick={onBack}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🗄️ Manajemen Cache</h1>
              <p className="text-gray-600 mt-1">Kelola pengaturan cache biaya pengiriman dan pantau performa</p>
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              ← Kembali ke Admin
            </button>
          </div>
        </div>

        {/* Alert Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
            message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Cache Type Selector */}
        <div className="bg-white rounded-lg shadow-sm mb-4">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-1 px-6">
              <button
                onClick={() => setCacheType('shipping')}
                className={`py-3 px-4 border-b-2 font-medium text-sm rounded-t-lg ${
                  cacheType === 'shipping'
                    ? 'border-purple-500 text-purple-600 bg-purple-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                📦 Cache Ongkir
              </button>
              <button
                onClick={() => setCacheType('address')}
                className={`py-3 px-4 border-b-2 font-medium text-sm rounded-t-lg ${
                  cacheType === 'address'
                    ? 'border-orange-500 text-orange-600 bg-orange-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                🏠 Cache Alamat
              </button>
            </nav>
          </div>
        </div>

        {/* Sub Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {cacheType === 'shipping' ? (
                <>
                  <button
                    onClick={() => setActiveTab('shipping-settings')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'shipping-settings'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    ⚙️ Pengaturan Ongkir
                  </button>
                  <button
                    onClick={() => setActiveTab('shipping-list')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'shipping-list'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    📋 Daftar Cache Ongkir
                  </button>
                  <button
                    onClick={() => setActiveTab('shipping-actions')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'shipping-actions'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    🔄 Aksi Ongkir
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setActiveTab('address-settings')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'address-settings'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    ⚙️ Pengaturan Alamat
                  </button>
                  <button
                    onClick={() => setActiveTab('address-list')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'address-list'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    📋 Daftar Cache Alamat
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>

        {/* Shipping Settings Tab */}
        {activeTab === 'shipping-settings' && cacheType === 'shipping' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-6">Pengaturan Cache Ongkir</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cache TTL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cache TTL Ongkir (Masa Aktif)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="8760"
                    value={settings.shipping_cache_ttl_hours || 168}
                    onChange={(e) => setSettings({ ...settings, shipping_cache_ttl_hours: parseInt(e.target.value) })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-600">jam</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Default: 168 jam (7 hari) - untuk mencegah kerugian akibat perubahan harga
                </p>
              </div>

              {/* Max Cache Age */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maksimal Umur Cache Ongkir
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={settings.shipping_max_cache_age_days || 14}
                    onChange={(e) => setSettings({ ...settings, shipping_max_cache_age_days: parseInt(e.target.value) })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-600">hari</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Cache otomatis dihapus setelah ini. Default: 14 hari
                </p>
              </div>

              {/* Checkboxes */}
              <div className="md:col-span-2 space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.shipping_auto_cleanup_expired !== false}
                    onChange={(e) => setSettings({ ...settings, shipping_auto_cleanup_expired: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Otomatis Hapus Cache Ongkir Kadaluarsa</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.shipping_refresh_all_couriers !== false}
                    onChange={(e) => setSettings({ ...settings, shipping_refresh_all_couriers: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Refresh Semua Kurir Saat Update Cache</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.shipping_notify_on_price_change || false}
                    onChange={(e) => setSettings({ ...settings, shipping_notify_on_price_change: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Notifikasi jika Harga Ongkir Berubah</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => updateSettings(settings)}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Pengaturan Ongkir'}
              </button>
            </div>
          </div>
        )}

        {/* Address Settings Tab */}
        {activeTab === 'address-settings' && cacheType === 'address' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-6">Pengaturan Cache Alamat</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Address Cache TTL Settings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cache TTL Provinsi
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="24"
                    max="8760"
                    value={settings.address_provinces_ttl_hours || 4320}
                    onChange={(e) => setSettings({ ...settings, address_provinces_ttl_hours: parseInt(e.target.value) })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-600">jam</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Default: 4320 jam (6 bulan) - provinsi jarang berubah
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cache TTL Kota/Kabupaten
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="24"
                    max="8760"
                    value={settings.address_cities_ttl_hours || 720}
                    onChange={(e) => setSettings({ ...settings, address_cities_ttl_hours: parseInt(e.target.value) })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-600">jam</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Default: 720 jam (30 hari)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cache TTL Kecamatan
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="24"
                    max="8760"
                    value={settings.address_districts_ttl_hours || 720}
                    onChange={(e) => setSettings({ ...settings, address_districts_ttl_hours: parseInt(e.target.value) })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-600">jam</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Default: 720 jam (30 hari)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cache TTL Kelurahan/Desa
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="24"
                    max="8760"
                    value={settings.address_subdistricts_ttl_hours || 720}
                    onChange={(e) => setSettings({ ...settings, address_subdistricts_ttl_hours: parseInt(e.target.value) })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-600">jam</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Default: 720 jam (30 hari)
                </p>
              </div>

              {/* Address Checkboxes */}
              <div className="md:col-span-2 space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.address_auto_cleanup_expired !== false}
                    onChange={(e) => setSettings({ ...settings, address_auto_cleanup_expired: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Otomatis Hapus Cache Alamat Kadaluarsa</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => updateSettings(settings)}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Pengaturan Alamat'}
              </button>
            </div>
          </div>
        )}

        {/* Shipping Cache List Tab */}
        {activeTab === 'shipping-list' && cacheType === 'shipping' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">📦 Cache Ongkir</h2>
              <button
                onClick={loadCacheList}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Memuat...' : '🔄 Refresh'}
              </button>
            </div>

            {cacheSummary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-purple-50 p-4 rounded">
                  <div className="text-2xl font-bold text-purple-600">{cacheSummary.shipping_total || 0}</div>
                  <div className="text-sm text-purple-800">Total Ongkir Cache</div>
                </div>
                <div className="bg-green-50 p-4 rounded">
                  <div className="text-2xl font-bold text-green-600">{(cacheSummary.shipping_total || 0) - (cacheSummary.shipping_expired || 0)}</div>
                  <div className="text-sm text-green-800">Active</div>
                </div>
                <div className="bg-red-50 p-4 rounded">
                  <div className="text-2xl font-bold text-red-600">{cacheSummary.shipping_expired || 0}</div>
                  <div className="text-sm text-red-800">Expired</div>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <div className="text-2xl font-bold text-gray-600">{cacheSummary.oldest_cache}</div>
                  <div className="text-sm text-gray-800">Oldest (days)</div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Weight
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Courier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Age
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cacheList.filter(cache => cache.type === 'shipping').map((cache) => (
                    <tr key={cache.cacheKey} className={cache.is_expired ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cache.origin} → {cache.destination}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cache.weight}g
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cache.courier?.toUpperCase() || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cache.age_days} days
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          cache.is_expired
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {cache.is_expired ? 'Expired' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => deleteCacheEntry(cache.cacheKey)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {cacheList.filter(cache => cache.type === 'shipping').length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Tidak ada cache ongkir yang ditemukan
                </div>
              )}
            </div>
          </div>
        )}

        {/* Address Cache List Tab */}
        {activeTab === 'address-list' && cacheType === 'address' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">🏠 Cache Alamat</h2>
              <button
                onClick={loadCacheList}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Memuat...' : '🔄 Refresh'}
              </button>
            </div>

            {cacheSummary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-orange-50 p-4 rounded">
                  <div className="text-2xl font-bold text-orange-600">{cacheSummary.address_total || 0}</div>
                  <div className="text-sm text-orange-800">Total Address Cache</div>
                </div>
                <div className="bg-green-50 p-4 rounded">
                  <div className="text-2xl font-bold text-green-600">{(cacheSummary.address_total || 0) - (cacheSummary.address_expired || 0)}</div>
                  <div className="text-sm text-green-800">Active</div>
                </div>
                <div className="bg-red-50 p-4 rounded">
                  <div className="text-2xl font-bold text-red-600">{cacheSummary.address_expired || 0}</div>
                  <div className="text-sm text-red-800">Expired</div>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <div className="text-2xl font-bold text-gray-600">{cacheSummary.newest_cache}</div>
                  <div className="text-sm text-gray-800">Newest (days)</div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cache Key
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Age
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cacheList.filter(cache => cache.type === 'address').map((cache) => (
                    <tr key={cache.cacheKey} className={cache.is_expired ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cache.cacheKey}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded bg-orange-100 text-orange-800">
                          {cache.data_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cache.data_count || 0} items
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cache.age_days} days
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          cache.is_expired
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {cache.is_expired ? 'Expired' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => deleteCacheEntry(cache.cacheKey)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {cacheList.filter(cache => cache.type === 'address').length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Tidak ada cache alamat yang ditemukan
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shipping Actions Tab */}
        {activeTab === 'shipping-actions' && cacheType === 'shipping' && (
          <div className="space-y-6">
            {/* Refresh Cache */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-6">🔄 Refresh Cache Ongkir</h2>
              <p className="text-sm text-gray-600 mb-4">
                Paksa refresh cache ongkir untuk rute dan berat tertentu. Berguna jika ada perubahan harga kurir.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <input
                  type="text"
                  placeholder="Origin (city ID)"
                  value={refreshForm.origin}
                  onChange={(e) => setRefreshForm({ ...refreshForm, origin: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Destination (city ID)"
                  value={refreshForm.destination}
                  onChange={(e) => setRefreshForm({ ...refreshForm, destination: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="number"
                  placeholder="Weight (grams)"
                  value={refreshForm.weight}
                  onChange={(e) => setRefreshForm({ ...refreshForm, weight: parseInt(e.target.value) })}
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                />
                <select
                  value={refreshForm.courier}
                  onChange={(e) => setRefreshForm({ ...refreshForm, courier: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Couriers</option>
                  <option value="jne">JNE</option>
                  <option value="jnt">J&T</option>
                  <option value="pos">POS</option>
                  <option value="tiki">TIKI</option>
                  <option value="ide">IDExpress</option>
                  <option value="lion">Lion Parcel</option>
                </select>
              </div>
              <button
                onClick={refreshCache}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : '🔄 Refresh Cache Ongkir'}
              </button>
            </div>

            {/* Cache Cleanup */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-6">🧹 Cache Cleanup Ongkir</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded">
                  <div>
                    <h3 className="font-medium text-yellow-800">Hapus Cache Ongkir Kadaluarsa</h3>
                    <p className="text-sm text-yellow-600">Hapus cache ongkir yang sudah kadaluarsa</p>
                  </div>
                  <button
                    onClick={clearExpiredCache}
                    disabled={loading}
                    className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                  >
                    Hapus Kadaluarsa
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded">
                  <div>
                    <h3 className="font-medium text-red-800">⚠️ Hapus Semua Cache Ongkir</h3>
                    <p className="text-sm text-red-600">BAHAYA: Hapus SEMUA cache ongkir. Ini akan memaksa panggilan API baru!</p>
                  </div>
                  <button
                    onClick={clearAllCache}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    Hapus Semua
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCacheManagement;