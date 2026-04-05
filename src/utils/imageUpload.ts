import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from './firebaseClient';

const storage = getStorage(app);

// Kompres gambar sebelum upload (max 1200px, kualitas 0.85)
const compressImage = (file: File, maxWidth = 1200, quality = 0.85): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // Hitung dimensi baru jika melebihi maxWidth
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Jika hasil kompresi lebih besar dari aslinya, pakai file asli
            if (blob.size >= file.size) {
              resolve(file);
            } else {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              console.log(`🗜️ Compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB`);
              resolve(compressedFile);
            }
          } else {
            resolve(file); // Fallback ke file asli jika gagal kompresi
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // Fallback ke file asli jika error
    };

    img.src = objectUrl;
  });
};

// Fungsi untuk upload gambar ke Firebase Storage
export const uploadImageToStorage = async (file: File, productId: string, imageName: string): Promise<string> => {
  try {
    // Kompresi gambar sebelum upload
    const compressedFile = await compressImage(file);

    // Create storage reference
    const storageRef = ref(storage, `products/${productId}/${imageName}`);

    // Upload file (sudah dikompresi)
    const snapshot = await uploadBytes(storageRef, compressedFile);

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

// Fungsi untuk validasi file gambar (limit 20MB, dikompresi otomatis)
export const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
  // Check file size (max 20MB - akan dikompresi otomatis sebelum upload)
  if (file.size > 20 * 1024 * 1024) {
    return {
      isValid: false,
      error: `File ${file.name} terlalu besar. Maksimal ukuran file adalah 20MB.`
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