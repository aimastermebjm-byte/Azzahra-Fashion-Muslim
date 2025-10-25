// RajaOngkir Komerce API Configuration
const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://api-sandbox.collaborator.komerce.id'; // Use sandbox for development

export default async function handler(req, res) {
  try {
    // For provinces, we'll use a static list since Komerce doesn't have provinces endpoint
    // This is based on Indonesian provinces data
    const provinces = [
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

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    res.status(200).json({
      rajaongkir: {
        status: { code: 200, description: "OK" },
        results: provinces
      }
    });
  } catch (error) {
    console.error('Provinces API Error:', error);
    res.status(500).json({
      error: 'Failed to fetch provinces',
      details: error.message || 'Unknown error'
    });
  }
}