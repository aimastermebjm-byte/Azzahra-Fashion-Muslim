import React, { useState, useRef } from 'react';
import { ShoppingCart, ChevronUp, MessageCircle, X, ZoomIn } from 'lucide-react';
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
    const isReady = displayStatus === 'ready';

    return (
      <div className={`flex items-center gap-1 px-2 py-1 shadow-sm text-[10px] font-bold rounded-r-full ${isReady
        ? 'bg-emerald-500 text-white'
        : 'bg-amber-500 text-white'
        }`}>
        {isReady ? 'READY' : 'PO'} {totalStock > 0 && `(${totalStock})`}
      </div>
    );
  };

  const getPrice = () => {
    // Use the isFlashSale prop passed from parent
    const isThisProductInFlashSale = isFlashSale && product.flashSalePrice && product.flashSalePrice > 0;

    if (isThisProductInFlashSale) {
      return (
        <div className="space-y-1">
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-base font-bold text-brand-accent">
              Rp {product.flashSalePrice.toLocaleString('id-ID')}
            </span>
            <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded">
              -{Math.round((1 - product.flashSalePrice / (product.originalRetailPrice || product.retailPrice)) * 100)}%
            </span>
          </div>
          <div className="text-xs text-gray-400 line-through">
            Rp {(product.originalRetailPrice || product.retailPrice).toLocaleString('id-ID')}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1 relative">
        <div className="text-base font-bold text-brand-accent">
          Rp {product.retailPrice.toLocaleString('id-ID')}
        </div>
        <div className="relative">
          {user?.role === 'reseller' ? (
            <div className="text-xs font-medium text-brand-primary">
              Reseller: Rp {product.resellerPrice.toLocaleString('id-ID')}
            </div>
          ) : (
            <button
              onClick={handleResellerClick}
              className="text-xs text-gray-400 hover:text-brand-primary transition-colors flex items-center gap-1"
            >
              <span>Harga Reseller?</span>
              <ChevronUp className={`w-3 h-3 transition-transform ${showResellerMenu ? 'rotate-180' : ''}`} />
            </button>
          )}

          {/* Dropdown Menu */}
          {showResellerMenu && user?.role !== 'reseller' && (
            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-20 p-2">
              <p className="text-xs text-gray-600 mb-2">Login sebagai reseller untuk melihat harga khusus.</p>
              <button
                onClick={handleWhatsAppClick}
                className="w-full px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-3 h-3" />
                <span>Chat Admin</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        className={`bg-white rounded-lg hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden border border-gray-100 relative
        ${isFeatured ? 'ring-1 ring-yellow-400' : ''}`}
        onClick={handleImageClick}
      >
        <div className="relative aspect-[3/4] bg-gray-50 overflow-hidden">
          <img
            src={product.image || product.images?.[0] || '/placeholder-product.jpg'}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.classList.remove('bg-gray-50');
                parent.classList.add('bg-blue-50');
                parent.innerHTML = '<div class="flex items-center justify-center h-full w-full text-blue-300 flex-col"><div class="text-3xl mb-2">📦</div></div>';
              }
            }}
          />

          {/* Status Badge - Modern Ribbon Left */}
          <div className="absolute top-3 left-0">
            {getStatusBadge()}
          </div>

          {/* Quick Actions Overlay (Mobile friendly touches) */}
          <div className="absolute bottom-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={handleImageZoom}
              className="w-8 h-8 rounded-full bg-white/90 text-gray-700 shadow-sm flex items-center justify-center hover:bg-brand-primary hover:text-white transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleAddToCart}
              className="w-8 h-8 rounded-full bg-brand-accent text-white shadow-sm flex items-center justify-center hover:bg-orange-600 transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
          </div>

        </div>

        <div className="p-2 sm:p-2.5 md:p-3">
          <h3 className="font-semibold text-sm sm:text-base text-gray-800 mb-2 sm:mb-3 line-clamp-2 group-hover:text-pink-600 transition-colors">
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
                className={`max-w-full max-h-full object-contain cursor-move transition-transform duration-200 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'
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
