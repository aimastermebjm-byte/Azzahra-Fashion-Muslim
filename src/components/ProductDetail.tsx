import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Plus, Minus, ShoppingCart, Heart, Share2, Star, ArrowLeft } from 'lucide-react';
import { useToast } from './ToastProvider';
import { Product } from '../types';
import { useGlobalProducts } from '../hooks/useGlobalProducts';
import { useRealTimeCartOptimized } from '../hooks/useRealTimeCartOptimized';

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
  // Get cart count for badge
  const { cartItems } = useRealTimeCartOptimized();
  const cartItemCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const { showToast } = useToast();

  // Zoom state
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialScale, setInitialScale] = useState(1);
  const [pinchCenter, setPinchCenter] = useState({ x: 0, y: 0 });
  const [initialPanPosition, setInitialPanPosition] = useState({ x: 0, y: 0 });
  const zoomRef = useRef<HTMLDivElement>(null);

  // Zoom handlers
  const handleZoomOpen = useCallback(() => {
    setIsZoomOpen(true);
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
  }, []);

  const handleZoomClose = useCallback(() => {
    setIsZoomOpen(false);
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
  }, []);

  // Calculate distance between two touch points
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Calculate center point between two touches
  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: 0, y: 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  };

  // Pan handlers for dragging (mouse)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomScale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  }, [zoomScale, panPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && zoomScale > 1) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, zoomScale, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setInitialPinchDistance(null);
  }, []);

  // Touch handlers for mobile pinch zoom and pan
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault(); // Prevent refresh/scroll

    if (e.touches.length === 2) {
      // Start pinch zoom - save focal point
      const distance = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      setInitialPinchDistance(distance);
      setInitialScale(zoomScale);
      setPinchCenter(center);
      setInitialPanPosition(panPosition);
    } else if (e.touches.length === 1 && zoomScale > 1) {
      // Start pan
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - panPosition.x, y: touch.clientY - panPosition.y });
      setIsDragging(true);
    }
  }, [zoomScale, panPosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault(); // Prevent refresh/scroll

    if (e.touches.length === 2 && initialPinchDistance) {
      // Pinch zoom with focal point
      const currentDistance = getTouchDistance(e.touches);
      const currentCenter = getTouchCenter(e.touches);
      const newScale = Math.min(Math.max((currentDistance / initialPinchDistance) * initialScale, 1), 4);

      // Calculate pan offset to keep focal point stationary
      // When zooming, we want the pinch center to stay at the same visual position
      const scaleChange = newScale / initialScale;

      // Calculate how much the image should move to keep focal point stable
      const focalOffsetX = (pinchCenter.x - window.innerWidth / 2);
      const focalOffsetY = (pinchCenter.y - window.innerHeight / 2);

      // Apply focal point offset + follow the finger movement
      const newPanX = initialPanPosition.x - focalOffsetX * (scaleChange - 1) + (currentCenter.x - pinchCenter.x);
      const newPanY = initialPanPosition.y - focalOffsetY * (scaleChange - 1) + (currentCenter.y - pinchCenter.y);

      setZoomScale(newScale);
      setPanPosition({ x: newPanX, y: newPanY });

      // Reset pan if zoomed out completely
      if (newScale <= 1) {
        setPanPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && zoomScale > 1) {
      // Single touch pan
      const touch = e.touches[0];
      setPanPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  }, [initialPinchDistance, initialScale, isDragging, zoomScale, dragStart, pinchCenter, initialPanPosition]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 0) {
      setIsDragging(false);
      setInitialPinchDistance(null);
    }
  }, []);

  // 🔥 GLOBAL STATE: 0 reads untuk product data
  const { getProductById } = useGlobalProducts();

  const currentProduct = useMemo(() => {
    return getProductById(initialProduct.id) || initialProduct;
  }, [initialProduct.id, getProductById]);


  const handleAddToCart = () => {
    if (!user) {
      onLoginRequired();
      showToast({
        type: 'info',
        title: 'Butuh login',
        message: 'Masuk untuk menambahkan produk ke keranjang.'
      });
      return;
    }

    // Check if variants exist and require selection
    if (currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0) {
      if (!selectedSize || !selectedColor) {
        showToast({
          type: 'warning',
          title: 'Pilih varian',
          message: 'Silakan pilih ukuran dan warna sebelum melanjutkan.'
        });
        return;
      }
    }

    const availableStock = getSelectedVariantStock();
    if (quantity > availableStock) {
      const stockMessage = (currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0)
        ? `Stok tidak mencukupi! Stok tersedia untuk ${selectedSize} - ${selectedColor} adalah ${availableStock} pcs`
        : `Stok tidak mencukupi! Stok tersedia adalah ${availableStock} pcs`;
      showToast({
        type: 'warning',
        title: 'Stok tidak mencukupi',
        message: stockMessage
      });
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

    // Pass product with correct price based on user role and flash sale
    const productWithPrice = {
      ...currentProduct,
      price: getPrice() // Use calculated price based on flash sale and user role
    };

    onAddToCart(productWithPrice, variant, quantity);
    // No toast notification - silent add to cart

    // Reset selections
    setSelectedSize('');
    setSelectedColor('');
    setQuantity(1);
  };

  const handleBuyNow = () => {
    if (!user) {
      onLoginRequired();
      showToast({
        type: 'info',
        title: 'Butuh login',
        message: 'Masuk terlebih dahulu untuk melanjutkan transaksi.'
      });
      return;
    }

    // Check if variants exist and require selection
    if (currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0) {
      if (!selectedSize || !selectedColor) {
        showToast({
          type: 'warning',
          title: 'Pilih varian',
          message: 'Silakan pilih ukuran dan warna sebelum lanjut.'
        });
        return;
      }
    }

    const availableStock = getSelectedVariantStock();
    if (quantity > availableStock) {
      const stockMessage = (currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0)
        ? `Stok tidak mencukupi! Stok tersedia untuk ${selectedSize} - ${selectedColor} adalah ${availableStock} pcs`
        : `Stok tidak mencukupi! Stok tersedia adalah ${availableStock} pcs`;
      showToast({
        type: 'warning',
        title: 'Stok tidak mencukupi',
        message: stockMessage
      });
      return;
    }

    const variant = (currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0)
      ? { size: selectedSize, color: selectedColor }
      : null;

    // Pass product with correct price based on user role and flash sale
    const productWithPrice = {
      ...currentProduct,
      price: getPrice() // Use calculated price based on flash sale and user role
    };

    onBuyNow(productWithPrice, variant, quantity);
  };

  const getPrice = () => {
    if (currentProduct.isFlashSale && currentProduct.flashSalePrice > 0) {
      return currentProduct.flashSalePrice;
    }
    return user?.role === 'reseller' ? currentProduct.resellerPrice : currentProduct.retailPrice;
  };

  const requiresVariantSelection = Boolean(currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0);
  const isVariantIncomplete = requiresVariantSelection && (!selectedSize || !selectedColor);
  const totalPrice = getPrice() * quantity;

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
          total += Number(colorStock) || 0; // FIX: Ensure numeric addition
        });
      });
      return total;
    }
    return Number(currentProduct.stock) || 0;
  };


  return (
    <div className="min-h-screen bg-gray-50 pb-40 sm:pb-32">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <button
              onClick={onBack}
              className="rounded-full p-2 text-gray-600 transition hover:bg-gray-100 flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-gray-900 truncate">Detail Produk</h1>
              <p className="text-xs text-gray-500 hidden lg:block">Lihat informasi lengkap produk</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button className="rounded-full border border-gray-200 bg-white p-2 text-gray-600 transition hover:text-brand-primary">
              <Share2 className="h-4 w-4" />
            </button>
            <button className="rounded-full border border-gray-200 bg-white p-2 text-gray-600 transition hover:text-rose-500">
              <Heart className="h-4 w-4" />
            </button>
            <button
              onClick={onNavigateToCart || (() => { })}
              className="relative inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-3 py-2 sm:px-4 text-sm font-semibold text-white transition hover:bg-brand-primary/90 whitespace-nowrap"
            >
              <ShoppingCart className="h-4 w-4 flex-shrink-0" />
              <span className="hidden md:inline">Keranjang</span>
              {cartItemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Product Images */}
      <div className="bg-white">
        <div className="relative aspect-[3/4] bg-gray-100 cursor-zoom-in" onClick={handleZoomOpen}>
          <img
            src={currentProduct.images?.[selectedImageIndex] || currentProduct.image || '/placeholder-currentProduct.jpg'}
            alt={currentProduct.name}
            className="w-full h-full object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholder-currentProduct.jpg';
            }}
          />

          {/* Zoom hint */}
          <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            🔍 Tap untuk zoom
          </div>

          {currentProduct.isFlashSale && (
            <div className="absolute top-4 left-4 rounded-full bg-red-500 px-4 py-1 text-sm font-semibold text-white shadow-lg">
              FLASH SALE
            </div>
          )}

          {currentProduct.status === 'po' && (
            <div className="absolute top-4 right-4 rounded-full bg-orange-500 px-4 py-1 text-sm font-semibold text-white shadow-lg">
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
                className={`flex-shrink-0 rounded-2xl border-2 p-1 transition ${selectedImageIndex === index ? 'border-brand-primary shadow' : 'border-transparent'
                  }`}
              >
                <img
                  src={image}
                  alt={`${currentProduct.name} ${index + 1}`}
                  className="h-16 w-16 rounded-xl object-cover"
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
              <span className={`font-semibold ${getTotalStock() > 10 ? 'text-green-600' :
                getTotalStock() > 0 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                {getTotalStock()}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Status: </span>
              <span className={`font-semibold ${currentProduct.status === 'ready' ? 'text-green-600' : 'text-orange-600'
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
              <span className={`font-bold ${getSelectedVariantStock() > 5 ? 'text-green-600' :
                getSelectedVariantStock() > 0 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                {getSelectedVariantStock()} pcs
              </span>
            </div>
          </div>
        )}
        <div className="border-t pt-4">
          <p className="text-gray-600 leading-relaxed whitespace-pre-wrap text-left">{currentProduct.description}</p>
        </div>
      </div>

      {/* Variants Selection */}
      {currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0 && (
        <div className="bg-white mt-2 p-4">
          {/* Variant/Color Selection - NOW FIRST */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Pilih Varian</h3>
            <div className="flex flex-wrap gap-2">
              {(currentProduct.variants?.colors || []).map((color) => {
                const colorStock = selectedSize
                  ? getVariantStock(selectedSize, color)
                  : (currentProduct.variants?.sizes || []).reduce((total, size) => total + getVariantStock(size, color), 0);

                return (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    disabled={colorStock === 0}
                    className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition ${selectedColor === color
                      ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/40'
                      : colorStock === 0
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 border border-gray-200 hover:text-brand-primary'
                      }`}
                  >
                    <span>{color}</span>
                    <span className="block text-xs font-normal text-gray-500">
                      {colorStock > 0 ? `${colorStock} pcs` : 'Habis'}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedColor && (
              <p className="mt-2 text-xs text-gray-500">
                💡 Stok ukuran ditampilkan untuk varian {selectedColor}
              </p>
            )}
          </div>

          {/* Size Selection - NOW SECOND */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Pilih Ukuran</h3>
            <div className="flex flex-wrap gap-2">
              {(currentProduct.variants?.sizes || []).map((size) => {
                // Calculate stock for this size based on selected color or all colors
                const sizeTotalStock = selectedColor
                  ? getVariantStock(size, selectedColor)
                  : (currentProduct.variants?.colors || []).reduce((total, color) => {
                    return total + getVariantStock(size, color);
                  }, 0);

                return (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    disabled={sizeTotalStock === 0}
                    className={`relative rounded-full px-4 py-2 text-sm font-semibold transition shadow-sm ${selectedSize === size
                      ? 'bg-brand-primary text-white shadow-brand-card'
                      : sizeTotalStock === 0
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:text-brand-primary border border-gray-200'
                      }`}
                  >
                    <span>{size}</span>
                    {sizeTotalStock === 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    )}
                    {currentProduct.variants.stock && (
                      <span className="block text-xs font-normal text-gray-500">
                        {sizeTotalStock > 0 ? `${sizeTotalStock} pcs` : 'Habis'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quantity Selection */}
      <div className="bg-white mt-2 p-4 mb-4">
        <div className="mb-4">
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
                className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${quantity >= getSelectedVariantStock()
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
                  <span className={`font-semibold ${getSelectedVariantStock() > 5 ? 'text-green-600' :
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

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white shadow-lg safe-area-inset-bottom">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-3 py-3 sm:px-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-shrink-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">Subtotal</p>
            <p className="text-xl sm:text-2xl font-bold text-brand-primary">
              Rp {totalPrice.toLocaleString('id-ID')}
            </p>
            {requiresVariantSelection && (
              <p className="text-xs text-slate-500 truncate">
                {isVariantIncomplete ? 'Pilih ukuran dan warna terlebih dahulu' : `${selectedSize} / ${selectedColor}`}
              </p>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:min-w-[400px]">
            <button
              onClick={handleAddToCart}
              disabled={isVariantIncomplete}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-brand-primary/30 bg-white px-4 py-2.5 text-sm font-semibold text-brand-primary shadow-sm transition hover:bg-brand-primary/5 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Tambah ke </span>Keranjang
            </button>
            <button
              onClick={handleBuyNow}
              disabled={isVariantIncomplete}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-brand-card transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
            >
              Beli Sekarang
            </button>
          </div>
        </div>
      </div>

      {/* Zoom Modal */}
      {isZoomOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={handleZoomClose}
        >
          {/* Close button */}
          <button
            onClick={handleZoomClose}
            className="absolute top-4 right-4 z-10 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white text-xl hover:bg-white/30 transition"
          >
            ✕
          </button>

          {/* Image with zoom and pan */}
          <div
            ref={zoomRef}
            className="w-full h-full flex items-center justify-center overflow-hidden touch-none"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={currentProduct.images?.[selectedImageIndex] || currentProduct.image || '/placeholder-currentProduct.jpg'}
              alt={currentProduct.name}
              className="max-w-none select-none pointer-events-none"
              style={{
                transform: `scale(${zoomScale}) translate(${panPosition.x / zoomScale}px, ${panPosition.y / zoomScale}px)`,
                transition: isDragging || initialPinchDistance ? 'none' : 'transform 0.1s ease-out'
              }}
              draggable={false}
            />
          </div>

          {/* Zoom hint - Updated for pinch */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
            {zoomScale <= 1 ? '👆 Cubit untuk zoom' : `${Math.round(zoomScale * 100)}% - Geser untuk melihat`}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;