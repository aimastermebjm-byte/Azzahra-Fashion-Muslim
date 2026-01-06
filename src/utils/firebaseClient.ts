import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
console.log('✅ Firebase initialized');

// Initialize Firestore
export const db = getFirestore(firebaseApp);

// Enable Firestore Persistence with multi-tab support
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db)
    .then(() => {
      console.log('✅ Firestore persistence enabled - data available offline');
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.log('⚠️ Multiple tabs open, persistence disabled - will use memory cache');
      } else if (err.code === 'unimplemented') {
        console.log('⚠️ Browser doesn\'t support persistence');
      } else {
        console.log('⚠️ Persistence error:', err.message);
      }
    });
}

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