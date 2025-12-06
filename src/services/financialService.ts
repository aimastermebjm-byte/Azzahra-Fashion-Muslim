import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export type FinancialType = 'income' | 'expense';

export interface FinancialCategory {
  id: string;
  name: string;
  type: FinancialType;
  isActive?: boolean;
}

export interface FinancialEntry {
  id: string;
  type: FinancialType;
  amount: number;
  category: string;
  note?: string;
  includeInPnL: boolean;
  createdAt?: Timestamp | Date | string | null;
  effectiveDate?: Timestamp | Date | string | null;
  createdBy?: string;
  createdByRole?: string;
}

const CATEGORY_CACHE_KEY = 'financial-categories-permanent';

const readCategoryCache = (): FinancialCategory[] | null => {
  try {
    const raw = localStorage.getItem(CATEGORY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FinancialCategory[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch (err) {
    console.error('⚠️ Failed to read category cache', err);
    return null;
  }
};

const writeCategoryCache = (categories: FinancialCategory[]) => {
  try {
    localStorage.setItem(CATEGORY_CACHE_KEY, JSON.stringify(categories));
  } catch (err) {
    console.error('⚠️ Failed to write category cache', err);
  }
};

export interface ListEntriesResult {
  entries: FinancialEntry[];
  cursor: DocumentSnapshot | null;
  hasMore: boolean;
}

export const financialService = {
  async listCategories(): Promise<FinancialCategory[]> {
    const cached = readCategoryCache();
    if (cached) return cached;

    const snap = await getDocs(query(collection(db, 'financial_categories'), orderBy('createdAt', 'desc')));
    const categories: FinancialCategory[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      categories.push({
        id: docSnap.id,
        name: data.name || 'Tanpa nama',
        type: data.type || 'expense',
        isActive: data.isActive ?? true
      });
    });
    writeCategoryCache(categories);
    return categories;
  },

  async addCategory(name: string, type: FinancialType, createdBy?: string, createdByRole?: string): Promise<FinancialCategory> {
    const docRef = await addDoc(collection(db, 'financial_categories'), {
      name,
      type,
      isActive: true,
      createdAt: serverTimestamp(),
      createdBy: createdBy || null,
      createdByRole: createdByRole || null
    });

    const newCategory: FinancialCategory = { id: docRef.id, name, type, isActive: true };
    const cached = readCategoryCache() || [];
    writeCategoryCache([newCategory, ...cached]);
    return newCategory;
  },

  async listEntries(options?: { pageSize?: number; cursor?: DocumentSnapshot | null }): Promise<ListEntriesResult> {
    const size = options?.pageSize ?? 10;
    const baseQuery = query(
      collection(db, 'financial_entries'),
      orderBy('createdAt', 'desc'),
      ...(options?.cursor ? [startAfter(options.cursor)] : []),
      limit(size)
    );

    const snap = await getDocs(baseQuery);
    const entries: FinancialEntry[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      entries.push({
        id: docSnap.id,
        type: data.type,
        amount: Number(data.amount || 0),
        category: data.category,
        note: data.note,
        includeInPnL: !!data.includeInPnL,
        createdAt: data.createdAt || null,
        effectiveDate: data.effectiveDate || null,
        createdBy: data.createdBy,
        createdByRole: data.createdByRole
      });
    });

    return {
      entries,
      cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
      hasMore: snap.docs.length === size
    };
  },

  async addEntry(entry: {
    type: FinancialType;
    amount: number;
    category: string;
    note?: string;
    includeInPnL: boolean;
    effectiveDate?: string | Date | null;
    createdBy?: string;
    createdByRole?: string;
  }): Promise<FinancialEntry> {
    const payload = {
      ...entry,
      createdAt: serverTimestamp(),
      effectiveDate: entry.effectiveDate ? new Date(entry.effectiveDate) : null
    };

    const docRef = await addDoc(collection(db, 'financial_entries'), payload);

    return {
      id: docRef.id,
      type: entry.type,
      amount: entry.amount,
      category: entry.category,
      note: entry.note,
      includeInPnL: entry.includeInPnL,
      createdAt: new Date(),
      effectiveDate: entry.effectiveDate ? new Date(entry.effectiveDate) : null,
      createdBy: entry.createdBy,
      createdByRole: entry.createdByRole
    };
  },

  async deleteEntry(id: string): Promise<void> {
    await deleteDoc(doc(db, 'financial_entries', id));
  }

  async deleteCategory(id: string): Promise<void> {
    await deleteDoc(doc(db, 'financial_categories', id));
    const cached = readCategoryCache();
    if (cached) {
      writeCategoryCache(cached.filter((cat) => cat.id !== id));
    }
  }
};
