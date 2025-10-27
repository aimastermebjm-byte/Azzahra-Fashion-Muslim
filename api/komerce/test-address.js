// Test Komerce Address API Endpoints
// This will test all address endpoints to ensure they work properly

const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

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
        message: 'Method not allowed',
        data: null
      });
    }

    console.log('🧪 Testing Komerce Address API Endpoints...');

    const testResults = {
      timestamp: new Date().toISOString(),
      apiKey: KOMERCE_API_KEY ? 'Set' : 'Missing',
      baseUrl: KOMERCE_BASE_URL,
      tests: {}
    };

    // Test 1: Provinces
    console.log('📋 Test 1: Testing provinces endpoint...');
    try {
      const provincesResponse = await fetch(`${KOMERCE_BASE_URL}/destination/province`, {
        method: 'GET',
        headers: {
          'Key': KOMERCE_API_KEY
        }
      });

      console.log('Provinces status:', provincesResponse.status);
      const provincesData = await provincesResponse.json();
      console.log('Raw provinces response:', JSON.stringify(provincesData, null, 2));

      // Handle different response structures
      let provincesArray = [];
      if (Array.isArray(provincesData)) {
        provincesArray = provincesData;
      } else if (provincesData.data && Array.isArray(provincesData.data)) {
        provincesArray = provincesData.data;
      } else if (provincesData.rajaongkir && provincesData.rajaongkir.results && Array.isArray(provincesData.rajaongkir.results)) {
        provincesArray = provincesData.rajaongkir.results;
      }

      console.log('Provinces count:', provincesArray.length);

      testResults.tests.provinces = {
        status: provincesResponse.status,
        success: provincesResponse.ok,
        count: provincesArray.length,
        sampleData: provincesArray.slice(0, 3).map(p => ({
          id: p.id,
          province_name: p.province_name
        }))
      };

      console.log('✅ Provinces test result:', testResults.tests.provinces.success ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      testResults.tests.provinces = {
        status: 'ERROR',
        success: false,
        error: error.message
      };
      console.log('❌ Provinces test failed:', error.message);
    }

    // Test 2: Cities (using Kalimantan Selatan = province_id 9 as example)
    console.log('\n📋 Test 2: Testing cities endpoint...');
    try {
      const citiesResponse = await fetch(`${KOMERCE_BASE_URL}/destination/city/9`, {
        method: 'GET',
        headers: {
          'Key': KOMERCE_API_KEY
        }
      });

      console.log('Cities status:', citiesResponse.status);
      const citiesData = await citiesResponse.json();
      console.log('Raw cities response:', JSON.stringify(citiesData, null, 2));

      // Handle different response structures
      let citiesArray = [];
      if (Array.isArray(citiesData)) {
        citiesArray = citiesData;
      } else if (citiesData.data && Array.isArray(citiesData.data)) {
        citiesArray = citiesData.data;
      } else if (citiesData.rajaongkir && citiesData.rajaongkir.results && Array.isArray(citiesData.rajaongkir.results)) {
        citiesArray = citiesData.rajaongkir.results;
      }

      console.log('Cities count:', citiesArray.length);

      testResults.tests.cities = {
        status: citiesResponse.status,
        success: citiesResponse.ok,
        count: citiesArray.length,
        sampleData: citiesArray.slice(0, 3).map(c => ({
          id: c.id,
          city_name: c.city_name,
          type: c.type
        }))
      };

      console.log('✅ Cities test result:', testResults.tests.cities.success ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      testResults.tests.cities = {
        status: 'ERROR',
        success: false,
        error: error.message
      };
      console.log('❌ Cities test failed:', error.message);
    }

    // Test 3: Districts (using Banjarmasin city_id as example)
    console.log('\n📋 Test 3: Testing districts endpoint...');
    try {
      const districtsResponse = await fetch(`${KOMERCE_BASE_URL}/destination/district/607`, {
        method: 'GET',
        headers: {
          'Key': KOMERCE_API_KEY
        }
      });

      console.log('Districts status:', districtsResponse.status);
      const districtsData = await districtsResponse.json();
      console.log('Raw districts response:', JSON.stringify(districtsData, null, 2));

      // Handle different response structures
      let districtsArray = [];
      if (Array.isArray(districtsData)) {
        districtsArray = districtsData;
      } else if (districtsData.data && Array.isArray(districtsData.data)) {
        districtsArray = districtsData.data;
      } else if (districtsData.rajaongkir && districtsData.rajaongkir.results && Array.isArray(districtsData.rajaongkir.results)) {
        districtsArray = districtsData.rajaongkir.results;
      }

      console.log('Districts count:', districtsArray.length);

      testResults.tests.districts = {
        status: districtsResponse.status,
        success: districtsResponse.ok,
        count: districtsArray.length,
        sampleData: districtsArray.slice(0, 3).map(d => ({
          id: d.id,
          district_name: d.district_name
        }))
      };

      console.log('✅ Districts test result:', testResults.tests.districts.success ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      testResults.tests.districts = {
        status: 'ERROR',
        success: false,
        error: error.message
      };
      console.log('❌ Districts test failed:', error.message);
    }

    // Test 4: Subdistricts (using a district example)
    console.log('\n📋 Test 4: Testing subdistricts endpoint...');
    try {
      const subdistrictsResponse = await fetch(`${KOMERCE_BASE_URL}/destination/sub-district/1391`, {
        method: 'GET',
        headers: {
          'Key': KOMERCE_API_KEY
        }
      });

      console.log('Subdistricts status:', subdistrictsResponse.status);
      const subdistrictsData = await subdistrictsResponse.json();
      console.log('Raw subdistricts response:', JSON.stringify(subdistrictsData, null, 2));

      // Handle different response structures
      let subdistrictsArray = [];
      if (Array.isArray(subdistrictsData)) {
        subdistrictsArray = subdistrictsData;
      } else if (subdistrictsData.data && Array.isArray(subdistrictsData.data)) {
        subdistrictsArray = subdistrictsData.data;
      } else if (subdistrictsData.rajaongkir && subdistrictsData.rajaongkir.results && Array.isArray(subdistrictsData.rajaongkir.results)) {
        subdistrictsArray = subdistrictsData.rajaongkir.results;
      }

      console.log('Subdistricts count:', subdistrictsArray.length);

      testResults.tests.subdistricts = {
        status: subdistrictsResponse.status,
        success: subdistrictsResponse.ok,
        count: subdistrictsArray.length,
        sampleData: subdistrictsArray.slice(0, 3).map(s => ({
          id: s.id,
          subdistrict_name: s.subdistrict_name
        }))
      };

      console.log('✅ Subdistricts test result:', testResults.tests.subdistricts.success ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      testResults.tests.subdistricts = {
        status: 'ERROR',
        success: false,
        error: error.message
      };
      console.log('❌ Subdistricts test failed:', error.message);
    }

    // Test 5: Calculate shipping cost (Banjarmasin to Jakarta)
    console.log('\n📋 Test 5: Testing shipping cost calculation...');
    try {
      const formData = new URLSearchParams();
      formData.append('key', KOMERCE_API_KEY);
      formData.append('origin', '1391'); // Banjarmasin district
      formData.append('destination', '1376'); // Jakarta district
      formData.append('weight', '1000'); // 1kg
      formData.append('courier', 'jne:sicepat:ide');
      formData.append('price', 'lowest');

      const costResponse = await fetch(`${KOMERCE_BASE_URL}/calculate/district/domestic-cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'key': KOMERCE_API_KEY
        },
        body: formData.toString()
      });

      console.log('Cost status:', costResponse.status);
      const costData = await costResponse.json();

      testResults.tests.shippingCost = {
        status: costResponse.status,
        success: costResponse.ok,
        data: costData
      };

      console.log('✅ Shipping cost test result:', testResults.tests.shippingCost.success ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      testResults.tests.shippingCost = {
        status: 'ERROR',
        success: false,
        error: error.message
      };
      console.log('❌ Shipping cost test failed:', error.message);
    }

    console.log('\n🔍 Final Analysis:');
    console.log('- Provinces API:', testResults.tests.provinces?.success ? '✅ WORKING' : '❌ FAILED');
    console.log('- Cities API:', testResults.tests.cities?.success ? '✅ WORKING' : '❌ FAILED');
    console.log('- Districts API:', testResults.tests.districts?.success ? '✅ WORKING' : '❌ FAILED');
    console.log('- Subdistricts API:', testResults.tests.subdistricts?.success ? '✅ WORKING' : '❌ FAILED');
    console.log('- Shipping Cost API:', testResults.tests.shippingCost?.success ? '✅ WORKING' : '❌ FAILED');

    return res.status(200).json({
      success: true,
      message: 'Komerce Address API test completed',
      data: testResults
    });

  } catch (error) {
    console.error('💥 Test endpoint error:', error);

    return res.status(500).json({
      success: false,
      message: 'Test endpoint error',
      error: error.message,
      data: null
    });
  }
}