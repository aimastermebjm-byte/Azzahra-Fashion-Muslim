import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from './firebaseClient';

const storage = getStorage(app);

// Fungsi untuk upload gambar ke Firebase Storage
export const uploadImageToStorage = async (file: File, productId: string, imageName: string): Promise<string> => {
  try {
    // Create storage reference
    const storageRef = ref(storage, `products/${productId}/${imageName}`);

    // Upload file
    const snapshot = await uploadBytes(storageRef, file);

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    console.log(`✅ Image uploaded to Firebase Storage: ${downloadURL}`);
    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading image to Firebase Storage:', error);
    throw error;
  }
};

// Fungsi untuk upload multiple images
export const uploadMultipleImages = async (files: File[], productId: string): Promise<string[]> => {
  const uploadPromises = files.map(async (file, index) => {
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const imageName = `image_${index + 1}.${fileExtension}`;
    return await uploadImageToStorage(file, productId, imageName);
  });

  try {
    const urls = await Promise.all(uploadPromises);
    console.log(`✅ Successfully uploaded ${urls.length} images to Firebase Storage`);
    return urls;
  } catch (error) {
    console.error('❌ Error uploading multiple images:', error);
    throw error;
  }
};

// Fungsi untuk validasi file gambar
export const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
  // Check file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return {
      isValid: false,
      error: `File ${file.name} terlalu besar. Maksimal ukuran file adalah 5MB.`
    };
  }

  // Check file type
  if (!file.type.startsWith('image/')) {
    return {
      isValid: false,
      error: `File ${file.name} bukan gambar. Silakan pilih file gambar.`
    };
  }

  return { isValid: true };
};

// Fungsi untuk generate unique filename
export const generateImageName = (originalName: string, index: number = 0): string => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop() || 'jpg';
  return `${timestamp}_${randomString}_${index}.${extension}`;
};