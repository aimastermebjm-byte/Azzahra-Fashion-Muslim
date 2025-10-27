import React, { useState, useEffect } from 'react';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';

// Types for address data
interface Province {
  province_id: string;
  province: string;
}

interface City {
  city_id: string;
  city_name: string;
  province: string;
  province_id: string;
  type: string;
}

interface District {
  district_id: string;
  district_name: string;
  city_id: string;
  province: string;
}

interface Subdistrict {
  subdistrict_id: string;
  subdistrict_name: string;
  district_id: string;
  city: string;
  province: string;
}

interface Address {
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
    provinceId: initialData?.provinceId || '',
    city: initialData?.city || '',
    cityId: initialData?.cityId || '',
    district: initialData?.district || '',
    districtId: initialData?.districtId || '',
    subdistrict: initialData?.subdistrict || '',
    subdistrictId: initialData?.subdistrictId || '',
    postalCode: initialData?.postalCode || '',
    isDefault: initialData?.isDefault || false
  });

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subdistricts, setSubdistricts] = useState<Subdistrict[]>([]);

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSubdistricts, setLoadingSubdistricts] = useState(false);
  const [error, setError] = useState('');

  const [errors, setErrors] = useState<Partial<Address>>({});

  // Load provinces on component mount
  useEffect(() => {
    loadProvinces();
  }, []);

  // Load cities when province changes
  useEffect(() => {
    if (formData.provinceId) {
      loadCities();
      // Reset dependent fields
      setCities([]);
      setDistricts([]);
      setSubdistricts([]);
      setFormData(prev => ({
        ...prev,
        city: '',
        cityId: '',
        district: '',
        districtId: '',
        subdistrict: '',
        subdistrictId: '',
        postalCode: ''
      }));
    }
  }, [formData.provinceId]);

  // Load districts when city changes
  useEffect(() => {
    if (formData.cityId) {
      loadDistricts();
      // Reset dependent fields
      setDistricts([]);
      setSubdistricts([]);
      setFormData(prev => ({
        ...prev,
        district: '',
        districtId: '',
        subdistrict: '',
        subdistrictId: '',
        postalCode: ''
      }));
    }
  }, [formData.cityId]);

  // Load subdistricts when district changes
  useEffect(() => {
    if (formData.districtId) {
      loadSubdistricts();
      // Reset dependent fields
      setSubdistricts([]);
      setFormData(prev => ({
        ...prev,
        subdistrict: '',
        subdistrictId: '',
        postalCode: ''
      }));
    }
  }, [formData.districtId]);

  const loadProvinces = async () => {
    setLoadingProvinces(true);
    try {
      const response = await fetch('/api/address?type=provinces');
      const data = await response.json();

      if (data.success && data.data) {
        setProvinces(data.data);
      }
    } catch (error) {
      console.error('Error loading provinces:', error);
    } finally {
      setLoadingProvinces(false);
    }
  };

  const loadCities = async () => {
    if (!formData.provinceId) return;

    setLoadingCities(true);
    try {
      const response = await fetch(`/api/address?type=cities&provinceId=${formData.provinceId}`);
      const data = await response.json();

      if (data.success && data.data) {
        setCities(data.data);
      }
    } catch (error) {
      console.error('Error loading cities:', error);
    } finally {
      setLoadingCities(false);
    }
  };

  const loadDistricts = async () => {
    if (!formData.cityId) return;

    setLoadingDistricts(true);
    try {
      const response = await fetch(`/api/address?type=districts&cityId=${formData.cityId}`);
      const data = await response.json();

      if (data.success && data.data) {
        setDistricts(data.data);
      }
    } catch (error) {
      console.error('Error loading districts:', error);
    } finally {
      setLoadingDistricts(false);
    }
  };

  const loadSubdistricts = async () => {
    if (!formData.districtId) return;

    setLoadingSubdistricts(true);
    try {
      const response = await fetch(`/api/address?type=subdistricts&districtId=${formData.districtId}`);
      const data = await response.json();

      if (data.success && data.data) {
        setSubdistricts(data.data);
      }
    } catch (error) {
      console.error('Error loading subdistricts:', error);
    } finally {
      setLoadingSubdistricts(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: newValue
      };

      // Special handling for province change
      if (name === 'provinceId') {
        const selectedProvince = provinces.find(p => p.province_id === value);
        if (selectedProvince) {
          updated.province = selectedProvince.province;
        }
      }

      // Special handling for city change
      if (name === 'cityId') {
        const selectedCity = cities.find(c => c.city_id === value);
        if (selectedCity) {
          updated.city = `${selectedCity.type} ${selectedCity.city_name}`;
        }
      }

      // Special handling for district change
      if (name === 'districtId') {
        const selectedDistrict = districts.find(d => d.district_id === value);
        if (selectedDistrict) {
          updated.district = selectedDistrict.district_name;
        }
      }

      // Special handling for subdistrict change
      if (name === 'subdistrictId') {
        const selectedSubdistrict = subdistricts.find(s => s.subdistrict_id === value);
        if (selectedSubdistrict) {
          updated.subdistrict = selectedSubdistrict.subdistrict_name;
        }
      }

      return updated;
    });

    // Clear error for this field
    if (errors[name as keyof Address]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Address> = {};

    if (!formData.name.trim()) newErrors.name = 'Nama harus diisi';
    if (!formData.phone.trim()) newErrors.phone = 'Nomor telepon harus diisi';
    if (!formData.provinceId) newErrors.provinceId = 'Provinsi harus diisi';
    if (!formData.cityId) newErrors.cityId = 'Kota harus diisi';
    if (!formData.districtId) newErrors.districtId = 'Kecamatan harus diisi';
    if (!formData.subdistrictId) newErrors.subdistrictId = 'Kelurahan harus diisi';
    if (!formData.postalCode.trim()) newErrors.postalCode = 'Kode pos harus diisi';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // Construct full address
      const fullAddress = `${formData.fullAddress}, ${formData.subdistrict}, ${formData.district}, ${formData.city}, ${formData.province}`;

      const addressToSave = {
        ...formData,
        fullAddress
      };

      onSave(addressToSave);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center text-red-800">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

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
          <MapPin className="w-4 h-4 inline mr-1" />
          Provinsi *
        </label>
        <select
          name="provinceId"
          value={formData.provinceId}
          onChange={handleChange}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
            errors.provinceId ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loadingProvinces}
        >
          <option value="">Pilih provinsi</option>
          {provinces.map(province => (
            <option key={province.province_id} value={province.province_id}>
              {province.province}
            </option>
          ))}
        </select>
        {loadingProvinces && (
          <div className="mt-2 flex items-center text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
            Memuat provinsi...
          </div>
        )}
        {errors.provinceId && (
          <p className="text-red-500 text-xs mt-1">{errors.provinceId}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kota/Kabupaten *
        </label>
        <select
          name="cityId"
          value={formData.cityId}
          onChange={handleChange}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
            errors.cityId ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={!formData.provinceId || loadingCities}
        >
          <option value="">Pilih kota/kabupaten</option>
          {cities.map(city => (
            <option key={city.city_id} value={city.city_id}>
              {city.type} {city.city_name}
            </option>
          ))}
        </select>
        {loadingCities && (
          <div className="mt-2 flex items-center text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
            Memuat kota...
          </div>
        )}
        {errors.cityId && (
          <p className="text-red-500 text-xs mt-1">{errors.cityId}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kecamatan *
        </label>
        <select
          name="districtId"
          value={formData.districtId}
          onChange={handleChange}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
            errors.districtId ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={!formData.cityId || loadingDistricts}
        >
          <option value="">Pilih kecamatan</option>
          {districts.map(district => (
            <option key={district.district_id} value={district.district_id}>
              {district.district_name}
            </option>
          ))}
        </select>
        {loadingDistricts && (
          <div className="mt-2 flex items-center text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
            Memuat kecamatan...
          </div>
        )}
        {errors.districtId && (
          <p className="text-red-500 text-xs mt-1">{errors.districtId}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kelurahan/Desa *
        </label>
        <select
          name="subdistrictId"
          value={formData.subdistrictId}
          onChange={handleChange}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
            errors.subdistrictId ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={!formData.districtId || loadingSubdistricts}
        >
          <option value="">Pilih kelurahan/desa</option>
          {subdistricts.map(subdistrict => (
            <option key={subdistrict.subdistrict_id} value={subdistrict.subdistrict_id}>
              {subdistrict.subdistrict_name}
            </option>
          ))}
        </select>
        {loadingSubdistricts && (
          <div className="mt-2 flex items-center text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
            Memuat kelurahan/desa...
          </div>
        )}
        {errors.subdistrictId && (
          <p className="text-red-500 text-xs mt-1">{errors.subdistrictId}</p>
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
          Alamat Detail (Jalan, RT/RW, No. Rumah) *
        </label>
        <textarea
          name="fullAddress"
          value={formData.fullAddress}
          onChange={handleChange}
          rows={3}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
            errors.fullAddress ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Contoh: Jl. Merdeka No. 123, RT 001/RW 002"
        />
        {errors.fullAddress && (
          <p className="text-red-500 text-xs mt-1">{errors.fullAddress}</p>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-800">
          <strong>Preview Alamat:</strong><br/>
          {formData.fullAddress && `${formData.fullAddress}, `}{formData.subdistrict}, {formData.district}, {formData.city}, {formData.province}, {formData.postalCode}
        </p>
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