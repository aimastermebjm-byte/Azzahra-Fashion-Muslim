import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    getDoc
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Collection, CreateCollectionInput } from '../types/collection';

const COLLECTION_NAME = 'collections';

export const collectionService = {
    // Create new collection
    async createCollection(input: CreateCollectionInput): Promise<string> {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...input,
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            console.log('✅ Collection created:', input.name);
            return docRef.id;
        } catch (error) {
            console.error('Error creating collection:', error);
            throw error;
        }
    },

    // Get all collections
    async getAllCollections(): Promise<Collection[]> {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name,
                    description: data.description || '',
                    productIds: data.productIds || [],
                    isActive: data.isActive ?? true,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
                } as Collection;
            });
        } catch (error) {
            console.error('Error getting collections:', error);
            throw error;
        }
    },

    // Get collection by ID
    async getCollectionById(id: string): Promise<Collection | null> {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const snapshot = await getDoc(docRef);

            if (!snapshot.exists()) {
                return null;
            }

            const data = snapshot.data();
            return {
                id: snapshot.id,
                name: data.name,
                description: data.description || '',
                productIds: data.productIds || [],
                isActive: data.isActive ?? true,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
            } as Collection;
        } catch (error) {
            console.error('Error getting collection:', error);
            throw error;
        }
    },

    // Delete collection
    async deleteCollection(id: string): Promise<void> {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
            console.log('✅ Collection deleted:', id);
        } catch (error) {
            console.error('Error deleting collection:', error);
            throw error;
        }
    },

    // Update collection
    async updateCollection(id: string, data: Partial<CreateCollectionInput>): Promise<void> {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
            console.log('✅ Collection updated:', id);
        } catch (error) {
            console.error('Error updating collection:', error);
            throw error;
        }
    }
};
