import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, MapPin, Edit, Trash2, Check, X, Home } from 'lucide-react';
import { addressService, Address } from '../services/addressService';

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
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    fullAddress: '',
    province: '',
    provinceId: '',
    city: '',
    cityId: '',
    district: '',
    districtId: '',
    subdistrict: '',
    subdistrictId: '',
    postalCode: '',
    isDefault: false
  });

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
    setFormData({
      name: '',
      phone: '',
      fullAddress: '',
      province: '',
      provinceId: '',
      city: '',
      cityId: '',
      district: '',
      districtId: '',
      subdistrict: '',
      subdistrictId: '',
      postalCode: '',
      isDefault: addresses.length === 0 // First address is default
    });
    setShowAddForm(true);
    setEditingAddress(null);
  };

  const handleEditAddress = (address: Address) => {
    setFormData({
      name: address.name,
      phone: address.phone,
      fullAddress: address.fullAddress,
      province: address.province,
      provinceId: address.provinceId,
      city: address.city,
      cityId: address.cityId,
      district: address.district,
      districtId: address.districtId,
      subdistrict: address.subdistrict,
      subdistrictId: address.subdistrictId,
      postalCode: address.postalCode,
      isDefault: address.isDefault
    });
    setShowAddForm(true);
    setEditingAddress(address);
  };

  const handleDeleteAddress = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus alamat ini?')) {
      return;
    }

    try {
      await addressService.deleteAddress(id);
      console.log('✅ Address deleted');
    } catch (error) {
      console.error('❌ Error deleting address:', error);
      alert('Gagal menghapus alamat. Silakan coba lagi.');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await addressService.setAsDefault(id);
      console.log('✅ Default address updated');
    } catch (error) {
      console.error('❌ Error setting default address:', error);
      alert('Gagal mengatur alamat utama. Silakan coba lagi.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phone || !formData.fullAddress || !formData.postalCode) {
      alert('Mohon lengkapi semua field yang wajib diisi.');
      return;
    }

    try {
      if (editingAddress) {
        await addressService.updateAddress(editingAddress.id, {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        console.log('✅ Address updated');
      } else {
        await addressService.saveAddress(formData);
        console.log('✅ Address saved');
      }

      setShowAddForm(false);
      setEditingAddress(null);
      setFormData({
        name: '',
        phone: '',
        fullAddress: '',
        province: '',
        provinceId: '',
        city: '',
        cityId: '',
        district: '',
        districtId: '',
        subdistrict: '',
        subdistrictId: '',
        postalCode: '',
        isDefault: false
      });
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
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="flex items-center p-4">
            <button onClick={() => setShowAddForm(false)} className="mr-4">
              <X className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-lg font-semibold">
              {editingAddress ? 'Edit Alamat' : 'Tambah Alamat Baru'}
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nama Penerima *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="Nama lengkap"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nomor Telepon *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="08xx-xxxx-xxxx"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alamat Lengkap *
            </label>
            <textarea
              value={formData.fullAddress}
              onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              rows={3}
              placeholder="Jl. xxx No. xx, RT/RW xx/xx"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kode Pos *
            </label>
            <input
              type="text"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="xxxxx"
              required
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
            />
            <label htmlFor="isDefault" className="text-sm font-medium text-gray-700">
              Jadikan alamat utama
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-pink-600 hover:to-purple-700 transition-all"
          >
            {editingAddress ? 'Update Alamat' : 'Simpan Alamat'}
          </button>
        </form>
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
          className="fixed bottom-24 right-4 w-14 h-14 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full shadow-lg flex items-center justify-center hover:from-pink-600 hover:to-purple-700 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default AddressManagementPage;