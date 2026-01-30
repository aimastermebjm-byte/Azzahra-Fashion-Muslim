import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

// ✅ Static data for instant dropdown (no API call needed)
import provincesData from '../data/provinces.json';
import citiesData from '../data/cities.json';

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

const ADDRESS_CACHE_PREFIX = 'addressFormCache';
const ADDRESS_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const isBrowser = typeof window !== 'undefined';

const readPersistentCache = <T,>(key: string): T | null => {
  if (!isBrowser) return null;

  try {
    const raw = localStorage.getItem(`${ADDRESS_CACHE_PREFIX}_${key}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { data: T; timestamp: number };
    if (!parsed?.data) return null;

    const isExpired = Date.now() - parsed.timestamp > ADDRESS_CACHE_TTL;
    if (isExpired) {
      localStorage.removeItem(`${ADDRESS_CACHE_PREFIX}_${key}`);
      return null;
    }

    return parsed.data;
  } catch (storageError) {
    console.error('❌ Error reading persisted address cache:', storageError);
    return null;
  }
};

const writePersistentCache = <T,>(key: string, data: T): void => {
  if (!isBrowser) return;

  try {
    localStorage.setItem(
      `${ADDRESS_CACHE_PREFIX}_${key}`,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch (storageError) {
    console.error('❌ Error writing persisted address cache:', storageError);
  }
};

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
  const buildFormState = (data?: Address | null): Address => {
    let street = data?.fullAddress || '';

    // 🔥 CLEANUP: Prevent doubling if data was already "poisoned" by old buggy saves
    if (street && data) {
      // Components in reverse order of how they were appended (Province, City, District, Subdistrict)
      const comps = [data.province, data.city, data.district, data.subdistrict].filter(Boolean);
      for (const comp of comps) {
        const suffix = `, ${comp}`;
        // Case insensitive strip from end
        if (street.toUpperCase().endsWith(suffix.toUpperCase())) {
          street = street.substring(0, street.length - suffix.length);
        } else if (street.toUpperCase().endsWith(comp.toUpperCase())) {
          // Fallback if no comma (some old formats)
          const lastIndex = street.toUpperCase().lastIndexOf(comp.toUpperCase());
          if (lastIndex > 0) {
            const before = street.charAt(lastIndex - 1);
            if (before === ' ' || before === ',') {
              street = street.substring(0, lastIndex).trim().replace(/,$/, '');
            }
          }
        }
      }
    }

    return {
      name: data?.name || '',
      phone: data?.phone || '',
      fullAddress: street.trim(), // Cleaned street detail
      province: data?.province || '',
      provinceId: data?.provinceId || '',
      city: data?.city || '',
      cityId: data?.cityId || '',
      district: data?.district || '',
      districtId: data?.districtId || '',
      subdistrict: data?.subdistrict || '',
      subdistrictId: data?.subdistrictId || '',
      postalCode: data?.postalCode || '',
      isDefault: data?.isDefault || false
    };
  };

  const [formData, setFormData] = useState<Address>(buildFormState(initialData));

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subdistricts, setSubdistricts] = useState<Subdistrict[]>([]);

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSubdistricts, setLoadingSubdistricts] = useState(false);
  const [errors, setErrors] = useState<Partial<Address>>({});

  // In-memory cache to reduce API calls within browser session
  const [addressCache, setAddressCache] = useState<Map<string, any>>(new Map());
  const isPrefillingRef = useRef(!!initialData);

  // Load provinces on component mount (preload for instant dropdown)
  useEffect(() => {
    // Start loading provinces immediately
    loadProvinces();

    // Preload popular provinces data in background for better UX
    // This ensures that when user selects common provinces, cities are already cached
    const popularProvinceIds = ['11', '12', '31', '34', '10', '6']; // Jabar, Jateng, DKI, Jatim, DIY, Banten
    popularProvinceIds.forEach(async (provinceId) => {
      try {
        // Preload cities for popular provinces (background, non-blocking)
        const cacheKey = `cities_${provinceId}`;
        const persistedData = readPersistentCache<City[]>(cacheKey);
        if (persistedData) {
          setAddressCache(prev => new Map(prev).set(cacheKey, persistedData));
          return;
        }

        const response = await fetch(`/api/address-cached?type=cities&provinceId=${provinceId}`);
        const data = await response.json();
        if (data.success && data.data) {
          setAddressCache(prev => new Map(prev).set(cacheKey, data.data));
          writePersistentCache(cacheKey, data.data);
        }
      } catch (error) {
        // Silently fail preload - not critical
      }
    });
  }, []); // Only run once on mount

  useEffect(() => {
    setFormData(buildFormState(initialData));
    isPrefillingRef.current = !!initialData;
  }, [initialData]);

  useEffect(() => {
    const hydrateInitialData = async () => {
      if (!initialData) {
        isPrefillingRef.current = false;
        return;
      }

      isPrefillingRef.current = true;

      if (initialData.provinceId) {
        await loadCities(initialData.provinceId);
      }
      if (initialData.cityId) {
        await loadDistricts(initialData.cityId);
      }
      if (initialData.districtId) {
        await loadSubdistricts(initialData.districtId);
      }

      isPrefillingRef.current = false;
    };

    void hydrateInitialData();
  }, [initialData]);

  // Load cities when province changes
  useEffect(() => {
    if (!formData.provinceId) return;

    // Load cities immediately (eager loading)
    loadCities();

    if (isPrefillingRef.current) return;

    // Only reset dependent fields when user changes selection
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
  }, [formData.provinceId]);

  // Load districts when city changes
  useEffect(() => {
    if (!formData.cityId) return;

    loadDistricts();

    if (isPrefillingRef.current) return;

    setSubdistricts([]);
    setFormData(prev => ({
      ...prev,
      district: '',
      districtId: '',
      subdistrict: '',
      subdistrictId: '',
      postalCode: ''
    }));
  }, [formData.cityId]);

  // Load subdistricts when district changes
  useEffect(() => {
    if (!formData.districtId) return;

    loadSubdistricts();

    if (isPrefillingRef.current) return;

    setFormData(prev => ({
      ...prev,
      subdistrict: '',
      subdistrictId: '',
      postalCode: ''
    }));
  }, [formData.districtId]);

  // ✅ OPTIMIZED: Load provinces from static JSON (INSTANT - no API call)
  const loadProvinces = async () => {
    // Static data is already typed correctly from import
    setProvinces(provincesData as Province[]);
    // Also cache it for consistency with rest of the code
    setAddressCache(prev => new Map(prev).set('provinces', provincesData));
  };

  // ✅ OPTIMIZED: Load cities from static JSON (INSTANT - no API call)
  const loadCities = async (provinceIdOverride?: string) => {
    const provinceId = provinceIdOverride || formData.provinceId;
    if (!provinceId) return [];

    // Filter cities from static data - INSTANT!
    const filteredCities = (citiesData as City[]).filter(
      city => city.province_id === provinceId
    );

    setCities(filteredCities);
    setAddressCache(prev => new Map(prev).set(`cities_${provinceId}`, filteredCities));
    return filteredCities;
  };

  const loadDistricts = async (cityIdOverride?: string) => {
    const cityId = cityIdOverride || formData.cityId;
    if (!cityId) return [];

    const cacheKey = `districts_${cityId}`;

    if (addressCache.has(cacheKey)) {
      const cached = addressCache.get(cacheKey) as District[];
      setDistricts(cached);
      return cached;
    }

    const persistedData = readPersistentCache<District[]>(cacheKey);
    if (persistedData) {
      setDistricts(persistedData);
      setAddressCache(prev => new Map(prev).set(cacheKey, persistedData));
      return persistedData;
    }

    setLoadingDistricts(true);
    try {
      const response = await fetch(`/api/address-cached?type=districts&cityId=${cityId}`);
      const data = await response.json();

      if (data.success && data.data) {
        setDistricts(data.data);
        setAddressCache(prev => new Map(prev).set(cacheKey, data.data));
        writePersistentCache(cacheKey, data.data);
        return data.data;
      } else {
        console.error('❌ Failed to load districts:', data.message);
      }
    } catch (error) {
      console.error('Error loading districts:', error);
    } finally {
      setLoadingDistricts(false);
    }

    return [];
  };

  const loadSubdistricts = async (districtIdOverride?: string) => {
    const districtId = districtIdOverride || formData.districtId;
    if (!districtId) return [];

    const cacheKey = `subdistricts_${districtId}`;

    if (addressCache.has(cacheKey)) {
      const cached = addressCache.get(cacheKey) as Subdistrict[];
      setSubdistricts(cached);
      return cached;
    }

    const persistedData = readPersistentCache<Subdistrict[]>(cacheKey);
    if (persistedData) {
      setSubdistricts(persistedData);
      setAddressCache(prev => new Map(prev).set(cacheKey, persistedData));
      return persistedData;
    }

    setLoadingSubdistricts(true);
    try {
      const response = await fetch(`/api/address-cached?type=subdistricts&districtId=${districtId}`);
      const data = await response.json();

      if (data.success && data.data) {
        setSubdistricts(data.data);
        setAddressCache(prev => new Map(prev).set(cacheKey, data.data));
        writePersistentCache(cacheKey, data.data);
        return data.data;
      } else {
        console.error('❌ Failed to load subdistricts:', data.message);
      }
    } catch (error) {
      console.error('Error loading subdistricts:', error);
    } finally {
      setLoadingSubdistricts(false);
    }

    return [];
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: newValue
      };

      // Special handling: Capture text directly from the <select> option
      // This is foolproof compared to searching in arrays by ID
      if (e.target instanceof HTMLSelectElement && e.target.selectedIndex >= 0) {
        const selectedText = e.target.options[e.target.selectedIndex].text;

        if (name === 'provinceId' && value) {
          updated.province = selectedText;
        }
        else if (name === 'cityId' && value) {
          updated.city = selectedText;
        }
        else if (name === 'districtId' && value) {
          updated.district = selectedText;
        }
        else if (name === 'subdistrictId' && value) {
          updated.subdistrict = selectedText;
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
      // ✅ FIX: Don't mutate fullAddress (street details) into composed address here.
      // The rest of the app expects fullAddress property to be JUST the street detail
      // because they will append components (province, etc.) manually for display/printing.
      onSave(formData);
    }
  };

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
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'
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
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${errors.phone ? 'border-red-500' : 'border-gray-300'
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
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${errors.provinceId ? 'border-red-500' : 'border-gray-300'
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
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${errors.cityId ? 'border-red-500' : 'border-gray-300'
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
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${errors.districtId ? 'border-red-500' : 'border-gray-300'
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
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${errors.subdistrictId ? 'border-red-500' : 'border-gray-300'
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
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${errors.postalCode ? 'border-red-500' : 'border-gray-300'
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
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${errors.fullAddress ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Contoh: Jl. Merdeka No. 123, RT 001/RW 002"
        />
        {errors.fullAddress && (
          <p className="text-red-500 text-xs mt-1">{errors.fullAddress}</p>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-800">
          <strong>Preview Alamat:</strong><br />
          {(() => {
            // Use formData directly as it's populated by handleChange
            const parts = [
              formData.fullAddress,
              formData.subdistrict,
              formData.district,
              formData.city,
              formData.province,
              formData.postalCode
            ].filter(Boolean); // Filter out empty strings/nulls

            return parts.length > 0 ? parts.join(', ') : 'Alamat akan muncul di sini...';
          })()}
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