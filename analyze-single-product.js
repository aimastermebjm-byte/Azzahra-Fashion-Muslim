// Analyze SINGLE Product by ID
// Run: node analyze-single-product.js "PRODUCT_ID"

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Get args
let GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || "AIzaSyCY0oBaR5ctwc6Bk9P36Mct7eRoT6IZGmM";
let PRODUCT_ID = process.argv[2];

if (!GEMINI_API_KEY) {
  console.log('❌ Gemini API Key required in .env.local');
  process.exit(1);
}

if (!PRODUCT_ID) {
  console.log('❌ Product ID required!');
  console.log('Usage: node analyze-single-product.js "product_id_here"');
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

async function analyzeProduct() {
  console.log(`🚀 Analyzing Single Product: ${PRODUCT_ID}`);
  
  try {
    // 1. Load Batch
    const batchRef = doc(db, 'productBatches', 'batch_1');
    const batchSnap = await getDoc(batchRef);
    
    if (!batchSnap.exists()) {
      console.log('❌ Batch not found');
      return;
    }
    
    const products = batchSnap.data().products || [];
    const productIndex = products.findIndex(p => p.id === PRODUCT_ID);
    
    if (productIndex === -1) {
      console.log(`❌ Product ID ${PRODUCT_ID} not found in batch_1`);
      return;
    }
    
    const product = products[productIndex];
    console.log(`📦 Found Product: ${product.name}`);
    
    const mainImageUrl = product.images?.[0] || product.image;
    
    if (!mainImageUrl) {
      console.log('❌ No image URL found');
      return;
    }
    
    console.log(`📸 Image: ${mainImageUrl.substring(0, 50)}...`);
    
    // 2. Analyze
    const base64Image = await urlToBase64(mainImageUrl);
    console.log('🤖 Analyzing with Gemini...');
    
    const modelNames = ["gemini-2.5-flash", "gemini-3-pro", "gemini-1.5-flash"];
    let analysis = null;
    
    for (const modelName of modelNames) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`, {
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
        
        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            analysis = JSON.parse(text);
            console.log(`✅ Success with ${modelName}`);
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!analysis) {
      console.log('❌ All models failed');
      return;
    }
    
    // 3. Update Firestore
    console.log('💾 Saving to Firestore...');
    const updatedProducts = [...products];
    updatedProducts[productIndex] = {
      ...product,
      aiAnalysis: {
        ...analysis,
        analyzedAt: new Date().toISOString()
      }
    };
    
    await updateDoc(batchRef, { products: updatedProducts });
    console.log('✅ Product updated successfully!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

analyzeProduct();
