import React, { useState, useRef } from 'react';
import { ShoppingCart, ChevronUp, MessageCircle, Star, X, ZoomIn } from 'lucide-react';
import { Product } from '../types';

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
  const [showZoomModal, setShowZoomModal] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [zoomScale, setZoomScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  
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

  const handleImageZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowZoomModal(true);
  };

  const handleZoomWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoomScale(prevScale => Math.min(Math.max(prevScale + delta, 0.5), 4));
  };

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - zoomPosition.x, y: e.clientY - zoomPosition.y });
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setZoomPosition({ x: newX, y: newY });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey || e.ctrlKey) {
      handleImageZoom(e);
    } else {
      onProductClick(product);
    }
  };

  const getTotalVariantStock = () => {
    // Calculate total stock from variants structure (same as ProductDetail)
    if (product.variants?.stock) {
      let totalStock = 0;
      Object.values(product.variants.stock).forEach((sizeStock: any) => {
        Object.values(sizeStock).forEach((colorStock: any) => {
          totalStock += Number(colorStock || 0);
        });
      });
            return totalStock;
    }

    // Fallback for non-variant products or missing variant data
        return product.stock || 0;
  };

  const getStatusBadge = () => {
    // Ready/PO badge with TOTAL stock count from all variants
    const totalStock = getTotalVariantStock();

    // Use status field with fallback to 'ready'
    const displayStatus = product.status || 'ready';

    const stockStatus = displayStatus === 'ready'
      ? `Ready (${totalStock})`
      : `PO (${totalStock})`;

    return (
      <div className={`absolute text-[10px] px-1 py-0.5 rounded-full font-medium backdrop-blur ${
        displayStatus === 'ready'
          ? 'bg-white/95 text-pink-700 shadow-lg border border-pink-200'
          : 'bg-white/95 text-pink-600 shadow-lg border border-pink-200'
      }`}>
        {stockStatus}
      </div>
    );
  };

  const getPrice = () => {
    // Use the isFlashSale prop passed from parent (HomePage already knows which products are flash sale)
    const isThisProductInFlashSale = isFlashSale && product.flashSalePrice && product.flashSalePrice > 0;


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
    <>
      <div
        className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group overflow-hidden border border-gray-100 ${
          isFeatured ? 'ring-2 ring-yellow-400' : ''
        }`}
      >
        <div className="relative aspect-[4/5] bg-gray-50 overflow-hidden">
          <img
            src={product.image || product.images?.[0] || '/placeholder-product.jpg'}
            alt={product.name}
            className="w-full h-full object-contain mix-blend-multiply hover:scale-105 transition-transform duration-500 ease-out p-2"
            onClick={handleImageClick}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.classList.remove('bg-gray-50');
                parent.classList.add('bg-gradient-to-br', 'from-blue-100', 'to-purple-100');
                parent.innerHTML = '<div class="flex items-center justify-center h-full w-full text-gray-400 text-center p-4 flex-col"><div class="text-3xl mb-2">📦</div><div class="text-xs font-medium">No Image</div></div>';
              }
            }}
          />

          {/* Status Badge - Back to Top Left */}
          <div className="absolute top-2 left-2">
            {getStatusBadge()}
          </div>

        {/* Zoom Button */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleImageZoom}
              type="button"
              className="bg-black bg-opacity-60 text-white p-1.5 rounded-full hover:bg-opacity-80 transition-all shadow-lg"
              title="Klik untuk zoom (Shift+Klik gambar)"
              aria-label="Zoom gambar"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Featured Product Star - Moved to Top Right */}
          {isFeatured && (
            <div className="absolute top-12 right-2 bg-yellow-400 text-white p-1.5 rounded-full shadow-lg">
              <Star className="w-4 h-4 fill-current" />
            </div>
          )}
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleAddToCart}
              className="bg-pink-500 text-white p-2 rounded-full hover:bg-pink-600 transition-colors shadow-lg"
              type="button"
              aria-label="Tambah ke keranjang"
              title="Tambah ke keranjang"
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom Hint */}
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
            Shift+Klik untuk zoom
          </div>
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-gray-800 mb-3 line-clamp-2 group-hover:text-pink-600 transition-colors">
            {product.name}
          </h3>

          {getPrice()}
        </div>
      </div>

      {/* Zoom Modal */}
      {showZoomModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
          onClick={() => setShowZoomModal(false)}
        >
          <div className="relative max-w-4xl max-h-full p-4">
            <button
              onClick={() => setShowZoomModal(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors z-10"
              type="button"
              aria-label="Close zoom modal"
              title="Tutup zoom modal"
            >
              <X className="w-6 h-6" />
            </button>

            <div
              className="bg-white rounded-lg p-2 max-w-full max-h-[80vh] overflow-hidden relative"
              onClick={(e) => e.stopPropagation()}
              onWheel={handleZoomWheel}
            >
              <img
                ref={imageRef}
                src={product.image || product.images?.[0] || '/placeholder-product.jpg'}
                alt={product.name}
                className={`max-w-full max-h-full object-contain cursor-move transition-transform duration-200 ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                style={{
                  transform: `translate(${zoomPosition.x}px, ${zoomPosition.y}px) scale(${zoomScale})`,
                  transformOrigin: 'center'
                }}
                draggable={false}
                onMouseDown={handleDragStart}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
              />
            </div>

            <div className="text-center mt-4 text-white">
              <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
              <p className="text-sm text-gray-300">
                🔍 Scroll untuk zoom • Drag untuk geser • Klik di luar gambar untuk menutup
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Zoom: {(zoomScale * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductCard;
