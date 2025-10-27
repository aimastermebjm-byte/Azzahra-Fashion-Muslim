// Check cities in Kalimantan Selatan to find correct Banjarmasin ID

const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

export default async function handler(req, res) {
  try {
    console.log('🔍 Checking Kalimantan Selatan cities...');

    // Test 1: Get all cities (if Komerce supports this endpoint)
    console.log('\nTest 1: Try to get cities list');
    try {
      const response = await fetch(`${KOMERCE_BASE_URL}/destination/domestic-destination`, {
        method: 'GET',
        headers: {
          'key': KOMERCE_API_KEY
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Cities API Response:', JSON.stringify(data, null, 2));

        // Filter cities from Kalimantan Selatan
        const kalselCities = data.data?.filter(city =>
          city.province && city.province.toLowerCase().includes('kalimantan selatan')
        ) || [];

        console.log('📊 Kalimantan Selatan cities found:', kalselCities.length);
        kalselCities.forEach(city => {
          console.log(`- ${city.city_name} (ID: ${city.city_id}) - ${city.province}`);
        });

        // Look for Banjarmasin variations
        const banjarmasinCities = kalselCities.filter(city =>
          city.city_name.toLowerCase().includes('banjarmasin')
        );

        console.log('\n🎯 Banjarmasin cities found:');
        banjarmasinCities.forEach(city => {
          console.log(`✅ ${city.city_name} (ID: ${city.city_id}) - Type: ${city.type || 'N/A'}`);
        });

        return res.status(200).json({
          success: true,
          message: 'Cities list retrieved successfully',
          data: {
            totalKalselCities: kalselCities.length,
            banjarmasinCities: banjarmasinCities,
            allKalselCities: kalselCities
          }
        });

      } else {
        const errorText = await response.text();
        console.log('❌ Cities API Error:', errorText);
        throw new Error('Cities API not available');
      }
    } catch (error) {
      console.log('❌ Cities API not available, using fallback test');
    }

    // Test 2: Test shipping costs with different Banjarmasin-like IDs
    console.log('\nTest 2: Test common Banjarmasin IDs');
    const possibleBanjarmasinIds = ['607', '608', '501', '502'];
    const destination = '177'; // Surabaya (for testing)
    const weight = '1000';
    const courier = 'jne';

    for (const originId of possibleBanjarmasinIds) {
      try {
        console.log(`\n📦 Testing origin ID: ${originId}`);

        const formData = new URLSearchParams();
        formData.append('origin', originId);
        formData.append('destination', destination);
        formData.append('weight', weight);
        formData.append('courier', courier);

        const response = await fetch(`${KOMERCE_BASE_URL}/calculate/domestic-cost`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'key': KOMERCE_API_KEY
          },
          body: formData.toString()
        });

        if (response.ok) {
          const data = await response.json();
          if (data.meta?.status === 'success' && data.data?.length > 0) {
            const result = data.data[0];
            console.log(`✅ Origin ${originId} - ${result.name}: Rp ${result.cost.toLocaleString('id-ID')} (${result.etd})`);

            // Check if this looks like Banjarmasin (reasonable price to Surabaya)
            const isReasonablePrice = result.cost >= 30000 && result.cost <= 80000; // Banjarmasin to Surabaya should be 30-80k
            if (isReasonablePrice) {
              console.log(`🎯 ID ${originId} looks like correct Banjarmasin ID!`);
            }
          }
        } else {
          console.log(`❌ Origin ${originId} - API Error`);
        }
      } catch (error) {
        console.log(`❌ Origin ${originId} - Network error: ${error.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Banjarmasin ID check completed',
      timestamp: new Date().toISOString(),
      testedIds: possibleBanjarmasinIds,
      note: 'Check Vercel logs for detailed results'
    });

  } catch (error) {
    console.error('💥 Check cities endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Check cities endpoint failed',
      details: error.message
    });
  }
}