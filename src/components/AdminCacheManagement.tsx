import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';

interface CacheSettings {
  cache_ttl_hours: number;
  max_cache_age_days: number;
  auto_cleanup_expired: boolean;
  refresh_all_couriers: boolean;
  notify_on_price_change: boolean;
  updated_at?: string;
  updated_by?: string;
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
  const [activeTab, setActiveTab] = useState<'settings' | 'list' | 'actions'>('settings');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Settings state
  const [settings, setSettings] = useState<CacheSettings>({
    cache_ttl_hours: 30 * 24, // 1 month default
    max_cache_age_days: 60,
    auto_cleanup_expired: true,
    refresh_all_couriers: true,
    notify_on_price_change: false
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
      const response = await fetch('/api/admin/cache-settings?action=settings', {
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
      const response = await fetch('/api/admin/cache-settings?action=list', {
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
      const response = await fetch('/api/admin/cache-settings', {
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
      const response = await fetch('/api/admin/cache-settings', {
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
    if (!confirm('Are you sure you want to clear all expired cache entries?')) return;

    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/admin/cache-settings?action=clear_expired', {
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
    if (!confirm('⚠️ DANGER: This will clear ALL cache entries and force fresh API calls. Continue?')) return;

    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/admin/cache-settings?action=clear_all', {
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

  // Delete specific cache entry
  const deleteCacheEntry = async (cacheKey: string) => {
    if (!confirm(`Delete cache entry: ${cacheKey}?`)) return;

    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/admin/cache-settings?action=clear_specific&cache_key=${encodeURIComponent(cacheKey)}`, {
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
    if (hours < 24) return `${hours} hours`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days} days`;
    return `${days} days ${remainingHours} hours`;
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
            <h2 className="text-red-800 text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-red-600">Only users with 'owner' role can access cache management.</p>
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
              <h1 className="text-2xl font-bold text-gray-900">🗄️ Cache Management</h1>
              <p className="text-gray-600 mt-1">Manage shipping cost cache settings and monitor performance</p>
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              ← Back to Admin
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

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                ⚙️ Settings
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'list'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📋 Cache List
              </button>
              <button
                onClick={() => setActiveTab('actions')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'actions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🔄 Actions
              </button>
            </nav>
          </div>
        </div>

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-6">Cache Configuration</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cache TTL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cache TTL (Time To Live)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="8760"
                    value={settings.cache_ttl_hours}
                    onChange={(e) => setSettings({ ...settings, cache_ttl_hours: parseInt(e.target.value) })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-600">hours</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Current: {formatDuration(settings.cache_ttl_hours)}
                </p>
              </div>

              {/* Max Cache Age */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Cache Age
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={settings.max_cache_age_days}
                    onChange={(e) => setSettings({ ...settings, max_cache_age_days: parseInt(e.target.value) })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-600">days</span>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="md:col-span-2 space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.auto_cleanup_expired}
                    onChange={(e) => setSettings({ ...settings, auto_cleanup_expired: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Auto cleanup expired cache entries</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.refresh_all_couriers}
                    onChange={(e) => setSettings({ ...settings, refresh_all_couriers: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Refresh all couriers when updating cache</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.notify_on_price_change}
                    onChange={(e) => setSettings({ ...settings, notify_on_price_change: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Notify when cache prices change</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => updateSettings(settings)}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}

        {/* Cache List Tab */}
        {activeTab === 'list' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">Cache Entries</h2>
              <button
                onClick={loadCacheList}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : '🔄 Refresh'}
              </button>
            </div>

            {cacheSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded">
                  <div className="text-2xl font-bold text-blue-600">{cacheSummary.total}</div>
                  <div className="text-sm text-blue-800">Total Cache</div>
                </div>
                <div className="bg-green-50 p-4 rounded">
                  <div className="text-2xl font-bold text-green-600">{cacheSummary.active}</div>
                  <div className="text-sm text-green-800">Active</div>
                </div>
                <div className="bg-red-50 p-4 rounded">
                  <div className="text-2xl font-bold text-red-600">{cacheSummary.expired}</div>
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
                  {cacheList.map((cache) => (
                    <tr key={cache.cacheKey} className={cache.is_expired ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cache.origin} → {cache.destination}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cache.weight}g
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cache.courier.toUpperCase()}
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
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {cacheList.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No cache entries found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions Tab */}
        {activeTab === 'actions' && (
          <div className="space-y-6">
            {/* Refresh Cache */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-6">🔄 Refresh Cache</h2>
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
                  <option value="sicepat">SiCepat</option>
                  <option value="wahana">Wahana</option>
                </select>
              </div>
              <button
                onClick={refreshCache}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : '🔄 Refresh Cache'}
              </button>
            </div>

            {/* Cache Cleanup */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-6">🧹 Cache Cleanup</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded">
                  <div>
                    <h3 className="font-medium text-yellow-800">Clear Expired Cache</h3>
                    <p className="text-sm text-yellow-600">Remove cache entries that have expired</p>
                  </div>
                  <button
                    onClick={clearExpiredCache}
                    disabled={loading}
                    className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                  >
                    Clear Expired
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded">
                  <div>
                    <h3 className="font-medium text-red-800">⚠️ Clear All Cache</h3>
                    <p className="text-sm text-red-600">DANGER: Remove ALL cache entries. This will force fresh API calls!</p>
                  </div>
                  <button
                    onClick={clearAllCache}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    Clear All
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