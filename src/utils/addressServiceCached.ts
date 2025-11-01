// Cached Address Service
// Uses cached address API to reduce Komerce API calls

export interface Province {
  province_id: string;
  province: string;
}

export interface City {
  city_id: string;
  city_name: string;
  province_id: string;
  province: string;
  type: string;
}

export interface District {
  district_id: string;
  district_name: string;
  city_id: string;
  city_name: string;
}

export interface Subdistrict {
  subdistrict_id: string;
  subdistrict_name: string;
  district_id: string;
  district_name: string;
  city_id: string;
  city_name: string;
}

class AddressServiceCached {
  private baseUrl = '/api/address-cached'; // Use cached endpoint

  async getProvinces(): Promise<Province[]> {
    try {
      console.log('🏛️ Loading provinces from cache...');
      const response = await fetch(`${this.baseUrl}?type=provinces`);
      const data = await response.json();

      if (data.success) {
        console.log(`✅ Provinces loaded: ${data.data?.length || 0} items`);
        return data.data || [];
      } else {
        throw new Error(data.message || 'Failed to load provinces');
      }
    } catch (error) {
      console.error('❌ Error loading provinces:', error);
      return [];
    }
  }

  async getCities(provinceId: string): Promise<City[]> {
    try {
      console.log(`🏙️ Loading cities for province ${provinceId} from cache...`);
      const response = await fetch(`${this.baseUrl}?type=cities&provinceId=${provinceId}`);
      const data = await response.json();

      if (data.success) {
        console.log(`✅ Cities loaded: ${data.data?.length || 0} items`);
        return data.data || [];
      } else {
        throw new Error(data.message || 'Failed to load cities');
      }
    } catch (error) {
      console.error('❌ Error loading cities:', error);
      return [];
    }
  }

  async getDistricts(cityId: string): Promise<District[]> {
    try {
      console.log(`🏘️ Loading districts for city ${cityId} from cache...`);
      const response = await fetch(`${this.baseUrl}?type=districts&cityId=${cityId}`);
      const data = await response.json();

      if (data.success) {
        console.log(`✅ Districts loaded: ${data.data?.length || 0} items`);
        return data.data || [];
      } else {
        throw new Error(data.message || 'Failed to load districts');
      }
    } catch (error) {
      console.error('❌ Error loading districts:', error);
      return [];
    }
  }

  async getSubdistricts(districtId: string): Promise<Subdistrict[]> {
    try {
      console.log(`🏘️ Loading subdistricts for district ${districtId} from cache...`);
      const response = await fetch(`${this.baseUrl}?type=subdistricts&districtId=${districtId}`);
      const data = await response.json();

      if (data.success) {
        console.log(`✅ Subdistricts loaded: ${data.data?.length || 0} items`);
        return data.data || [];
      } else {
        throw new Error(data.message || 'Failed to load subdistricts');
      }
    } catch (error) {
      console.error('❌ Error loading subdistricts:', error);
      return [];
    }
  }
}

export const addressServiceCached = new AddressServiceCached();