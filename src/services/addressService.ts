// Address Management Service - Pure Firebase Real-time System
// Single source of truth: Firebase Firestore only

import { auth } from '../utils/firebaseClient';
import { doc, getDoc, setDoc, collection, getDocs, query, where, deleteDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';

export interface Address {
  id: string;
  userId: string;
  name: string;
  phone: string;
  fullAddress: string;
  province: string;
  provinceId: string;
  city: string;
  cityId: string;
  district: string;
  districtId: string;
  subdistrict: string;
  subdistrictId: string;
  postalCode: string;
  isDefault: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

class AddressService {
  private readonly collection = 'user_addresses';

  // Get all addresses for current user from Firebase only
  async getUserAddresses(): Promise<Address[]> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('🏠 Loading addresses from Firebase for user:', user.uid);

      // Load from Firebase Firestore only
      const addressesRef = collection(db, this.collection);
      const q = query(addressesRef, where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);

      const addresses: Address[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<Address, 'id'>;
        addresses.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || data.createdAt || new Date().toISOString()
        });
      });

      console.log('✅ Addresses loaded from Firebase:', addresses.length, 'addresses');
      return addresses;
    } catch (error) {
      console.error('❌ Error getting user addresses:', error);
      return [];
    }
  }

  // Set up real-time address listener
  onAddressesChange(callback: (addresses: Address[]) => void): () => void {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No user for real-time address listener');
      return () => {};
    }

    console.log('🔄 Setting up real-time address listener for user:', user.uid);

    const addressesRef = collection(db, this.collection);
    const q = query(addressesRef, where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const addresses: Address[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<Address, 'id'>;
        addresses.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || data.createdAt || new Date().toISOString()
        });
      });

      console.log('📦 Real-time addresses update:', addresses.length, 'addresses');
      callback(addresses);
    }, (error) => {
      console.error('❌ Real-time address listener error:', error);
    });

    return unsubscribe;
  }

  // Save new address to Firebase only
  async saveAddress(addressData: Omit<Address, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Address> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('🏠 Saving address to Firebase...');

      // If this is set as default, unset other default addresses in Firebase
      if (addressData.isDefault) {
        await this.unsetAllDefaultAddressesInFirebase(user.uid);
      }

      const newAddress: Address = {
        ...addressData,
        id: this.generateId(),
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to Firebase Firestore only
      const addressRef = doc(db, this.collection, newAddress.id);
      await setDoc(addressRef, newAddress);

      console.log('✅ Address saved to Firebase:', newAddress.id);
      return newAddress;
    } catch (error) {
      console.error('❌ Error saving address:', error);
      throw error;
    }
  }

  // Update existing address in Firebase only
  async updateAddress(id: string, updateData: Partial<Omit<Address, 'id' | 'userId' | 'createdAt'>>): Promise<Address> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get existing address from Firebase
      const addressRef = doc(db, this.collection, id);
      const addressDoc = await getDoc(addressRef);

      if (!addressDoc.exists() || addressDoc.data().userId !== user.uid) {
        throw new Error('Address not found');
      }

      // If this is set as default, unset other default addresses in Firebase
      if (updateData.isDefault) {
        await this.unsetAllDefaultAddressesInFirebase(user.uid);
      }

      const updatedAddress: Address = {
        ...addressDoc.data() as Address,
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      // Update in Firebase only
      await setDoc(addressRef, updatedAddress);
      console.log('✅ Address updated in Firebase:', id);

      return updatedAddress;
    } catch (error) {
      console.error('❌ Error updating address:', error);
      throw error;
    }
  }

  // Delete address from Firebase only
  async deleteAddress(id: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('🗑️ Deleting address from Firebase:', id);

      // Check if address exists and belongs to user
      const addressRef = doc(db, this.collection, id);
      const addressDoc = await getDoc(addressRef);

      if (!addressDoc.exists() || addressDoc.data().userId !== user.uid) {
        throw new Error('Address not found');
      }

      const wasDefault = addressDoc.data().isDefault;

      // Delete from Firebase
      await deleteDoc(addressRef);
      console.log('✅ Address deleted from Firebase:', id);

      // If deleted address was default, set first remaining address as default
      if (wasDefault) {
        const remainingAddresses = await this.getUserAddresses();
        if (remainingAddresses.length > 0) {
          await this.setAsDefault(remainingAddresses[0].id);
        }
      }
    } catch (error) {
      console.error('❌ Error deleting address:', error);
      throw error;
    }
  }

  // Set address as default in Firebase only
  async setAsDefault(id: string): Promise<Address> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Unset all default addresses in Firebase
      await this.unsetAllDefaultAddressesInFirebase(user.uid);

      // Set selected address as default
      return await this.updateAddress(id, { isDefault: true });
    } catch (error) {
      console.error('❌ Error setting default address:', error);
      throw error;
    }
  }

  // Get default address from Firebase only
  async getDefaultAddress(): Promise<Address | null> {
    try {
      const addresses = await this.getUserAddresses();
      return addresses.find(addr => addr.isDefault) || null;
    } catch (error) {
      console.error('❌ Error getting default address:', error);
      return null;
    }
  }

  // Get address by ID from Firebase only
  async getAddressById(id: string): Promise<Address | null> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const addressRef = doc(db, this.collection, id);
      const addressDoc = await getDoc(addressRef);

      if (!addressDoc.exists() || addressDoc.data().userId !== user.uid) {
        return null;
      }

      const data = addressDoc.data() as Address;
      return {
        ...data,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || data.createdAt || new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting address by ID:', error);
      return null;
    }
  }

  // Unset all default addresses in Firebase
  private async unsetAllDefaultAddressesInFirebase(userId: string): Promise<void> {
    try {
      const addressesRef = collection(db, this.collection);
      const q = query(addressesRef, where('userId', '==', userId), where('isDefault', '==', true));
      const querySnapshot = await getDocs(q);

      const updatePromises = querySnapshot.docs.map((doc) =>
        setDoc(doc.ref, { isDefault: false, updatedAt: new Date().toISOString() }, { merge: true })
      );

      await Promise.all(updatePromises);
      console.log('✅ All default addresses unset in Firebase');
    } catch (error) {
      console.error('❌ Error unsetting default addresses:', error);
      throw error;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  // Format address for display
  formatAddress(address: Address): string {
    const parts = [
      address.fullAddress,
      address.subdistrict,
      address.district,
      address.city,
      address.province,
      address.postalCode
    ].filter(Boolean);

    return parts.join(', ');
  }

  // Get short address for display (without full address line)
  getShortAddress(address: Address): string {
    const parts = [
      address.subdistrict,
      address.district,
      address.city,
      address.province
    ].filter(Boolean);

    return parts.join(', ');
  }
}

export const addressService = new AddressService();