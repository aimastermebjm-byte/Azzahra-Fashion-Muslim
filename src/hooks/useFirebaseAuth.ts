import { useState, useEffect } from 'react';
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile
} from '../utils/firebaseClient';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

interface User {
  uid: string;
  email: string;
  displayName?: string;
  role?: 'customer' | 'reseller' | 'admin' | 'owner';
}

export const useFirebaseAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setLoading(false);

      if (firebaseUser) {
        // Convert Firebase user to our app user format
        const appUser: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
          // For now, we'll determine role based on email
          role: determineUserRole(firebaseUser.email || '')
        };
        setUser(appUser);
        console.log('✅ Firebase user authenticated:', appUser);
      } else {
        setUser(null);
        console.log('ℹ️ No Firebase user authenticated');
      }
    });

    return unsubscribe;
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(userRef, userData, { merge: true });
      console.log('✅ User profile saved to Firestore:', userData);
    } catch (error) {
      console.error('❌ Error saving user profile:', error);
    }
  };

  // Determine user role based on email
  const determineUserRole = (email: string): 'customer' | 'reseller' | 'admin' | 'owner' => {
    const lowerEmail = email.toLowerCase();

    // Specific email addresses for owner
    if (lowerEmail === 'v4hrin@gmail.com' || lowerEmail.includes('owner')) return 'owner';
    if (lowerEmail.includes('admin')) return 'admin';
    if (lowerEmail.includes('reseller')) return 'reseller';
    return 'customer';
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        const role = determineUserRole(firebaseUser.email || '');
        const appUser: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
          role: role
        };

        // Save user profile to Firestore
        await saveUserProfile(firebaseUser, role);

        setUser(appUser);
        console.log('✅ Firebase login successful:', appUser);
        return appUser;
      }
    } catch (err: any) {
      console.error('❌ Firebase login error:', err);
      setError(getAuthErrorMessage(err.code));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (email: string, password: string, displayName?: string, role?: string) => {
    try {
      setError(null);
      setLoading(true);

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      if (firebaseUser && displayName) {
        // Update display name
        await updateProfile(firebaseUser, { displayName });
      }

      if (firebaseUser) {
        const userRole = (role as 'customer' | 'reseller' | 'admin' | 'owner') || determineUserRole(firebaseUser.email || '');
        const appUser: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: displayName || firebaseUser.email?.split('@')[0] || '',
          role: userRole
        };

        // Save user profile to Firestore
        await saveUserProfile(firebaseUser, userRole);

        setUser(appUser);
        console.log('✅ Firebase registration successful:', appUser);
        return appUser;
      }
    } catch (err: any) {
      console.error('❌ Firebase registration error:', err);
      setError(getAuthErrorMessage(err.code));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      console.log('✅ Firebase logout successful');
    } catch (err: any) {
      console.error('❌ Firebase logout error:', err);
      setError(getAuthErrorMessage(err.code));
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
    register,
    logout,
    isAuthenticated: !!user
  };
};