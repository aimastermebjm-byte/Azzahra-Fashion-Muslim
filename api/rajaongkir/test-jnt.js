// Test endpoint specifically for J&T services

const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

export default async function handler(req, res) {
  try {
    console.log('🧪 Testing J&T API services...');

    const origin = '607'; // Banjarmasin
    const destination = '607'; // Banjarmasin (same city)
    const weight = '1000'; // 1kg
    const courier = 'jnt';

    // Test 1: Without price parameter
    console.log('\nTest 1: J&T without price parameter');
    try {
      const formData1 = new URLSearchParams();
      formData1.append('origin', origin);
      formData1.append('destination', destination);
      formData1.append('weight', weight);
      formData1.append('courier', courier);
      // NO price parameter

      console.log('Request body (no price):', formData1.toString());

      const response1 = await fetch(`${KOMERCE_BASE_URL}/calculate/domestic-cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'key': KOMERCE_API_KEY
        },
        body: formData1.toString()
      });

      if (response1.ok) {
        const data1 = await response1.json();
        console.log('✅ JNT without price - Response:', JSON.stringify(data1, null, 2));
        console.log('📊 JNT services count:', data1.data?.length || 0);
      } else {
        const errorText1 = await response1.text();
        console.log('❌ JNT without price - Error:', errorText1);
      }
    } catch (error) {
      console.log('❌ JNT without price - Network error:', error.message);
    }

    // Test 2: With price = lowest
    console.log('\nTest 2: JNT with price = lowest');
    try {
      const formData2 = new URLSearchParams();
      formData2.append('origin', origin);
      formData2.append('destination', destination);
      formData2.append('weight', weight);
      formData2.append('courier', courier);
      formData2.append('price', 'lowest');

      console.log('Request body (lowest):', formData2.toString());

      const response2 = await fetch(`${KOMERCE_BASE_URL}/calculate/domestic-cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'key': KOMERCE_API_KEY
        },
        body: formData2.toString()
      });

      if (response2.ok) {
        const data2 = await response2.json();
        console.log('✅ JNT price lowest - Response:', JSON.stringify(data2, null, 2));
      } else {
        const errorText2 = await response2.text();
        console.log('❌ JNT price lowest - Error:', errorText2);
      }
    } catch (error) {
      console.log('❌ JNT price lowest - Network error:', error.message);
    }

    // Test 3: Different destination (Surabaya) to see if more services available
    console.log('\nTest 3: JNT to Surabaya (longer distance)');
    try {
      const formData3 = new URLSearchParams();
      formData3.append('origin', origin);
      formData3.append('destination', '177'); // Surabaya
      formData3.append('weight', weight);
      formData3.append('courier', courier);
      // NO price parameter

      console.log('Request body (to Surabaya):', formData3.toString());

      const response3 = await fetch(`${KOMERCE_BASE_URL}/calculate/domestic-cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'key': KOMERCE_API_KEY
        },
        body: formData3.toString()
      });

      if (response3.ok) {
        const data3 = await response3.json();
        console.log('✅ JNT to Surabaya - Response:', JSON.stringify(data3, null, 2));
        console.log('📊 JNT services to Surabaya:', data3.data?.length || 0);
      } else {
        const errorText3 = await response3.text();
        console.log('❌ JNT to Surabaya - Error:', errorText3);
      }
    } catch (error) {
      console.log('❌ JNT to Surabaya - Network error:', error.message);
    }

    res.status(200).json({
      success: true,
      message: 'J&T API services test completed',
      timestamp: new Date().toISOString(),
      testInfo: {
        origin: 'Banjarmasin (607)',
        destination_same_city: 'Banjarmasin (607)',
        destination_surabaya: 'Surabaya (177)',
        weight: '1kg',
        courier: 'J&T'
      }
    });

  } catch (error) {
    console.error('💥 JNT test endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'JNT test endpoint failed',
      details: error.message
    });
  }
}