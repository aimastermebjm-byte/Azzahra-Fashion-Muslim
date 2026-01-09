
import { useState, useEffect } from 'react';
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from '../utils/firebaseClient';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: 'customer' | 'reseller' | 'admin' | 'owner';
  phone?: string;
  gender?: 'male' | 'female'; // Added gender
  status?: string;
  points?: number;
}

export const useFirebaseAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine user role based on email (Fallback)
  const determineUserRole = (email: string): 'customer' | 'reseller' | 'admin' | 'owner' => {
    const lowerEmail = email.toLowerCase();
    if (lowerEmail === 'v4hrin@gmail.com' || lowerEmail.includes('owner')) return 'owner';
    if (lowerEmail.includes('admin')) return 'admin';
    if (lowerEmail.includes('reseller')) return 'reseller';
    return 'customer';
  };

  // Listen to auth state changes & Firestore Realtime Updates
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
      // Clean up previous Firestore listener if exists
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (firebaseUser) {
        // Subscribe to Firestore User Document
        const userRef = doc(db, 'users', firebaseUser.uid);

        unsubscribeFirestore = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Merge Auth data with Firestore data
            const appUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: data.name || data.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
              photoURL: firebaseUser.photoURL || '',
              role: data.role || determineUserRole(firebaseUser.email || ''),
              phone: data.phone || data.phoneNumber || '',
              gender: data.gender || 'male', // Default to male if not set
              status: data.status || 'active',
              points: Number(data.points || data.resellerPoints || 0)
            };
            setUser(appUser);
          } else {
            // No firestore document yet, fall back to Auth data
            // This handles new users before profile is created/synced
            const role = determineUserRole(firebaseUser.email || '');
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
              photoURL: firebaseUser.photoURL || '',
              role: role,
              phone: '',
              status: 'active',
              points: 0
            });
          }
          setLoading(false);
        }, (err) => {
          console.error('❌ Error listening to user profile:', err);
          setLoading(false);
        });

      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  // Save user profile to Firestore
  const saveUserProfile = async (firebaseUser: any, role: string) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
        role: role,
        updatedAt: new Date().toISOString()
      };

      // Use setDoc with merge to avoid overwriting existing data fields (like phone)
      await setDoc(userRef, userData, { merge: true });
    } catch (error) {
      console.error('❌ Error saving user profile:', error);
    }
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        // We rely on the useEffect listener to set the user state
        // But we trigger a profile save to ensure document exists
        const role = determineUserRole(firebaseUser.email || '');
        await saveUserProfile(firebaseUser, role);
        return firebaseUser;
      }
    } catch (err: any) {
      console.error('❌ Firebase login error:', err);
      setError(getAuthErrorMessage(err.code));
      throw err;
    }
    // setLoading(false) handled by listener
  };

  // Register function
  const register = async (email: string, password: string, displayName?: string, role?: string) => {
    try {
      setError(null);
      setLoading(true);

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      if (firebaseUser && displayName) {
        await updateProfile(firebaseUser, { displayName });
      }

      if (firebaseUser) {
        const userRole = (role as 'customer' | 'reseller' | 'admin' | 'owner') || determineUserRole(firebaseUser.email || '');
        await saveUserProfile(firebaseUser, userRole);
        return firebaseUser;
      }
    } catch (err: any) {
      console.error('❌ Firebase registration error:', err);
      setError(getAuthErrorMessage(err.code));
      throw err;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
      // setUser(null) handled by listener
    } catch (err: any) {
      console.error('❌ Firebase logout error:', err);
      setError(getAuthErrorMessage(err.code));
    }
  };

  // Login with Google
  const loginWithGoogle = async () => {
    try {
      setError(null);
      setLoading(true);

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      if (firebaseUser) {
        // Check if user exists to preserve role
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userRef);

        let role: 'customer' | 'reseller' | 'admin' | 'owner' = 'customer';
        if (userDoc.exists()) {
          role = userDoc.data().role as any || 'customer';
        } else {
          role = determineUserRole(firebaseUser.email || '');
        }

        await saveUserProfile(firebaseUser, role);
        console.log('✅ Google login successful:', firebaseUser.email);
        return firebaseUser;
      }
    } catch (err: any) {
      console.error('❌ Google login error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Login dibatalkan');
      } else {
        setError(getAuthErrorMessage(err.code));
      }
      throw err;
    }
  };

  // Reset password function
  const resetPassword = async (email: string) => {
    try {
      setError(null);
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: 'Email reset password telah dikirim. Cek inbox Anda.' };
    } catch (err: any) {
      console.error('❌ Reset password error:', err);
      const errorMessage = getAuthErrorMessage(err.code);
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Get user-friendly error message
  const getAuthErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'Email tidak terdaftar. Silakan coba lagi.';
      case 'auth/wrong-password':
        return 'Password salah. Silakan coba lagi.';
      case 'auth/email-already-in-use':
        return 'Email sudah terdaftar. Silakan gunakan email lain.';
      case 'auth/weak-password':
        return 'Password terlalu lemah. Gunakan minimal 6 karakter.';
      case 'auth/invalid-email':
        return 'Format email tidak valid. Silakan coba lagi.';
      case 'auth/too-many-requests':
        return 'Terlalu banyak percobaan login. Silakan coba lagi nanti.';
      case 'auth/user-disabled':
        return 'Akun dinonaktifkan. Hubungi admin.';
      default:
        return 'Login gagal. Silakan coba lagi.';
    }
  };

  return {
    user,
    loading,
    error,
    login,
    loginWithGoogle,
    register,
    logout,
    resetPassword,
    isAuthenticated: !!user
  };
};