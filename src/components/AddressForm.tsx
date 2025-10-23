import React, { useState, useEffect } from 'react';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { rajaOngkirService, Province, City, Subdistrict } from '../utils/rajaOngkirService';

interface Address {
  name: string;
  phone: string;
  fullAddress: string;
  province: string;
  provinceId: string;
  city: string;
  cityId: string;
  district: string;
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
    subdistrict: initialData?.subdistrict || '',
    subdistrictId: initialData?.subdistrictId || '',
    postalCode: initialData?.postalCode || '',
    isDefault: initialData?.isDefault || false
  });

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [subdistricts, setSubdistricts] = useState<Subdistrict[]>([]);

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
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
      loadCities(formData.provinceId);
      // Reset dependent fields
      setCities([]);
      setSubdistricts([]);
      setFormData(prev => ({
        ...prev,
        cityId: '',
        city: '',
        district: '',
        subdistrict: '',
        subdistrictId: '',
        postalCode: ''
      }));
    }
  }, [formData.provinceId]);

  // Load subdistricts when city changes
  useEffect(() => {
    if (formData.cityId) {
      loadSubdistricts(formData.cityId);
      // Reset dependent fields
      setSubdistricts([]);
      setFormData(prev => ({
        ...prev,
        district: '',
        subdistrict: '',
        subdistrictId: '',
        postalCode: ''
      }));
    }
  }, [formData.cityId]);

  // Update postal code when subdistrict is selected
  useEffect(() => {
    if (formData.subdistrictId && cities.length > 0) {
      const selectedCity = cities.find(c => c.city_id === formData.cityId);
      if (selectedCity) {
        setFormData(prev => ({
          ...prev,
          postalCode: selectedCity.postal_code
        }));
      }
    }
  }, [formData.subdistrictId, formData.cityId, cities]);

  const loadProvinces = async () => {
    try {
      setLoadingProvinces(true);
      setError('');
      const provincesData = await rajaOngkirService.getProvinces();
      setProvinces(provincesData);
    } catch (err) {
      setError('Gagal memuat data provinsi');
      console.error('Error loading provinces:', err);
    } finally {
      setLoadingProvinces(false);
    }
  };

  const loadCities = async (provinceId: string) => {
    try {
      setLoadingCities(true);
      setError('');
      const citiesData = await rajaOngkirService.getCities(provinceId);
      setCities(citiesData);
    } catch (err) {
      setError('Gagal memuat data kota');
      console.error('Error loading cities:', err);
    } finally {
      setLoadingCities(false);
    }
  };

  const loadSubdistricts = async (cityId: string) => {
    try {
      setLoadingSubdistricts(true);
      setError('');
      const subdistrictsData = await rajaOngkirService.getSubdistricts(cityId);
      setSubdistricts(subdistrictsData);
    } catch (err) {
      setError('Gagal memuat data kecamatan');
      console.error('Error loading subdistricts:', err);
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
          updated.city = selectedCity.city_name;
          updated.postalCode = selectedCity.postal_code;
        }
      }

      // Special handling for subdistrict change
      if (name === 'subdistrictId') {
        const selectedSubdistrict = subdistricts.find(s => s.subdistrict_id === value);
        if (selectedSubdistrict) {
          updated.district = selectedSubdistrict.subdistrict_name;
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
    if (!formData.provinceId.trim()) newErrors.provinceId = 'Provinsi harus diisi';
    if (!formData.cityId.trim()) newErrors.cityId = 'Kota harus diisi';
    if (!formData.district.trim()) newErrors.district = 'Kecamatan harus diisi';
    if (!formData.subdistrict.trim()) newErrors.subdistrict = 'Kelurahan harus diisi';
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
          name="subdistrictId"
          value={formData.subdistrictId}
          onChange={handleChange}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
            errors.district ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={!formData.cityId || loadingSubdistricts}
        >
          <option value="">Pilih kecamatan</option>
          {subdistricts.map(subdistrict => (
            <option key={subdistrict.subdistrict_id} value={subdistrict.subdistrict_id}>
              {subdistrict.subdistrict_name}
            </option>
          ))}
        </select>
        {loadingSubdistricts && (
          <div className="mt-2 flex items-center text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
            Memuat kecamatan...
          </div>
        )}
        {errors.district && (
          <p className="text-red-500 text-xs mt-1">{errors.district}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kelurahan/Desa *
        </label>
        <input
          type="text"
          name="subdistrict"
          value={formData.subdistrict}
          onChange={handleChange}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
            errors.subdistrict ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Masukkan nama kelurahan/desa"
        />
        {errors.subdistrict && (
          <p className="text-red-500 text-xs mt-1">{errors.subdistrict}</p>
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