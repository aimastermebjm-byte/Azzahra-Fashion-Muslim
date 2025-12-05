import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, Minus, ShoppingCart, Heart, Share2, Star } from 'lucide-react';
import { Product } from '../types';
import { useGlobalProducts } from '../hooks/useGlobalProducts';

interface ProductDetailProps {
  currentProduct: Product;
  user: any;
  onBack: () => void;
  onLoginRequired: () => void;
  onAddToCart: (product: Product, variant: any, quantity: number) => void;
  onBuyNow: (product: Product, variant: any, quantity: number) => void;
  onNavigateToCart?: () => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({
  currentProduct: initialProduct,
  user,
  onBack,
  onLoginRequired,
  onAddToCart,
  onBuyNow,
  onNavigateToCart
}) => {

  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // 🔥 GLOBAL STATE: 0 reads untuk product data
  const { getProductById } = useGlobalProducts();

  const currentProduct = useMemo(() => {
    return getProductById(initialProduct.id) || initialProduct;
  }, [initialProduct.id, getProductById]);

  
  const handleAddToCart = () => {
    if (!user) {
      onLoginRequired();
      return;
    }

    // Check if variants exist and require selection
    if (currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0) {
      if (!selectedSize || !selectedColor) {
        alert('Pilih ukuran dan warna terlebih dahulu');
        return;
      }
    }

    const availableStock = getSelectedVariantStock();
    if (quantity > availableStock) {
      const stockMessage = (currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0)
        ? `Stok tidak mencukupi! Stok tersedia untuk ${selectedSize} - ${selectedColor} adalah ${availableStock} pcs`
        : `Stok tidak mencukupi! Stok tersedia adalah ${availableStock} pcs`;
      alert(stockMessage);
      return;
    }

    console.log('🔍 DEBUG: ProductDetail variant creation:', {
      hasVariants: !!(currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0),
      selectedSize,
      selectedColor,
      sizes: currentProduct.variants?.sizes,
      colors: currentProduct.variants?.colors
    });

    const variant = (currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0)
      ? { size: selectedSize, color: selectedColor }
      : undefined;

    console.log('🔍 DEBUG: Final variant object:', variant);
    onAddToCart(currentProduct, variant, quantity);

    // Reset selections
    setSelectedSize('');
    setSelectedColor('');
    setQuantity(1);
  };

  const handleBuyNow = () => {
    if (!user) {
      onLoginRequired();
      return;
    }

    // Check if variants exist and require selection
    if (currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0) {
      if (!selectedSize || !selectedColor) {
        alert('Pilih ukuran dan warna terlebih dahulu');
        return;
      }
    }

    const availableStock = getSelectedVariantStock();
    if (quantity > availableStock) {
      const stockMessage = (currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0)
        ? `Stok tidak mencukupi! Stok tersedia untuk ${selectedSize} - ${selectedColor} adalah ${availableStock} pcs`
        : `Stok tidak mencukupi! Stok tersedia adalah ${availableStock} pcs`;
      alert(stockMessage);
      return;
    }

    const variant = (currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0)
      ? { size: selectedSize, color: selectedColor }
      : null;
    onBuyNow(currentProduct, variant, quantity);
  };

  const getPrice = () => {
    if (currentProduct.isFlashSale && currentProduct.flashSalePrice > 0) {
      return currentProduct.flashSalePrice;
    }
    return user?.role === 'reseller' ? currentProduct.resellerPrice : currentProduct.retailPrice;
  };

  const getOriginalPrice = () => {
    return user?.role === 'reseller' ? currentProduct.resellerPrice : currentProduct.retailPrice;
  };

  const handleResellerPriceClick = () => {
    if (user?.role !== 'reseller') {
      const message = encodeURIComponent(
        `Halo Admin, saya tertarik dengan produk ${currentProduct.name} dan ingin menanyakan tentang harga reseller. Mohon info lebih lanjut. Terima kasih.`
      );
      window.open(`https://wa.me/6287815990944?text=${message}`, '_blank');
    }
  };

  // Get stock for specific variant - BATCH SYSTEM (CORRECT STRUCTURE)
  const getVariantStock = (size: string, color: string) => {

    // BATCH SYSTEM: Check correct structure from Firestore
    if (currentProduct.variants?.stock) {
      const variantStock = currentProduct.variants.stock[size]?.[color];
      const stock = Number(variantStock || 0);
            return stock;
    }

    // Fallback: Check if this is a non-variant product
    if (!currentProduct.variants?.sizes || currentProduct.variants.sizes.length === 0) {
            return currentProduct.stock || 0;
    }

    // No stock data available
    console.warn('❌ No stock data found for variant:', { size, color });
    return 0;
  };

  // Get available stock for selected variants
  const getSelectedVariantStock = () => {
    if (!selectedSize || !selectedColor) {
      return currentProduct.stock || 0;
    }
    return getVariantStock(selectedSize, selectedColor);
  };

  // Calculate total stock across all variants
  const getTotalStock = () => {
    if (currentProduct.variants?.stock) {
      let total = 0;
      Object.values(currentProduct.variants.stock).forEach(sizeStock => {
        Object.values(sizeStock).forEach(colorStock => {
          total += colorStock;
        });
      });
      return total;
    }
    return currentProduct.stock || 0;
  };

  
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold">Detail Produk</h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={onNavigateToCart || (() => {})}
              className={`p-2 rounded-full transition-colors relative ${
                user ? 'bg-pink-500 text-white hover:bg-pink-600' : 'bg-gray-100 text-gray-400'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full">
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full">
              <Heart className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

        {/* Product Images */}
        <div className="bg-white">
          <div className="relative">
            <img
              src={currentProduct.images?.[selectedImageIndex] || currentProduct.image || '/placeholder-currentProduct.jpg'}
              alt={currentProduct.name}
              className="w-full h-96 object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/placeholder-currentProduct.jpg';
              }}
            />
            
            {currentProduct.isFlashSale && (
              <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                FLASH SALE
              </div>
            )}
            
            {currentProduct.status === 'po' && (
              <div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                PRE ORDER
              </div>
            )}
          </div>
          
          {currentProduct.images && currentProduct.images.length > 1 && (
            <div className="flex space-x-2 p-4 overflow-x-auto">
              {currentProduct.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                    selectedImageIndex === index ? 'border-pink-500' : 'border-gray-200'
                  }`}
                >
                  <img
                    src={image}
                    alt={`${currentProduct.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-currentProduct.jpg';
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="bg-white mt-2 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-800 mb-2">{currentProduct.name}</h1>
              <div className="flex items-center space-x-2 mb-2">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                  <span className="text-sm text-gray-600 ml-1">(4.8)</span>
                </div>
                <span className="text-sm text-gray-500">• Terjual 150+</span>
              </div>
            </div>
          </div>

          <div className="mb-4">
            {currentProduct.isFlashSale && currentProduct.flashSalePrice > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-red-600">
                    Rp {currentProduct.flashSalePrice.toLocaleString('id-ID')}
                  </span>
                  <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded">
                    -{Math.round((1 - currentProduct.flashSalePrice / (currentProduct.originalRetailPrice || currentProduct.retailPrice)) * 100)}%
                  </span>
                </div>
                <div className="text-lg text-gray-500 line-through">
                  Rp {(currentProduct.originalRetailPrice || currentProduct.retailPrice).toLocaleString('id-ID')}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-pink-600">
                  Rp {getPrice().toLocaleString('id-ID')}
                </div>
                {user?.role === 'reseller' ? (
                  <div className="text-sm text-blue-600 font-medium">
                    Harga Reseller (Retail: Rp {currentProduct.retailPrice.toLocaleString('id-ID')})
                  </div>
                ) : (
                  <button
                    onClick={handleResellerPriceClick}
                    className="text-sm text-green-600 font-medium hover:text-green-700 underline transition-colors"
                  >
                    💬 Info Harga Reseller?
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stock and Status Info */}
          <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <span className="text-gray-600">Total Stok: </span>
                <span className={`font-semibold ${
                  getTotalStock() > 10 ? 'text-green-600' :
                  getTotalStock() > 0 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {getTotalStock()}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Status: </span>
                <span className={`font-semibold ${
                  currentProduct.status === 'ready' ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {currentProduct.status === 'ready' ? 'Ready Stock' : 'Pre Order'}
                </span>
              </div>
            </div>
          </div>

          {/* Variant Stock Display */}
          {selectedSize && selectedColor && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm">
                <span className="text-blue-600 font-medium">Stok {selectedSize} - {selectedColor}: </span>
                <span className={`font-bold ${
                  getSelectedVariantStock() > 5 ? 'text-green-600' :
                  getSelectedVariantStock() > 0 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {getSelectedVariantStock()} pcs
                </span>
              </div>
            </div>
          )}
          <div className="border-t pt-4">
            <p className="text-gray-600 leading-relaxed">{currentProduct.description}</p>
          </div>
        </div>

        {/* Variants Selection */}
        {currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0 && (
          <div className="bg-white mt-2 p-4">
            {/* Size Selection */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-3">Pilih Ukuran</h3>
            <div className="flex flex-wrap gap-2">
              {(currentProduct.variants?.sizes || []).map((size) => {
                // Calculate total stock for this size across all colors
                const sizeTotalStock = (currentProduct.variants?.colors || []).reduce((total, color) => {
                  return total + getVariantStock(size, color);
                }, 0);

                return (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    disabled={sizeTotalStock === 0}
                    className={`px-4 py-2 border rounded-lg font-medium transition-colors relative ${
                      selectedSize === size
                        ? 'border-pink-500 bg-pink-50 text-pink-600'
                        : sizeTotalStock === 0
                        ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <span>{size}</span>
                    {sizeTotalStock === 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    )}
                    {currentProduct.variants.stock && (
                      <span className="text-xs text-gray-500 block">
                        {sizeTotalStock > 0 ? `${sizeTotalStock} pcs` : 'Habis'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Selection */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Pilih Warna</h3>
            <div className="flex flex-wrap gap-2">
              {(currentProduct.variants?.colors || []).map((color) => {
                // Get stock for this color (based on selected size, or total across all sizes if no size selected)
                const colorStock = selectedSize
                  ? getVariantStock(selectedSize, color)
                  : (currentProduct.variants?.sizes || []).reduce((total, size) => total + getVariantStock(size, color), 0);

                const isColorDisabled = selectedSize ? colorStock === 0 : false;

                return (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    disabled={isColorDisabled}
                    className={`px-4 py-2 border rounded-lg font-medium transition-colors relative ${
                      selectedColor === color
                        ? 'border-pink-500 bg-pink-50 text-pink-600'
                        : isColorDisabled
                        ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <span>{color}</span>
                    {isColorDisabled && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    )}
                    {currentProduct.variants.stock && (
                      <span className="text-xs text-gray-500 block">
                        {colorStock > 0 ? `${colorStock} pcs` : 'Habis'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedSize && (
              <p className="text-xs text-gray-500 mt-2">
                💡 Stok warna ditampilkan untuk ukuran {selectedSize}
              </p>
            )}
          </div>
        </div>
        )}

        {/* Quantity Selection */}
        <div className="bg-white mt-2 p-4">
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Jumlah</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center font-semibold">{quantity}</span>
                <button
                  onClick={() => {
                    const maxStock = getSelectedVariantStock();
                    if (quantity < maxStock) {
                      setQuantity(quantity + 1);
                    }
                  }}
                  disabled={quantity >= getSelectedVariantStock()}
                  className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${
                    quantity >= getSelectedVariantStock()
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'hover:bg-gray-200'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="text-sm text-gray-600">
                {selectedSize && selectedColor ? (
                  <>
                    Stok {selectedSize} - {selectedColor}:{' '}
                    <span className={`font-semibold ${
                      getSelectedVariantStock() > 5 ? 'text-green-600' :
                      getSelectedVariantStock() > 0 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {getSelectedVariantStock()} pcs
                    </span>
                  </>
                ) : (
                  <>
                    Stok tersedia:{' '}
                    <span className="font-semibold">{getTotalStock()} pcs</span>
                  </>
                )}
              </div>
            </div>

            {/* Stock Warning */}
            {selectedSize && selectedColor && quantity >= getSelectedVariantStock() && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-700">
                  ⚠️ Maksimal pembelian untuk {selectedSize} - {selectedColor} adalah {getSelectedVariantStock()} pcs
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Product Details */}
        <div className="bg-white mt-2 p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Detail Produk</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Kategori:</span>
              <span className="font-medium capitalize">{currentProduct.category}</span>
            </div>
            {currentProduct.status === 'po' && currentProduct.estimatedReady && (
              <div className="flex justify-between">
                <span className="text-gray-600">Estimasi Ready:</span>
                <span className="font-medium">{currentProduct.estimatedReady.toLocaleDateString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Berat:</span>
              <span className="font-medium">{currentProduct.weight} gram</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Kondisi:</span>
              <span className="font-medium text-green-600">Baru</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Garansi:</span>
              <span className="font-medium">Garansi Toko</span>
            </div>
          </div>
        </div>

      {/* Bottom Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50">
        <div className="flex space-x-3">
          <button
            onClick={handleAddToCart}
            disabled={currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0 ? (!selectedSize || !selectedColor) : false}
            className="flex-1 btn-brand-outline py-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <ShoppingCart className="w-5 h-5" />
            <span>Tambah ke Keranjang</span>
          </button>
          <button
            onClick={handleBuyNow}
            disabled={currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0 ? (!selectedSize || !selectedColor) : false}
            className="flex-1 btn-brand py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Beli Sekarang
          </button>
        </div>

        {currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0 && (!selectedSize || !selectedColor) && (
          <p className="text-center text-sm text-gray-500 mt-2">
            Pilih ukuran dan warna terlebih dahulu
          </p>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;