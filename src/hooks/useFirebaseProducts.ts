import { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit as limitCount,
  onSnapshot,
  startAfter
} from 'firebase/firestore';
import { db, convertFirebaseUrl } from '../utils/firebaseClient';
import { useProductCache } from './useProductCache';

export const useFirebaseProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(20); // Fixed 20 produk untuk infinite scroll seperti Shopee
  const { saveToCache, getFromCache, isCacheValid } = useProductCache();

  useEffect(() => {
    // 🚨 EMERGENCY: DISABLE ALL FIRESTORE QUERIES TO STOP READ BLEEDING
    console.log('🚨 EMERGENCY: Firestore queries DISABLED to prevent quota exhaustion');
    setLoading(false);
    setIsInitialLoad(false);
    setProducts([]); // Empty products to prevent errors

    // Don't set up any listeners - return empty function
    return () => {};
  }, []); // Empty dependency array - prevent ALL re-runs

  // EMERGENCY: Disable all Firestore operations
  const addProduct = async (productData: any) => {
    console.error('🚨 EMERGENCY: Firestore DISABLED - addProduct blocked');
    throw new Error('Firestore disabled due to quota exhaustion. Please try again later.');
  };

  const updateProduct = async (id: string, updates: any) => {
    console.error('🚨 EMERGENCY: Firestore DISABLED - updateProduct blocked');
    throw new Error('Firestore disabled due to quota exhaustion. Please try again later.');
  };

  const deleteProduct = async (id: string) => {
    console.error('🚨 EMERGENCY: Firestore DISABLED - deleteProduct blocked');
    throw new Error('Firestore disabled due to quota exhaustion. Please try again later.');
  };

  const updateProductStock = async (id: string, quantity: number) => {
    console.error('🚨 EMERGENCY: Firestore DISABLED - updateProductStock blocked');
    throw new Error('Firestore disabled due to quota exhaustion. Please try again later.');
  };

  // Load more products for infinite scroll
  const loadMoreProducts = useCallback(async () => {
    console.error('🚨 EMERGENCY: Firestore DISABLED - loadMoreProducts blocked');
    return;
  }, []);

  return {
    products,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    updateProductStock,
    setProducts,
    hasMore,
    currentPage,
    productsPerPage,
    setCurrentPage,
    loadMoreProducts
  };
};