// Test Courier Codes API
// Test all courier codes directly from browser

const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

const COURIERS_TO_TEST = [
  { code: 'jnt', name: 'J&T Express' },
  { code: 'jne', name: 'Jalur Nugraha Ekakurir (JNE)' },
  { code: 'pos', name: 'POS Indonesia' },
  { code: 'tiki', name: 'TIKI' },
  { code: 'sicepat', name: 'SiCepat Express' },
  { code: 'wahana', name: 'Wahana Prestasi Logistik' },
  { code: 'idexpress', name: 'IDExpress' },
  { code: 'lion', name: 'Lion Parcel' },
  { code: 'ide', name: 'IDExpress (Alternative)' },
  { code: 'lionparcel', name: 'Lion Parcel (Alternative)' },
  { code: 'id_express', name: 'IDExpress (Underscore)' },
  { code: 'lion_parcel', name: 'Lion Parcel (Underscore)' }
];

async function testCourierCode(courier) {
  try {
    const formData = new URLSearchParams();
    formData.append('origin', '607');  // Jakarta Pusat
    formData.append('destination', '114'); // Bandung
    formData.append('weight', '1000');  // 1kg
    formData.append('courier', courier.code);
    formData.append('price', 'lowest');

    console.log(`📡 Testing ${courier.name} (${courier.code})...`);

    const response = await fetch(`${KOMERCE_BASE_URL}/calculate/domestic-cost`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'key': KOMERCE_API_KEY
      },
      body: formData.toString()
    });

    const data = await response.json();

    const result = {
      courier: courier.name,
      code: courier.code,
      status: response.status,
      success: response.ok && data.meta?.code === 200,
      message: data.meta?.message || response.statusText,
      services: []
    };

    if (result.success && data.data && data.data.length > 0) {
      result.services = data.data.map(service => ({
        service: service.service,
        cost: service.cost,
        etd: service.etd,
        description: service.description
      }));
    }

    return result;
  } catch (error) {
    return {
      courier: courier.name,
      code: courier.code,
      status: 'ERROR',
      success: false,
      message: error.message,
      services: []
    };
  }
}

export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed. Use GET.'
      });
    }

    console.log('🧪 Testing courier codes with Komerce API...');

    const results = [];

    // Test all couriers
    for (const courier of COURIERS_TO_TEST) {
      const result = await testCourierCode(courier);
      results.push(result);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Analyze results
    const workingCouriers = results.filter(r => r.success);
    const failedCouriers = results.filter(r => !r.success);

    console.log(`✅ Working couriers: ${workingCouriers.length}`);
    console.log(`❌ Failed couriers: ${failedCouriers.length}`);

    const summary = {
      total_tested: results.length,
      working_count: workingCouriers.length,
      failed_count: failedCouriers.length,
      working_codes: workingCouriers.map(c => c.code),
      failed_codes: failedCouriers.map(c => c.code)
    };

    return res.status(200).json({
      success: true,
      message: 'Courier code testing completed',
      data: {
        summary,
        results,
        recommendations: {
          idexpress: workingCouriers.find(c => c.code === 'idexpress') ? 'idexpress' :
                    workingCouriers.find(c => c.code === 'ide') ? 'ide' : 'UNKNOWN',
          lion_parcel: workingCouriers.find(c => c.code === 'lion') ? 'lion' :
                       workingCouriers.find(c => c.code === 'lionparcel') ? 'lionparcel' : 'UNKNOWN'
        }
      }
    });

  } catch (error) {
    console.error('💥 Courier testing error:', error);
    return res.status(500).json({
      success: false,
      message: `Courier testing failed: ${error.message}`,
      data: null
    });
  }
}