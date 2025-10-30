// Debug logging untuk shipping cost calculation
console.log('🔍 SHIPPING DEBUG SCRIPT LOADED');

// Override fetch untuk logging API calls
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const [url, options] = args;

  if (url.includes('/api/rajaongkir/cost')) {
    console.log('📡 SHIPPING API CALL:', {
      url,
      method: options?.method,
      body: options?.body ? JSON.parse(options.body) : null,
      timestamp: new Date().toISOString()
    });

    const response = await originalFetch.apply(this, args);
    const clonedResponse = response.clone();

    try {
      const data = await clonedResponse.json();
      console.log('📋 SHIPPING API RESPONSE:', {
        status: response.status,
        ok: response.ok,
        data,
        timestamp: new Date().toISOString()
      });

      // Log detail ongkos kirim
      if (data.meta?.status === 'success' && data.data?.length > 0) {
        console.log('💰 SHIPPING COSTS DETAIL:', data.data.map((item, index) => ({
          index,
          service: item.service,
          cost: item.cost,
          etd: item.etd,
          description: item.description
        })));

        // Find the cheapest
        const cheapest = data.data.reduce((min, curr) =>
          curr.cost < min.cost ? curr : min, data.data[0]);
        console.log('🏆 CHEAPEST SHIPPING:', {
          service: cheapest.service,
          cost: cheapest.cost,
          etd: cheapest.etd,
          description: cheapest.description
        });
      }
    } catch (error) {
      console.error('❌ Error parsing API response:', error);
    }

    return response;
  }

  return originalFetch.apply(this, args);
};

// Log address data usage
const originalLog = console.log;
console.log = function(...args) {
  if (args[0] === '🚚 CALCULATE SHIPPING COST DEBUG:') {
    console.log('🎯 SHIPPING CALCULATION TRIGGERED:', args[1]);

    // Log jika destination adalah cityId bukan subdistrictId
    const destId = args[1]?.destinationCityId;
    if (destId && destId.length === 3) {
      console.log('🏙️  POSSIBLE ISSUE: Using cityId (3 digits) instead of subdistrictId for destination');
      console.log('📍 Expected: subdistrictId for Cililin should be longer than 3 digits');
    } else if (destId && destId.length > 3) {
      console.log('✅ GOOD: Using subdistrictId (more than 3 digits) for destination');
    }
  }

  return originalLog.apply(this, args);
};