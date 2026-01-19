import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ShoppingCart, Heart, Share2, ArrowLeft } from 'lucide-react';
import { useToast } from './ToastProvider';
import { Product } from '../types';
import { useGlobalProducts } from '../hooks/useGlobalProducts';
import { useRealTimeCartOptimized } from '../hooks/useRealTimeCartOptimized';
import VariantSelectionModal from './VariantSelectionModal';
import { collectionService } from '../services/collectionService';

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

  // Modal state
  const [modalMode, setModalMode] = useState<'addToCart' | 'buyNow' | null>(null);

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

  // Collection Discount State (Virtual discount from collection)
  const [collectionDiscount, setCollectionDiscount] = useState(0);

  // Fetch collection discount - check sessionStorage first (from BannerProductsPage), then try product.collectionId
  useEffect(() => {
    const fetchCollectionDiscount = async () => {
      // First try sessionStorage (set by BannerProductsPage when clicking from collection)
      const storedDiscount = sessionStorage.getItem('activeCollectionDiscount');
      if (storedDiscount) {
        const discount = Number(storedDiscount);
        console.log('💰 ProductDetail: Using sessionStorage discount:', discount);
        setCollectionDiscount(discount);
        return; // Found it!
      }

      // Fallback: try fetching from collectionId on product
      const productAny = initialProduct as any;
      if (productAny.collectionId) {
        try {
          const collection = await collectionService.getCollectionById(productAny.collectionId);
          if (collection && collection.discountAmount) {
            console.log('💰 ProductDetail: Collection discount from DB:', collection.discountAmount);
            setCollectionDiscount(collection.discountAmount);
          }
        } catch (err) {
          console.error('Error fetching collection for discount:', err);
        }
      }
    };
    fetchCollectionDiscount();

    // Cleanup sessionStorage on unmount
    return () => {
      sessionStorage.removeItem('activeCollectionDiscount');
    };
  }, [initialProduct]);

  // Scroll to top when component mounts (so hero image is visible first)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

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

    // Check for variant-specific pricing
    let variantPrice = 0;
    const productAny = currentProduct as any;
    if (productAny.pricesPerVariant && selectedSize && selectedColor) {
      const variantKey = `${selectedSize}-${selectedColor}`;
      const variantPricing = productAny.pricesPerVariant[variantKey];
      if (variantPricing?.retail && Number(variantPricing.retail) > 0) {
        variantPrice = user?.role === 'reseller' && variantPricing.reseller
          ? Number(variantPricing.reseller)
          : Number(variantPricing.retail);
        console.log(`💰 Using variant-specific price for ${variantKey}: ${variantPrice}`);
      }
    }

    // Pass product with correct price based on variant pricing, user role and flash sale
    const productWithPrice = {
      ...currentProduct,
      price: variantPrice > 0 ? variantPrice : getPrice() // Use variant price if available
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

    // Check for variant-specific pricing
    let variantPrice = 0;
    const productAny = currentProduct as any;
    if (productAny.pricesPerVariant && selectedSize && selectedColor) {
      const variantKey = `${selectedSize}-${selectedColor}`;
      const variantPricing = productAny.pricesPerVariant[variantKey];
      if (variantPricing?.retail && Number(variantPricing.retail) > 0) {
        variantPrice = user?.role === 'reseller' && variantPricing.reseller
          ? Number(variantPricing.reseller)
          : Number(variantPricing.retail);
        console.log(`💰 BuyNow: Using variant-specific price for ${variantKey}: ${variantPrice}`);
      }
    }

    // Pass product with correct price based on variant pricing, user role and flash sale
    const productWithPrice = {
      ...currentProduct,
      price: variantPrice > 0 ? variantPrice : getPrice() // Use variant price if available
    };

    onBuyNow(productWithPrice, variant, quantity);
  };

  // Get price - check variant-specific pricing first
  const getPrice = () => {
    // Check for variant-specific pricing
    const productAny = currentProduct as any;
    if (productAny.pricesPerVariant && selectedSize && selectedColor) {
      const variantKey = `${selectedSize}-${selectedColor}`;
      const variantPricing = productAny.pricesPerVariant[variantKey];
      if (variantPricing?.retail && Number(variantPricing.retail) > 0) {
        const variantPrice = user?.role === 'reseller' && variantPricing.reseller
          ? Number(variantPricing.reseller)
          : Number(variantPricing.retail);
        return variantPrice;
      }
    }

    // Fallback to global prices
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
    <>
      {/* STICKY HEADER - Always visible on scroll */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Left: Back button */}
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 transition hover:bg-gray-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 transition hover:bg-gray-200">
              <Share2 className="h-4 w-4" />
            </button>
            <button className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 transition hover:bg-gray-200">
              <Heart className="h-4 w-4" />
            </button>
            <button
              onClick={onNavigateToCart || (() => { })}
              className="relative w-9 h-9 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center text-white transition hover:from-yellow-600 hover:to-yellow-700 shadow-md"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartItemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Add padding for fixed header */}
      <div className="pt-14">
        {/* IMMERSIVE FULL SCREEN HERO IMAGE */}
        <div className="relative h-[75vh] w-full bg-gray-900">
          <img
            src={currentProduct.images?.[selectedImageIndex] || currentProduct.image || '/placeholder-currentProduct.jpg'}
            alt={currentProduct.name}
            className="w-full h-full object-contain cursor-zoom-in"
            onClick={handleZoomOpen}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholder-currentProduct.jpg';
            }}
          />

          {/* Badge overlays on image */}
          {currentProduct.isFlashSale && (
            <div className="absolute top-4 left-4 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white shadow-lg animate-pulse">
              FLASH SALE
            </div>
          )}
          {currentProduct.status === 'po' && (
            <div className="absolute top-4 right-4 rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
              PRE ORDER
            </div>
          )}

          {/* Zoom hint - bottom of hero */}
          <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full">
            🔍 Tap untuk zoom
          </div>

          {/* Image Thumbnails (if multiple) - Floating */}
          {currentProduct.images && currentProduct.images.length > 1 && (
            <div className="absolute bottom-4 left-4 right-16 flex gap-2 overflow-x-auto scrollbar-hide">
              {currentProduct.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition ${selectedImageIndex === index ? 'border-yellow-400 shadow-lg' : 'border-white/40'
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

        {/* FLOATING INFO SHEET - Overlaps hero with rounded top */}
        <div className="relative -mt-8 bg-white rounded-t-3xl shadow-2xl pb-32">
          <div className="px-4 py-6 space-y-6">
            {/* Product Title & Price */}
            <div>
              {currentProduct.brand && (
                <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-bold rounded uppercase tracking-wide mb-2">
                  {currentProduct.brand}
                </span>
              )}
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{currentProduct.name}</h1>

              {/* Price */}
              {currentProduct.isFlashSale && currentProduct.flashSalePrice > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-red-600">
                      Rp {currentProduct.flashSalePrice.toLocaleString('id-ID')}
                    </span>
                    <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded font-bold">
                      -{Math.round((1 - currentProduct.flashSalePrice / (currentProduct.originalRetailPrice || currentProduct.retailPrice)) * 100)}%
                    </span>
                  </div>
                  <div className="text-lg text-gray-400 line-through">
                    Rp {(currentProduct.originalRetailPrice || currentProduct.retailPrice).toLocaleString('id-ID')}
                  </div>
                </div>
              ) : collectionDiscount > 0 ? (
                // Collection Discount Display
                <div className="space-y-2">
                  {(() => {
                    const baseRetail = currentProduct.originalRetailPrice || currentProduct.retailPrice;
                    const baseReseller = currentProduct.originalResellerPrice || currentProduct.resellerPrice || baseRetail * 0.8;
                    const discountedRetail = Math.max(0, baseRetail - collectionDiscount);
                    const discountedReseller = Math.max(0, baseReseller - collectionDiscount);
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl font-bold text-[#D4AF37]">
                            Rp {discountedRetail.toLocaleString('id-ID')}
                          </span>
                          <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold">
                            -Rp {collectionDiscount.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="text-lg text-gray-400 line-through">
                          Rp {baseRetail.toLocaleString('id-ID')}
                        </div>
                        {user?.role === 'reseller' && (
                          <div className="inline-flex items-center gap-2 text-sm bg-yellow-50 border border-yellow-200 py-2 px-3 rounded-lg">
                            <span className="text-yellow-700 font-medium opacity-80">Reseller:</span>
                            <span className="text-yellow-800 font-bold">Rp {discountedReseller.toLocaleString('id-ID')}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-3xl font-bold bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] bg-clip-text text-transparent">
                    Rp {currentProduct.retailPrice.toLocaleString('id-ID')}
                  </div>

                  {/* Reseller Price - Match ProductCard Style */}
                  {user?.role === 'reseller' ? (
                    <div className="inline-flex items-center gap-2 text-sm bg-yellow-50 border border-yellow-200 py-2 px-3 rounded-lg">
                      <span className="text-yellow-700 font-medium opacity-80">Reseller:</span>
                      <span className="text-yellow-800 font-bold">Rp {currentProduct.resellerPrice.toLocaleString('id-ID')}</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleResellerPriceClick}
                      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-yellow-600 transition-colors"
                    >
                      <span>Info Harga Reseller</span>
                      <span className="text-xs">▼</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-bold text-gray-800 mb-2">Deskripsi</h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{currentProduct.description}</p>
            </div>
          </div>
        </div>

        {/* STICKY BOTTOM CTA - Gold Gradient */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl safe-area-inset-bottom">
          <div className="px-4 py-3 flex items-center gap-3">
            {/* Price Summary */}
            <div className="flex-shrink-0">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-bold bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] bg-clip-text text-transparent">
                Rp {totalPrice.toLocaleString('id-ID')}
              </p>
            </div>

            {/* Actions */}
            <div className="flex-1 flex gap-2">
              <button
                onClick={() => setModalMode('addToCart')}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border border-[#D4AF37] bg-white text-[#997B2C] font-bold text-sm transition hover:bg-[#FEFAE0] shadow-sm"
              >
                <ShoppingCart className="h-4 w-4" />
                Keranjang
              </button>
              <button
                onClick={() => setModalMode('buyNow')}
                className="flex-1 flex items-center justify-center px-4 py-2.5 rounded-full bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-[#5d4008] font-bold text-sm shadow-[0_4px_14px_0_rgba(153,123,44,0.39)] hover:shadow-[0_6px_20px_rgba(153,123,44,0.23)] hover:bg-[100%_0] transition-all transform hover:-translate-y-0.5 active:scale-95"
              >
                Beli Sekarang
              </button>
            </div>
          </div>
        </div>

        {/* Variant Selection Modal */}
        {modalMode && (
          <VariantSelectionModal
            isOpen={!!modalMode}
            onClose={() => setModalMode(null)}
            product={currentProduct}
            mode={modalMode}
            onConfirm={(variant, qty) => {
              // Update state from modal selection
              setSelectedSize(variant.size);
              setSelectedColor(variant.color);
              setQuantity(qty);

              // Execute the appropriate action
              if (modalMode === 'addToCart') {
                onAddToCart(currentProduct, variant, qty);
              } else {
                onBuyNow(currentProduct, variant, qty);
              }

              // Close modal
              setModalMode(null);
            }}
            user={user}
          />
        )}

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
    </>
  );
};

export default ProductDetail;