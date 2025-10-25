
export interface Province {
  province_id: string;
  province: string;
}

export interface City {
  city_id: string;
  city_name: string;
  province: string;
  province_id: string;
  type: string;
  postal_code: string;
}

export interface Subdistrict {
  subdistrict_id: string;
  subdistrict_name: string;
  city_id: string;
  city: string;
  province: string;
  province_id: string;
  type: string;
}

export interface CostDetail {
  value: number;
  etd: string;
  note: string;
}

export interface CostService {
  service: string;
  description: string;
  cost: CostDetail[];
}

export interface CostResult {
  code: string;
  name: string;
  costs: CostService[];
}

export interface AddressData {
  provinceId: string;
  provinceName: string;
  cityId: string;
  cityName: string;
  district: string;
  subdistrict: string;
  fullAddress: string;
}

export const COURIERS = [
  { code: 'jnt', name: 'J&T Express' },
  { code: 'jne', name: 'JNE' },
  { code: 'pos', name: 'POS Indonesia' },
  { code: 'tiki', name: 'TIKI' },
  { code: 'sicepat', name: 'SiCepat Express' },
  { code: 'wahana', name: 'Wahana Prestasi Logistik' }
];

class RajaOngkirService {
  private baseUrl = '/api/rajaongkir';

  async getProvinces(): Promise<Province[]> {
    try {
      console.log('📍 Fetching real provinces from RajaOngkir API');
      const response = await fetch(`${this.baseUrl}/provinces`);

      if (!response.ok) {
        throw new Error('Failed to fetch provinces');
      }

      const data = await response.json();
      return data.rajaongkir.results;
    } catch (error) {
      console.error('❌ Error fetching provinces, falling back to mock data:', error);
      return this.getMockProvinces();
    }
  }

