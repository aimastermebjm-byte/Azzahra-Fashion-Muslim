// Test endpoint to explore Komerce API service options

const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

export default async function handler(req, res) {
  try {
    console.log('🧪 Testing Komerce API service options...');

    const origin = '607'; // Banjarmasin
    const destination = '177'; // Surabaya
    const weight = '1000'; // 1kg
    const courier = 'jne'; // Test JNE

    // Test 1: Without price parameter (might return all services)
    console.log('\nTest 1: Without price parameter');
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
        console.log('✅ Without price - Response:', JSON.stringify(data1, null, 2));
      } else {
        const errorText1 = await response1.text();
        console.log('❌ Without price - Error:', errorText1);
      }
    } catch (error) {
      console.log('❌ Without price - Network error:', error.message);
    }

    // Test 2: With price = lowest
    console.log('\nTest 2: With price = lowest');
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
        console.log('✅ Price lowest - Response:', JSON.stringify(data2, null, 2));
      } else {
        const errorText2 = await response2.text();
        console.log('❌ Price lowest - Error:', errorText2);
      }
    } catch (error) {
      console.log('❌ Price lowest - Network error:', error.message);
    }

    // Test 3: With price = highest
    console.log('\nTest 3: With price = highest');
    try {
      const formData3 = new URLSearchParams();
      formData3.append('origin', origin);
      formData3.append('destination', destination);
      formData3.append('weight', weight);
      formData3.append('courier', courier);
      formData3.append('price', 'highest');

      console.log('Request body (highest):', formData3.toString());

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
        console.log('✅ Price highest - Response:', JSON.stringify(data3, null, 2));
      } else {
        const errorText3 = await response3.text();
        console.log('❌ Price highest - Error:', errorText3);
      }
    } catch (error) {
      console.log('❌ Price highest - Network error:', error.message);
    }

    res.status(200).json({
      success: true,
      message: 'Komerce API service options test completed',
      timestamp: new Date().toISOString(),
      testParameters: { origin, destination, weight, courier }
    });

  } catch (error) {
    console.error('💥 Test endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Test endpoint failed',
      details: error.message
    });
  }
}