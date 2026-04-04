// Service untuk mengelola kategori produk
import { db } from '../utils/firebaseClient';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';

export interface ProductCategory {
  id: string;
  name: string;
  icon?: string; // path to icon file, e.g. '/icons/hijab-icon.png'
  isActive: boolean;
}

const COLLECTION_NAME = 'product_categories';
const CACHE_KEY = 'product_categories_cache';

// Cache helpers
const readCache = (): ProductCategory[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductCategory[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch (err) {
    console.error('⚠️ Failed to read product category cache', err);
    return null;
  }
};

const writeCache = (categories: ProductCategory[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(categories));
  } catch (err) {
    console.error('⚠️ Failed to write product category cache', err);
  }
};

export const productCategoryService = {
  /**
   * List all product categories
   */
  async listCategories(): Promise<ProductCategory[]> {
    // Try cache first
    const cached = readCache();
    if (cached) {

      return cached;
    }

    // Fetch from Firestore
    const snap = await getDocs(query(collection(db, COLLECTION_NAME), orderBy('name', 'asc')));
    const categories: ProductCategory[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      categories.push({
        id: docSnap.id,
        name: data.name || 'Tanpa nama',
        icon: data.icon || undefined,
        isActive: data.isActive ?? true
      });
    });

    // Cache the result
    writeCache(categories);

    return categories;
  },

  /**
   * Add new product category
   */
  async addCategory(
    name: string,
    createdBy?: string,
    createdByRole?: string,
    icon?: string
  ): Promise<ProductCategory> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Nama kategori tidak boleh kosong');
    }

    // Check duplicate
    const existing = await this.listCategories();
    const duplicate = existing.find(
      (cat) => cat.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Kategori "${trimmedName}" sudah ada`);
    }

    // Add to Firestore
    const docData: any = {
      name: trimmedName,
      isActive: true,
      createdAt: serverTimestamp(),
      createdBy: createdBy || null,
      createdByRole: createdByRole || null
    };
    if (icon) {
      docData.icon = icon;
    }
    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);

    const newCategory: ProductCategory = {
      id: docRef.id,
      name: trimmedName,
      icon: icon || undefined,
      isActive: true
    };

    // Update cache
    const cached = readCache() || [];
    writeCache([newCategory, ...cached]);

    return newCategory;
  },

  /**
   * Delete product category
   */
  async deleteCategory(categoryId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_NAME, categoryId));

    // Update cache
    const cached = readCache() || [];
    writeCache(cached.filter((cat) => cat.id !== categoryId));


  },

  /**
   * Update product category (name, icon)
   */
  async updateCategory(categoryId: string, updates: { name?: string; icon?: string }): Promise<void> {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.icon !== undefined) updateData.icon = updates.icon;

    await updateDoc(doc(db, COLLECTION_NAME, categoryId), updateData);

    // Update cache
    const cached = readCache() || [];
    writeCache(cached.map((cat) => {
      if (cat.id === categoryId) {
        return { ...cat, ...updates };
      }
      return cat;
    }));
  },

  /**
   * Clear cache
   */
  clearCache(): void {
    localStorage.removeItem(CACHE_KEY);

  },

  /**
   * Initialize default categories (run once)
   */
  async initializeDefaultCategories(): Promise<void> {
    try {
      const existing = await this.listCategories();

      // Default categories yang sudah ada di sistem
      const defaultCategories = [
        { name: 'Hijab', icon: '🧕' },
        { name: 'Gamis', icon: '👗' },
        { name: 'Khimar', icon: '🧕' },
        { name: 'Tunik', icon: '👚' },
        { name: 'Aksesoris', icon: '✨' }
      ];

      // Add only if not exists
      for (const cat of defaultCategories) {
        const exists = existing.find(e =>
          e.name.toLowerCase() === cat.name.toLowerCase()
        );

        if (!exists) {
          await this.addCategory(cat.name, 'system', 'system');

        }
      }


    } catch (error) {
      console.error('❌ Failed to initialize default categories:', error);
    }
  }
};
