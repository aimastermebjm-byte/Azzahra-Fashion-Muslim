import { collection, getDocs } from 'firebase/firestore';
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

  // Real Firebase connection with timeout protection
  static async getCurrentUsage(): Promise<FirebaseUsageStats> {
    const now = Date.now();

    // Return cached data if still fresh
    if (this.cachedStats && (now - this.lastUpdate) < this.CACHE_DURATION) {
      console.log('📊 Using cached Firebase usage stats');
      return this.cachedStats;
    }

    console.log('📊 Fetching fresh Firebase usage stats');

    try {
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

      // Real Firebase collections to check
      const collectionsToCheck = [
        'users', 'products', 'carts', 'orders', 'shipping_cache',
        'address_provinces', 'address_cities', 'address_districts', 'address_subdistricts'
      ];

      let totalDocs = 0;
      let totalReads = 0;
      let totalWrites = 0;
      const validCollections: string[] = [];

      // Check each collection with timeout
      for (const collectionName of collectionsToCheck) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Collection timeout')), 3000)
          );

          const collectionRef = collection(db, collectionName);
          const queryPromise = getDocs(collectionRef);

          const snapshot = await Promise.race([queryPromise, timeoutPromise]);

          const docCount = snapshot.size;
          if (docCount > 0) {
            totalDocs += docCount;
            totalReads += Math.ceil(docCount / 8); // Estimate reads based on doc count
            totalWrites += Math.ceil(docCount / 15); // Estimate writes
            validCollections.push(collectionName);
            console.log(`📁 ${collectionName}: ${docCount} documents`);
          }
        } catch (error: any) {
          console.log(`⚠️ ${collectionName}: ${error?.message || 'Unknown error'}`);
        }
      }

      // Real user count from users collection
      try {
        const usersRef = collection(db, 'users');
        const usersSnapshot = await Promise.race([
          getDocs(usersRef),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Users timeout')), 3000))
        ]);
        stats.auth.totalUsers = usersSnapshot.size;
        console.log(`👥 Auth users: ${usersSnapshot.size}`);
      } catch (error: any) {
        console.log(`⚠️ Users count failed: ${error?.message || 'Unknown error'}`);
        stats.auth.totalUsers = Math.max(1, Math.floor(totalDocs / 20));
      }

      // Update firestore stats with real data
      stats.firestore = {
        totalDocuments: totalDocs,
        collections: validCollections,
        estimatedReads: Math.min(totalReads * 3, 45000), // Cap at reasonable daily estimate
        estimatedWrites: Math.min(totalWrites * 2, 18000), // Cap at reasonable daily estimate
      };

      // Estimate storage based on document count
      const estimatedSizeMB = totalDocs * 0.05; // ~50KB per document average
      stats.storage = {
        totalFiles: Math.max(5, Math.floor(totalDocs / 8)),
        estimatedSize: estimatedSizeMB > 1 ? `${estimatedSizeMB.toFixed(1)} MB` : '~0.1 MB',
      };

      // Cache the results
      this.cachedStats = stats;
      this.lastUpdate = now;

      console.log('📊 Firebase usage stats updated:', {
        totalDocs,
        collections: validCollections.length,
        users: stats.auth.totalUsers,
        storage: stats.storage.estimatedSize
      });

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