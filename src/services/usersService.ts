import { collection, getDocs, query, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  gender?: 'male' | 'female'; // Added gender field
  status: string;
  joinDate?: string;
  totalOrders?: number;
  totalSpent?: number;
  points?: number;
  lastLoginAt?: string;
}

const CACHE_KEY = 'users-cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 menit

const readCache = (): AdminUser[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: AdminUser[]; timestamp: number };
    if (!parsed?.data) return null;
    // With realtime listener, TTL is less critical as onSnapshot will handle updates
    // But for initial "offline" render, it's useful
    const expired = Date.now() - parsed.timestamp > CACHE_TTL;
    if (expired) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch (err) {
    console.error('❌ Error reading users cache:', err);
    return null;
  }
};

const writeCache = (data: AdminUser[]) => {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch (err) {
    console.error('❌ Error writing users cache:', err);
  }
};

export const usersService = {
  getCachedUsers(): AdminUser[] | null {
    return readCache();
  },

  subscribeToUsers(
    callback: (data: { users: AdminUser[]; loading: boolean; error: Error | null }) => void,
    limitCount: number = 50
  ): () => void {
    // Initial state from cache
    const cached = readCache();
    if (cached) {
      callback({ users: cached, loading: true, error: null });
    } else {
      callback({ users: [], loading: true, error: null });
    }

    try {
      // Optimization: Limit users to 50 latest for dashboard view
      // If store grows large, this prevents reading 1000+ users on load
      // Note: Removed orderBy to include users without createdAt field
      // Sorting is now done client-side after fetch
      const q = query(
        collection(db, 'users'),
        limit(limitCount)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const users: AdminUser[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            users.push({
              id: docSnap.id,
              name: data.name || data.displayName || 'Pengguna',
              email: data.email || 'no-email',
              phone: data.phone || data.phoneNumber || '',
              role: data.role || 'customer',
              status: data.status || 'active',
              joinDate: data.createdAt || data.joinDate || '',
              totalOrders: Number(data.totalOrders || 0),
              totalSpent: Number(data.totalSpent || 0),
              points: Number(data.points || data.resellerPoints || 0),
              lastLoginAt: data.lastLoginAt || '',
              gender: data.gender || 'male'
            });
          });

          // Update cache
          writeCache(users);

          callback({ users, loading: false, error: null });
        },
        (err) => {
          console.error('❌ Error subscribing to users:', err);
          callback({ users: cached || [], loading: false, error: err as Error });
        }
      );

      return unsubscribe;
    } catch (err) {
      console.error('❌ Failed to setup users subscription:', err);
      callback({ users: [], loading: false, error: err as Error });
      return () => { };
    }
  },

  async fetchUsers(): Promise<AdminUser[]> {
    // Fallback fetch method (kept for compatibility/full fetches if needed)
    try {
      const snap = await getDocs(collection(db, 'users'));
      const users: AdminUser[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        users.push({
          id: docSnap.id,
          name: data.name || data.displayName || 'Pengguna',
          email: data.email || 'no-email',
          phone: data.phone || data.phoneNumber || '',
          role: data.role || 'customer',
          status: data.status || 'active',
          joinDate: data.createdAt || data.joinDate || '',
          totalOrders: Number(data.totalOrders || 0),
          totalSpent: Number(data.totalSpent || 0),
          points: Number(data.points || data.resellerPoints || 0),
          lastLoginAt: data.lastLoginAt || '',
          gender: data.gender || 'male'
        });
      });
      writeCache(users);
      return users;
    } catch (err) {
      console.error('❌ Error fetching users from Firestore:', err);
      throw err;
    }
  },

  async getUserById(userId: string): Promise<AdminUser | null> {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data() as any;
        return {
          id: userSnap.id,
          name: data.name || data.displayName || 'Pengguna',
          email: data.email || 'no-email',
          phone: data.phone || data.phoneNumber || '',
          role: data.role || 'customer',
          status: data.status || 'active',
          joinDate: data.createdAt || data.joinDate || '',
          totalOrders: Number(data.totalOrders || 0),
          totalSpent: Number(data.totalSpent || 0),
          points: Number(data.points || data.resellerPoints || 0),
          lastLoginAt: data.lastLoginAt || '',
          gender: data.gender || 'male'
        };
      }
      return null;
    } catch (err) {
      console.error('❌ Error fetching user by ID:', err);
      return null;
    }
  },

  async updateUser(userId: string, data: Partial<AdminUser>): Promise<void> {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const userRef = doc(db, 'users', userId);

      await updateDoc(userRef, {
        ...data,
        updatedAt: new Date().toISOString()
      });

      console.log('✅ User updated successfully:', userId);
    } catch (err) {
      console.error('❌ Error updating user:', err);
      throw err;
    }
  },

  async deleteUser(userId: string): Promise<void> {
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'users', userId));
      console.log('✅ User deleted successfully:', userId);
    } catch (err) {
      console.error('❌ Error deleting user:', err);
      throw err;
    }
  }
};