  async getCities(provinceId?: string): Promise<City[]> {
    try {
      console.log('🏙️ Fetching real cities from RajaOngkir API for province:', provinceId);
      const url = provinceId
        ? `${this.baseUrl}/cities?province=${provinceId}`
        : `${this.baseUrl}/cities`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch cities');
      }

      const data = await response.json();
      return data.rajaongkir.results;
    } catch (error) {
      console.error('❌ Error fetching cities, falling back to mock data:', error);
      return this.getMockCities(provinceId);
    }
  }

  async getSubdistricts(cityId: string): Promise<Subdistrict[]> {
    try {
      console.log('🏘️ Fetching real subdistricts from RajaOngkir API for city:', cityId);
      const response = await fetch(`${this.baseUrl}/subdistricts?city=${cityId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch subdistricts');
      }

      const data = await response.json();
      return data.rajaongkir.results;
    } catch (error) {
      console.error('❌ Error fetching subdistricts, falling back to mock data:', error);
      return this.getMockSubdistricts(cityId);
    }
  }

  async calculateShippingCost(
    destinationCityId: string,
    weight: number,
    courier: string
  ): Promise<CostResult[]> {
    try {
      console.log('📦 Calculating REAL shipping cost from Komerce API');
      console.log('📋 Parameters:', { origin: '607', destination: destinationCityId, weight, courier });

      // Convert weight to kg (Komerce uses kg, frontend uses grams)
      const weightInKg = Math.max(1, weight / 1000);

      // Use GET method for Komerce API with query parameters
      const params = new URLSearchParams({
        shipper_destination_id: '607', // Banjarmasin
        receiver_destination_id: destinationCityId,
        weight: weightInKg.toString(),
        item_value: '100000', // Default item value
        cod: 'no',
        origin_pin_point: '-3.3186111,114.5908333', // Banjarmasin coordinates
        destination_pin_point: '-6.2087634,106.845599' // Jakarta coordinates (default)
      });

      const response = await fetch(`${this.baseUrl}/cost?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to calculate shipping cost');
      }

      const data = await response.json();
      console.log('✅ Real shipping cost result:', data);

      // Return transformed format (backend already transforms Komerce response)
      return data.rajaongkir.results;
    } catch (error) {
      console.error('❌ Error calculating shipping cost, falling back to mock data:', error);
      return this.getMockCost('607', destinationCityId, weight, courier);
    }
  }

  private getMockProvinces(): Province[] {
    return [
      { province_id: '1', province: 'Bali' },
      { province_id: '2', province: 'Bangka Belitung' },
      { province_id: '3', province: 'Banten' },
      { province_id: '4', province: 'Bengkulu' },
      { province_id: '5', province: 'Daerah Istimewa Yogyakarta' },
      { province_id: '6', province: 'DKI Jakarta' },
      { province_id: '7', province: 'Gorontalo' },
      { province_id: '8', province: 'Jambi' },
      { province_id: '9', province: 'Jawa Barat' },
      { province_id: '10', province: 'Jawa Tengah' },
      { province_id: '11', province: 'Jawa Timur' },
      { province_id: '12', province: 'Kalimantan Barat' },
      { province_id: '13', province: 'Kalimantan Selatan' },
      { province_id: '14', province: 'Kalimantan Tengah' },
      { province_id: '15', province: 'Kalimantan Timur' },
      { province_id: '16', province: 'Kalimantan Utara' },
      { province_id: '17', province: 'Kepulauan Riau' },
      { province_id: '18', province: 'Lampung' },
      { province_id: '19', province: 'Maluku' },
      { province_id: '20', province: 'Maluku Utara' },
      { province_id: '21', province: 'Nusa Tenggara Barat' },
      { province_id: '22', province: 'Nusa Tenggara Timur' },
      { province_id: '23', province: 'Papua' },
      { province_id: '24', province: 'Papua Barat' },
      { province_id: '25', province: 'Riau' },
      { province_id: '26', province: 'Sulawesi Barat' },
      { province_id: '27', province: 'Sulawesi Selatan' },
      { province_id: '28', province: 'Sulawesi Tengah' },
      { province_id: '29', province: 'Sulawesi Tenggara' },
      { province_id: '30', province: 'Sulawesi Utara' },
      { province_id: '31', province: 'Sumatera Barat' },
      { province_id: '32', province: 'Sumatera Selatan' },
      { province_id: '33', province: 'Sumatera Utara' },
      { province_id: '34', province: 'Aceh' }
    ];
  }

  private getMockCities(provinceId?: string): City[] {
    const allCities: City[] = [
      // BALI
      { city_id: '17', city_name: 'Badung', province: 'Bali', province_id: '1', type: 'Kabupaten', postal_code: '80351' },
      { city_id: '18', city_name: 'Bangli', province: 'Bali', province_id: '1', type: 'Kabupaten', postal_code: '80619' },
      { city_id: '19', city_name: 'Buleleng', province: 'Bali', province_id: '1', type: 'Kabupaten', postal_code: '81111' },
      { city_id: '20', city_name: 'Gianyar', province: 'Bali', province_id: '1', type: 'Kabupaten', postal_code: '80511' },
      { city_id: '21', city_name: 'Jembrana', province: 'Bali', province_id: '1', type: 'Kabupaten', postal_code: '82211' },
      { city_id: '22', city_name: 'Karangasem', province: 'Bali', province_id: '1', type: 'Kabupaten', postal_code: '80811' },
      { city_id: '23', city_name: 'Klungkung', province: 'Bali', province_id: '1', type: 'Kabupaten', postal_code: '80711' },
      { city_id: '24', city_name: 'Tabanan', province: 'Bali', province_id: '1', type: 'Kabupaten', postal_code: '82111' },
      { city_id: '25', city_name: 'Denpasar', province: 'Bali', province_id: '1', type: 'Kota', postal_code: '80227' },

      // KALIMANTAN SELATAN
      { city_id: '192', city_name: 'Tanah Laut', province: 'Kalimantan Selatan', province_id: '13', type: 'Kabupaten', postal_code: '70811' },
      { city_id: '193', city_name: 'Kotabaru', province: 'Kalimantan Selatan', province_id: '13', type: 'Kabupaten', postal_code: '72111' },
      { city_id: '194', city_name: 'Banjar', province: 'Kalimantan Selatan', province_id: '13', type: 'Kabupaten', postal_code: '70611' },
      { city_id: '195', city_name: 'Barito Kuala', province: 'Kalimantan Selatan', province_id: '13', type: 'Kabupaten', postal_code: '70511' },
      { city_id: '196', city_name: 'Tapin', province: 'Kalimantan Selatan', province_id: '13', type: 'Kabupaten', postal_code: '71111' },
      { city_id: '197', city_name: 'Hulu Sungai Selatan', province: 'Kalimantan Selatan', province_id: '13', type: 'Kabupaten', postal_code: '71211' },
      { city_id: '198', city_name: 'Hulu Sungai Tengah', province: 'Kalimantan Selatan', province_id: '13', type: 'Kabupaten', postal_code: '71311' },
      { city_id: '199', city_name: 'Hulu Sungai Utara', province: 'Kalimantan Selatan', province_id: '13', type: 'Kabupaten', postal_code: '71411' },
      { city_id: '200', city_name: 'Tabalong', province: 'Kalimantan Selatan', province_id: '13', type: 'Kabupaten', postal_code: '71511' },
      { city_id: '201', city_name: 'Tanah Bumbu', province: 'Kalimantan Selatan', province_id: '13', type: 'Kabupaten', postal_code: '72211' },
      { city_id: '202', city_name: 'Balangan', province: 'Kalimantan Selatan', province_id: '13', type: 'Kabupaten', postal_code: '71611' },
      { city_id: '607', city_name: 'Banjarmasin', province: 'Kalimantan Selatan', province_id: '13', type: 'Kota', postal_code: '70117' },
      { city_id: '608', city_name: 'Banjarbaru', province: 'Kalimantan Selatan', province_id: '13', type: 'Kota', postal_code: '70712' },

      // DKI JAKARTA
      { city_id: '56', city_name: 'Jakarta Pusat', province: 'DKI Jakarta', province_id: '6', type: 'Kota Administrasi', postal_code: '10110' },
      { city_id: '57', city_name: 'Jakarta Utara', province: 'DKI Jakarta', province_id: '6', type: 'Kota Administrasi', postal_code: '14140' },
      { city_id: '58', city_name: 'Jakarta Barat', province: 'DKI Jakarta', province_id: '6', type: 'Kota Administrasi', postal_code: '11110' },
      { city_id: '59', city_name: 'Jakarta Selatan', province: 'DKI Jakarta', province_id: '6', type: 'Kota Administrasi', postal_code: '12110' },
      { city_id: '60', city_name: 'Jakarta Timur', province: 'DKI Jakarta', province_id: '6', type: 'Kota Administrasi', postal_code: '13110' },
      { city_id: '61', city_name: 'Kepulauan Seribu', province: 'DKI Jakarta', province_id: '6', type: 'Kabupaten Administrasi', postal_code: '11110' },

      // JAWA BARAT
      { city_id: '43', city_name: 'Bandung', province: 'Jawa Barat', province_id: '9', type: 'Kabupaten', postal_code: '40111' },
      { city_id: '44', city_name: 'Bandung Barat', province: 'Jawa Barat', province_id: '9', type: 'Kabupaten', postal_code: '40511' },
      { city_id: '45', city_name: 'Bekasi', province: 'Jawa Barat', province_id: '9', type: 'Kabupaten', postal_code: '17111' },
      { city_id: '46', city_name: 'Bogor', province: 'Jawa Barat', province_id: '9', type: 'Kabupaten', postal_code: '16111' },
      { city_id: '47', city_name: 'Ciamis', province: 'Jawa Barat', province_id: '9', type: 'Kabupaten', postal_code: '46211' },
      { city_id: '48', city_name: 'Cianjur', province: 'Jawa Barat', province_id: '9', type: 'Kabupaten', postal_code: '43211' },
      { city_id: '49', city_name: 'Cirebon', province: 'Jawa Barat', province_id: '9', type: 'Kabupaten', postal_code: '45111' },
      { city_id: '50', city_name: 'Garut', province: 'Jawa Barat', province_id: '9', type: 'Kabupaten', postal_code: '44111' },
      { city_id: '51', city_name: 'Indramayu', province: 'Jawa Barat', province_id: '9', type: 'Kabupaten', postal_code: '45211' },
      { city_id: '52', city_name: 'Karawang', province: 'Jawa Barat', province_id: '9', type: 'Kabupaten', postal_code: '41311' },
      { city_id: '53', city_name: 'Kuningan', province: 'Jawa Barat', province_id: '9', type: 'Kabupaten', postal_code: '45511' },
      { city_id: '54', city_name: 'Majalengka', province: 'Jawa Barat', province_id: '9', type: 'Kabupaten', postal_code: '45411' },
      { city_id: '55', city_name: 'Pangandaran', province: 'Jawa Barat', province_id: '9', type: 'Kabupaten', postal_code: '46311' },
      { city_id: '96', city_name: 'Bandung', province: 'Jawa Barat', province_id: '9', type: 'Kota', postal_code: '40111' },
      { city_id: '97', city_name: 'Banjar', province: 'Jawa Barat', province_id: '9', type: 'Kota', postal_code: '46311' },
      { city_id: '98', city_name: 'Bekasi', province: 'Jawa Barat', province_id: '9', type: 'Kota', postal_code: '17111' },
      { city_id: '99', city_name: 'Bogor', province: 'Jawa Barat', province_id: '9', type: 'Kota', postal_code: '16111' },
      { city_id: '100', city_name: 'Cimahi', province: 'Jawa Barat', province_id: '9', type: 'Kota', postal_code: '40511' },
      { city_id: '101', city_name: 'Cirebon', province: 'Jawa Barat', province_id: '9', type: 'Kota', postal_code: '45111' },
      { city_id: '102', city_name: 'Depok', province: 'Jawa Barat', province_id: '9', type: 'Kota', postal_code: '16411' },
      { city_id: '103', city_name: 'Sukabumi', province: 'Jawa Barat', province_id: '9', type: 'Kota', postal_code: '43111' },
      { city_id: '104', city_name: 'Tasikmalaya', province: 'Jawa Barat', province_id: '9', type: 'Kota', postal_code: '46111' },

      // JAWA TENGAH
      { city_id: '69', city_name: 'Semarang', province: 'Jawa Tengah', province_id: '10', type: 'Kabupaten', postal_code: '50111' },
      { city_id: '70', city_name: 'Surakarta', province: 'Jawa Tengah', province_id: '10', type: 'Kabupaten', postal_code: '57111' },
      { city_id: '71', city_name: 'Salatiga', province: 'Jawa Tengah', province_id: '10', type: 'Kabupaten', postal_code: '50711' },
      { city_id: '72', city_name: 'Pekalongan', province: 'Jawa Tengah', province_id: '10', type: 'Kabupaten', postal_code: '51111' },
      { city_id: '73', city_name: 'Tegal', province: 'Jawa Tengah', province_id: '10', type: 'Kabupaten', postal_code: '52111' },
      { city_id: '134', city_name: 'Magelang', province: 'Jawa Tengah', province_id: '10', type: 'Kota', postal_code: '56111' },
      { city_id: '135', city_name: 'Pekalongan', province: 'Jawa Tengah', province_id: '10', type: 'Kota', postal_code: '51111' },
      { city_id: '136', city_name: 'Salatiga', province: 'Jawa Tengah', province_id: '10', type: 'Kota', postal_code: '50711' },
      { city_id: '137', city_name: 'Semarang', province: 'Jawa Tengah', province_id: '10', type: 'Kota', postal_code: '50111' },
      { city_id: '138', city_name: 'Surakarta', province: 'Jawa Tengah', province_id: '10', type: 'Kota', postal_code: '57111' },
      { city_id: '139', city_name: 'Tegal', province: 'Jawa Tengah', province_id: '10', type: 'Kota', postal_code: '52111' },

      // JAWA TIMUR
      { city_id: '140', city_name: 'Bangkalan', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '69111' },
      { city_id: '141', city_name: 'Banyuwangi', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '68411' },
      { city_id: '142', city_name: 'Blitar', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '66111' },
      { city_id: '143', city_name: 'Bojonegoro', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '62111' },
      { city_id: '144', city_name: 'Bondowoso', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '68211' },
      { city_id: '145', city_name: 'Gresik', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '61111' },
      { city_id: '146', city_name: 'Jember', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '68111' },
      { city_id: '147', city_name: 'Jombang', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '61411' },
      { city_id: '148', city_name: 'Kediri', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '64111' },
      { city_id: '149', city_name: 'Lamongan', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '62211' },
      { city_id: '150', city_name: 'Lumajang', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '67311' },
      { city_id: '151', city_name: 'Madiun', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '63111' },
      { city_id: '152', city_name: 'Magetan', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '63311' },
      { city_id: '153', city_name: 'Malang', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '65111' },
      { city_id: '154', city_name: 'Mojokerto', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '61311' },
      { city_id: '155', city_name: 'Nganjuk', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '64411' },
      { city_id: '156', city_name: 'Ngawi', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '63211' },
      { city_id: '157', city_name: 'Pacitan', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '63511' },
      { city_id: '158', city_name: 'Pamekasan', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '69311' },
      { city_id: '159', city_name: 'Pasuruan', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '67111' },
      { city_id: '160', city_name: 'Ponorogo', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '63411' },
      { city_id: '161', city_name: 'Probolinggo', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '67211' },
      { city_id: '162', city_name: 'Sampang', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '69211' },
      { city_id: '163', city_name: 'Sidoarjo', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '61211' },
      { city_id: '164', city_name: 'Situbondo', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '68311' },
      { city_id: '165', city_name: 'Sumenep', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '69411' },
      { city_id: '166', city_name: 'Trenggalek', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '66411' },
      { city_id: '167', city_name: 'Tuban', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '62311' },
      { city_id: '168', city_name: 'Tulungagung', province: 'Jawa Timur', province_id: '11', type: 'Kabupaten', postal_code: '66211' },
      { city_id: '169', city_name: 'Batu', province: 'Jawa Timur', province_id: '11', type: 'Kota', postal_code: '65311' },
      { city_id: '170', city_name: 'Blitar', province: 'Jawa Timur', province_id: '11', type: 'Kota', postal_code: '66111' },
      { city_id: '171', city_name: 'Kediri', province: 'Jawa Timur', province_id: '11', type: 'Kota', postal_code: '64111' },
      { city_id: '172', city_name: 'Madiun', province: 'Jawa Timur', province_id: '11', type: 'Kota', postal_code: '63111' },
      { city_id: '173', city_name: 'Malang', province: 'Jawa Timur', province_id: '11', type: 'Kota', postal_code: '65111' },
      { city_id: '174', city_name: 'Mojokerto', province: 'Jawa Timur', province_id: '11', type: 'Kota', postal_code: '61311' },
      { city_id: '175', city_name: 'Pasuruan', province: 'Jawa Timur', province_id: '11', type: 'Kota', postal_code: '67111' },
      { city_id: '176', city_name: 'Probolinggo', province: 'Jawa Timur', province_id: '11', type: 'Kota', postal_code: '67211' },
      { city_id: '177', city_name: 'Surabaya', province: 'Jawa Timur', province_id: '11', type: 'Kota', postal_code: '60111' },

      // SUMATERA UTARA
      { city_id: '1', city_name: 'Sibolga', province: 'Sumatera Utara', province_id: '33', type: 'Kota', postal_code: '22511' },
      { city_id: '2', city_name: 'Tanjung Balai', province: 'Sumatera Utara', province_id: '33', type: 'Kota', postal_code: '21311' },
      { city_id: '3', city_name: 'Pematangsiantar', province: 'Sumatera Utara', province_id: '33', type: 'Kota', postal_code: '21111' },
      { city_id: '4', city_name: 'Tebing Tinggi', province: 'Sumatera Utara', province_id: '33', type: 'Kota', postal_code: '20611' },
      { city_id: '5', city_name: 'Binjai', province: 'Sumatera Utara', province_id: '33', type: 'Kota', postal_code: '20711' },
      { city_id: '6', city_name: 'Medan', province: 'Sumatera Utara', province_id: '33', type: 'Kota', postal_code: '20111' },
      { city_id: '7', city_name: 'Padangsidimpuan', province: 'Sumatera Utara', province_id: '33', type: 'Kota', postal_code: '22711' },
      { city_id: '8', city_name: 'Gunungsitoli', province: 'Sumatera Utara', province_id: '33', type: 'Kota', postal_code: '22811' }
    ];

    if (provinceId) {
      return allCities.filter(city => city.province_id === provinceId);
    }
    return allCities;
  }

  private getMockSubdistricts(cityId: string): Subdistrict[] {
    // Comprehensive mock subdistricts data for major cities
    const subdistrictsMap: { [key: string]: Subdistrict[] } = {
      '607': [ // Banjarmasin
        { subdistrict_id: '60701', subdistrict_name: 'Banjarmasin Utara', city_id: '607', city: 'Banjarmasin', province: 'Kalimantan Selatan', province_id: '13', type: 'Kecamatan' },
        { subdistrict_id: '60702', subdistrict_name: 'Banjarmasin Tengah', city_id: '607', city: 'Banjarmasin', province: 'Kalimantan Selatan', province_id: '13', type: 'Kecamatan' },
        { subdistrict_id: '60703', subdistrict_name: 'Banjarmasin Selatan', city_id: '607', city: 'Banjarmasin', province: 'Kalimantan Selatan', province_id: '13', type: 'Kecamatan' },
        { subdistrict_id: '60704', subdistrict_name: 'Banjarmasin Barat', city_id: '607', city: 'Banjarmasin', province: 'Kalimantan Selatan', province_id: '13', type: 'Kecamatan' },
        { subdistrict_id: '60705', subdistrict_name: 'Banjarmasin Timur', city_id: '607', city: 'Banjarmasin', province: 'Kalimantan Selatan', province_id: '13', type: 'Kecamatan' },
        { subdistrict_id: '60706', subdistrict_name: 'Surgi Mufti', city_id: '607', city: 'Banjarmasin', province: 'Kalimantan Selatan', province_id: '13', type: 'Kelurahan' },
        { subdistrict_id: '60707', subdistrict_name: 'Antasan Besar', city_id: '607', city: 'Banjarmasin', province: 'Kalimantan Selatan', province_id: '13', type: 'Kelurahan' },
        { subdistrict_id: '60708', subdistrict_name: 'Pekapuran Raya', city_id: '607', city: 'Banjarmasin', province: 'Kalimantan Selatan', province_id: '13', type: 'Kelurahan' },
        { subdistrict_id: '60709', subdistrict_name: 'Kertak Hanyar', city_id: '607', city: 'Banjarmasin', province: 'Kalimantan Selatan', province_id: '13', type: 'Kecamatan' },
        { subdistrict_id: '60710', subdistrict_name: 'Landasan Ulin', city_id: '607', city: 'Banjarmasin', province: 'Kalimantan Selatan', province_id: '13', type: 'Kecamatan' }
      ],
      '608': [ // Banjarbaru
        { subdistrict_id: '60801', subdistrict_name: 'Banjarbaru Utara', city_id: '608', city: 'Banjarbaru', province: 'Kalimantan Selatan', province_id: '13', type: 'Kecamatan' },
        { subdistrict_id: '60802', subdistrict_name: 'Banjarbaru Selatan', city_id: '608', city: 'Banjarbaru', province: 'Kalimantan Selatan', province_id: '13', type: 'Kecamatan' },
        { subdistrict_id: '60803', subdistrict_name: 'Cempaka', city_id: '608', city: 'Banjarbaru', province: 'Kalimantan Selatan', province_id: '13', type: 'Kecamatan' },
        { subdistrict_id: '60804', subdistrict_name: 'Landasan Ulin Tengah', city_id: '608', city: 'Banjarbaru', province: 'Kalimantan Selatan', province_id: '13', type: 'Kecamatan' },
        { subdistrict_id: '60805', subdistrict_name: 'Landasan Ulin Utara', city_id: '608', city: 'Banjarbaru', province: 'Kalimantan Selatan', province_id: '13', type: 'Kecamatan' }
      ],
      '177': [ // Surabaya
        { subdistrict_id: '17701', subdistrict_name: 'Gubeng', city_id: '177', city: 'Surabaya', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17702', subdistrict_name: 'Sukolilo', city_id: '177', city: 'Surabaya', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17703', subdistrict_name: 'Tegalsari', city_id: '177', city: 'Surabaya', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17704', subdistrict_name: 'Simokerto', city_id: '177', city: 'Surabaya', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17705', subdistrict_name: 'Tambaksari', city_id: '177', city: 'Surabaya', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17706', subdistrict_name: 'Kenjeran', city_id: '177', city: 'Surabaya', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17707', subdistrict_name: 'Sukomanunggal', city_id: '177', city: 'Surabaya', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17708', subdistrict_name: 'Wiyung', city_id: '177', city: 'Surabaya', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17709', subdistrict_name: 'Dukuh Pakis', city_id: '177', city: 'Surabaya', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17710', subdistrict_name: 'Asemrowo', city_id: '177', city: 'Surabaya', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' }
      ],
      '6': [ // Medan
        { subdistrict_id: '601', subdistrict_name: 'Medan Barat', city_id: '6', city: 'Medan', province: 'Sumatera Utara', province_id: '33', type: 'Kecamatan' },
        { subdistrict_id: '602', subdistrict_name: 'Medan Timur', city_id: '6', city: 'Medan', province: 'Sumatera Utara', province_id: '33', type: 'Kecamatan' },
        { subdistrict_id: '603', subdistrict_name: 'Medan Selatan', city_id: '6', city: 'Medan', province: 'Sumatera Utara', province_id: '33', type: 'Kecamatan' },
        { subdistrict_id: '604', subdistrict_name: 'Medan Utara', city_id: '6', city: 'Medan', province: 'Sumatera Utara', province_id: '33', type: 'Kecamatan' },
        { subdistrict_id: '605', subdistrict_name: 'Medan Area', city_id: '6', city: 'Medan', province: 'Sumatera Utara', province_id: '33', type: 'Kecamatan' },
        { subdistrict_id: '606', subdistrict_name: 'Medan Kota', city_id: '6', city: 'Medan', province: 'Sumatera Utara', province_id: '33', type: 'Kecamatan' },
        { subdistrict_id: '607', subdistrict_name: 'Medan Maimun', city_id: '6', city: 'Medan', province: 'Sumatera Utara', province_id: '33', type: 'Kecamatan' },
        { subdistrict_id: '608', subdistrict_name: 'Medan Polonia', city_id: '6', city: 'Medan', province: 'Sumatera Utara', province_id: '33', type: 'Kecamatan' },
        { subdistrict_id: '609', subdistrict_name: 'Medan Selayang', city_id: '6', city: 'Medan', province: 'Sumatera Utara', province_id: '33', type: 'Kecamatan' },
        { subdistrict_id: '610', subdistrict_name: 'Medan Sunggal', city_id: '6', city: 'Medan', province: 'Sumatera Utara', province_id: '33', type: 'Kecamatan' }
      ],
      '96': [ // Bandung
        { subdistrict_id: '9601', subdistrict_name: 'Coblong', city_id: '96', city: 'Bandung', province: 'Jawa Barat', province_id: '9', type: 'Kecamatan' },
        { subdistrict_id: '9602', subdistrict_name: 'Cidadap', city_id: '96', city: 'Bandung', province: 'Jawa Barat', province_id: '9', type: 'Kecamatan' },
        { subdistrict_id: '9603', subdistrict_name: 'Cicendo', city_id: '96', city: 'Bandung', province: 'Jawa Barat', province_id: '9', type: 'Kecamatan' },
        { subdistrict_id: '9604', subdistrict_name: 'Cibeunying Kaler', city_id: '96', city: 'Bandung', province: 'Jawa Barat', province_id: '9', type: 'Kecamatan' },
        { subdistrict_id: '9605', subdistrict_name: 'Cibeunying Kidul', city_id: '96', city: 'Bandung', province: 'Jawa Barat', province_id: '9', type: 'Kecamatan' },
        { subdistrict_id: '9606', subdistrict_name: 'Sumur Bandung', city_id: '96', city: 'Bandung', province: 'Jawa Barat', province_id: '9', type: 'Kecamatan' },
        { subdistrict_id: '9607', subdistrict_name: 'Bandung Kulon', city_id: '96', city: 'Bandung', province: 'Jawa Barat', province_id: '9', type: 'Kecamatan' },
        { subdistrict_id: '9608', subdistrict_name: 'Andir', city_id: '96', city: 'Bandung', province: 'Jawa Barat', province_id: '9', type: 'Kecamatan' },
        { subdistrict_id: '9609', subdistrict_name: 'Cicendo', city_id: '96', city: 'Bandung', province: 'Jawa Barat', province_id: '9', type: 'Kecamatan' },
        { subdistrict_id: '9610', subdistrict_name: 'Batununggal', city_id: '96', city: 'Bandung', province: 'Jawa Barat', province_id: '9', type: 'Kecamatan' }
      ],
      '137': [ // Semarang
        { subdistrict_id: '13701', subdistrict_name: 'Semarang Tengah', city_id: '137', city: 'Semarang', province: 'Jawa Tengah', province_id: '10', type: 'Kecamatan' },
        { subdistrict_id: '13702', subdistrict_name: 'Semarang Utara', city_id: '137', city: 'Semarang', province: 'Jawa Tengah', province_id: '10', type: 'Kecamatan' },
        { subdistrict_id: '13703', subdistrict_name: 'Semarang Barat', city_id: '137', city: 'Semarang', province: 'Jawa Tengah', province_id: '10', type: 'Kecamatan' },
        { subdistrict_id: '13704', subdistrict_name: 'Semarang Selatan', city_id: '137', city: 'Semarang', province: 'Jawa Tengah', province_id: '10', type: 'Kecamatan' },
        { subdistrict_id: '13705', subdistrict_name: 'Semarang Timur', city_id: '137', city: 'Semarang', province: 'Jawa Tengah', province_id: '10', type: 'Kecamatan' },
        { subdistrict_id: '13706', subdistrict_name: 'Candisari', city_id: '137', city: 'Semarang', province: 'Jawa Tengah', province_id: '10', type: 'Kecamatan' },
        { subdistrict_id: '13707', subdistrict_name: 'Gajahmungkur', city_id: '137', city: 'Semarang', province: 'Jawa Tengah', province_id: '10', type: 'Kecamatan' },
        { subdistrict_id: '13708', subdistrict_name: 'Pedurungan', city_id: '137', city: 'Semarang', province: 'Jawa Tengah', province_id: '10', type: 'Kecamatan' },
        { subdistrict_id: '13709', subdistrict_name: 'Tembalang', city_id: '137', city: 'Semarang', province: 'Jawa Tengah', province_id: '10', type: 'Kecamatan' },
        { subdistrict_id: '13710', subdistrict_name: 'Banyumanik', city_id: '137', city: 'Semarang', province: 'Jawa Tengah', province_id: '10', type: 'Kecamatan' }
      ],
      '173': [ // Malang
        { subdistrict_id: '17301', subdistrict_name: 'Klojen', city_id: '173', city: 'Malang', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17302', subdistrict_name: 'Blimbing', city_id: '173', city: 'Malang', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17303', subdistrict_name: 'Sukun', city_id: '173', city: 'Malang', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17304', subdistrict_name: 'Lowokwaru', city_id: '173', city: 'Malang', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17305', subdistrict_name: 'Kedungkandang', city_id: '173', city: 'Malang', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' }
      ],
      '171': [ // Kediri
        { subdistrict_id: '17101', subdistrict_name: 'Kediri Kota', city_id: '171', city: 'Kediri', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17102', subdistrict_name: 'Pesantren', city_id: '171', city: 'Kediri', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' },
        { subdistrict_id: '17103', subdistrict_name: 'Mojoroto', city_id: '171', city: 'Kediri', province: 'Jawa Timur', province_id: '11', type: 'Kecamatan' }
      ]
    };

    return subdistrictsMap[cityId] || [
      { subdistrict_id: '1', subdistrict_name: 'Kecamatan Utama', city_id: cityId, city: 'Unknown', province: 'Unknown', province_id: '0', type: 'Kecamatan' },
      { subdistrict_id: '2', subdistrict_name: 'Kecamatan Barat', city_id: cityId, city: 'Unknown', province: 'Unknown', province_id: '0', type: 'Kecamatan' },
      { subdistrict_id: '3', subdistrict_name: 'Kecamatan Timur', city_id: cityId, city: 'Unknown', province: 'Unknown', province_id: '0', type: 'Kecamatan' },
      { subdistrict_id: '4', subdistrict_name: 'Kecamatan Selatan', city_id: cityId, city: 'Unknown', province: 'Unknown', province_id: '0', type: 'Kecamatan' },
      { subdistrict_id: '5', subdistrict_name: 'Kecamatan Pusat', city_id: cityId, city: 'Unknown', province: 'Unknown', province_id: '0', type: 'Kecamatan' }
    ];
  }

  private getMockCost(origin: string, destination: string, weight: number, courier: string): CostResult[] {
    const baseCosts: { [key: string]: number } = {
      'jnt': 15000,
      'jne': 18000,
      'pos': 20000,
      'tiki': 17000,
      'sicepat': 16000,
      'wahana': 12000
    };

    const baseCost = baseCosts[courier] || 15000;
    const weightMultiplier = Math.max(1, weight / 1000);
    const distanceCost = Math.floor(Math.random() * 10000) + 5000;
    const totalCost = Math.round(baseCost * weightMultiplier + distanceCost);

    const etdMap: { [key: string]: string } = {
      'jnt': '2-3 hari',
      'jne': '2-4 hari',
      'pos': '3-5 hari',
      'tiki': '2-3 hari',
      'sicepat': '1-2 hari',
      'wahana': '3-6 hari'
    };

    return [{
      code: courier.toUpperCase(),
      name: COURIERS.find(c => c.code === courier)?.name || courier.toUpperCase(),
      costs: [{
        service: 'Regular Package',
        description: 'Paket reguler',
        cost: [{
          value: totalCost,
          etd: etdMap[courier] || '2-4 hari',
          note: 'Mock calculation'
        }]
      }]
    }];
  }

  // Utility method to format full address
  formatFullAddress(address: AddressData): string {
    const parts = [
      address.subdistrict,
      address.district,
      address.cityName,
      address.provinceName
    ].filter(Boolean);

    return parts.join(', ');
  }

  // Method to check if courier supports RajaOngkir
  isCourierSupported(courierCode: string): boolean {
    return COURIERS.some(courier => courier.code === courierCode);
  }
}

export const rajaOngkirService = new RajaOngkirService();