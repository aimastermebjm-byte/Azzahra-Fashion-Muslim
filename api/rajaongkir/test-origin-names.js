// Test if Komerce API accepts city names instead of IDs

const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

export default async function handler(req, res) {
  try {
    console.log('🧪 Testing Komerce API with city names instead of IDs...');

    const destination = 'Surabaya';
    const weight = '1000';
    const courier = 'jne';

    // Test 1: Origin = "Banjarmasin Utara" (your location)
    console.log('\nTest 1: Origin = "Banjarmasin Utara"');
    try {
      const formData1 = new URLSearchParams();
      formData1.append('origin', 'Banjarmasin Utara');
      formData1.append('destination', destination);
      formData1.append('weight', weight);
      formData1.append('courier', courier);
      formData1.append('price', 'lowest');

      console.log('Request body:', formData1.toString());

      const response1 = await fetch(`${KOMERCE_BASE_URL}/calculate/domestic-cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'key': KOMERCE_API_KEY
        },
        body: formData1.toString()
      });

      console.log('Response status:', response1.status);

      if (response1.ok) {
        const data1 = await response1.json();
        console.log('✅ Banjarmasin Utara - Response:', JSON.stringify(data1, null, 2));

        if (data1.meta?.status === 'success' && data1.data?.length > 0) {
          const result = data1.data[0];
          console.log(`💰 SUCCESS! ${result.name}: Rp ${result.cost.toLocaleString('id-ID')} (${result.etd})`);
        } else {
          console.log('❌ Failed response:', data1);
        }
      } else {
        const errorText1 = await response1.text();
        console.log('❌ API Error:', errorText1);
      }
    } catch (error) {
      console.log('❌ Network error:', error.message);
    }

    // Test 2: Origin = "Banjarmasin" (city level)
    console.log('\nTest 2: Origin = "Banjarmasin"');
    try {
      const formData2 = new URLSearchParams();
      formData2.append('origin', 'Banjarmasin');
      formData2.append('destination', destination);
      formData2.append('weight', weight);
      formData2.append('courier', courier);
      formData2.append('price', 'lowest');

      console.log('Request body:', formData2.toString());

      const response2 = await fetch(`${KOMERCE_BASE_URL}/calculate/domestic-cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'key': KOMERCE_API_KEY
        },
        body: formData2.toString()
      });

      console.log('Response status:', response2.status);

      if (response2.ok) {
        const data2 = await response2.json();
        console.log('✅ Banjarmasin - Response:', JSON.stringify(data2, null, 2));

        if (data2.meta?.status === 'success' && data2.data?.length > 0) {
          const result = data2.data[0];
          console.log(`💰 SUCCESS! ${result.name}: Rp ${result.cost.toLocaleString('id-ID')} (${result.etd})`);
        } else {
          console.log('❌ Failed response:', data2);
        }
      } else {
        const errorText2 = await response2.text();
        console.log('❌ API Error:', errorText2);
      }
    } catch (error) {
      console.log('❌ Network error:', error.message);
    }

    // Test 3: Origin = "Surgi Mufti, Banjarmasin Utara" (full address)
    console.log('\nTest 3: Origin = "Surgi Mufti, Banjarmasin Utara"');
    try {
      const formData3 = new URLSearchParams();
      formData3.append('origin', 'Surgi Mufti, Banjarmasin Utara');
      formData3.append('destination', destination);
      formData3.append('weight', weight);
      formData3.append('courier', courier);
      formData3.append('price', 'lowest');

      console.log('Request body:', formData3.toString());

      const response3 = await fetch(`${KOMERCE_BASE_URL}/calculate/domestic-cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'key': KOMERCE_API_KEY
        },
        body: formData3.toString()
      });

      console.log('Response status:', response3.status);

      if (response3.ok) {
        const data3 = await response3.json();
        console.log('✅ Surgi Mufti - Response:', JSON.stringify(data3, null, 2));

        if (data3.meta?.status === 'success' && data3.data?.length > 0) {
          const result = data3.data[0];
          console.log(`💰 SUCCESS! ${result.name}: Rp ${result.cost.toLocaleString('id-ID')} (${result.etd})`);
        } else {
          console.log('❌ Failed response:', data3);
        }
      } else {
        const errorText3 = await response3.text();
        console.log('❌ API Error:', errorText3);
      }
    } catch (error) {
      console.log('❌ Network error:', error.message);
    }

    res.status(200).json({
      success: true,
      message: 'Origin names test completed',
      timestamp: new Date().toISOString(),
      testInfo: {
        origin_tests: [
          'Banjarmasin Utara',
          'Banjarmasin',
          'Surgi Mufti, Banjarmasin Utara'
        ],
        destination: 'Surabaya',
        courier: 'JNE',
        weight: '1kg'
      },
      note: 'Check Vercel logs for detailed test results'
    });

  } catch (error) {
    console.error('💥 Origin names test error:', error);
    res.status(500).json({
      success: false,
      error: 'Origin names test failed',
      details: error.message
    });
  }
}