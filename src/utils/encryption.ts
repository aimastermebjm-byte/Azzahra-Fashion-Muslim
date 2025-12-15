import CryptoJS from 'crypto-js';

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
