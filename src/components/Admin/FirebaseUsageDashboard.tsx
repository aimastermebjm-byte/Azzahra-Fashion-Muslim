import React, { useState, useEffect } from 'react';
import { FirebaseUsageMonitor, FirebaseUsageStats } from '../../utils/FirebaseUsageMonitor';

const FirebaseUsageDashboard: React.FC = () => {
  const [usage, setUsage] = useState<FirebaseUsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsageData();
  }, []);

  const loadUsageData = async () => {
    setLoading(true);
    try {
      const usageData = await FirebaseUsageMonitor.getCurrentUsage();
      setUsage(usageData);
    } catch (error) {
      console.error('Error loading usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const limits = FirebaseUsageMonitor.getSparkPlanLimits();

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded mb-4 w-48"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-300 rounded w-64"></div>
            <div className="h-4 bg-gray-300 rounded w-56"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error loading Firebase usage data.
        </div>
      </div>
    );
  }

  const firestoreReadPercentage = (usage.firestore.estimatedReads / limits.firestore.readsPerDay) * 100;
  const firestoreWritePercentage = (usage.firestore.estimatedWrites / limits.firestore.writesPerDay) * 100;
  const userPercentage = (usage.auth.totalUsers / limits.auth.monthlyActiveUsers) * 100;

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">🔥 Firebase Usage Monitor</h2>
        <button
          onClick={loadUsageData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Firestore Usage */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">📊 Firestore</h3>
            <span className="text-2xl">🔥</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Documents</span>
                <span className="font-medium">{usage.firestore.totalDocuments}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Reads/Day</span>
                <span className="font-medium">{usage.firestore.estimatedReads.toLocaleString()}/{limits.firestore.readsPerDay.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    firestoreReadPercentage > 80 ? 'bg-red-500' :
                    firestoreReadPercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(firestoreReadPercentage, 100)}%` }}
                ></div>
              </div>
              <span className="text-xs text-gray-500">{firestoreReadPercentage.toFixed(1)}% used</span>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Writes/Day</span>
                <span className="font-medium">{usage.firestore.estimatedWrites.toLocaleString()}/{limits.firestore.writesPerDay.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    firestoreWritePercentage > 80 ? 'bg-red-500' :
                    firestoreWritePercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(firestoreWritePercentage, 100)}%` }}
                ></div>
              </div>
              <span className="text-xs text-gray-500">{firestoreWritePercentage.toFixed(1)}% used</span>
            </div>
          </div>
        </div>

        {/* Authentication Usage */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">👥 Authentication</h3>
            <span className="text-2xl">🔐</span>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Total Users</span>
              <span className="font-medium">{usage.auth.totalUsers.toLocaleString()}/{limits.auth.monthlyActiveUsers.toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  userPercentage > 80 ? 'bg-red-500' :
                  userPercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(userPercentage, 100)}%` }}
              ></div>
            </div>
            <span className="text-xs text-gray-500">{userPercentage.toFixed(1)}% used</span>
          </div>

          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="text-sm text-gray-600">
              <div>Collections: {usage.firestore.collections.length}</div>
              <div className="text-xs mt-1 text-gray-500">
                {usage.firestore.collections.join(', ')}
              </div>
            </div>
          </div>
        </div>

        {/* Storage Usage */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">💾 Storage</h3>
            <span className="text-2xl">📦</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Storage Used</span>
                <span className="font-medium">Unknown</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Limit: {limits.storage.totalStorage}</div>
            </div>

            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Files Count</span>
                <span className="font-medium">{usage.storage.totalFiles}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-green-200">
            <div className="text-xs text-gray-500">
              <div>📤 Upload: {limits.storage.uploadBandwidthPerDay}/day</div>
              <div>📥 Download: {limits.storage.downloadBandwidthPerDay}/day</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <strong>Tip:</strong> Monitor usage regularly to avoid hitting limits
          </div>
          <button
            onClick={() => {
              FirebaseUsageMonitor.printUsageReport();
            }}
            className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition"
          >
            📋 Console Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirebaseUsageDashboard;