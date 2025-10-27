// Check Komerce address API endpoints

const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

export default async function handler(req, res) {
  try {
    console.log('🔍 Checking Komerce address API...');

    // Test 1: Get provinces with search parameter
    console.log('\nTest 1: Get all provinces');
    try {
      // Try without search first
      const response1 = await fetch(`${KOMERCE_BASE_URL}/destination/domestic-destination?key=${KOMERCE_API_KEY}`, {
        method: 'GET',
        headers: {
          'key': KOMERCE_API_KEY
        }
      });

      if (response1.ok) {
        const data = await response1.json();
        console.log('✅ Provinces Response:', JSON.stringify(data, null, 2));
      } else {
        const errorText1 = await response1.text();
        console.log('❌ Provinces API Error (no search):', errorText1);

        // Try with search parameter
        console.log('\nTrying with search parameter...');
        const response2 = await fetch(`${KOMERCE_BASE_URL}/destination/domestic-destination?key=${KOMERCE_API_KEY}&search=surgi`, {
          method: 'GET',
          headers: {
            'key': KOMERCE_API_KEY
          }
        });

        if (response2.ok) {
          const data2 = await response2.json();
          console.log('✅ Provinces Response (with search):', JSON.stringify(data2, null, 2));

          // Process data from search response
          return res.status(200).json({
            success: true,
            message: 'Address API check completed',
            timestamp: new Date().toISOString(),
            data: data2,
            note: 'Used search parameter for provinces'
          });
        } else {
          const errorText2 = await response2.text();
          console.log('❌ Provinces API Error (with search):', errorText2);
        }
      }

      if (response1.ok) {
        const data = await response1.json();
        console.log('✅ Provinces Response:', JSON.stringify(data, null, 2));

        // Look for Kalimantan Selatan
        const kalselProvinces = data.data?.filter(province =>
          province.province && province.province.toLowerCase().includes('kalimantan selatan')
        ) || [];

        console.log('📊 Kalimantan Selatan provinces:', kalselProvinces.length);
        kalselProvinces.forEach(province => {
          console.log(`✅ ${province.province} (ID: ${province.province_id})`);
        });

        // Test 2: Get cities in Kalimantan Selatan
        console.log('\nTest 2: Get cities in Kalimantan Selatan');
        if (kalselProvinces.length > 0) {
          const kalselProvinceId = kalselProvinces[0].province_id;
          console.log(`🔍 Using province ID: ${kalselProvinceId}`);

          const citiesResponse = await fetch(`${KOMERCE_BASE_URL}/destination/domestic-destination?key=${KOMERCE_API_KEY}&province=${kalselProvinceId}`, {
            method: 'GET',
            headers: {
              'key': KOMERCE_API_KEY
            }
          });

          if (citiesResponse.ok) {
            const citiesData = await citiesResponse.json();
            console.log('✅ Cities Response:', JSON.stringify(citiesData, null, 2));

            // Look for Banjarmasin cities
            const banjarmasinCities = citiesData.data?.filter(city =>
              city.city_name && city.city_name.toLowerCase().includes('banjarmasin')
            ) || [];

            console.log('📊 Banjarmasin cities found:', banjarmasinCities.length);
            banjarmasinCities.forEach(city => {
              console.log(`✅ ${city.city_name} (ID: ${city.city_id}) - Type: ${city.type || 'N/A'}`);
            });

            // Test 3: Test cost calculation with correct Banjarmasin ID
            console.log('\nTest 3: Test cost with correct Banjarmasin ID');
            if (banjarmasinCities.length > 0) {
              const banjarmasinCityId = banjarmasinCities[0].city_id;
              console.log(`🚀 Testing with origin ID: ${banjarmasinCityId} (Banjarmasin)`);

              const formData = new URLSearchParams();
              formData.append('origin', banjarmasinCityId);
              formData.append('destination', '177'); // Surabaya
              formData.append('weight', '1000');
              formData.append('courier', 'jne');

              const costResponse = await fetch(`${KOMERCE_BASE_URL}/calculate/domestic-cost`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'key': KOMERCE_API_KEY
                },
                body: formData.toString()
              });

              if (costResponse.ok) {
                const costData = await costResponse.json();
                console.log('✅ Cost Response:', JSON.stringify(costData, null, 2));

                if (costData.meta?.status === 'success' && costData.data?.length > 0) {
                  const cost = costData.data[0];
                  console.log(`💰 Real pricing from ${cost.name}: Rp ${cost.cost.toLocaleString('id-ID')} (${cost.etd})`);
                }
              } else {
                const errorText = await costResponse.text();
                console.log('❌ Cost API Error:', errorText);
              }
            }
          } else {
            console.log('❌ Cities API Error:', await citiesResponse.text());
          }
        }
      } else {
        const errorText = await response1.text();
        console.log('❌ Provinces API Error:', errorText);
      }
    } catch (error) {
      console.log('❌ Network error:', error.message);
    }

    res.status(200).json({
      success: true,
      message: 'Address API check completed',
      timestamp: new Date().toISOString(),
      note: 'Check Vercel logs for detailed address API results'
    });

  } catch (error) {
    console.error('💥 Address check error:', error);
    res.status(500).json({
      success: false,
      error: 'Address check failed',
      details: error.message
    });
  }
}