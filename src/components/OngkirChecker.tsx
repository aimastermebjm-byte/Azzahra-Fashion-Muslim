import React, { useState, useEffect } from 'react';
import { MapPin, Package, Truck, Loader2, Search } from 'lucide-react';
import { rajaOngkirService, Province, City, CostResult } from '../utils/rajaOngkirService';

interface OngkirCheckerProps {
  originCityId?: string;
  weight?: number;
  onCostSelected?: (courier: string, service: string, cost: number, etd: string) => void;
  className?: string;
}

export const OngkirChecker: React.FC<OngkirCheckerProps> = ({
  originCityId = '152', // Default: Jakarta Pusat
  weight = 1000, // Default: 1kg
  onCostSelected,
  className = ''
}) => {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedCourier, setSelectedCourier] = useState<string>('jne');
  const [costResults, setCostResults] = useState<CostResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingCities, setLoadingCities] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [selectedService, setSelectedService] = useState<{
    courier: string;
    service: string;
    cost: number;
    etd: string;
  } | null>(null);

  // Load provinces on mount
  useEffect(() => {
    loadProvinces();
  }, []);

  // Load cities when province changes
  useEffect(() => {
    if (selectedProvince) {
      loadCities(selectedProvince);
    } else {
      setCities([]);
    }
  }, [selectedProvince]);

  const loadProvinces = async () => {
    try {
      setLoading(true);
      const provincesData = await rajaOngkirService.getProvinces();
      setProvinces(provincesData);
    } catch (err) {
      setError('Gagal memuat data provinsi');
    } finally {
      setLoading(false);
    }
  };

  const loadCities = async (provinceId: string) => {
    try {
      setLoadingCities(true);
      const citiesData = await rajaOngkirService.getCities(provinceId);
      setCities(citiesData);
      setSelectedCity(''); // Reset city when province changes
    } catch (err) {
      setError('Gagal memuat data kota');
    } finally {
      setLoadingCities(false);
    }
  };

  const calculateCost = async () => {
    if (!selectedCity || !selectedCourier) {
      setError('Silakan pilih kota tujuan dan kurir');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setCostResults([]);

      const results = await rajaOngkirService.calculateCost(
        originCityId,
        selectedCity,
        weight,
        selectedCourier
      );

      setCostResults(results);
    } catch (err: any) {
      setError(err.message || 'Gagal menghitung ongkos kirim');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (courierCode: string, service: string, cost: number, etd: string) => {
    const selection = {
      courier: courierCode,
      service,
      cost,
      etd
    };

    setSelectedService(selection);

    if (onCostSelected) {
      onCostSelected(courierCode, service, cost, etd);
    }
  };

  const getSelectedCourierName = () => {
    const couriers = rajaOngkirService.getCouriers();
    const courier = couriers.find(c => c.code === selectedCourier);
    return courier?.name || selectedCourier.toUpperCase();
  };

  if (loading && provinces.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mr-2" />
          <span className="text-gray-600">Memuat data provinsi...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center mb-4">
        <Truck className="w-5 h-5 text-blue-500 mr-2" />
        <h3 className="text-lg font-semibold text-gray-800">Cek Ongkos Kirim</h3>
      </div>

      {/* Origin Info */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center text-sm text-gray-600">
          <MapPin className="w-4 h-4 mr-2" />
          <span>Dikirim dari Jakarta</span>
        </div>
        <div className="flex items-center text-sm text-gray-600 mt-1">
          <Package className="w-4 h-4 mr-2" />
          <span>Berat: {(weight / 1000).toFixed(1)} kg</span>
        </div>
      </div>

      {/* Province Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Provinsi Tujuan
        </label>
        <select
          value={selectedProvince}
          onChange={(e) => setSelectedProvince(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">-- Pilih Provinsi --</option>
          {provinces.map((province) => (
            <option key={province.province_id} value={province.province_id}>
              {province.province}
            </option>
          ))}
        </select>
      </div>

      {/* City Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Kota/Kabupaten Tujuan
        </label>
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          disabled={!selectedProvince || loadingCities}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        >
          <option value="">-- Pilih Kota --</option>
          {cities.map((city) => (
            <option key={city.city_id} value={city.city_id}>
              {city.type} {city.city_name}
            </option>
          ))}
        </select>
        {loadingCities && (
          <div className="flex items-center mt-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
            Memuat kota...
          </div>
        )}
      </div>

      {/* Courier Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Kurir
        </label>
        <select
          value={selectedCourier}
          onChange={(e) => setSelectedCourier(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {rajaOngkirService.getCouriers().map((courier) => (
            <option key={courier.code} value={courier.code}>
              {courier.name}
            </option>
          ))}
        </select>
      </div>

      {/* Calculate Button */}
      <button
        onClick={calculateCost}
        disabled={!selectedCity || loading}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Menghitung...
          </>
        ) : (
          <>
            <Search className="w-4 h-4 mr-2" />
            Cek Ongkir
          </>
        )}
      </button>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Cost Results */}
      {costResults.length > 0 && (
        <div className="mt-4 space-y-3">
          <h4 className="font-medium text-gray-700">Hasil Pencarian - {getSelectedCourierName()}</h4>

          {costResults.map((result) => (
            <div key={result.code} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800">{result.name}</p>
                  <p className="text-sm text-gray-500">{result.code.toUpperCase()}</p>
                </div>
              </div>

              <div className="space-y-2">
                {result.costs.map((cost, index) => (
                  <button
                    key={index}
                    onClick={() => handleServiceSelect(
                      result.code,
                      cost.service,
                      cost.cost[0].value,
                      cost.cost[0].etd
                    )}
                    className={`w-full text-left p-3 rounded-lg border transition-colors duration-200 ${
                      selectedService?.courier === result.code && selectedService?.service === cost.service
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{cost.service}</p>
                        <p className="text-sm text-gray-600">{cost.description}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Estimasi: <span className="font-medium">{cost.cost[0].etd}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">
                          Rp {cost.cost[0].value.toLocaleString('id-ID')}
                        </p>
                        {selectedService?.courier === result.code && selectedService?.service === cost.service && (
                          <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                            Dipilih
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OngkirChecker;