import CryptoJS from 'crypto-js';
import { aiApiKeyService } from '../services/aiApiKeyService';

// Secret key for encryption (in production, should be in .env)
const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_SECRET || 'azzahra-fashion-ai-secret-2025';

export class EncryptionService {
  /**
   * Encrypt API key before storing in localStorage
   */
  static encryptAPIKey(apiKey: string): string {
    if (!apiKey) {
      throw new Error('API key cannot be empty');
    }
    
    try {
      const encrypted = CryptoJS.AES.encrypt(apiKey, SECRET_KEY).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt API key');
    }
  }
  
  /**
   * Decrypt API key from localStorage
   */
  static decryptAPIKey(encryptedKey: string): string | null {
    if (!encryptedKey) {
      return null;
    }
    
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedKey, SECRET_KEY);
      const plainText = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!plainText) {
        console.warn('Decryption resulted in empty string');
        return null;
      }
      
      return plainText;
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }
  
  /**
   * Save Gemini API key to localStorage (encrypted)
   */
  static saveGeminiAPIKey(apiKey: string): void {
    const encrypted = this.encryptAPIKey(apiKey);
    localStorage.setItem('gemini_api_key_encrypted', encrypted);
    
    // Also save timestamp
    localStorage.setItem('gemini_api_key_saved_at', Date.now().toString());
  }
  
  /**
   * Load Gemini API key from localStorage (decrypt)
   */
  static loadGeminiAPIKey(): string | null {
    const encrypted = localStorage.getItem('gemini_api_key_encrypted');
    
    if (!encrypted) {
      return null;
    }
    
    return this.decryptAPIKey(encrypted);
  }
  
  /**
   * Save GLM API key to localStorage (encrypted)
   */
  static saveGLMAPIKey(apiKey: string): void {
    const encrypted = this.encryptAPIKey(apiKey);
    localStorage.setItem('glm_api_key_encrypted', encrypted);
    
    // Also save timestamp
    localStorage.setItem('glm_api_key_saved_at', Date.now().toString());
  }
  
  /**
   * Load GLM API key from localStorage (decrypt)
   */
  static loadGLMAPIKey(): string | null {
    const encrypted = localStorage.getItem('glm_api_key_encrypted');
    
    if (!encrypted) {
      return null;
    }
    
    return this.decryptAPIKey(encrypted);
  }
  
  /**
   * Remove API key from localStorage
   */
  static removeGeminiAPIKey(): void {
    localStorage.removeItem('gemini_api_key_encrypted');
    localStorage.removeItem('gemini_api_key_saved_at');
  }
  
  /**
   * Remove GLM API key from localStorage
   */
  static removeGLMAPIKey(): void {
    localStorage.removeItem('glm_api_key_encrypted');
    localStorage.removeItem('glm_api_key_saved_at');
  }
  
  /**
   * Check if API key exists
   */
  static hasGeminiAPIKey(): boolean {
    return localStorage.getItem('gemini_api_key_encrypted') !== null;
  }
  
  /**
   * Check if GLM API key exists
   */
  static hasGLMAPIKey(): boolean {
    return localStorage.getItem('glm_api_key_encrypted') !== null;
  }
  
  /**
   * Get when API key was saved
   */
  static getAPIKeySavedDate(): Date | null {
    const timestamp = localStorage.getItem('gemini_api_key_saved_at');
    
    if (!timestamp) {
      return null;
    }
    
    return new Date(parseInt(timestamp));
  }

  /**
   * Save API key with option to store globally in Firestore
   * @param type 'gemini' | 'glm'
   * @param apiKey Plain API key
   * @param options.saveGlobal Whether to save to global storage (Firestore)
   */
  static async saveAPIKey(
    type: 'gemini' | 'glm', 
    apiKey: string, 
    options?: { saveGlobal?: boolean }
  ): Promise<void> {
    // Encrypt the key
    const encrypted = this.encryptAPIKey(apiKey);
    
    // Save encrypted key to localStorage (single encryption)
    if (type === 'gemini') {
      localStorage.setItem('gemini_api_key_encrypted', encrypted);
      localStorage.setItem('gemini_api_key_saved_at', Date.now().toString());
    } else {
      localStorage.setItem('glm_api_key_encrypted', encrypted);
      localStorage.setItem('glm_api_key_saved_at', Date.now().toString());
    }
    
    console.log(`✅ ${type.toUpperCase()} API key saved to localStorage`);
    
    // Save to global storage if requested
    if (options?.saveGlobal) {
      try {
        await aiApiKeyService.saveGlobalApiKey(type, encrypted);
        console.log(`✅ ${type.toUpperCase()} API key saved to global storage`);
      } catch (error) {
        console.error(`⚠️ Failed to save ${type} API key to global storage:`, error);
        // Don't throw - local storage is already saved
      }
    }
  }

  /**
   * Load API key with fallback to global storage
   * Checks localStorage first, then Firestore global storage
   * @param type 'gemini' | 'glm'
   * @returns Promise<string | null> Decrypted API key
   */
  static async loadAPIKeyWithFallback(type: 'gemini' | 'glm'): Promise<string | null> {
    // Try localStorage first
    let encryptedKey: string | null = null;
    
    if (type === 'gemini') {
      encryptedKey = localStorage.getItem('gemini_api_key_encrypted');
    } else {
      encryptedKey = localStorage.getItem('glm_api_key_encrypted');
    }
    
    if (encryptedKey) {
      const decrypted = this.decryptAPIKey(encryptedKey);
      if (decrypted) {
        console.log(`✅ Loaded ${type} API key from localStorage`);
        return decrypted;
      }
    }
    
    // If not found in localStorage, try global storage
    try {
      const globalEncryptedKey = await aiApiKeyService.loadGlobalApiKey(type);
      if (globalEncryptedKey) {
        const decrypted = this.decryptAPIKey(globalEncryptedKey);
        if (decrypted) {
          console.log(`✅ Loaded ${type} API key from global storage`);
          
          // Cache in localStorage for future use
          if (type === 'gemini') {
            localStorage.setItem('gemini_api_key_encrypted', globalEncryptedKey);
            localStorage.setItem('gemini_api_key_saved_at', Date.now().toString());
          } else {
            localStorage.setItem('glm_api_key_encrypted', globalEncryptedKey);
            localStorage.setItem('glm_api_key_saved_at', Date.now().toString());
          }
          
          return decrypted;
        }
      }
    } catch (error) {
      console.error(`⚠️ Failed to load ${type} API key from global storage:`, error);
      // Continue to return null
    }
    
    console.log(`ℹ️ No ${type} API key found in localStorage or global storage`);
    return null;
  }

  /**
   * Check if API key exists (local or global)
   * @param type 'gemini' | 'glm'
   * @returns Promise<boolean>
   */
  static async hasAPIKeyWithFallback(type: 'gemini' | 'glm'): Promise<boolean> {
    // Check localStorage first
    const localHasKey = type === 'gemini' ? this.hasGeminiAPIKey() : this.hasGLMAPIKey();
    if (localHasKey) {
      return true;
    }
    
    // Check global storage
    try {
      return await aiApiKeyService.hasGlobalApiKey(type);
    } catch (error) {
      console.error(`⚠️ Failed to check global ${type} API key:`, error);
      return false;
    }
  }

  /**
   * Remove API key from both localStorage and global storage
   * @param type 'gemini' | 'glm'
   * @param removeGlobal Whether to remove from global storage too
   */
  static async removeAPIKey(
    type: 'gemini' | 'glm',
    removeGlobal: boolean = false
  ): Promise<void> {
    // Remove from localStorage
    if (type === 'gemini') {
      this.removeGeminiAPIKey();
    } else {
      this.removeGLMAPIKey();
    }
    
    // Remove from global storage if requested
    if (removeGlobal) {
      try {
        await aiApiKeyService.removeGlobalApiKey(type);
        console.log(`✅ ${type.toUpperCase()} API key removed from global storage`);
      } catch (error) {
        console.error(`⚠️ Failed to remove ${type} API key from global storage:`, error);
      }
    }
  }
}

