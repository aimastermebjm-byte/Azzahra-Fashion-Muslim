import { useState, useEffect } from 'react';

interface Address {
  id: string;
  name: string;
  phone: string;
  fullAddress: string;
  province: string;
  provinceId?: string;
  city: string;
  cityId?: string;
  district?: string;
  subdistrict?: string;
  postalCode: string;
  isDefault: boolean;
}

const ADDRESSES_KEY = 'azzahra-addresses';

export const useAddresses = () => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = () => {
    try {
      const savedAddresses = localStorage.getItem(ADDRESSES_KEY);
      if (savedAddresses) {
        setAddresses(JSON.parse(savedAddresses));
      }
    } catch (error) {
      console.error('Failed to load addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveAddresses = (newAddresses: Address[]) => {
    localStorage.setItem(ADDRESSES_KEY, JSON.stringify(newAddresses));
    setAddresses(newAddresses);
  };

  const addAddress = (address: Omit<Address, 'id'>) => {
    const newAddress: Address = {
      ...address,
      id: Date.now().toString()
    };

    // If this is the first address or marked as default, update other addresses
    if (addresses.length === 0 || address.isDefault) {
      const updatedAddresses = addresses.map(a => ({ ...a, isDefault: false }));
      saveAddresses([...updatedAddresses, newAddress]);
    } else {
      saveAddresses([...addresses, newAddress]);
    }
  };

  const updateAddress = (id: string, updates: Partial<Address>) => {
    const updatedAddresses = addresses.map(address => {
      if (address.id === id) {
        return { ...address, ...updates };
      }
      // If updating to default, unset other defaults
      if (updates.isDefault) {
        return { ...address, isDefault: false };
      }
      return address;
    });

    // Ensure only one default address
    const defaultAddress = updatedAddresses.find(a => a.id === id && updates.isDefault);
    if (defaultAddress) {
      saveAddresses(updatedAddresses.map(a =>
        a.id === id ? a : { ...a, isDefault: false }
      ));
    } else {
      saveAddresses(updatedAddresses);
    }
  };

  const deleteAddress = (id: string) => {
    const addressToDelete = addresses.find(a => a.id === id);

    // Don't delete if it's the only address
    if (addresses.length <= 1) {
      alert('Tidak dapat menghapus alamat. Minimal harus ada satu alamat.');
      return;
    }

    // If deleting default address, set another as default
    if (addressToDelete?.isDefault) {
      const updatedAddresses = addresses.filter(a => a.id !== id);
      if (updatedAddresses.length > 0) {
        updatedAddresses[0].isDefault = true;
      }
      saveAddresses(updatedAddresses);
    } else {
      saveAddresses(addresses.filter(a => a.id !== id));
    }
  };

  const setDefaultAddress = (id: string) => {
    saveAddresses(addresses.map(address => ({
      ...address,
      isDefault: address.id === id
    })));
  };

  const getDefaultAddress = () => {
    return addresses.find(a => a.isDefault) || addresses[0];
  };

  return {
    addresses,
    loading,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getDefaultAddress,
    refresh: loadAddresses
  };
};