import React, { useState, useEffect, useCallback } from 'react';
import { Database, Users, HardDrive, Wifi, AlertTriangle, CheckCircle, Clock, TrendingUp, BarChart3 } from 'lucide-react';
import { FirebaseUsageMonitor, FirebaseUsageStats } from '../../utils/FirebaseUsageMonitor';

interface FirebaseUsageDashboardProps {
  user: any;
  onBack: () => void;
}

const FirebaseUsageDashboard: React.FC<FirebaseUsageDashboardProps> = ({ user, onBack }) => {
  const [usage, setUsage] = useState<FirebaseUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const limits = FirebaseUsageMonitor.getSparkPlanLimits();

  const loadUsage = useCallback(async () => {
    try {
      setError(null);
      console.log('🔄 Loading Firebase usage stats...');

      const usageData = await FirebaseUsageMonitor.getCurrentUsage();
      setUsage(usageData);
      setLastUpdated(new Date());
      console.log('✅ Firebase usage stats loaded:', usageData);
    } catch (err) {
      console.error('❌ Error loading Firebase usage:', err);
      setError('Failed to load Firebase usage stats');
      setUsage(FirebaseUsageMonitor.getEmptyStats());
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data on component mount
  useEffect(() => {
    if (user?.role === 'owner') {
      loadUsage();
    }
  }, [user, loadUsage]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh || user?.role !== 'owner') return;

    const interval = setInterval(() => {
      loadUsage();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, user, loadUsage]);

  if (user?.role !== 'owner') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 text-xl font-semibold mb-2">Akses Ditolak</h2>
            <p className="text-red-600">Hanya pengguna dengan role 'owner' yang bisa mengakses Firebase usage monitor.</p>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">🔥 Firebase Usage Monitor</h1>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading Firebase usage statistics...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !usage) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">🔥 Firebase Usage Monitor</h1>
              <button
                onClick={onBack}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                ← Kembali
              </button>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <div>
                <h3 className="text-red-800 font-semibold">Error Loading Data</h3>
                <p className="text-red-600">{error}</p>
                <button
                  onClick={loadUsage}
                  className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const percentages = usage ? FirebaseUsageMonitor.getUsagePercentages(usage) : {
    firestoreReads: 0,
    firestoreWrites: 0,
    authUsers: 0,
  };

  const getUsageColor = (percentage: number) => {
    if (percentage > 80) return 'bg-red-500';
    if (percentage > 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getUsageTextColor = (percentage: number) => {
    if (percentage > 80) return 'text-red-600';
    if (percentage > 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🔥 Firebase Usage Monitor</h1>
              <p className="text-gray-600 mt-1">Monitor Firebase resource usage and limits</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="autoRefresh" className="text-sm text-gray-600">
                  Auto-refresh
                </label>
              </div>
              <button
                onClick={loadUsage}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                🔄 Refresh
              </button>
              <button
                onClick={onBack}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                ← Kembali
              </button>
            </div>
          </div>
          {lastUpdated && (
            <div className="mt-4 text-sm text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-yellow-800 font-medium">Warning</p>
                <p className="text-yellow-600 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Usage Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Firestore Usage */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-lg border border-orange-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Database className="w-8 h-8 text-orange-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Firestore</h3>
                  <p className="text-sm text-gray-600">Database Operations</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Documents</span>
                  <span className="font-medium">{usage?.firestore.totalDocuments || 0}</span>
                </div>
                <div className="text-xs text-gray-500">
                  Collections: {usage?.firestore.collections.join(', ') || 'None'}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Daily Reads</span>
                  <span className="font-medium">
                    {usage?.firestore.estimatedReads.toLocaleString()}/{limits.firestore.readsPerDay.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(percentages.firestoreReads)}`}
                    style={{ width: `${Math.min(percentages.firestoreReads, 100)}%` }}
                  ></div>
                </div>
                <span className={`text-xs ${getUsageTextColor(percentages.firestoreReads)}`}>
                  {percentages.firestoreReads.toFixed(1)}% used
                </span>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Daily Writes</span>
                  <span className="font-medium">
                    {usage?.firestore.estimatedWrites.toLocaleString()}/{limits.firestore.writesPerDay.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(percentages.firestoreWrites)}`}
                    style={{ width: `${Math.min(percentages.firestoreWrites, 100)}%` }}
                  ></div>
                </div>
                <span className={`text-xs ${getUsageTextColor(percentages.firestoreWrites)}`}>
                  {percentages.firestoreWrites.toFixed(1)}% used
                </span>
              </div>
            </div>
          </div>

          {/* Authentication Usage */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Users className="w-8 h-8 text-blue-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Authentication</h3>
                  <p className="text-sm text-gray-600">User Management</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Monthly Active Users</span>
                  <span className="font-medium">
                    {usage?.auth.totalUsers.toLocaleString()}/{limits.auth.monthlyActiveUsers.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(percentages.authUsers)}`}
                    style={{ width: `${Math.min(percentages.authUsers, 100)}%` }}
                  ></div>
                </div>
                <span className={`text-xs ${getUsageTextColor(percentages.authUsers)}`}>
                  {percentages.authUsers.toFixed(1)}% used
                </span>
              </div>

              <div className="pt-4 border-t border-blue-200">
                <div className="flex items-center space-x-2 text-sm text-blue-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Authentication active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Storage Usage */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <HardDrive className="w-8 h-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Storage</h3>
                  <p className="text-sm text-gray-600">File Storage</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Storage Used</span>
                  <span className="font-medium">{usage?.storage.estimatedSize || 'Unknown'}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Limit: {limits.storage.totalStorage}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Files Count</span>
                  <span className="font-medium">{usage?.storage.totalFiles || 0}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-green-200">
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>📤 Upload/day:</span>
                    <span>{limits.storage.uploadBandwidthPerDay}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>📥 Download/day:</span>
                    <span>{limits.storage.downloadBandwidthPerDay}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => FirebaseUsageMonitor.printUsageReport()}
              className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800 font-medium">Print Usage Report</span>
            </button>
            <button
              onClick={() => {
                FirebaseUsageMonitor.clearCache();
                loadUsage();
              }}
              className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Clock className="w-5 h-5 text-green-600" />
              <span className="text-green-800 font-medium">Clear Cache</span>
            </button>
            <button
              onClick={() => window.open('https://console.firebase.google.com/', '_blank')}
              className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <Wifi className="w-5 h-5 text-purple-600" />
              <span className="text-purple-800 font-medium">Open Firebase Console</span>
            </button>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="text-blue-800 font-semibold mb-2">💡 Optimization Tips</h3>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• Monitor usage regularly to avoid hitting limits</li>
                <li>• Implement efficient caching to reduce Firestore reads</li>
                <li>• Use batch operations for multiple writes</li>
                <li>• Regular cleanup of expired cache data</li>
                <li>• Consider upgrading to Blaze plan for higher limits</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirebaseUsageDashboard;