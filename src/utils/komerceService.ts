// Komerce API Service
// Based on official Komerce API documentation

export interface KomerceCostResult {
  name: string;
  code: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
}

export interface KomerceResponse {
  meta: {
    message: string;
    code: number;
    status: string;
  };
  data: KomerceCostResult[] | null;
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
  { code: 'jne', name: 'Jalur Nugraha Ekakurir (JNE)' },
  { code: 'pos', name: 'POS Indonesia' },
  { code: 'tiki', name: 'TIKI' },
  { code: 'sicepat', name: 'SiCepat Express' },
  { code: 'wahana', name: 'Wahana Prestasi Logistik' }
];

class KomerceService {
  private baseUrl = '/api/rajaongkir';

  async calculateShippingCost(
    origin: string,
    destination: string,
    weight: number,
    courier: string,
    price: 'lowest' | 'highest' = 'lowest'
  ): Promise<KomerceCostResult[]> {
    try {
      console.log('📦 Calculating shipping cost from Komerce API');
      console.log('📋 Parameters:', { origin, destination, weight, courier, price });

      const response = await fetch(`${this.baseUrl}/cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin,
          destination,
          weight,
          courier,
          price
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: KomerceResponse = await response.json();
      console.log('✅ Komerce API Response:', data);

      if (data.meta.status === 'success' && data.data) {
        console.log('✅ Real shipping cost results:', data.data.length);
        return data.data;
      } else {
        console.log('❌ Komerce API returned error:', data.meta.message);
        throw new Error(data.meta.message);
      }
    } catch (error) {
      console.error('❌ Error calculating shipping cost:', error);
      throw error;
    }
  }

  // Method to check if courier is supported
  isCourierSupported(courierCode: string): boolean {
    return COURIERS.some(courier => courier.code === courierCode);
  }

  // Get courier name by code
  getCourierName(courierCode: string): string {
    const courier = COURIERS.find(c => c.code === courierCode);
    return courier?.name || courierCode.toUpperCase();
  }

  // Format full address
  formatFullAddress(address: AddressData): string {
    const parts = [
      address.subdistrict,
      address.district,
      address.cityName,
      address.provinceName
    ].filter(Boolean);

    return parts.join(', ');
  }
}

export const komerceService = new KomerceService();