import React, { useState, useEffect } from 'react';
import { AdminProvider } from './contexts/AdminContext';
// import { FlashSaleProvider } from './contexts/FlashSaleContext'; // DISABLED - Emergency fix
import { GlobalProductsProvider } from './hooks/useGlobalProducts';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import SplashScreen from './components/SplashScreen';

// Cache busting version - force browser refresh
const APP_VERSION = '2.1.0';
import HomePage from './components/HomePage';
import ProductDetail from './components/ProductDetail';
import CartPage from './components/CartPage';
import CheckoutPage from './components/CheckoutPage';
import LoginFormSimple from './components/LoginFormSimple';
import FirebaseRegistration from './components/FirebaseRegistration';
import FlashSalePage from './components/FlashSalePage';
import OrdersPage from './components/OrdersPage';
import AccountPage from './components/AccountPage';
import AddressManagementPage from './components/AddressManagementPage';
import AdminProductsPage from './components/AdminProductsPage';
import AdminOrdersPage from './components/AdminOrdersPage';
import AdminReportsPage from './components/AdminReportsPage';
import AdminUsersPage from './components/AdminUsersPage';
import AdminFinancialPage from './components/AdminFinancialPage';
import AdminMasterDataPage from './components/AdminMasterDataPage';
import AdminCacheManagement from './components/AdminCacheManagement';
import AdminPaymentVerificationPage from './components/AdminPaymentVerificationPage';
import AdminStockOpnamePage from './components/AdminStockOpnamePage';
import AdminStockAdjustmentPage from './components/AdminStockAdjustmentPage';
import AdminVoucherPage from './components/AdminVoucherPage';
import AdminBannerPage from './components/AdminBannerPage';
import BannerProductsPage from './components/BannerProductsPage';
import BottomNavigation from './components/BottomNavigation';
import InstallPrompt from './components/InstallPrompt';
import PaymentAutoVerifier from './components/PaymentAutoVerifier';
import OrderExpirationChecker from './components/OrderExpirationChecker';
import { OngkirTestPage } from './pages/OngkirTestPage';
import { useUnifiedProducts } from './hooks/useUnifiedProducts';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';
import { useAdmin } from './contexts/AdminContext';
import { cartServiceOptimized } from './services/cartServiceOptimized';
import { ordersService } from './services/ordersService';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './utils/firebaseClient';
import './utils/forceSyncGlobalIndex'; // Load force sync function to window

import { Banner } from './types/banner';

