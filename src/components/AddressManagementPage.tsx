import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, MapPin, Edit, Trash2, Check, Home } from 'lucide-react';
import { addressService, Address } from '../services/addressService';
import AddressForm from './AddressForm';

interface AddressManagementPageProps {
  user: any;
  onBack: () => void;
}

const AddressManagementPage: React.FC<AddressManagementPageProps> = ({ user, onBack }) => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Load addresses with real-time listener
  useEffect(() => {
    const unsubscribe = addressService.onAddressesChange((addressList) => {
      setAddresses(addressList);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, []);

  const handleAddAddress = () => {
    setShowAddForm(true);
    setEditingAddress(null);
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setShowAddForm(true);
  };

  const handleDeleteAddress = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus alamat ini?')) {
      return;
    }

    try {
      await addressService.deleteAddress(id);
      } catch (error) {
      console.error('❌ Error deleting address:', error);
      alert('Gagal menghapus alamat. Silakan coba lagi.');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await addressService.setAsDefault(id);
      } catch (error) {
      console.error('❌ Error setting default address:', error);
      alert('Gagal mengatur alamat utama. Silakan coba lagi.');
    }
  };

  const handleAddressSubmit = async (addressData: any) => {
    try {
      if (editingAddress) {
        // Convert AddressForm data to AddressService format
        await addressService.updateAddress(editingAddress.id, {
          name: addressData.name,
          phone: addressData.phone,
          fullAddress: addressData.fullAddress,
          province: addressData.province,
          provinceId: addressData.provinceId,
          city: addressData.city,
          cityId: addressData.cityId,
          district: addressData.district,
          districtId: addressData.districtId,
          subdistrict: addressData.subdistrict,
          subdistrictId: addressData.subdistrictId,
          postalCode: addressData.postalCode,
          isDefault: addressData.isDefault,
          updatedAt: new Date().toISOString()
        });
        } else {
        // Add new address
        await addressService.saveAddress({
          name: addressData.name,
          phone: addressData.phone,
          fullAddress: addressData.fullAddress,
          province: addressData.province,
          provinceId: addressData.provinceId,
          city: addressData.city,
          cityId: addressData.cityId,
          district: addressData.district,
          districtId: addressData.districtId,
          subdistrict: addressData.subdistrict,
          subdistrictId: addressData.subdistrictId,
          postalCode: addressData.postalCode,
          isDefault: addressData.isDefault
        });
        }

      setShowAddForm(false);
      setEditingAddress(null);
    } catch (error) {
      console.error('❌ Error saving address:', error);
      alert('Gagal menyimpan alamat. Silakan coba lagi.');
    }
  };

  const formatAddress = (address: Address) => {
    return `${address.fullAddress}, ${address.subdistrict}, ${address.district}, ${address.city}, ${address.province} ${address.postalCode}`;
  };

  if (showAddForm) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AddressForm
          initialData={editingAddress ? {
            name: editingAddress.name,
            phone: editingAddress.phone,
            fullAddress: editingAddress.fullAddress,
            province: editingAddress.province,
            provinceId: editingAddress.provinceId,
            city: editingAddress.city,
            cityId: editingAddress.cityId,
            district: editingAddress.district,
            districtId: editingAddress.districtId,
            subdistrict: editingAddress.subdistrict,
            subdistrictId: editingAddress.subdistrictId,
            postalCode: editingAddress.postalCode,
            isDefault: editingAddress.isDefault
          } : null}
          onSave={handleAddressSubmit}
          onCancel={() => {
            setShowAddForm(false);
            setEditingAddress(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4">
          <button onClick={onBack} className="mr-4">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold">Alamat Saya</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600">Error: {error}</p>
          </div>
        ) : addresses.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Belum Ada Alamat</h3>
            <p className="text-gray-500 mb-6">
              Tambahkan alamat pengiriman untuk memudahkan proses checkout
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {addresses.map((address) => (
              <div key={address.id} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Home className="w-4 h-4 text-pink-600" />
                      {address.isDefault && (
                        <span className="bg-pink-100 text-pink-600 text-xs px-2 py-1 rounded-full font-medium">
                          Utama
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-800 mb-1">{address.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{address.phone}</p>
                    <p className="text-sm text-gray-700">{formatAddress(address)}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditAddress(address)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {addresses.length > 1 && (
                      <button
                        onClick={() => handleDeleteAddress(address.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {!address.isDefault && (
                      <button
                        onClick={() => handleSetDefault(address.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Address Button */}
        <button
          onClick={handleAddAddress}
          className="fixed bottom-24 right-4 w-14 h-14 bg-brand-gradient text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default AddressManagementPage;