import { collection, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
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

  async fetchUsers(): Promise<AdminUser[]> {
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
          lastLoginAt: data.lastLoginAt || ''
        });
      });
      writeCache(users);
      return users;
    } catch (err) {
      console.error('❌ Error fetching users from Firestore:', err);
      throw err;
    }
  }
};
