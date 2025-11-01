// Test courier codes with Komerce API
// This will help identify correct courier codes

async function testCourierCodes() {
  console.log('🧪 Testing Courier Codes with Komerce API...');

  const COURIERS_TO_TEST = [
    'jnt',      // Working
    'jne',      // Working
    'pos',      // Working
    'tiki',     // Working
    'sicepat',  // Working
    'wahana',   // Working
    'idexpress', // New - needs testing
    'lion',     // New - needs testing
    'id_express', // Alternative format
    'lion_parcel', // Alternative format
    'ide',      // Alternative format
    'lionparcel' // Alternative format
  ];

  const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
  const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

  // Test parameters
  const testParams = {
    origin: '607',  // Jakarta Pusat
    destination: '114', // Bandung
    weight: 1000,  // 1kg
    price: 'lowest'
  };

  console.log('📋 Test Parameters:', testParams);
  console.log('==========================================');

  for (const courierCode of COURIERS_TO_TEST) {
    console.log(`\n🚚 Testing courier: ${courierCode}`);

    try {
      const formData = new URLSearchParams();
      formData.append('origin', testParams.origin.toString());
      formData.append('destination', testParams.destination.toString());
      formData.append('weight', testParams.weight.toString());
      formData.append('courier', courierCode);
      formData.append('price', testParams.price);

      const response = await fetch(`${KOMERCE_BASE_URL}/calculate/domestic-cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'key': KOMERCE_API_KEY
        },
        body: formData.toString()
      });

      console.log(`   Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        if (data.meta && data.meta.code === 200) {
          const results = data.data || [];
          console.log(`   ✅ SUCCESS: Found ${results.length} services`);

          if (results.length > 0) {
            console.log('   📦 Sample services:');
            results.slice(0, 2).forEach((service, index) => {
              console.log(`     ${index + 1}. ${service.service} - Rp${service.cost} (${service.etd})`);
            });
          }
        } else {
          console.log(`   ❌ API Error: ${data.meta?.message || 'Unknown error'}`);
        }
      } else {
        const errorText = await response.text();
        console.log(`   ❌ HTTP Error: ${errorText}`);

        // Try to parse error message
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.meta?.message) {
            console.log(`   📝 Error Message: ${errorData.meta.message}`);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    } catch (error) {
      console.log(`   💥 Network Error: ${error.message}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n🎯 Test Summary:');
  console.log('==========================================');
  console.log('Working couriers will show services and costs');
  console.log('Invalid couriers will show errors');
  console.log('Use the working codes in your application');
}

// Make function available globally
window.testCourierCodes = testCourierCodes;

console.log('🚀 Courier Code Test loaded. Run testCourierCodes() in console to test.');

// Auto-run if needed
// testCourierCodes().catch(console.error);