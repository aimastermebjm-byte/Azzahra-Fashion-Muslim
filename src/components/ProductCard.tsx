import React, { useState } from 'react';
import { ShoppingCart, ChevronUp, MessageCircle, Star } from 'lucide-react';
import { Product } from '../types';
import { useFirebaseFlashSale } from '../hooks/useFirebaseFlashSale';

interface ProductCardProps {
  product: Product;
  onProductClick: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  isFlashSale?: boolean;
  isFeatured?: boolean;
  user?: any;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onProductClick,
  onAddToCart,
  isFlashSale = false,
  isFeatured = false,
  user
}) => {
  const [showResellerMenu, setShowResellerMenu] = useState(false);
  const { isFlashSaleActive, isProductInFlashSale } = useFirebaseFlashSale();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart(product);
  };

  const handleResellerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (user?.role !== 'reseller') {
      setShowResellerMenu(!showResellerMenu);
    }
  };

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const message = encodeURIComponent(
      `Halo Admin, saya tertarik dengan produk ${product.name} dan ingin menanyakan tentang harga reseller. Mohon info lebih lanjut. Terima kasih.`
    );
    window.open(`https://wa.me/6287815990944?text=${message}`, '_blank');
    setShowResellerMenu(false);
  };

  const getStatusBadge = () => {
    // Ready/PO badge with stock count
    const stockStatus = product.status === 'ready'
      ? `Ready (${product.stock})`
      : `PO (${product.stock})`;

    return (
      <div className={`absolute top-2 left-2 text-xs px-2 py-1 rounded font-medium ${
        product.status === 'ready'
          ? 'bg-green-500 text-white'
          : 'bg-orange-500 text-white'
      }`}>
        {stockStatus}
      </div>
    );
  };

  const getPrice = () => {
    // Check if this specific product is in flash sale and flash sale is active
    const isThisProductInFlashSale = isProductInFlashSale(product.id) && product.isFlashSale && product.flashSalePrice > 0;

  
    if (isThisProductInFlashSale) {
      return (
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold text-red-600">
              Rp {product.flashSalePrice.toLocaleString('id-ID')}
            </span>
            <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded">
              -{Math.round((1 - product.flashSalePrice / (product.originalRetailPrice || product.retailPrice)) * 100)}%
            </span>
          </div>
          <div className="text-sm text-gray-500 line-through">
            Rp {(product.originalRetailPrice || product.retailPrice).toLocaleString('id-ID')}
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-1 relative">
        <div className="text-lg font-bold text-pink-600">
          Rp {product.retailPrice.toLocaleString('id-ID')}
        </div>
        <div className="relative">
          {user?.role === 'reseller' ? (
            <div className="text-sm text-pink-600">
              Reseller: Rp {product.resellerPrice.toLocaleString('id-ID')}
            </div>
          ) : (
            <button
              onClick={handleResellerClick}
              className="text-sm text-pink-600 hover:text-pink-700 font-medium transition-colors flex items-center space-x-1"
            >
              <span>Reseller: Rp {product.resellerPrice.toLocaleString('id-ID')}</span>
              <ChevronUp className={`w-3 h-3 transition-transform ${showResellerMenu ? 'rotate-180' : ''}`} />
            </button>
          )}

          {/* Dropdown Menu */}
          {showResellerMenu && user?.role !== 'reseller' && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
              <button
                onClick={handleWhatsAppClick}
                className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2 rounded-t-lg"
              >
                <MessageCircle className="w-4 h-4 text-green-600" />
                <span>Info Reseller via WhatsApp</span>
              </button>
              <div className="text-xs text-gray-500 px-3 pb-2 text-center">
                Hubungi admin untuk harga reseller
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={() => onProductClick(product)}
      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden ${
        isFeatured ? 'ring-2 ring-yellow-400 shadow-lg' : ''
      }`}
    >
      <div className="relative">
        <img
          src={product.image || product.images?.[0] || '/placeholder-product.jpg'}
          alt={product.name}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
              parent.innerHTML = '<div class="flex items-center justify-center h-full text-white text-center p-4"><div><div class="text-2xl mb-2">📦</div><div class="text-sm">No Image</div></div></div>';
            }
          }}
        />
        {getStatusBadge()}
        {isFeatured && (
          <div className="absolute top-2 right-2 bg-yellow-400 text-white p-1.5 rounded-full shadow-lg">
            <Star className="w-4 h-4 fill-current" />
          </div>
        )}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleAddToCart}
            className="bg-pink-500 text-white p-2 rounded-full hover:bg-pink-600 transition-colors shadow-lg"
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3 line-clamp-2 group-hover:text-pink-600 transition-colors">
          {product.name}
        </h3>

        {getPrice()}
      </div>
    </div>
  );
};

export default ProductCard;