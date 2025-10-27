// Address Management Service
// Handle CRUD operations for user addresses

import { auth } from '../utils/firebaseClient';

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
  createdAt: Date;
  updatedAt: Date;
}

class AddressService {
  private readonly storageKey = 'user_addresses';

  // Get all addresses for current user
  async getUserAddresses(): Promise<Address[]> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Try to get from localStorage first (offline-first)
      const cachedAddresses = this.getCachedAddresses(user.uid);
      if (cachedAddresses.length > 0) {
        return cachedAddresses;
      }

      // If no cached addresses, return empty array
      // TODO: Implement Firebase/Firestore integration when needed
      return [];
    } catch (error) {
      console.error('Error getting user addresses:', error);
      return [];
    }
  }

  // Save new address
  async saveAddress(addressData: Omit<Address, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Address> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // If this is set as default, unset other default addresses
      if (addressData.isDefault) {
        await this.unsetAllDefaultAddresses(user.uid);
      }

      const newAddress: Address = {
        ...addressData,
        id: this.generateId(),
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Get existing addresses
      const addresses = this.getCachedAddresses(user.uid);
      addresses.push(newAddress);

      // Save to localStorage
      this.saveCachedAddresses(user.uid, addresses);

      return newAddress;
    } catch (error) {
      console.error('Error saving address:', error);
      throw error;
    }
  }

  // Update existing address
  async updateAddress(id: string, updateData: Partial<Omit<Address, 'id' | 'userId' | 'createdAt'>>): Promise<Address> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // If this is set as default, unset other default addresses
      if (updateData.isDefault) {
        await this.unsetAllDefaultAddresses(user.uid);
      }

      const addresses = this.getCachedAddresses(user.uid);
      const addressIndex = addresses.findIndex(addr => addr.id === id);

      if (addressIndex === -1) {
        throw new Error('Address not found');
      }

      const updatedAddress: Address = {
        ...addresses[addressIndex],
        ...updateData,
        updatedAt: new Date()
      };

      addresses[addressIndex] = updatedAddress;
      this.saveCachedAddresses(user.uid, addresses);

      return updatedAddress;
    } catch (error) {
      console.error('Error updating address:', error);
      throw error;
    }
  }

  // Delete address
  async deleteAddress(id: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const addresses = this.getCachedAddresses(user.uid);
      const filteredAddresses = addresses.filter(addr => addr.id !== id);

      // If deleted address was default, set first address as default
      if (addresses.find(addr => addr.id === id)?.isDefault && filteredAddresses.length > 0) {
        filteredAddresses[0].isDefault = true;
        filteredAddresses[0].updatedAt = new Date();
      }

      this.saveCachedAddresses(user.uid, filteredAddresses);
    } catch (error) {
      console.error('Error deleting address:', error);
      throw error;
    }
  }

  // Set address as default
  async setAsDefault(id: string): Promise<Address> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Unset all default addresses
      await this.unsetAllDefaultAddresses(user.uid);

      // Set selected address as default
      return await this.updateAddress(id, { isDefault: true });
    } catch (error) {
      console.error('Error setting default address:', error);
      throw error;
    }
  }

  // Get default address
  async getDefaultAddress(): Promise<Address | null> {
    try {
      const addresses = await this.getUserAddresses();
      return addresses.find(addr => addr.isDefault) || null;
    } catch (error) {
      console.error('Error getting default address:', error);
      return null;
    }
  }

  // Get address by ID
  async getAddressById(id: string): Promise<Address | null> {
    try {
      const addresses = await this.getUserAddresses();
      return addresses.find(addr => addr.id === id) || null;
    } catch (error) {
      console.error('Error getting address by ID:', error);
      return null;
    }
  }

  // Helper methods for localStorage
  private getCachedAddresses(userId: string): Address[] {
    try {
      const cached = localStorage.getItem(`${this.storageKey}_${userId}`);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Error getting cached addresses:', error);
      return [];
    }
  }

  private saveCachedAddresses(userId: string, addresses: Address[]): void {
    try {
      localStorage.setItem(`${this.storageKey}_${userId}`, JSON.stringify(addresses));
    } catch (error) {
      console.error('Error saving cached addresses:', error);
    }
  }

  private async unsetAllDefaultAddresses(userId: string): Promise<void> {
    const addresses = this.getCachedAddresses(userId);
    const updatedAddresses = addresses.map(addr => ({
      ...addr,
      isDefault: false,
      updatedAt: new Date()
    }));
    this.saveCachedAddresses(userId, updatedAddresses);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
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