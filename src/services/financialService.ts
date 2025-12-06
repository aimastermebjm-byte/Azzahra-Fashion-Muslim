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
  paymentMethodId?: string | null;
  paymentMethodName?: string | null;
  note?: string;
  includeInPnL: boolean;
  createdAt?: Timestamp | Date | string | null;
  effectiveDate?: Timestamp | Date | string | null;
  createdBy?: string;
  createdByRole?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  isActive?: boolean;
}

const CATEGORY_CACHE_KEY = 'financial-categories-permanent';
const PAYMENT_METHOD_CACHE_KEY = 'financial-payment-methods-permanent';

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

const readPaymentMethodCache = (): PaymentMethod[] | null => {
  try {
    const raw = localStorage.getItem(PAYMENT_METHOD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PaymentMethod[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch (err) {
    console.error('⚠️ Failed to read payment method cache', err);
    return null;
  }
};

const writePaymentMethodCache = (methods: PaymentMethod[]) => {
  try {
    localStorage.setItem(PAYMENT_METHOD_CACHE_KEY, JSON.stringify(methods));
  } catch (err) {
    console.error('⚠️ Failed to write payment method cache', err);
  }
};

const addPaymentMethodDoc = async (
  name: string,
  createdBy?: string,
  createdByRole?: string
): Promise<PaymentMethod> => {
  const docRef = await addDoc(collection(db, 'financial_payment_methods'), {
    name,
    isActive: true,
    createdAt: serverTimestamp(),
    createdBy: createdBy || null,
    createdByRole: createdByRole || null
  });

  return { id: docRef.id, name, isActive: true };
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

  async listPaymentMethods(): Promise<PaymentMethod[]> {
    const cached = readPaymentMethodCache();
    if (cached) return cached;

    const snap = await getDocs(query(collection(db, 'financial_payment_methods'), orderBy('createdAt', 'desc')));
    const methods: PaymentMethod[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      methods.push({
        id: docSnap.id,
        name: data.name || 'Tanpa nama',
        isActive: data.isActive ?? true
      });
    });
    writePaymentMethodCache(methods);
    return methods;
  },

  async addPaymentMethod(name: string, createdBy?: string, createdByRole?: string): Promise<PaymentMethod> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Nama metode wajib diisi');
    }

    const created = await addPaymentMethodDoc(trimmedName, createdBy, createdByRole);
    const cached = readPaymentMethodCache() || [];
    writePaymentMethodCache([created, ...cached]);
    return created;
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
        paymentMethodId: data.paymentMethodId || null,
        paymentMethodName: data.paymentMethodName || null,
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
    paymentMethodId: string;
    paymentMethodName?: string;
    note?: string;
    includeInPnL: boolean;
    effectiveDate?: string | Date | null;
    createdBy?: string;
    createdByRole?: string;
  }): Promise<FinancialEntry> {
    const payload = {
      ...entry,
      createdAt: serverTimestamp(),
      effectiveDate: entry.effectiveDate ? new Date(entry.effectiveDate) : null,
      paymentMethodName: entry.paymentMethodName || null
    };

    const docRef = await addDoc(collection(db, 'financial_entries'), payload);

    return {
      id: docRef.id,
      type: entry.type,
      amount: entry.amount,
      category: entry.category,
      paymentMethodId: entry.paymentMethodId,
      paymentMethodName: entry.paymentMethodName || null,
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
  },

  async deleteCategory(id: string): Promise<void> {
    await deleteDoc(doc(db, 'financial_categories', id));
    const cached = readCategoryCache();
    if (cached) {
      writeCategoryCache(cached.filter((cat) => cat.id !== id));
    }
  },

  async deletePaymentMethod(id: string): Promise<void> {
    if (!id) {
      throw new Error('ID metode pembayaran tidak valid');
    }

    await deleteDoc(doc(db, 'financial_payment_methods', id));
    const cached = readPaymentMethodCache();
    if (cached) {
      writePaymentMethodCache(cached.filter((method) => method.id !== id));
    }
  }
};
