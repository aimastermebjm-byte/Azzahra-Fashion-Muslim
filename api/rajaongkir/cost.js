// Komerce API Integration - Calculate Domestic Cost
// Based on official Komerce documentation

const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

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

    console.log('🚀 Komerce API Request:', {
      origin,
      destination,
      weight,
      courier,
      price,
      apiKey: KOMERCE_API_KEY ? 'Set' : 'Missing'
    });

    // Available couriers
    const availableCouriers = ['jne', 'jnt', 'pos', 'tiki', 'sicepat', 'wahana'];

    let results = [];

    if (getAllCouriers) {
      // Get costs for ALL couriers
      console.log('🚀 Getting costs for ALL couriers...');

      for (const courierCode of availableCouriers) {
        try {
          const formData = new URLSearchParams();
          formData.append('origin', origin.toString());
          formData.append('destination', destination.toString());
          formData.append('weight', weight.toString());
          formData.append('courier', courierCode);
          formData.append('price', price);

          console.log(`📋 Request for ${courierCode}:`, formData.toString());

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
            if (data.meta?.status === 'success' && data.data && data.data.length > 0) {
              results = results.concat(data.data);
              console.log(`✅ ${courierCode} results:`, data.data.length);
            }
          }
        } catch (error) {
          console.error(`❌ Error getting ${courierCode}:`, error.message);
        }
      }
    } else {
      // Get cost for single courier (existing behavior)
      const formData = new URLSearchParams();
      formData.append('origin', origin.toString());
      formData.append('destination', destination.toString());
      formData.append('weight', weight.toString());
      formData.append('courier', courier);

      // Try to get all services by not specifying price
      if (price && price !== 'all') {
        formData.append('price', price);
      }

      console.log('📋 Request Body (single courier):', formData.toString());

      const response = await fetch(`${KOMERCE_BASE_URL}/calculate/domestic-cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'key': KOMERCE_API_KEY
        },
        body: formData.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Komerce API Error:', errorText);

        return res.status(response.status).json({
          meta: {
            message: `API Error: ${errorText}`,
            code: response.status,
            status: 'error'
          },
          data: null
        });
      }

      const data = await response.json();
      console.log('✅ Komerce API Response:', JSON.stringify(data, null, 2));

      // Return Komerce response directly (already in correct format)
      return res.status(200).json(data);
    }

    // Return results for getAllCouriers mode
    if (getAllCouriers) {
      console.log('✅ All couriers results:', results.length, 'items');

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

      console.log('✅ Returning all couriers response');
      return res.status(200).json(allCouriersResponse);
    }

  } catch (error) {
    console.error('💥 Komerce API Error:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });

    return res.status(500).json({
      meta: {
        message: 'Internal server error',
        code: 500,
        status: 'error'
      },
      data: null
    });
  }
}