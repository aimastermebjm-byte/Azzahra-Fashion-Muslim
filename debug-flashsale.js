// Debug script untuk check flash sale status
console.log('🔍 DEBUG: Checking flash sale status...');

// Check localStorage
const flashSaleConfig = localStorage.getItem('flashSaleConfig');
console.log('📱 LocalStorage flash sale config:', flashSaleConfig ? JSON.parse(flashSaleConfig) : null);

// Check untuk products yang isFlashSale = true
const products = JSON.parse(localStorage.getItem('products') || '[]');
const flashSaleProducts = products.filter(p => p.isFlashSale);
console.log('🔥 Flash sale products in localStorage:', flashSaleProducts.length, flashSaleProducts.map(p => ({ name: p.name, id: p.id, isFlashSale: p.isFlashSale, flashSalePrice: p.flashSalePrice })));

// Check active flash sale status
const isFlashSaleActive = flashSaleConfig ? JSON.parse(flashSaleConfig).isActive : false;
console.log('⚡ Flash sale active status:', isFlashSaleActive);

if (flashSaleProducts.length > 0 && !isFlashSaleActive) {
    console.warn('🚨 PROBLEM DETECTED: Products have isFlashSale=true but flash sale is not active!');
    flashSaleProducts.forEach(p => {
        console.warn(`🚨 Product "${p.name}" (ID: ${p.id}) stuck in flash sale mode`);
    });
} else if (flashSaleProducts.length === 0 && isFlashSaleActive) {
    console.warn('🚨 PROBLEM DETECTED: Flash sale is active but no products marked as flash sale!');
} else {
    console.log('✅ Flash sale status appears consistent');
}