// Komerce API Integration - Calculate Domestic Cost
// Based on official Komerce documentation
// ✅ Now with multi-key fallback support

const { fetchWithFallback, KOMERCE_BASE_URL } = require('../utils/rajaongkir-keys');

export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, key');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'POST') {
      return res.status(405).json({
        meta: {
          message: 'Method not allowed',
          code: 405,
          status: 'error'
        },
        data: null
      });
    }

    const { origin, destination, weight, courier, price = 'lowest', getAllCouriers = false } = req.body;

    // Validate required parameters
    if (!origin || !destination || !weight || !courier) {
      return res.status(400).json({
        meta: {
          message: 'Missing required parameters: origin, destination, weight, courier',
          code: 400,
          status: 'error'
        },
        data: null
      });
    }

    // Available couriers
    const availableCouriers = ['jne', 'jnt', 'pos', 'tiki', 'sicepat', 'wahana'];

    let results = [];

    if (getAllCouriers) {
      // Get costs for ALL couriers
      for (const courierCode of availableCouriers) {
        try {
          const formData = new URLSearchParams();
          formData.append('origin', origin.toString());
          formData.append('destination', destination.toString());
          formData.append('weight', weight.toString());
          formData.append('courier', courierCode);
          formData.append('price', price);

          // ✅ Use fetchWithFallback for automatic key rotation
          const result = await fetchWithFallback('/calculate/domestic-cost', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
          });

          const { data } = result;
          if (data?.meta?.status === 'success' && data.data && data.data.length > 0) {
            results = results.concat(data.data);
          }
        } catch (error) {
          // Continue to next courier
          console.warn(`⚠️ Failed for ${courierCode}:`, error.message);
        }
      }
    } else {
      // Get cost for single courier (existing behavior)
      const formData = new URLSearchParams();
      formData.append('origin', origin.toString());
      formData.append('destination', destination.toString());
      formData.append('weight', weight.toString());
      formData.append('courier', courier);

      if (price && price !== 'all') {
        formData.append('price', price);
      }

      // ✅ Use fetchWithFallback for automatic key rotation
      const result = await fetchWithFallback('/calculate/domestic-cost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      const { response, data, keyIndex } = result;

      if (!response.ok) {
        console.error(`❌ Komerce API Error (key #${keyIndex}):`, response.status);
        return res.status(response.status).json({
          meta: {
            message: `API Error: ${response.status}`,
            code: response.status,
            status: 'error'
          },
          data: null
        });
      }

      // Return Komerce response directly (already in correct format)
      return res.status(200).json(data);
    }

    // Return results for getAllCouriers mode
    if (getAllCouriers) {
      // Sort by cost (lowest first)
      results.sort((a, b) => a.cost - b.cost);

      const allCouriersResponse = {
        meta: {
          message: 'Success Get All Couriers Domestic Shipping costs',
          code: 200,
          status: 'success'
        },
        data: results
      };

      return res.status(200).json(allCouriersResponse);
    }

  } catch (error) {
    console.error('💥 Komerce API Error:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });

    // NO MOCK DATA FALLBACK - Return error directly
    return res.status(500).json({
      meta: {
        message: `API Error: ${error.message}`,
        code: 500,
        status: 'error'
      },
      data: null
    });
  }
}