// Add AI Analysis to Baju 5 via REST API
// Run: node add-ai-baju5-rest.js

import fetch from 'node-fetch';

const FIREBASE_API_KEY = "AIzaSyBGPl6P_LpMWPtNAqKCjDiCxp1-zFNjBWE";
const PROJECT_ID = "azzahra-fashion-muslim-ab416";
const BATCH_DOC_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/productBatches/batch_1`;

async function addAIAnalysisToBaju5() {
  try {
    console.log('🚀 Fetching batch document...');
    
    // Get batch document
    const getResponse = await fetch(`${BATCH_DOC_URL}?key=${FIREBASE_API_KEY}`);
    
    if (!getResponse.ok) {
      throw new Error(`Failed to get batch: ${getResponse.status} ${getResponse.statusText}`);
    }
    
    const batchData = await getResponse.json();
    console.log('✅ Batch fetched');
    
    // Parse products array
    const productsField = batchData.fields.products;
    const products = productsField.arrayValue.values.map(v => {
      const fields = v.mapValue.fields;
      const product = {};
      
      // Parse each field
      for (const [key, value] of Object.entries(fields)) {
        if (value.stringValue !== undefined) product[key] = value.stringValue;
        else if (value.integerValue !== undefined) product[key] = parseInt(value.integerValue);
        else if (value.doubleValue !== undefined) product[key] = value.doubleValue;
        else if (value.booleanValue !== undefined) product[key] = value.booleanValue;
        else if (value.arrayValue) {
          product[key] = value.arrayValue.values?.map(av => {
            if (av.stringValue) return av.stringValue;
            if (av.mapValue) return av.mapValue; // Keep as is for now
            return av;
          }) || [];
        }
        else if (value.mapValue) product[key] = value.mapValue;
      }
      
      return { originalFields: fields, parsed: product };
    });
    
    console.log(`📦 Found ${products.length} products`);
    
    // Find baju 5
    const baju5Index = products.findIndex(p => p.parsed.id === 'product_1764832872695_8yz8zqkrg');
    
    if (baju5Index === -1) {
      console.error('❌ Baju 5 not found!');
      return;
    }
    
    console.log(`✅ Found baju 5 at index ${baju5Index}: ${products[baju5Index].parsed.name}`);
    
    // Add AI analysis to baju 5
    const aiAnalysis = {
      mapValue: {
        fields: {
          analyzedAt: { timestampValue: new Date().toISOString() },
          clothing_type: {
            mapValue: {
              fields: {
                main_type: { stringValue: "gamis" },
                silhouette: { stringValue: "a-line" },
                length: { stringValue: "maxi" },
                confidence: { integerValue: "85" }
              }
            }
          },
          pattern_type: {
            mapValue: {
              fields: {
                pattern: { stringValue: "solid" },
                complexity: { stringValue: "simple" },
                confidence: { integerValue: "90" }
              }
            }
          },
          lace_details: {
            mapValue: {
              fields: {
                has_lace: { booleanValue: false },
                locations: { arrayValue: { values: [] } },
                confidence: { integerValue: "80" }
              }
            }
          },
          hem_pleats: {
            mapValue: {
              fields: {
                has_pleats: { booleanValue: false },
                pleat_type: { stringValue: "none" },
                depth: { stringValue: "shallow" },
                fullness: { integerValue: "0" },
                confidence: { integerValue: "70" }
              }
            }
          },
          sleeve_details: {
            mapValue: {
              fields: {
                has_pleats: { booleanValue: false },
                sleeve_type: { stringValue: "straight" },
                pleat_position: { stringValue: "wrist" },
                ruffle_count: { integerValue: "0" },
                cuff_style: { stringValue: "plain" },
                confidence: { integerValue: "85" }
              }
            }
          },
          embellishments: {
            mapValue: {
              fields: {
                beads: {
                  mapValue: {
                    fields: {
                      has: { booleanValue: false },
                      locations: { arrayValue: { values: [] } },
                      density: { integerValue: "0" }
                    }
                  }
                },
                embroidery: {
                  mapValue: {
                    fields: {
                      has: { booleanValue: false },
                      pattern: { stringValue: "" }
                    }
                  }
                },
                sequins: {
                  mapValue: {
                    fields: {
                      has: { booleanValue: false },
                      locations: { arrayValue: { values: [] } }
                    }
                  }
                },
                gold_thread: {
                  mapValue: {
                    fields: {
                      has: { booleanValue: false },
                      coverage: { integerValue: "0" }
                    }
                  }
                }
              }
            }
          },
          colors: {
            arrayValue: {
              values: [{ stringValue: "solid" }]
            }
          },
          fabric_texture: { stringValue: "smooth" }
        }
      }
    };
    
    // Add aiAnalysis to baju 5's fields
    products[baju5Index].originalFields.aiAnalysis = aiAnalysis;
    
    console.log('📝 Adding AI analysis to baju 5...');
    
    // Reconstruct products array for update
    const updatedProducts = products.map(p => ({
      mapValue: { fields: p.originalFields }
    }));
    
    // Update batch document
    const updateResponse = await fetch(
      `${BATCH_DOC_URL}?key=${FIREBASE_API_KEY}&updateMask.fieldPaths=products`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            products: {
              arrayValue: { values: updatedProducts }
            }
          }
        })
      }
    );
    
    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Update failed: ${updateResponse.status} - ${error}`);
    }
    
    console.log('✅ AI analysis added to baju 5!');
    console.log('🎯 Now try AI Auto Upload - should match with baju 5!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

addAIAnalysisToBaju5();
