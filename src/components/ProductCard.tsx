import React, { useState, useRef } from 'react';
import { ChevronUp, MessageCircle, X, ZoomIn } from 'lucide-react';
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
      <div className={`px-3 py-1 bg-white/95 backdrop-blur-sm border border-[#D4AF37]/50 text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm`}>
        {isReady ? 'Ready' : 'PO'} ({totalStock})
      </div>
    );
  };

  const getPrice = () => {
    // Use the isFlashSale prop passed from parent (HomePage already knows which products are flash sale)
    const isThisProductInFlashSale = isFlashSale && product.flashSalePrice && product.flashSalePrice > 0;

    if (isThisProductInFlashSale) {
      return (
        <div className="space-y-0.5 text-left">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold text-[#D4AF37]">
              Rp {product.flashSalePrice.toLocaleString('id-ID')}
            </span>
            <span className="bg-red-50 text-red-600 text-[10px] font-medium px-1.5 py-0.5 rounded border border-red-100">
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
      <div className="space-y-1.5 text-left">
        <div className="text-base sm:text-lg font-bold text-[#D4AF37]">
          Rp {product.retailPrice.toLocaleString('id-ID')}
        </div>

        {/* Reseller Price Tag */}
        <div className="relative">
          {user?.role === 'reseller' ? (
            <div className="flex items-center gap-1.5 text-xs text-brand-primary/80 bg-brand-surface/50 py-1 px-2 rounded-lg w-fit">
              <span className="font-medium opacity-70">Reseller:</span>
              <span className="font-bold">Rp {product.resellerPrice.toLocaleString('id-ID')}</span>
            </div>
          ) : (
            <button
              onClick={handleResellerClick}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#D4AF37] transition-colors"
            >
              <span>Reseller Price & Info</span>
              <ChevronUp className={`w-3 h-3 transition-transform ${showResellerMenu ? 'rotate-180' : ''}`} />
            </button>
          )}

          {/* Dropdown Menu */}
          {showResellerMenu && user?.role !== 'reseller' && (
            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-20 overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                Harga Member
              </div>
              <div className="p-3">
                <div className="text-sm font-bold text-brand-primary mb-2">
                  Rp {product.resellerPrice.toLocaleString('id-ID')}
                </div>
                <button
                  onClick={handleWhatsAppClick}
                  className="w-full px-2 py-1.5 text-xs bg-[#25D366] text-white rounded hover:bg-[#20bd5a] transition-colors flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>Join Reseller</span>
                </button>
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
        className={`relative bg-white rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-brand-border/20 group hover:shadow-[0_10px_30px_rgba(139,75,107,0.1)] transition-all duration-300 cursor-pointer ${isFeatured ? 'ring-1 ring-brand-accent shadow-brand-accent/20' : ''
          }`}
        onClick={() => onProductClick(product)}
      >
        {/* Image Area */}
        <div className="relative aspect-[3/4] bg-gray-50 overflow-hidden">
          <img
            src={product.image || product.images?.[0] || '/placeholder-product.jpg'}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            onClick={handleImageClick}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.classList.add('bg-brand-surface');
                parent.innerHTML = '<div class="flex flex-col items-center justify-center h-full w-full text-brand-border"><span class="text-2xl">📦</span></div>';
              }
            }}
          />

          {/* Status Badge - Luxury Gold Pill */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
            {getStatusBadge()}
          </div>

          {/* Floating Action Buttons (Zoom) - Cart Removed */}
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
            <button
              onClick={handleImageZoom}
              className="w-8 h-8 rounded-full bg-white/90 backdrop-blur text-gray-600 flex items-center justify-center shadow-sm hover:bg-brand-primary hover:text-white transition-colors"
              title="Zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Product Info - Minimalist & Left Aligned */}
        <div className="p-3 sm:p-4 text-left">
          <h3 className="font-display text-base sm:text-lg font-medium text-brand-primary mb-1 line-clamp-2 leading-tight group-hover:text-brand-accent transition-colors">
            {product.name}
          </h3>

          {/* Price Section */}
          <div className="pt-1">
            {getPrice()}
          </div>
        </div>
      </div>

      {showZoomModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-sm" onClick={() => setShowZoomModal(false)}>
          {/* Modal Layout */}
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <button
              onClick={() => setShowZoomModal(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-8 h-8" />
            </button>

            <div
              className="relative w-full max-w-2xl aspect-[3/4] sm:aspect-auto sm:h-[80vh] bg-transparent flex items-center justify-center overflow-hidden"
              onClick={e => e.stopPropagation()}
              onWheel={handleZoomWheel}
            >
              <img
                ref={imageRef}
                src={product.image || product.images?.[0] || '/placeholder-product.jpg'}
                alt={product.name}
                className={`max-w-full max-h-full object-contain transition-transform duration-100 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{ transform: `translate(${zoomPosition.x}px, ${zoomPosition.y}px) scale(${zoomScale})` }}
                onMouseDown={handleDragStart}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
              />
            </div>

            <div className="absolute bottom-10 left-0 right-0 text-center text-white/50 text-sm pointer-events-none">
              Scroll/Pinch to Zoom • Drag to Pan
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductCard;
