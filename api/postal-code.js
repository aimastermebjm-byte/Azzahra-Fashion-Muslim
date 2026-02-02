// Postal Code API - Lookup kode pos by kelurahan/desa
// Data source: erlange/Kodepos-Wilayah-Indonesia (Permendagri No.137/2017)

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load kodepos data (runs once on cold start)
let kodeposData = null;

function loadKodeposData() {
    if (kodeposData) return kodeposData;
    try {
        // In Vercel, __dirname works differently - need to construct path
        const fs = require('fs');
        const path = require('path');

        // Try loading from scripts/data first (development)
        const devPath = path.join(process.cwd(), 'scripts', 'data', 'kodepos.json');
        if (fs.existsSync(devPath)) {
            kodeposData = JSON.parse(fs.readFileSync(devPath, 'utf-8'));
            console.log('✅ Loaded kodepos.json from development path');
            return kodeposData;
        }

        // Fallback: Try public folder (production)
        const prodPath = path.join(process.cwd(), 'public', 'data', 'kodepos.json');
        if (fs.existsSync(prodPath)) {
            kodeposData = JSON.parse(fs.readFileSync(prodPath, 'utf-8'));
            console.log('✅ Loaded kodepos.json from public path');
            return kodeposData;
        }

        console.error('❌ kodepos.json not found');
        return null;
    } catch (error) {
        console.error('Error loading kodepos data:', error);
        return null;
    }
}

// Normalize string for matching (uppercase, trim, remove extra spaces)
function normalizeString(str) {
    if (!str) return '';
    return str.toUpperCase().trim().replace(/\s+/g, ' ');
}

// Find postal codes for a specific location
function findPostalCodes(province, city, district, subdistrict) {
    const data = loadKodeposData();
    if (!data) return { success: false, error: 'Data not loaded', codes: [] };

    const normProvince = normalizeString(province);
    const normCity = normalizeString(city);
    const normDistrict = normalizeString(district);
    const normSubdistrict = normalizeString(subdistrict);

    console.log(`🔍 Looking for: ${normProvince} > ${normCity} > ${normDistrict} > ${normSubdistrict}`);

    // Find matching province
    let matchedProvince = null;
    for (const prov of Object.keys(data)) {
        if (normalizeString(prov).includes(normProvince) || normProvince.includes(normalizeString(prov))) {
            matchedProvince = prov;
            break;
        }
    }

    if (!matchedProvince) {
        console.log(`❌ Province not found: ${normProvince}`);
        return { success: false, error: 'Province not found', codes: [] };
    }

    // Find matching city
    let matchedCity = null;
    const cities = data[matchedProvince];
    for (const c of Object.keys(cities)) {
        const normC = normalizeString(c);
        if (normC.includes(normCity) || normCity.includes(normC)) {
            matchedCity = c;
            break;
        }
    }

    if (!matchedCity) {
        console.log(`❌ City not found: ${normCity}`);
        return { success: false, error: 'City not found', codes: [] };
    }

    // Find matching district
    let matchedDistrict = null;
    const districts = cities[matchedCity];
    for (const d of Object.keys(districts)) {
        const normD = normalizeString(d);
        if (normD.includes(normDistrict) || normDistrict.includes(normD)) {
            matchedDistrict = d;
            break;
        }
    }

    if (!matchedDistrict) {
        console.log(`❌ District not found: ${normDistrict}`);
        return { success: false, error: 'District not found', codes: [] };
    }

    // Get subdistricts and postal codes for this district
    const subdistricts = districts[matchedDistrict];

    // If subdistrict is provided, find specific match
    if (normSubdistrict) {
        for (const sub of Object.keys(subdistricts)) {
            const normSub = normalizeString(sub);
            if (normSub.includes(normSubdistrict) || normSubdistrict.includes(normSub)) {
                const postalCode = subdistricts[sub];
                console.log(`✅ Found: ${sub} → ${postalCode}`);
                return {
                    success: true,
                    codes: [postalCode],
                    matched: {
                        province: matchedProvince,
                        city: matchedCity,
                        district: matchedDistrict,
                        subdistrict: sub
                    }
                };
            }
        }
        console.log(`❌ Subdistrict not found: ${normSubdistrict}`);
        return { success: false, error: 'Subdistrict not found', codes: [] };
    }

    // If no subdistrict provided, return all postal codes for the district
    const allCodes = [...new Set(Object.values(subdistricts))];
    console.log(`✅ Found ${allCodes.length} postal codes for district ${matchedDistrict}`);

    return {
        success: true,
        codes: allCodes.sort(),
        matched: {
            province: matchedProvince,
            city: matchedCity,
            district: matchedDistrict
        },
        subdistricts: Object.entries(subdistricts).map(([name, code]) => ({
            name,
            postal_code: code
        }))
    };
}

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const { province, city, district, subdistrict } = req.query;

        if (!province || !city || !district) {
            return res.status(400).json({
                success: false,
                message: 'Required: province, city, district',
                codes: []
            });
        }

        const result = findPostalCodes(province, city, district, subdistrict);

        return res.status(result.success ? 200 : 404).json(result);

    } catch (error) {
        console.error('Postal code API error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
            codes: []
        });
    }
}
