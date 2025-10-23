import React, { useState, useEffect } from 'react';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { rajaOngkirService, Province, City, Subdistrict } from '../utils/rajaOngkirService';

interface AddressSelectorProps {
  onAddressChange: (address: {
    provinceId: string;
    provinceName: string;
    cityId: string;
    cityName: string;
    district: string;
    subdistrict: string;
    fullAddress: string;
  }) => void;
  initialAddress?: {
    provinceId: string;
    provinceName: string;
    cityId: string;
    cityName: string;
    district: string;
    subdistrict: string;
    fullAddress: string;
  };
  className?: string;
}

const AddressSelector: React.FC<AddressSelectorProps> = ({
  onAddressChange,
  initialAddress,
  className = ''
}) => {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [subdistricts, setSubdistricts] = useState<Subdistrict[]>([]);

  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedSubdistrictId, setSelectedSubdistrictId] = useState('');

  const [district, setDistrict] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [addressDetail, setAddressDetail] = useState('');

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingSubdistricts, setLoadingSubdistricts] = useState(false);
  const [error, setError] = useState('');

  // Load provinces on component mount
  useEffect(() => {
    loadProvinces();
  }, []);

  // Load cities when province changes
  useEffect(() => {
    if (selectedProvinceId) {
      loadCities(selectedProvinceId);
      // Reset dependent fields
      setCities([]);
      setSubdistricts([]);
      setSelectedCityId('');
      setSelectedSubdistrictId('');
      setDistrict('');
      setSubdistrict('');
    }
  }, [selectedProvinceId]);

  // Load subdistricts when city changes
  useEffect(() => {
    if (selectedCityId) {
      loadSubdistricts(selectedCityId);
      // Reset dependent fields
      setSubdistricts([]);
      setSelectedSubdistrictId('');
      setDistrict('');
      setSubdistrict('');
    }
  }, [selectedCityId]);

  // Update address when all fields are filled
  useEffect(() => {
    if (selectedProvinceId && selectedCityId && district && subdistrict) {
      const province = provinces.find(p => p.province_id === selectedProvinceId);
      const city = cities.find(c => c.city_id === selectedCityId);

      if (province && city) {
        const fullAddress = `${addressDetail}, ${subdistrict}, ${district}, ${city.city_name}, ${province.province}`;

        onAddressChange({
          provinceId: selectedProvinceId,
          provinceName: province.province,
          cityId: selectedCityId,
          cityName: city.city_name,
          district,
          subdistrict,
          fullAddress
        });
      }
    }
  }, [selectedProvinceId, selectedCityId, district, subdistrict, addressDetail, provinces, cities, onAddressChange]);

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

  const handleProvinceChange = (provinceId: string) => {
    setSelectedProvinceId(provinceId);
  };

  const handleCityChange = (cityId: string) => {
    setSelectedCityId(cityId);
  };

  const handleSubdistrictChange = (subdistrictId: string) => {
    setSelectedSubdistrictId(subdistrictId);
    const selectedSub = subdistricts.find(s => s.subdistrict_id === subdistrictId);
    if (selectedSub) {
      // Extract district and subdistrict from the selected subdistrict data
      setSubdistrict(selectedSub.subdistrict_name);
      // For this implementation, we'll use the subdistrict name as both district and subdistrict
      // In a real implementation, you might want to have separate district data
      setDistrict(selectedSub.subdistrict_name);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center text-red-800">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Province Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <MapPin className="w-4 h-4 inline mr-1" />
          Provinsi
        </label>
        <select
          value={selectedProvinceId}
          onChange={(e) => handleProvinceChange(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
          disabled={loadingProvinces}
        >
          <option value="">Pilih Provinsi</option>
          {provinces.map((province) => (
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
      </div>

      {/* City Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Kota/Kabupaten
        </label>
        <select
          value={selectedCityId}
          onChange={(e) => handleCityChange(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
          disabled={!selectedProvinceId || loadingCities}
        >
          <option value="">Pilih Kota/Kabupaten</option>
          {cities.map((city) => (
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
      </div>

      {/* Subdistrict Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Kecamatan
        </label>
        <select
          value={selectedSubdistrictId}
          onChange={(e) => handleSubdistrictChange(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
          disabled={!selectedCityId || loadingSubdistricts}
        >
          <option value="">Pilih Kecamatan</option>
          {subdistricts.map((subdistrict) => (
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
      </div>

      {/* Manual District Input (for flexibility) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Kelurahan/Desa
        </label>
        <input
          type="text"
          value={subdistrict}
          onChange={(e) => setSubdistrict(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          placeholder="Masukkan nama kelurahan/desa"
        />
      </div>

      {/* Address Detail */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Alamat Lengkap (Jalan, RT/RW, No. Rumah)
        </label>
        <textarea
          value={addressDetail}
          onChange={(e) => setAddressDetail(e.target.value)}
          rows={3}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          placeholder="Contoh: Jl. Merdeka No. 123, RT 001/RW 002"
        />
      </div>

      {/* Selected Address Preview */}
      {selectedProvinceId && selectedCityId && district && subdistrict && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">
            <strong>Alamat Lengkap:</strong><br/>
            {addressDetail && `${addressDetail}, `}{subdistrict}, {district}, {cities.find(c => c.city_id === selectedCityId)?.city_name}, {provinces.find(p => p.province_id === selectedProvinceId)?.province}
          </p>
        </div>
      )}
    </div>
  );
};

export default AddressSelector;