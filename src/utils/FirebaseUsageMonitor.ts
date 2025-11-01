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
  static async getCurrentUsage(): Promise<FirebaseUsageStats> {
    try {
      // Count Firestore documents
      const collections = ['users', 'products', 'carts', 'orders', 'addressCache', 'shippingCache'];
      let totalDocuments = 0;
      const collectionStats: { [key: string]: number } = {};

      for (const collectionName of collections) {
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          collectionStats[collectionName] = snapshot.size;
          totalDocuments += snapshot.size;
        } catch (error) {
          console.log(`Collection ${collectionName} not accessible`);
        }
      }

      // Get user count from auth (estimated from users collection)
      const userCount = collectionStats['users'] || 0;

      return {
        firestore: {
          totalDocuments,
          collections: Object.keys(collectionStats),
          estimatedReads: totalDocuments * 2, // Rough estimate
          estimatedWrites: Math.floor(totalDocuments * 0.3), // Rough estimate
        },
        storage: {
          totalFiles: 0, // Would need Storage API access
          estimatedSize: 'Unknown',
        },
        auth: {
          totalUsers: userCount,
        },
      };
    } catch (error) {
      console.error('Error getting Firebase usage:', error);
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
  }
}