// Export convenience functions
export const saveGeminiAPIKey = EncryptionService.saveGeminiAPIKey.bind(EncryptionService);
export const loadGeminiAPIKey = EncryptionService.loadGeminiAPIKey.bind(EncryptionService);
export const removeGeminiAPIKey = EncryptionService.removeGeminiAPIKey.bind(EncryptionService);
export const hasGeminiAPIKey = EncryptionService.hasGeminiAPIKey.bind(EncryptionService);

export const saveGLMAPIKey = EncryptionService.saveGLMAPIKey.bind(EncryptionService);
export const loadGLMAPIKey = EncryptionService.loadGLMAPIKey.bind(EncryptionService);
export const removeGLMAPIKey = EncryptionService.removeGLMAPIKey.bind(EncryptionService);
export const hasGLMAPIKey = EncryptionService.hasGLMAPIKey.bind(EncryptionService);

// Export new async functions with global storage support
export const saveAPIKey = EncryptionService.saveAPIKey.bind(EncryptionService);
export const loadAPIKeyWithFallback = EncryptionService.loadAPIKeyWithFallback.bind(EncryptionService);
export const hasAPIKeyWithFallback = EncryptionService.hasAPIKeyWithFallback.bind(EncryptionService);
export const removeAPIKey = EncryptionService.removeAPIKey.bind(EncryptionService);
