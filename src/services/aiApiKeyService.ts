/**
 * AI API Key Service
 * Manages storage of Gemini/GLM API keys in Firestore for cross-device synchronization
 * API keys are encrypted before storage for security
 */

import { 
  collection, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { getAuth } from 'firebase/auth';

export interface AIApiKeyRecord {
  id: string;                     // userId
  userId: string;
  geminiApiKeyEncrypted?: string; // Encrypted Gemini API key
  glmApiKeyEncrypted?: string;    // Encrypted GLM API key
  lastUpdated: any;               // Firestore Timestamp
  updatedBy: string;              // User email or name
  version: number;                // Schema version for future migrations
}

class AIApiKeyService {
  private readonly COLLECTION = 'aiApiKeys';

  /**
   * Get current authenticated user ID
   * Throws error if user is not authenticated
   */
  private getCurrentUserId(): string {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated. Please login first.');
    }
    
    return user.uid;
  }

  /**
   * Save encrypted API key to Firestore (global storage)
   * @param type 'gemini' | 'glm'
   * @param encryptedKey Encrypted API key (use EncryptionService.encryptAPIKey)
   * @returns Promise<void>
   */
  async saveGlobalApiKey(type: 'gemini' | 'glm', encryptedKey: string): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      const docRef = doc(db, this.COLLECTION, userId);
      
      const updateData: Partial<AIApiKeyRecord> = {
        id: userId,
        userId,
        lastUpdated: serverTimestamp(),
        updatedBy: getAuth().currentUser?.email || 'unknown',
        version: 1
      };
      
      if (type === 'gemini') {
        updateData.geminiApiKeyEncrypted = encryptedKey;
      } else {
        updateData.glmApiKeyEncrypted = encryptedKey;
      }
      
      // Use setDoc with merge to update or create
      await setDoc(docRef, updateData, { merge: true });
      
      console.log(`✅ ${type.toUpperCase()} API key saved globally for user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to save global ${type} API key:`, error);
      throw error;
    }
  }

  /**
   * Load encrypted API key from Firestore (global storage)
   * @param type 'gemini' | 'glm'
   * @returns Promise<string | null> Encrypted key or null if not found
   */
  async loadGlobalApiKey(type: 'gemini' | 'glm'): Promise<string | null> {
    try {
      const userId = this.getCurrentUserId();
      const docRef = doc(db, this.COLLECTION, userId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        console.log(`ℹ️ No global ${type} API key found for user ${userId}`);
        return null;
      }
      
      const data = docSnap.data() as AIApiKeyRecord;
      const encryptedKey = type === 'gemini' 
        ? data.geminiApiKeyEncrypted 
        : data.glmApiKeyEncrypted;
      
      if (!encryptedKey) {
        console.log(`ℹ️ Global ${type} API key exists but empty for user ${userId}`);
        return null;
      }
      
      console.log(`✅ Loaded global ${type} API key for user ${userId}`);
      return encryptedKey;
    } catch (error) {
      console.error(`❌ Failed to load global ${type} API key:`, error);
      // Don't throw error - fallback to localStorage
      return null;
    }
  }

  /**
   * Check if global API key exists in Firestore
   * @param type 'gemini' | 'glm'
   * @returns Promise<boolean>
   */
  async hasGlobalApiKey(type: 'gemini' | 'glm'): Promise<boolean> {
    try {
      const encryptedKey = await this.loadGlobalApiKey(type);
      return encryptedKey !== null;
    } catch (error) {
      console.error(`❌ Failed to check global ${type} API key:`, error);
      return false;
    }
  }

  /**
   * Remove API key from global storage
   * @param type 'gemini' | 'glm'
   * @returns Promise<void>
   */
  async removeGlobalApiKey(type: 'gemini' | 'glm'): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      const docRef = doc(db, this.COLLECTION, userId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        console.log(`ℹ️ No global API keys found for user ${userId}`);
        return;
      }
      
      const updateData: Partial<AIApiKeyRecord> = {
        lastUpdated: serverTimestamp(),
        updatedBy: getAuth().currentUser?.email || 'unknown'
      };
      
      if (type === 'gemini') {
        updateData.geminiApiKeyEncrypted = null;
      } else {
        updateData.glmApiKeyEncrypted = null;
      }
      
      await updateDoc(docRef, updateData);
      console.log(`✅ ${type.toUpperCase()} API key removed from global storage`);
    } catch (error) {
      console.error(`❌ Failed to remove global ${type} API key:`, error);
      throw error;
    }
  }

  /**
   * Remove all API keys (both Gemini and GLM) from global storage
   * @returns Promise<void>
   */
  async removeAllGlobalApiKeys(): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      const docRef = doc(db, this.COLLECTION, userId);
      await deleteDoc(docRef);
      console.log(`✅ All AI API keys removed from global storage for user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to remove all global API keys:`, error);
      throw error;
    }
  }

  /**
   * Get timestamp of last update for global API key
   * @param type 'gemini' | 'glm'
   * @returns Promise<Date | null>
   */
  async getGlobalApiKeyLastUpdated(type: 'gemini' | 'glm'): Promise<Date | null> {
    try {
      const userId = this.getCurrentUserId();
      const docRef = doc(db, this.COLLECTION, userId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data() as AIApiKeyRecord;
      const encryptedKey = type === 'gemini' 
        ? data.geminiApiKeyEncrypted 
        : data.glmApiKeyEncrypted;
      
      if (!encryptedKey) {
        return null;
      }
      
      const timestamp = data.lastUpdated;
      if (timestamp instanceof Timestamp) {
        return timestamp.toDate();
      } else if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
      } else if (timestamp) {
        return new Date(timestamp);
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Failed to get last updated timestamp for ${type} API key:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const aiApiKeyService = new AIApiKeyService();

// Export convenience functions
export const saveGlobalApiKey = aiApiKeyService.saveGlobalApiKey.bind(aiApiKeyService);
export const loadGlobalApiKey = aiApiKeyService.loadGlobalApiKey.bind(aiApiKeyService);
export const hasGlobalApiKey = aiApiKeyService.hasGlobalApiKey.bind(aiApiKeyService);
export const removeGlobalApiKey = aiApiKeyService.removeGlobalApiKey.bind(aiApiKeyService);
export const removeAllGlobalApiKeys = aiApiKeyService.removeAllGlobalApiKeys.bind(aiApiKeyService);
export const getGlobalApiKeyLastUpdated = aiApiKeyService.getGlobalApiKeyLastUpdated.bind(aiApiKeyService);
