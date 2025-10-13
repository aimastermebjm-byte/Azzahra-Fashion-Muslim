import React, { useState, useEffect } from 'react';

interface Address {
  name: string;
  phone: string;
  fullAddress: string;
  province: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
}

interface AddressFormProps {
  initialData?: Address | null;
  onSave: (data: Address) => void;
  onCancel: () => void;
}

const AddressForm: React.FC<AddressFormProps> = ({ initialData, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Address>({
    name: initialData?.name || '',
    phone: initialData?.phone || '',
    fullAddress: initialData?.fullAddress || '',
    province: initialData?.province || '',
    city: initialData?.city || '',
    postalCode: initialData?.postalCode || '',
    isDefault: initialData?.isDefault || false
  });

  const [errors, setErrors] = useState<Partial<Address>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));

    // Clear error for this field
    if (errors[name as keyof Address]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Address> = {};

    if (!formData.name.trim()) newErrors.name = 'Nama harus diisi';
    if (!formData.phone.trim()) newErrors.phone = 'Nomor telepon harus diisi';
    if (!formData.fullAddress.trim()) newErrors.fullAddress = 'Alamat harus diisi';
    if (!formData.province.trim()) newErrors.province = 'Provinsi harus diisi';
    if (!formData.city.trim()) newErrors.city = 'Kota harus diisi';
    if (!formData.postalCode.trim()) newErrors.postalCode = 'Kode pos harus diisi';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

  const provinces = [
    'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Sumatera Selatan', 'Riau',
    'Kepulauan Riau', 'Jambi', 'Bengkulu', 'Lampung', 'Banten',
    'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur',
    'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Kalimantan Barat',
    'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
    'Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara',
    'Sulawesi Barat', 'Gorontalo', 'Sulawesi Selatan', 'Maluku', 'Maluku Utara',
    'Papua', 'Papua Barat', 'Papua Selatan', 'Papua Tengah'
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nama Lengkap *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Masukkan nama lengkap"
        />
        {errors.name && (
          <p className="text-red-500 text-xs mt-1">{errors.name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nomor Telepon *
        </label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
            errors.phone ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Masukkan nomor telepon aktif"
        />
        {errors.phone && (
          <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Provinsi *
        </label>
        <select
          name="province"
          value={formData.province}
          onChange={handleChange}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
            errors.province ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="">Pilih provinsi</option>
          {provinces.map(province => (
            <option key={province} value={province}>{province}</option>
          ))}
        </select>
        {errors.province && (
          <p className="text-red-500 text-xs mt-1">{errors.province}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kota/Kabupaten *
        </label>
        <input
          type="text"
          name="city"
          value={formData.city}
          onChange={handleChange}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
            errors.city ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Masukkan kota/kabupaten"
        />
        {errors.city && (
          <p className="text-red-500 text-xs mt-1">{errors.city}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kode Pos *
        </label>
        <input
          type="text"
          name="postalCode"
          value={formData.postalCode}
          onChange={handleChange}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
            errors.postalCode ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Masukkan kode pos"
          maxLength={5}
        />
        {errors.postalCode && (
          <p className="text-red-500 text-xs mt-1">{errors.postalCode}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Alamat Lengkap *
        </label>
        <textarea
          name="fullAddress"
          value={formData.fullAddress}
          onChange={handleChange}
          rows={3}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
            errors.fullAddress ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Jalan, nomor rumah, RT/RW, kelurahan/desa"
        />
        {errors.fullAddress && (
          <p className="text-red-500 text-xs mt-1">{errors.fullAddress}</p>
        )}
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          name="isDefault"
          checked={formData.isDefault}
          onChange={handleChange}
          className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
        />
        <label className="ml-2 text-sm text-gray-700">
          Jadikan alamat utama
        </label>
      </div>

      <div className="flex space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Batal
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
        >
          {initialData ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  );
};

export default AddressForm;