type Page = 'home' | 'flash-sale' | 'orders' | 'account' | 'address-management' | 'product-detail' | 'cart' | 'checkout' | 'login' | 'admin-products' | 'admin-orders' | 'admin-reports' | 'admin-users' | 'admin-cache' | 'admin-financials' | 'admin-master' | 'admin-payment-verification' | 'admin-stock-opname' | 'admin-stock-adjustments' | 'admin-voucher' | 'admin-banner' | 'banner-products' | 'ongkir-test';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [selectedCartItemIds, setSelectedCartItemIds] = useState<string[]>([]);
  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);

  // Firebase Authentication
  const { user, login, logout } = useFirebaseAuth();
  // Optimized hooks with Firestore persistence only
  const { allProducts: products, featuredProducts, flashSaleProducts, loading, refresh, updateProductStock } = useUnifiedProducts();
  const { addOrder } = useAdmin();


  // Initialize Firebase-only app on app start
  useEffect(() => {

    // No more AppStorage localStorage initialization
    // All data will be stored in Firebase Firestore only


    // Handle URL routing for special pages
    const handleRouting = () => {
      const path = window.location.pathname;
      if (path === '/ongkir-test') {
        setCurrentPage('ongkir-test');
      }
    };

    handleRouting();
  }, []);

  // ✨ NEW: Navigation history stack for hardware back button support
  const [navigationHistory, setNavigationHistory] = useState<Page[]>(['home']);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);

  // Parent page mapping for back navigation
  const getParentPage = (page: Page): Page => {
    const parentMap: Record<Page, Page> = {
      'home': 'home',
      'flash-sale': 'home',
      'orders': 'home',
      'account': 'home',
      'address-management': 'account',
      'product-detail': 'home',
      'cart': 'home',
      'checkout': 'cart',
      'login': 'home',
      'admin-products': 'account',
      'admin-orders': 'account',
      'admin-reports': 'account',
      'admin-users': 'account',
      'admin-cache': 'account',
      'admin-financials': 'account',
      'admin-master': 'account',
      'admin-payment-verification': 'account',
      'admin-stock-opname': 'account',
      'admin-stock-adjustments': 'admin-products', // Return to products page
      'admin-voucher': 'account',
      'admin-banner': 'account',
      'banner-products': 'home',
      'ongkir-test': 'account'
    };
    return parentMap[page] || 'home';
  };

  // Push history state whenever currentPage changes
  useEffect(() => {
    if (isNavigatingBack) {
      setIsNavigatingBack(false);
      return;
    }

    // Push new state to browser history
    window.history.pushState({ page: currentPage }, '', window.location.pathname);

    // Update navigation history stack
    setNavigationHistory(prev => {
      // Avoid duplicates at the end
      if (prev[prev.length - 1] === currentPage) return prev;
      return [...prev, currentPage];
    });
  }, [currentPage, isNavigatingBack]);

  // Handle hardware back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();

      // Mark that we're navigating back to prevent pushing new state
      setIsNavigatingBack(true);

      // Get previous page from history or use parent mapping
      const prevPage = navigationHistory.length > 1
        ? navigationHistory[navigationHistory.length - 2]
        : getParentPage(currentPage);

      // Update history stack (remove current page)
      setNavigationHistory(prev =>
        prev.length > 1 ? prev.slice(0, -1) : ['home']
      );

      // Navigate to previous page
      setCurrentPage(prevPage);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentPage, navigationHistory]);

  // Navigation helper that pushes to history (kept for compatibility)
  const navigateTo = (page: Page, replace = false) => {
    if (replace) {
      window.history.replaceState({ page }, '', window.location.pathname);
      setNavigationHistory(prev => [...prev.slice(0, -1), page]);
    } else {
      // Just set current page - useEffect will handle history push
      setCurrentPage(page);
    }
  };

  const handleProductClick = (product: any) => {
    console.log('🔗 App.tsx handleProductClick:', {
      id: product.id,
      name: product.name,
      hasVariants: !!product.variants,
      variantsStock: product.variants?.stock,
      hasStock: !!(product.variants?.stock && Object.keys(product.variants?.stock).length > 0),
      variantsData: product.variants
    });


    setSelectedProduct(product);
    setCurrentPage('product-detail');
  };

  const handleLoginRequired = () => {
    setShowLogin(true);
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    // This will be handled by LoginForm component and Firebase Auth
  };

  const handleLoginWithUser = (userData: any) => {
    setShowLogin(false);

    // If user was trying to checkout, continue to checkout page
    if (selectedCartItemIds.length > 0) {
      setCurrentPage('checkout');
    }
  };

  const handleRegistrationSuccess = (user: any) => {
    setShowRegistration(false);
  };

  const handleLogout = () => {

    // Firebase logout
    logout();
    setCurrentPage('home');

    // Clear cart from cartService only (Firebase-only)
    cartServiceOptimized.clearCart().catch(error => {
      console.error('❌ Error clearing cart on logout:', error);
    });
  };

  const handleAddToCart = async (product: any, variant: any, quantity: number) => {
    if (!user?.uid) {
      handleLoginRequired();
      return;
    }

    try {
      console.log('🔍 DEBUG: App.tsx handleAddToCart called with:', {
        product: product,
        variant: variant,
        quantity: quantity
      });

      // Call cartService.addToCart - let it read existing cart items
      const success = await cartServiceOptimized.addToCart(product, quantity, variant);

      if (!success) {
        console.error('❌ Failed to add to cart');
      }
    } catch (error) {
      console.error('❌ Failed to add to cart:', error);
    }
  };

  const handleQuickAddToCart = async (product: any) => {
    if (!user?.uid) {
      handleLoginRequired();
      return;
    }

    // Add with default variant (first available)
    const defaultVariant = {
      size: product.variants.sizes[0],
      color: product.variants.colors[0]
    };

    await handleAddToCart(product, defaultVariant, 1);
  };

  const handleBuyNow = async (product: any, variant: any, quantity: number) => {
    if (!user?.uid) {
      handleLoginRequired();
      return;
    }

    // Add to cart first and get the item ID
    await handleAddToCart(product, variant, quantity);

    // Get cart to find the newly added item
    const cartItems = await cartServiceOptimized.getCart();
    const latestItem = cartItems[cartItems.length - 1]; // Last added item

    if (latestItem) {
      // Set selected item for checkout (only the item just added)
      setSelectedCartItemIds([latestItem.id]);
    }

    // Go directly to checkout
    setCurrentPage('checkout');
  };

  const handleOrderComplete = async (orderData: any, cartItems?: any[]) => {
    if (!user?.uid) {
      console.error('❌ Cannot complete order: User not logged in');
      return null;
    }

    const orderId = 'AZF' + Date.now().toString().slice(-8);

    try {
      // Use cartItems from parameter (eliminates 1 read!)
      const items = cartItems || [];

      if (items.length === 0) {
        console.log('⚠️ Keranjang belanja kosong');
        return null;
      }

      console.log('🚀 Starting ATOMIC transaction for checkout...', items.length, 'items');
      console.log('🔍 DEBUG: Cart items structure:', items.map(item => ({
        productId: item.productId,
        name: item.name,
        variant: item.variant,
        hasVariant: !!item.variant,
        variantSize: item.variant?.size,
        variantColor: item.variant?.color,
        quantity: item.quantity,
        price: item.price
      })));

      // Import transaction functions
      const { runTransaction, getDoc, doc: docRef } = await import('firebase/firestore');

      // Execute ATOMIC transaction for stock validation and reduction - BATCH SYSTEM
      const transactionResult = await runTransaction(db, async (transaction) => {
        console.log('📦 ATOMIC TRANSACTION: Reading and validating stock from BATCH SYSTEM...');

        // Read batch document once (single read for all products)
        const batchRef = docRef(db, 'productBatches', 'batch_1');
        const batchDoc = await transaction.get(batchRef);

        if (!batchDoc.exists()) {
          throw new Error('Batch products tidak ditemukan');
        }

        const batchProducts = batchDoc.data().products || [];
        console.log(`📦 Loaded ${batchProducts.length} products from batch`);

        const validatedItems = [];
        let cartTotal = 0;
        const updatedBatchProducts = [...batchProducts];

        // Validate each item against batch data
        for (const item of items) {
          console.log('🔍 DEBUG: Processing cart item:', {
            productId: item.productId,
            name: item.name,
            variant: item.variant,
            hasVariant: !!item.variant,
            variantSize: item.variant?.size,
            variantColor: item.variant?.color
          });
          // Find product in batch
          const batchProduct = batchProducts.find(p => p.id === item.productId);

          if (!batchProduct) {
            throw new Error(`Produk "${item.name}" tidak ditemukan di batch system`);
          }

          // Handle variant stock if exists - CORRECT STRUCTURE
          let currentStock = Number(batchProduct.stock || 0);
          if (item.variant && batchProduct.variants?.stock && item.variant.size && item.variant.color) {
            const oldVariantStock = Number(batchProduct.variants.stock[item.variant.size]?.[item.variant.color] || 0);
            currentStock = oldVariantStock;
          }

          if (currentStock < item.quantity) {
            throw new Error(`Stok "${item.name}" ${item.variant ? `(${item.variant.size}, ${item.variant.color})` : ''} tidak mencukupi. Tersedia: ${currentStock}, Diminta: ${item.quantity}`);
          }

          // Get current prices based on user role (atomic price check)
          const currentRetailPrice = Number(batchProduct.retailPrice || batchProduct.price || 0);
          const currentResellerPrice = Number(batchProduct.resellerPrice || 0) || currentRetailPrice * 0.8;
          const expectedPrice = user?.role === 'reseller' ? currentResellerPrice : currentRetailPrice;

          const itemTotal = expectedPrice * item.quantity;
          cartTotal += itemTotal;

          // Update stock in batch products array
          const productIndex = updatedBatchProducts.findIndex(p => p.id === item.productId);
          if (productIndex !== -1) {
            if (item.variant && updatedBatchProducts[productIndex].variants?.stock && item.variant.size && item.variant.color) {
              // Update variant stock (CORRECT STRUCTURE)
              const oldVariantStock = Number(updatedBatchProducts[productIndex].variants.stock[item.variant.size]?.[item.variant.color] || 0);
              const newVariantStock = Math.max(0, oldVariantStock - item.quantity);
              updatedBatchProducts[productIndex].variants.stock[item.variant.size][item.variant.color] = newVariantStock;

              console.log(`🔍 VARIANT UPDATE: ${item.name} (${item.variant.size}-${item.variant.color}) ${oldVariantStock} → ${newVariantStock}`);

              // 🚨 CRITICAL: Recalculate total stock from ALL variants to ensure accuracy
              let totalStock = 0;
              if (updatedBatchProducts[productIndex].variants?.stock) {
                Object.values(updatedBatchProducts[productIndex].variants.stock).forEach((sizeStock: any) => {
                  Object.values(sizeStock).forEach((colorStock: any) => {
                    totalStock += Number(colorStock || 0);
                  });
                });
              }
              // 🔥 IMPORTANT: Update main stock field to match calculated variant total
              updatedBatchProducts[productIndex].stock = totalStock;

              console.log(`🔍 TOTAL STOCK RECALCULATED: ${item.name} total = ${totalStock}`);
            } else {
              // No variant - update main stock only
              const oldStock = Number(updatedBatchProducts[productIndex].stock || 0);
              const newStock = Math.max(0, oldStock - item.quantity);
              updatedBatchProducts[productIndex].stock = newStock;

              console.log(`🔍 MAIN STOCK UPDATE: ${item.name} ${oldStock} → ${newStock}`);
            }

            // Update last modified
            updatedBatchProducts[productIndex].lastModified = Date.now();
          }

          // Add to validated items
          validatedItems.push({
            ...item,
            price: expectedPrice,
            total: itemTotal,
            currentStock: currentStock,
            newStock: currentStock - item.quantity,
            validated: true
          });
        }

        // Update batch system with all stock changes in single atomic operation
        transaction.update(batchRef, {
          products: updatedBatchProducts,
          lastModified: Date.now()
        });

        console.log('✅ ATOMIC TRANSACTION: Batch system updated successfully!');
        console.log(`📦 Updated ${validatedItems.length} items in batch`);
        console.log('🔍 DEBUG: Updated batch products sample:', updatedBatchProducts.slice(0, 3).map((p: any) => ({
          id: p.id,
          name: p.name,
          stock: p.stock,
          variantsStock: p.variants?.stock
        })));

        return {
          validatedItems,
          cartTotal
        };
      });

      // Transaction completed successfully
      const { validatedItems, cartTotal } = transactionResult;

      // ✅ LOG STOCK MUTATIONS
      // We do this after transaction to keep transaction fast and avoid dependency issues
      // Mutations are "history", consistency with stock is critical but strictly speaking can be async
      try {
        const { stockMutationService } = await import('./services/stockMutationService');

        // Log in parallel
        await Promise.all(validatedItems.map(async (item: any) => {
          try {
            await stockMutationService.logMutation({
              productId: item.productId,
              productName: item.name || 'Product',
              size: item.variant?.size || '-',
              variant: item.variant?.color || '-',
              previousStock: item.currentStock,
              newStock: item.newStock,
              change: -item.quantity, // Negative for sales
              type: 'order',
              referenceId: orderId,
              notes: `Order ${orderId}`,
              createdBy: user.uid,
              performedBy: user.displayName || 'Customer'
            });
          } catch (err) {
            console.error('Failed to log mutation for item:', item.name, err);
            // Don't block the order process if log fails
          }
        }));

        console.log('✅ Stock mutations logged successfully');
      } catch (err) {
        console.error('Failed to init mutation logging:', err);
      }

      console.log('🎉 ATOMIC TRANSACTION SUCCESS:', {
        itemsProcessed: validatedItems.length,
        totalAmount: cartTotal
      });

      // Calculate final totals
      const calculatedSubtotal = cartTotal;
      const calculatedShippingCost = orderData.shippingCost || 0;
      const calculatedFinalTotal = calculatedSubtotal + calculatedShippingCost;

      // ✅ CRITICAL FIX: Use orderData.finalTotal if provided (includes unique code)
      const finalTotalToUse = orderData.finalTotal || calculatedFinalTotal;

      console.log('💰 FINAL TOTAL DEBUG:', {
        calculatedFinalTotal,
        orderDataFinalTotal: orderData.finalTotal,
        finalTotalToUse,
        hasUniqueCode: !!orderData.uniquePaymentCode,
        uniqueCode: orderData.uniquePaymentCode
      });

      // Clear cart from backend (after successful stock reduction)
      await cartServiceOptimized.clearCart();

      // Create single order record for both admin system and Firebase sync
      const orderRecord: any = {
        id: orderId,
        userId: user.uid,
        userName: user.displayName || 'User',
        userEmail: user.email || 'user@example.com',
        items: validatedItems.map(item => ({
          productId: item.productId,
          productName: item.name || 'Product',
          productImage: item.image || item.productImage || item.images?.[0] || '',
          selectedVariant: {
            size: item.variant?.size || '',
            color: item.variant?.color || ''
          },
          quantity: item.quantity,
          price: item.price || 0,
          total: item.total || 0,
          category: item.category || ''
        })),
        shippingInfo: orderData.shippingInfo,
        paymentMethod: orderData.paymentMethodName || orderData.paymentMethod || '',
        paymentMethodId: orderData.paymentMethodId || null,
        paymentMethodName: orderData.paymentMethodName || orderData.paymentMethod || '',
        status: 'pending' as const,
        totalAmount: calculatedSubtotal,
        shippingCost: calculatedShippingCost,
        // ✅ CRITICAL: Use finalTotal from CheckoutPage (includes unique code if auto mode)
        finalTotal: finalTotalToUse,
        notes: orderData.notes || '',
        timestamp: Date.now(),
        // ✨ AUTO-EXPIRE: Add user role and expiration fields
        userRole: user.role || 'customer',
        hasReadyStockItems: validatedItems.some((item: any) => item.status === 'ready' || !item.status),
        expiryNotified: false
      };

      // ✨ AUTO-EXPIRE: Calculate expiresAt based on role and product type
      const userRole = user.role || 'customer';
      const hasReadyStock = orderRecord.hasReadyStockItems;

      if (userRole === 'customer') {
        // Customer: 6 hours to pay
        orderRecord.expiresAt = Date.now() + (6 * 60 * 60 * 1000);
      } else if (['reseller', 'admin', 'owner'].includes(userRole)) {
        if (hasReadyStock) {
          // Reseller with ready stock: 2 days to pay
          orderRecord.expiresAt = Date.now() + (48 * 60 * 60 * 1000);
        } else {
          // Reseller with PO only: No limit
          orderRecord.expiresAt = null;
        }
      } else {
        // Default: 6 hours
        orderRecord.expiresAt = Date.now() + (6 * 60 * 60 * 1000);
      }

      console.log('⏰ AUTO-EXPIRE: Order expiration set:', {
        userRole,
        hasReadyStock,
        expiresAt: orderRecord.expiresAt ? new Date(orderRecord.expiresAt).toISOString() : 'No limit'
      });

      // ✅ FIXED: Only add unique payment code fields if they exist (Firebase doesn't accept undefined)
      if (orderData.verificationMode) {
        orderRecord.verificationMode = orderData.verificationMode;
      }
      if (orderData.uniquePaymentCode !== undefined) {
        orderRecord.uniquePaymentCode = orderData.uniquePaymentCode;
      }
      if (orderData.exactPaymentAmount !== undefined) {
        orderRecord.exactPaymentAmount = orderData.exactPaymentAmount;
      }
      if (orderData.originalAmount !== undefined) {
        orderRecord.originalAmount = orderData.originalAmount;
      }
      if (orderData.paymentGroupId) {
        orderRecord.paymentGroupId = orderData.paymentGroupId;
      }
      if (orderData.groupPaymentAmount !== undefined) {
        orderRecord.groupPaymentAmount = orderData.groupPaymentAmount;
      }

      // ✨ NEW: Add shippingMode and shippingConfigured fields
      if (orderData.shippingMode) {
        orderRecord.shippingMode = orderData.shippingMode;
      }
      if (orderData.shippingConfigured !== undefined) {
        orderRecord.shippingConfigured = orderData.shippingConfigured;
      }

      // Save to Firebase only - single source of truth
      const savedOrder = await ordersService.createOrder(orderRecord);

      console.log('✅ Order completed successfully with ATOMIC transaction');

      // ⚡ ATOMIC TRANSACTION already guarantees data consistency
      // Real-time sync automatically triggered by onSnapshot listeners
      // No need for forced batch refresh - eliminates 1 waste read

      return orderId;

    } catch (error) {
      console.error('❌ ATOMIC TRANSACTION FAILED:', error);

      // Log error without alert
      console.error('⚠️ CHECKOUT GAGAL:', error.message);
      return null;
    }
  };

  // getTotalPrice moved to components since cart is now managed by cartService
  const handleCartClick = () => {
    setCurrentPage('cart');
  };

  const handleCheckout = (selectedItemIds: string[]) => {
    // Guest browsing: Require login before checkout
    if (!user) {
      setShowLogin(true);
      // Store selected items to continue after login
      setSelectedCartItemIds(selectedItemIds);
      return;
    }
    setSelectedCartItemIds(selectedItemIds);
    setCurrentPage('checkout');
  };

  const handleNavigateToFlashSale = () => {
    setCurrentPage('flash-sale');
  };

  const handleBannerClick = (banner: Banner) => {
    console.log('🖼️ App: Banner clicked, navigating to products:', banner.title);
    setSelectedBanner(banner);
    setCurrentPage('banner-products');
  };

  const handleNavigateToOngkirTest = () => {
    setCurrentPage('ongkir-test');
  };

  // Admin navigation functions for specific pages
  const handleNavigateToAdminProducts = () => {
    setCurrentPage('admin-products');
  };

  const handleNavigateToAdminOrders = () => {
    setCurrentPage('admin-orders');
  };

  const handleNavigateToAdminReports = () => {
    setCurrentPage('admin-reports');
  };

  const handleNavigateToAdminUsers = () => {
    setCurrentPage('admin-users');
  };

  const handleNavigateToAdminCache = () => {
    setCurrentPage('admin-cache');
  };

  const handleNavigateToAdminFinancials = () => {
    setCurrentPage('admin-financials');
  };

  const handleNavigateToAdminMaster = () => {
    setCurrentPage('admin-master');
  };

  const handleNavigateToAdminPaymentVerification = () => {
    setCurrentPage('admin-payment-verification');
  };

  const handleNavigateToAdminStockOpname = () => {
    setCurrentPage('admin-stock-opname');
  };

  const handleNavigateToAdminStockAdjustments = () => {
    setCurrentPage('admin-stock-adjustments');
  };

  const handleNavigateToAdminVoucher = () => {
    setCurrentPage('admin-voucher');
  };

  const handleNavigateToAdminBanner = () => {
    setCurrentPage('admin-banner');
  };



  const renderCurrentPage = () => {
    // Show loading while checking authentication
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-brand-surface">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Memuat...</p>
          </div>
        </div>
      );
    }

    // Force login if user is not authenticated (except for ongkir-test page)
    if (!user && currentPage !== 'ongkir-test') {
      return (
        <LoginFormSimple
          onSuccess={handleLoginWithUser}
          onClose={() => { }} // Prevent closing without login
          onShowRegister={() => {
            setShowLogin(false);
            setShowRegistration(true);
          }}
        />
      );
    }

    if (showLogin) {
      return (
        <LoginFormSimple
          onSuccess={handleLoginWithUser}
          onClose={() => setShowLogin(false)}
          onShowRegister={() => {
            setShowLogin(false);
            setShowRegistration(true);
          }}
        />
      );
    }

    switch (currentPage) {
      case 'home':
        return (
          <HomePage
            user={user}
            products={products}
            loading={loading}
            onProductClick={handleProductClick}
            onLoginRequired={handleLoginRequired}
            onCartClick={handleCartClick}
            onAddToCart={handleQuickAddToCart}
            onNavigateToFlashSale={handleNavigateToFlashSale}
            onRefreshProducts={refresh}
            onBannerClick={handleBannerClick}
          />
        );
      case 'banner-products':
        return selectedBanner ? (
          <BannerProductsPage
            banner={selectedBanner}
            allProducts={products}
            user={user}
            onBack={() => setCurrentPage('home')}
            onProductClick={handleProductClick}
            onAddToCart={handleQuickAddToCart}
          />
        ) : (
          <HomePage
            user={user}
            products={products}
            loading={loading}
            onProductClick={handleProductClick}
            onLoginRequired={handleLoginRequired}
            onCartClick={handleCartClick}
            onAddToCart={handleQuickAddToCart}
            onNavigateToFlashSale={handleNavigateToFlashSale}
            onRefreshProducts={refresh}
            onBannerClick={handleBannerClick}
          />
        );
      case 'flash-sale':
        return (
          <FlashSalePage
            user={user}
            onProductClick={handleProductClick}
            onCartClick={handleCartClick}
            onAddToCart={handleQuickAddToCart}
            flashSaleProducts={flashSaleProducts}
            onBack={() => setCurrentPage('home')}
          />
        );
      case 'orders':
        return <OrdersPage user={user} onBack={() => setCurrentPage('home')} />;
      case 'account':
        return (
          <AccountPage
            user={user}
            onLogout={handleLogout}
            onNavigateToAdminProducts={handleNavigateToAdminProducts}
            onNavigateToAdminOrders={handleNavigateToAdminOrders}
            onNavigateToAdminPaymentVerification={handleNavigateToAdminPaymentVerification}
            onNavigateToAdminReports={handleNavigateToAdminReports}
            onNavigateToAdminUsers={handleNavigateToAdminUsers}
            onNavigateToAdminCache={handleNavigateToAdminCache}
            onNavigateToAdminFinancials={handleNavigateToAdminFinancials}
            onNavigateToAdminMaster={handleNavigateToAdminMaster}
            onNavigateToAddressManagement={() => setCurrentPage('address-management')}
            onNavigateToAdminStockOpname={handleNavigateToAdminStockOpname}
            onNavigateToAdminVoucher={handleNavigateToAdminVoucher}
            onNavigateToAdminBanner={handleNavigateToAdminBanner}
          />
        );
      case 'address-management':
        return (
          <AddressManagementPage
            user={user}
            onBack={() => setCurrentPage('account')}
          />
        );
      case 'admin-products':
        return (
          <AdminProductsPage
            onBack={() => setCurrentPage('account')}
            user={user}
            onNavigateToStockApproval={handleNavigateToAdminStockAdjustments}
          />
        );
      case 'admin-orders':
        return (
          <AdminOrdersPage
            onBack={() => setCurrentPage('account')}
            user={user}
            onRefreshProducts={refresh}
            onNavigateToHome={() => setCurrentPage('home')}
          />
        );
      case 'admin-payment-verification':
        return (
          <AdminPaymentVerificationPage
            onBack={() => setCurrentPage('account')}
            user={user}
          />
        );
      case 'admin-reports':
        return <AdminReportsPage onBack={() => setCurrentPage('account')} user={user} />;
      case 'admin-users':
        return <AdminUsersPage onBack={() => setCurrentPage('account')} user={user} />;
      case 'admin-cache':
        return <AdminCacheManagement onBack={() => setCurrentPage('account')} user={user} />;
      case 'admin-financials':
        return <AdminFinancialPage onBack={() => setCurrentPage('account')} user={user} />;
      case 'admin-banner':
        return <AdminBannerPage onBack={() => setCurrentPage('account')} user={user} />;
      case 'admin-master':
        return <AdminMasterDataPage onBack={() => setCurrentPage('account')} user={user} />;
      case 'admin-stock-opname':
        return <AdminStockOpnamePage onBack={() => setCurrentPage('account')} user={user} />;
      case 'admin-voucher':
        return <AdminVoucherPage onBack={() => setCurrentPage('account')} user={user} />;
      case 'ongkir-test':
        return <OngkirTestPage onBack={() => setCurrentPage('home')} />;
      case 'product-detail':
        return (
          <ProductDetail
            currentProduct={selectedProduct!}
            user={user}
            onBack={() => setCurrentPage('home')}
            onLoginRequired={handleLoginRequired}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
            onNavigateToCart={() => setCurrentPage('cart')}
          />
        );
      case 'cart':
        return (
          <CartPage
            user={user}
            onBack={() => setCurrentPage('home')}
            onCheckout={handleCheckout}
          />
        );
      case 'checkout':
        return (
          <CheckoutPage
            user={user}
            clearCart={handleOrderComplete}
            onBack={() => setCurrentPage('cart')}
            selectedCartItemIds={selectedCartItemIds}
          />
        );
      default:
        return (
          <HomePage
            user={user}
            products={products}
            loading={loading}
            onProductClick={handleProductClick}
            onLoginRequired={handleLoginRequired}
            onCartClick={handleCartClick}
            onAddToCart={handleQuickAddToCart}
            onNavigateToFlashSale={handleNavigateToFlashSale}
            onLoadMore={loadMore}
            hasMore={hasMore}
            onRefreshProducts={refresh}
            searchProducts={searchProducts}
          />
        );
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-brand-surface text-slate-900">
        {/* 🤖 PaymentAutoVerifier - MUST be inside AppContent to access user auth */}
        {user?.role === 'owner' && <PaymentAutoVerifier />}
        {/* ⏰ OrderExpirationChecker - Auto-expire unpaid orders */}
        {user && <OrderExpirationChecker userId={user.uid} />}
        {renderCurrentPage()}
        {!showLogin && !currentPage.startsWith('admin-') && ['home', 'flash-sale', 'orders', 'account'].includes(currentPage) && (
          <BottomNavigation currentPage={currentPage} onPageChange={setCurrentPage} />
        )}
        <InstallPrompt />

        {/* Login Modal */}
        {showLogin && (
          <LoginFormSimple
            onSuccess={handleLoginWithUser}
            onClose={() => setShowLogin(false)}
            onShowRegister={() => {
              setShowLogin(false);
              setShowRegistration(true);
            }}
          />
        )}

        {/* Registration Modal */}
        {showRegistration && (
          <FirebaseRegistration
            onSuccess={handleRegistrationSuccess}
            onClose={() => setShowRegistration(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  // Check if splash already shown in this session
  useEffect(() => {
    const splashShown = sessionStorage.getItem('azzahra-splash-shown');

    if (splashShown === 'true') {
      // Skip splash if already shown in this session
      setShowSplash(false);
    }
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    // Mark splash as shown for this session
    sessionStorage.setItem('azzahra-splash-shown', 'true');
  };

  // Show splash screen
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Show main app after splash
  return (
    <AdminProvider>
      <GlobalProductsProvider>
        <ToastProvider>
          {/* <FlashSaleProvider> - DISABLED Emergency fix untuk infinite loop */}
          {/* PaymentAutoVerifier moved inside AppContent for proper user auth access */}
          <AppContent />
          {/* </FlashSaleProvider> */}
        </ToastProvider>
      </GlobalProductsProvider>
    </AdminProvider>
  );
}

export default App;