import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebaseClient';

export interface FirebaseUsageStats {
  firestore: {
    totalDocuments: number;
    collections: string[];
    estimatedReads: number;
    estimatedWrites: number;
  };
  storage: {
    totalFiles: number;
    estimatedSize: string;
  };
  auth: {
    totalUsers: number;
  };
}

export class FirebaseUsageMonitor {
  private static cachedStats: FirebaseUsageStats | null = null;
  private static lastUpdate: number = 0;
  private static readonly CACHE_DURATION = 30000; // 30 seconds cache

  // Optimized version with static data to prevent hanging
  static async getCurrentUsage(): Promise<FirebaseUsageStats> {
    const now = Date.now();

    // Return cached data if still fresh
    if (this.cachedStats && (now - this.lastUpdate) < this.CACHE_DURATION) {
      console.log('📊 Using cached Firebase usage stats');
      return this.cachedStats;
    }

    console.log('📊 Fetching fresh Firebase usage stats');

    try {
      // Use lightweight static data for performance
      const stats: FirebaseUsageStats = {
        firestore: {
          totalDocuments: 0,
          collections: [],
          estimatedReads: 0,
          estimatedWrites: 0,
        },
        storage: {
          totalFiles: 0,
          estimatedSize: '0 MB',
        },
        auth: {
          totalUsers: 0,
        },
      };

      // Quick count of main collections (non-blocking)
      const mainCollections = ['users', 'products', 'carts', 'orders', 'shippingCache'];
      let totalDocs = 0;
      let totalReads = 0;
      let totalWrites = 0;

      // Use Promise.all with timeout to prevent hanging
      const collectionPromises = mainCollections.map(async (collectionName) => {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 2000)
          );

          const queryPromise = getDocs(collection(db, collectionName));
          const snapshot = await Promise.race([queryPromise, timeoutPromise]) as any;

          const docCount = snapshot.size;
          totalDocs += docCount;
          totalReads += Math.ceil(docCount / 10); // Estimate reads
          totalWrites += Math.ceil(docCount / 20); // Estimate writes

          return collectionName;
        } catch (error) {
          console.warn(`Could not count ${collectionName}:`, error);
          return null;
        }
      });

      // Wait for all collections with timeout
      const results = await Promise.race([
        Promise.all(collectionPromises),
        new Promise(resolve => setTimeout(() => resolve([]), 5000))
      ]);

      const validCollections = results.filter(Boolean);

      stats.firestore = {
        totalDocuments: totalDocs,
        collections: validCollections,
        estimatedReads: totalReads * 2, // Rough daily estimate
        estimatedWrites: totalWrites,   // Rough daily estimate
      };

      // Static estimates for storage and auth
      stats.storage = {
        totalFiles: Math.max(5, Math.floor(totalDocs / 10)),
        estimatedSize: totalDocs > 100 ? `${(totalDocs * 2.5).toFixed(1)} MB` : '~2.5 MB',
      };

      stats.auth = {
        totalUsers: Math.max(1, Math.floor(totalDocs / 15)),
      };

      // Cache the results
      this.cachedStats = stats;
      this.lastUpdate = now;

      console.log('📊 Firebase usage stats updated:', stats);
      return stats;

    } catch (error) {
      console.error('❌ Error getting Firebase usage:', error);
      return this.getEmptyStats();
    }
  }

  static getEmptyStats(): FirebaseUsageStats {
    return {
      firestore: {
        totalDocuments: 0,
        collections: [],
        estimatedReads: 0,
        estimatedWrites: 0,
      },
      storage: {
        totalFiles: 0,
        estimatedSize: '0 MB',
      },
      auth: {
        totalUsers: 0,
      },
    };
  }

  static getSparkPlanLimits() {
    return {
      firestore: {
        storage: '1 GiB',
        readsPerDay: 50000,
        writesPerDay: 20000,
        deletesPerDay: 20000,
      },
      storage: {
        totalStorage: '1 GB',
        downloadBandwidthPerDay: '10 GB',
        uploadBandwidthPerDay: '20 GB',
      },
      auth: {
        monthlyActiveUsers: 10000,
      },
    };
  }

  static async printUsageReport() {
    try {
      const usage = await this.getCurrentUsage();
      const limits = this.getSparkPlanLimits();

      console.group('🔥 Firebase Usage Report');
      console.log('📊 Firestore Usage:');
      console.log(`  Documents: ${usage.firestore.totalDocuments}`);
      console.log(`  Collections: ${usage.firestore.collections.length}`);
      console.log(`  Est. Reads/Day: ${usage.firestore.estimatedReads}/${limits.firestore.readsPerDay}`);
      console.log(`  Est. Writes/Day: ${usage.firestore.estimatedWrites}/${limits.firestore.writesPerDay}`);

      console.log('👥 Authentication:');
      console.log(`  Total Users: ${usage.auth.totalUsers}/${limits.auth.monthlyActiveUsers}`);

      console.log('💾 Storage:');
      console.log(`  Usage: ${usage.storage.estimatedSize}/${limits.storage.totalStorage}`);
      console.groupEnd();
    } catch (error) {
      console.error('❌ Error generating usage report:', error);
    }
  }

  // Clear cache manually if needed
  static clearCache() {
    this.cachedStats = null;
    this.lastUpdate = 0;
    console.log('📊 Firebase usage cache cleared');
  }

  // Get usage percentages for UI display
  static getUsagePercentages(usage: FirebaseUsageStats) {
    const limits = this.getSparkPlanLimits();

    return {
      firestoreReads: (usage.firestore.estimatedReads / limits.firestore.readsPerDay) * 100,
      firestoreWrites: (usage.firestore.estimatedWrites / limits.firestore.writesPerDay) * 100,
      authUsers: (usage.auth.totalUsers / limits.auth.monthlyActiveUsers) * 100,
    };
  }
}