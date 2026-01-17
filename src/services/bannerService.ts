import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    getDoc
} from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import { Banner, CreateBannerInput } from '../types/banner';

const COLLECTION_NAME = 'banners';

export const bannerService = {
    // Create new banner
    async createBanner(input: CreateBannerInput, userId: string): Promise<string> {
        try {
            // Get current highest order to append to end
            const q = query(collection(db, COLLECTION_NAME), orderBy('order', 'desc'));
            const snapshot = await getDocs(q);
            const output = snapshot.docs[0]?.data();
            const nextOrder = (output?.order || 0) + 1;

            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...input,
                order: nextOrder,
                isActive: true,
                createdBy: userId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            return docRef.id;
        } catch (error) {
            console.error('Error creating banner:', error);
            throw error;
        }
    },

    // Get all banners (for admin)
    async getAllBanners(): Promise<Banner[]> {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    startDate: data.startDate?.toDate ? data.startDate.toDate() : null,
                    endDate: data.endDate?.toDate ? data.endDate.toDate() : null,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
                } as Banner;
            });
        } catch (error) {
            console.error('Error getting banners:', error);
            throw error;
        }
    },

    // Get active banners (for homepage)
    async getActiveBanners(): Promise<Banner[]> {
        try {
            // Get all active banners first
            const q = query(
                collection(db, COLLECTION_NAME),
                where('isActive', '==', true),
                orderBy('order', 'asc')
            );

            const snapshot = await getDocs(q);
            const now = new Date();

            // Filter by date range in memory
            return snapshot.docs
                .map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        startDate: data.startDate?.toDate ? data.startDate.toDate() : null,
                        endDate: data.endDate?.toDate ? data.endDate.toDate() : null,
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
                    } as Banner;
                })
                .filter(banner => {
                    // Check start date
                    if (banner.startDate && banner.startDate > now) return false;
                    // Check end date
                    if (banner.endDate && banner.endDate < now) return false;
                    return true;
                });
        } catch (error) {
            console.error('Error getting active banners:', error);
            throw error;
        }
    },

    // Update banner
    async updateBanner(id: string, data: Partial<CreateBannerInput>): Promise<void> {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating banner:', error);
            throw error;
        }
    },

    // Toggle active status
    async toggleStatus(id: string, isActive: boolean): Promise<void> {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                isActive,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error toggling banner status:', error);
            throw error;
        }
    },

    // Delete banner
    async deleteBanner(id: string): Promise<void> {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error('Error deleting banner:', error);
            throw error;
        }
    },

    // Reorder banners
    async reorderBanners(orderedIds: string[]): Promise<void> {
        try {
            const batchPromises = orderedIds.map((id, index) => {
                const docRef = doc(db, COLLECTION_NAME, id);
                return updateDoc(docRef, {
                    order: index + 1,
                    updatedAt: serverTimestamp()
                });
            });

            await Promise.all(batchPromises);
        } catch (error) {
            console.error('Error reordering banners:', error);
            throw error;
        }
    }
};
