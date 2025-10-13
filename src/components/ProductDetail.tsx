import React, { useState } from 'react';
import { ArrowLeft, Plus, Minus, ShoppingCart, Heart, Share2, Star } from 'lucide-react';
import { Product } from '../types';

interface ProductDetailProps {
  product: Product;
  user: any;
  onBack: () => void;
  onLoginRequired: () => void;
  onAddToCart: (product: Product, variant: any, quantity: number) => void;
  onBuyNow: (product: Product, variant: any, quantity: number) => void;
  onNavigateToCart?: () => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({
  product,
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

  const handleAddToCart = () => {
    if (!user) {
      onLoginRequired();
      return;
    }

    if (!selectedSize || !selectedColor) {
      alert('Pilih ukuran dan warna terlebih dahulu');
      return;
    }

    onAddToCart(product, { size: selectedSize, color: selectedColor }, quantity);
    
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

    if (!selectedSize || !selectedColor) {
      alert('Pilih ukuran dan warna terlebih dahulu');
      return;
    }

    onBuyNow(product, { size: selectedSize, color: selectedColor }, quantity);
  };

  const getPrice = () => {
    if (product.isFlashSale && product.flashSalePrice > 0) {
      return product.flashSalePrice;
    }
    return user?.role === 'reseller' ? product.resellerPrice : product.retailPrice;
  };

  const getOriginalPrice = () => {
    return user?.role === 'reseller' ? product.resellerPrice : product.retailPrice;
  };

  const handleResellerPriceClick = () => {
    if (user?.role !== 'reseller') {
      const message = encodeURIComponent(
        `Halo Admin, saya tertarik dengan produk ${product.name} dan ingin menanyakan tentang harga reseller. Mohon info lebih lanjut. Terima kasih.`
      );
      window.open(`https://wa.me/6287815990944?text=${message}`, '_blank');
    }
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
              src={product.images[selectedImageIndex]}
              alt={product.name}
              className="w-full h-96 object-cover"
            />
            
            {product.isFlashSale && (
              <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                FLASH SALE
              </div>
            )}
            
            {product.status === 'po' && (
              <div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                PRE ORDER
              </div>
            )}
          </div>
          
          {product.images.length > 1 && (
            <div className="flex space-x-2 p-4 overflow-x-auto">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                    selectedImageIndex === index ? 'border-pink-500' : 'border-gray-200'
                  }`}
                >
                  <img src={image} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="bg-white mt-2 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-800 mb-2">{product.name}</h1>
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
            {product.isFlashSale && product.flashSalePrice > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-red-600">
                    Rp {product.flashSalePrice.toLocaleString('id-ID')}
                  </span>
                  <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded">
                    -{Math.round((1 - product.flashSalePrice / (product.originalRetailPrice || product.retailPrice)) * 100)}%
                  </span>
                </div>
                <div className="text-lg text-gray-500 line-through">
                  Rp {(product.originalRetailPrice || product.retailPrice).toLocaleString('id-ID')}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-pink-600">
                  Rp {getPrice().toLocaleString('id-ID')}
                </div>
                {user?.role === 'reseller' ? (
                  <div className="text-sm text-blue-600 font-medium">
                    Harga Reseller (Retail: Rp {product.retailPrice.toLocaleString('id-ID')})
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
                <span className="text-gray-600">Stok: </span>
                <span className={`font-semibold ${
                  product.stock > 10 ? 'text-green-600' : 
                  product.stock > 0 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {product.stock}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Status: </span>
                <span className={`font-semibold ${
                  product.status === 'ready' ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {product.status === 'ready' ? 'Ready Stock' : 'Pre Order'}
                </span>
              </div>
            </div>
          </div>
          <div className="border-t pt-4">
            <p className="text-gray-600 leading-relaxed">{product.description}</p>
          </div>
        </div>

        {/* Variants Selection */}
        <div className="bg-white mt-2 p-4">
          {/* Size Selection */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Pilih Ukuran</h3>
            <div className="flex flex-wrap gap-2">
              {product.variants.sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`px-4 py-2 border rounded-lg font-medium transition-colors ${
                    selectedSize === size
                      ? 'border-pink-500 bg-pink-50 text-pink-600'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Pilih Warna</h3>
            <div className="flex flex-wrap gap-2">
              {product.variants.colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`px-4 py-2 border rounded-lg font-medium transition-colors ${
                    selectedColor === color
                      ? 'border-pink-500 bg-pink-50 text-pink-600'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity Selection */}
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
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="text-sm text-gray-600">
                Stok tersedia: <span className="font-semibold">{product.stock}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details */}
        <div className="bg-white mt-2 p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Detail Produk</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Kategori:</span>
              <span className="font-medium capitalize">{product.category}</span>
            </div>
            {product.status === 'po' && product.estimatedReady && (
              <div className="flex justify-between">
                <span className="text-gray-600">Estimasi Ready:</span>
                <span className="font-medium">{product.estimatedReady.toLocaleDateString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Berat:</span>
              <span className="font-medium">500 gram</span>
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
            disabled={!selectedSize || !selectedColor}
            className="flex-1 bg-pink-100 text-pink-600 py-4 rounded-lg font-semibold hover:bg-pink-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <ShoppingCart className="w-5 h-5" />
            <span>Tambah ke Keranjang</span>
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!selectedSize || !selectedColor}
            className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-lg font-semibold hover:from-pink-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Beli Sekarang
          </button>
        </div>
        
        {(!selectedSize || !selectedColor) && (
          <p className="text-center text-sm text-gray-500 mt-2">
            Pilih ukuran dan warna terlebih dahulu
          </p>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;