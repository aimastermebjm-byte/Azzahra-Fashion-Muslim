// RajaOngkir API Configuration
export const RAJAONGKIR_CONFIG = {
  API_KEY: 'L3abavkD5358dc66be91f537G8MkpZHi', // API Key Starter
  BASE_URL: 'https://api.rajaongkir.com/starter',
  DELIVERY_API_KEY: 'LVhqbq325358dc66be91f537xYjLL3Zi', // API Key Delivery
  DELIVERY_BASE_URL: 'https://pro.rajaongkir.com/api',
};

// Store Origin Address (Kelurahan Surgi Mufti, Banjarmasin Utara)
export const STORE_ORIGIN = {
  cityId: '607', // Banjarmasin city ID
  cityName: 'Banjarmasin',
  province: 'Kalimantan Selatan',
  fullAddress: 'Kelurahan Surgi Mufti, Kecamatan Banjarmasin Utara, Kota Banjarmasin, Kalimantan Selatan'
};

// Courier codes
export const COURIERS = [
  { code: 'jne', name: 'JNE' },
  { code: 'tiki', name: 'TIKI' },
  { code: 'pos', name: 'POS Indonesia' },
  { code: 'jnt', name: 'J&T Express' },
  { code: 'sicepat', name: 'SiCepat' },
  { code: 'wahana', name: 'Wahana' },
  { code: 'anteraja', name: 'AnterAja' },
];

// Package types
export const PACKAGES = [
  { code: 'package', name: 'Paket' },
  { code: 'document', name: 'Dokumen' },
  { code: 'oversize', name: 'Oversize' },
];