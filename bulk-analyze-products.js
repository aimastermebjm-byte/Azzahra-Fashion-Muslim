// Bulk Analyze Products - Add AI analysis to existing products in productBatches/batch_1
// Run: node bulk-analyze-products.js "YOUR_API_KEY"

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
// Native fetch in Node 20+

// Load environment variables
dotenv.config({ path: '.env.local' });

// Get API key
let GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.argv[2];

if (!GEMINI_API_KEY) {
  console.log('❌ Gemini API Key required!');
  console.log('Usage: node bulk-analyze-products.js "YOUR_API_KEY"');
  process.exit(1);
}

const firebaseConfig = {
  apiKey: "AIzaSyBGPl6P_LpMWPtNAqKCjDiCxp1-zFNjBWE",
  authDomain: "azzahra-fashion-muslim-ab416.firebaseapp.com",
  projectId: "azzahra-fashion-muslim-ab416",
  storageBucket: "azzahra-fashion-muslim-ab416.firebasestorage.app",
  messagingSenderId: "389566093532",
  appId: "1:389566093532:web:9e3ceb1d73bdda62b93a36",
  measurementId: "G-DL37HR4KT1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper to convert URL to base64
async function urlToBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  } catch (error) {
    console.error('Error converting image to base64:', error.message);
    throw error;
  }
}

// 1. DYNAMICALLY FIND AVAILABLE MODELS
async function getBestModel() {
  console.log('🔍 Checking available Gemini models...');
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
    const data = await response.json();
    
    if (!data.models) {
      console.warn('⚠️ Could not list models. Using fallback.');
      return 'gemini-1.5-flash';
    }

    // Filter for models that support generateContent
    const models = data.models
      .map(m => m.name.replace('models/', ''))
      .filter(name => 
        (name.includes('flash') || name.includes('pro') || name.includes('vision')) && 
        !name.includes('embedding')
      );
      
    console.log('📋 Available vision models:', models.join(', '));
    
    // Priority list (Newest to Oldest)
    const priorities = [
      'gemini-3.0-pro', // Hypothetical future
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.0-pro-vision'
    ];
    
    for (const p of priorities) {
      if (models.includes(p)) return p;
    }
    
    // If none match exact priority, pick the first "flash" model
    const flash = models.find(m => m.includes('flash'));
    if (flash) return flash;
    
    return models[0] || 'gemini-1.5-flash';
    
  } catch (error) {
    console.error('❌ Error listing models:', error.message);
    return 'gemini-1.5-flash'; // Fallback
  }
}

// Analysis prompt
const ANALYSIS_PROMPT = `
Analyze this clothing/fashion item image in EXTREME detail. Return ONLY valid JSON.
Format:
{
  "clothing_type": { "main_type": "gamis", "silhouette": "a-line", "length": "maxi", "confidence": 85 },
  "pattern_type": { "pattern": "floral", "complexity": "detailed", "confidence": 90 },
  "lace_details": { "has_lace": true, "locations": [{"position": "hem", "coverage": "moderate", "lace_type": "floral_lace"}], "confidence": 80 },
  "hem_pleats": { "has_pleats": true, "pleat_type": "accordion", "depth": "medium", "fullness": 75, "confidence": 70 },
  "sleeve_details": { "has_pleats": true, "sleeve_type": "bishop", "pleat_position": "wrist", "ruffle_count": 2, "cuff_style": "elastic", "confidence": 85 },
  "embellishments": { "beads": {"has": true, "locations": ["collar"], "density": 30}, "embroidery": {"has": false, "pattern": ""}, "sequins": {"has": false, "locations": []}, "gold_thread": {"has": false, "coverage": 0} },
  "colors": ["pink", "white"],
  "fabric_texture": "smooth"
}
`;

async function analyzeProductRaw(product, modelName) {
  try {
    console.log(`\n🔍 Analyzing: ${product.name}`);
    const mainImageUrl = product.images?.[0] || product.image;
    
    if (!mainImageUrl || mainImageUrl.includes('undefined')) {
      console.log('  ⚠️ Invalid image URL, skipping');
      return null;
    }
    
    const base64Image = await urlToBase64(mainImageUrl);
    
    console.log(`  🤖 Calling API (${modelName})...`);
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: ANALYSIS_PROMPT },
            { inline_data: { mime_type: "image/jpeg", data: base64Image } }
          ]
        }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.2
        }
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error ${response.status}: ${errText}`);
    }
    
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error('No response text');
    
    const analysis = JSON.parse(text);
    console.log('  ✅ Analysis success!');
    return { ...analysis, analyzedAt: new Date().toISOString() };
    
  } catch (error) {
    console.error(`  ❌ Failed: ${error.message}`);
    return null;
  }
}

async function bulkAnalyze() {
  console.log('🚀 Bulk Analyze Products (Direct REST API)');
  
  // 1. Find Best Model
  const bestModel = await getBestModel();
  console.log(`⭐ SELECTED MODEL: ${bestModel}\n`);
  
  // 2. Load Batch
  const batchRef = doc(db, 'productBatches', 'batch_1');
  const batchSnap = await getDoc(batchRef);
  
  if (!batchSnap.exists()) {
    console.log('❌ Batch not found');
    return;
  }
  
  const products = batchSnap.data().products || [];
  console.log(`📦 Found ${products.length} products`);
  
  const updatedProducts = [...products];
  let updatedCount = 0;
  
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    
    if (p.aiAnalysis?.analyzedAt) {
      // console.log(`✓ ${p.name} already done`);
      continue;
    }
    
    const analysis = await analyzeProductRaw(p, bestModel);
    
    if (analysis) {
      updatedProducts[i] = { ...p, aiAnalysis: analysis };
      updatedCount++;
      
      // Save every 2 items to be safe
      if (updatedCount % 2 === 0) {
        console.log(`💾 Saving progress...`);
        await updateDoc(batchRef, { products: updatedProducts });
      }
      
      // Short delay
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  if (updatedCount > 0) {
    await updateDoc(batchRef, { products: updatedProducts });
    console.log('✅ Final save complete.');
  } else {
    console.log('✅ No new updates needed.');
  }
}

bulkAnalyze();
