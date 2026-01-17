import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';

// Firebase configuration with HARDCODED FALLBACK values
// This ensures the app works even without Vercel env vars
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'azzahra-fashion-muslim-ab416.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'azzahra-fashion-muslim-ab416',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'azzahra-fashion-muslim-ab416.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '822661485961',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:822661485961:web:4603488d8bef0119f3fd58',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-NZSXEKPQER'
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
console.log('✅ Firebase initialized');

// Initialize Firestore with new cache settings (replaces deprecated enableIndexedDbPersistence)
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
console.log('✅ Firestore initialized with persistent cache');


// Initialize other Firebase services
export const storage = getStorage(firebaseApp);
export const auth = getAuth(firebaseApp);
export const app = firebaseApp;

// Export auth functions
export { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail };

// Function to get public URL for Firebase Storage
export const getPublicImageUrl = (imagePath: string): string => {
  if (!imagePath) return '/placeholder-product.jpg';

  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  // If it's a Firebase Storage path, convert to public URL
  if (imagePath.startsWith('gs://') || imagePath.startsWith('product-images/')) {
    const bucketName = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
    const baseUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/`;
    const encodedPath = encodeURIComponent(imagePath);
    return `${baseUrl}${encodedPath}?alt=media`;
  }

  // If it's a relative path starting with /, assume it's from public folder
  if (imagePath.startsWith('/')) {
    return imagePath;
  }

  return imagePath;
};

// Function to convert Firebase Storage URL to public URL
export const convertFirebaseUrl = (url: string): string => {
  if (!url) return '/placeholder-product.jpg';

  // Handle UCloud URLs (private) - these need to be replaced with public URLs
  if (url.includes('ufileos.com') || url.includes('maas-log-prod')) {
    console.warn('⚠️ Private storage URL detected, needs public URL');
    return '/placeholder-product.jpg';
  }

  return getPublicImageUrl(url);
};

// Export as default for compatibility
export default firebaseApp;