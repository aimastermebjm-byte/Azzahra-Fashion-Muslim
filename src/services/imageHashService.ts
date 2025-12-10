import { encode } from 'blurhash';

export class ImageHashService {
  /**
   * Generate perceptual hash from image file using blurhash
   * @param imageFile - Image file to hash
   * @returns Blurhash string (consistent for same image)
   */
  async generateHash(imageFile: File): Promise<string> {
    try {
      const img = await this.loadImage(imageFile);
      const canvas = document.createElement('canvas');
      
      // Use small size for hash (32x32) - faster and good enough for similarity
      canvas.width = 32;
      canvas.height = 32;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      // Draw image resized to 32x32
      ctx.drawImage(img, 0, 0, 32, 32);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, 32, 32);
      
      // Generate blurhash (4x4 components for balance between quality and speed)
      const hash = encode(imageData.data, imageData.width, imageData.height, 4, 4);
      
      return hash;
    } catch (error) {
      console.error('Failed to generate image hash:', error);
      throw error;
    }
  }
  
  /**
   * Compare two blurhash strings for similarity
   * @param hash1 - First hash
   * @param hash2 - Second hash
   * @returns Similarity score (0-100)
   */
  compareHashes(hash1: string, hash2: string): number {
    if (hash1 === hash2) return 100;
    
    // Simple character-by-character comparison
    let matches = 0;
    const minLength = Math.min(hash1.length, hash2.length);
    const maxLength = Math.max(hash1.length, hash2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (hash1[i] === hash2[i]) {
        matches++;
      }
    }
    
    // Normalize to 0-100
    const similarity = (matches / maxLength) * 100;
    return Math.round(similarity);
  }
  
  /**
   * Load image from file
   * @param file - Image file
   * @returns HTMLImageElement
   */
  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url); // Clean up
        resolve(img);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    });
  }
  
  /**
   * Generate hash from base64 image data
   * @param base64Data - Base64 image string (without data:image prefix)
   * @param mimeType - Image mime type
   * @returns Blurhash string
   */
  async generateHashFromBase64(base64Data: string, mimeType: string = 'image/jpeg'): Promise<string> {
    try {
      // Convert base64 to blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      
      // Convert blob to file
      const file = new File([blob], 'temp.jpg', { type: mimeType });
      
      return await this.generateHash(file);
    } catch (error) {
      console.error('Failed to generate hash from base64:', error);
      throw error;
    }
  }
}

export const imageHashService = new ImageHashService();
