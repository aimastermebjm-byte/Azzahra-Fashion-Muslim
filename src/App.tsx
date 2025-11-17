import React, { useState, useEffect } from 'react';
import { AdminProvider } from './contexts/AdminContext';
import ErrorBoundary from './components/ErrorBoundary';
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
import AdminCacheManagement from './components/AdminCacheManagement';
import BottomNavigation from './components/BottomNavigation';
import { OngkirTestPage } from './pages/OngkirTestPage';
import { useFirebaseProductsRealTime } from './hooks/useFirebaseProductsRealTime';
import { useFirebaseProducts } from './hooks/useFirebaseProducts';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';
import { useAdmin } from './contexts/AdminContext';
// import { AppStorage } from './utils/appStorage'; // REMOVED - Firebase only
import { cartService } from './services/cartService';
import { ordersService } from './services/ordersService';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './utils/firebaseClient';

type Page = 'home' | 'flash-sale' | 'orders' | 'account' | 'address-management' | 'product-detail' | 'cart' | 'checkout' | 'login' | 'admin-products' | 'admin-orders' | 'admin-reports' | 'admin-users' | 'admin-cache' | 'ongkir-test';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);

  // Firebase Authentication
  const { user, login, logout } = useFirebaseAuth();
  // Gunakan real-time hook untuk HomePage products
  const { products, loading, loadMoreProducts, hasMore, featuredProducts, featuredLoading, flashSaleProducts, flashSaleLoading, searchProducts } = useFirebaseProductsRealTime();

  // Tetap gunakan original hook untuk fungsi update stock dan manual refresh
  const { updateProductStock, refreshProducts } = useFirebaseProducts();
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

  const handleLoginWithUser = (user: any) => {
    setShowLogin(false);
      };

  const handleRegistrationSuccess = (user: any) => {
    setShowRegistration(false);
      };

  const handleLogout = () => {
    
    // Firebase logout
    logout();
    setCurrentPage('home');

    // Clear cart from cartService only (Firebase-only)
    cartService.clearCart().catch(error => {
      console.error('❌ Error clearing cart on logout:', error);
    });
      };

  const handleAddToCart = async (product: any, variant: any, quantity: number) => {
    if (!user?.uid) {
            handleLoginRequired();
      return;
    }

    try {
      // Get the correct price based on user role
      const price = user?.role === 'reseller' ? product.resellerPrice : product.retailPrice;

      await cartService.addToCart({
        productId: product.id,
        name: product.name,
        price: price,
        image: product.images?.[0] || '',
        variant: variant,
        quantity: quantity
      });
            alert('Produk berhasil ditambahkan ke keranjang!');
    } catch (error) {
      console.error('❌ Failed to add to cart:', error);
      alert('Gagal menambahkan produk ke keranjang');
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

    // Add to cart first
    await handleAddToCart(product, variant, quantity);

    // Then go to checkout
    setTimeout(() => {
      setCurrentPage('checkout');
    }, 500);
  };
  
  const handleOrderComplete = async (orderData: any) => {
    if (!user?.uid) {
      console.error('❌ Cannot complete order: User not logged in');
      return null;
    }

    const orderId = 'AZF' + Date.now().toString().slice(-8);

    try {
      // Get cart items from backend
      const cartItems = await cartService.getCart();

      // BATCH PRICE VALIDATION (90% Cost Reduction!)
      console.log('🔍 Validating cart prices against fresh Firebase data...');
      const { getDoc, doc: docRef } = await import('firebase/firestore');

      // Get all unique product IDs from cart
      const productIds = [...new Set(cartItems.map(item => item.productId))];

      // Batch fetch current product data (1 read per product, not per item)
      const currentProductData: Record<string, any> = {};
      const validationErrors: string[] = [];

      for (const productId of productIds) {
        try {
          const productDoc = await getDoc(docRef(db, 'products', productId));
          if (productDoc.exists()) {
            currentProductData[productId] = productDoc.data();
          } else {
            validationErrors.push(`Produk ${productId} tidak ditemukan`);
          }
        } catch (error) {
          console.error(`❌ Error validating product ${productId}:`, error);
          validationErrors.push(`Error memvalidasi produk ${productId}`);
        }
      }

      // Validate each cart item against current data
      let cartTotal = 0;
      let validatedItems = [];

      for (const item of cartItems) {
        const currentProduct = currentProductData[item.productId];

        if (!currentProduct) {
          validationErrors.push(`Produk "${item.name}" sudah tidak tersedia`);
          continue;
        }

        // Get current prices based on user role
        const currentRetailPrice = Number(currentProduct.retailPrice || currentProduct.price || 0);
        const currentResellerPrice = Number(currentProduct.resellerPrice) || currentRetailPrice * 0.8;

        // Determine which price should be used
        const expectedPrice = user?.role === 'reseller' ? currentResellerPrice : currentRetailPrice;
        const cartPrice = Number(item.price || 0);

        // Price validation check
        if (Math.abs(cartPrice - expectedPrice) > 0.01) {
          validationErrors.push(
            `Harga "${item.name}" berubah: Rp${cartPrice.toLocaleString('id-ID')} → Rp${expectedPrice.toLocaleString('id-ID')}`
          );

          // Update cart item with correct price
          item.price = expectedPrice;
        }

        // Stock validation check
        if (item.quantity > 0) {
          const currentStock = Number(currentProduct.stock || 0);
          if (currentStock < item.quantity) {
            validationErrors.push(
              `Stok "${item.name}" tidak mencukupi: tersisa ${currentStock}, diminta ${item.quantity}`
            );
            continue;
          }
        }

        // Add to validated total
        cartTotal += expectedPrice * item.quantity;
        validatedItems.push({
          ...item,
          price: expectedPrice,
          validated: true
        });
      }

      // Check for validation errors
      if (validationErrors.length > 0) {
        console.error('❌ Checkout validation errors:', validationErrors);
        const errorMessage = validationErrors.join('. ');

        // If critical errors (products not found, insufficient stock), block checkout
        const hasCriticalErrors = validationErrors.some(error =>
          error.includes('tidak ditemukan') || error.includes('tidak mencukupi')
        );

        if (hasCriticalErrors) {
          throw new Error(`Checkout gagal: ${errorMessage}`);
        } else {
          // For price changes, we can proceed but warn user
          console.warn('⚠️ Price changes detected and updated:', errorMessage);
          // In production, you might want to show a confirmation dialog
        }
      }

      // Use validated items and total
      const validatedCartItems = validatedItems.length > 0 ? validatedItems : cartItems;
      const calculatedSubtotal = validatedCartItems.reduce((total, item) => {
        const itemPrice = item.price || 0;
        const itemQuantity = item.quantity || 1;
        return total + (itemPrice * itemQuantity);
      }, 0);

      console.log('✅ Price validation complete:', {
        itemsValidated: validatedCartItems.length,
        totalValidated: calculatedSubtotal,
        errorsFound: validationErrors.length
      });

      const calculatedShippingCost = orderData.shippingCost || 0;
      const calculatedFinalTotal = calculatedSubtotal + calculatedShippingCost;

      // Add order to admin system using validated items
      addOrder({
        id: orderId,
        userId: user.uid,
        userName: user.displayName || 'User',
        userEmail: user.email || 'user@example.com',
        items: validatedCartItems.map(item => ({
          productId: item.productId,
          productName: item.name || 'Product',
          productImage: item.image || '',
          selectedVariant: item.variant || { size: '', color: '' },
          quantity: item.quantity,
          price: item.price || 0,
          total: (item.price || 0) * item.quantity
        })),
        shippingInfo: orderData.shippingInfo,
        paymentMethod: orderData.paymentMethod,
        status: 'pending',
        totalAmount: calculatedSubtotal,
        shippingCost: calculatedShippingCost,
        finalTotal: calculatedFinalTotal,
        notes: orderData.notes
      });

      // Update stock for each validated item with variant info
      validatedCartItems.forEach(item => {
        console.log('🔄 Stock reduction on checkout:', {
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          variant: item.variant
        });

        // Pass variant info to updateProductStock
        updateProductStock(item.productId, item.quantity, item.variant);
      });

      // Clear cart from backend
      await cartService.clearCart();

      // Save order to Firebase for cross-device sync using OrdersService
      const orderRecord = {
        items: validatedCartItems.map(item => ({
          productId: item.productId,
          productName: item.name || 'Product',
          productImage: item.image || '',
          selectedVariant: item.variant || { size: '', color: '' },
          quantity: item.quantity,
          price: item.price || 0,
          total: (item.price || 0) * item.quantity
        })),
        shippingInfo: orderData.shippingInfo,
        paymentMethod: orderData.paymentMethod,
        status: 'pending' as const,
        totalAmount: calculatedSubtotal,
        shippingCost: calculatedShippingCost,
        finalTotal: calculatedFinalTotal,
        notes: orderData.notes || '',
        userName: user.displayName || 'User',
        userEmail: user.email || 'user@example.com',
        userId: user.uid,
        timestamp: Date.now()
      };

      try {
        // Save to Firebase using OrdersService ONLY
        await ordersService.createOrder(orderRecord);
                return orderId;
      } catch (firebaseError) {
        console.error('❌ Error saving order via OrdersService:', firebaseError);
        console.error('🚨 Order saving failed - Firebase is the only storage option');
        throw firebaseError; // Don't fallback to localStorage
      }
    } catch (error) {
      console.error('❌ Error completing order:', error);
      return null;
    }
  };

  // getTotalPrice moved to components since cart is now managed by cartService
  const handleCartClick = () => {
    setCurrentPage('cart');
  };

  const handleCheckout = () => {
    setCurrentPage('checkout');
  };

  const handleNavigateToFlashSale = () => {
    setCurrentPage('flash-sale');
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

  
  
  const renderCurrentPage = () => {
    if (showLogin) {
      return (
        <LoginFormSimple
          onSuccess={handleLoginWithUser}
          onClose={() => setShowLogin(false)}
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
            onRefreshProducts={refreshProducts}
            featuredProducts={featuredProducts}
            featuredLoading={featuredLoading}
            flashSaleProducts={flashSaleProducts}
            flashSaleLoading={flashSaleLoading}
            searchProducts={searchProducts}
          />
        );
      case 'flash-sale':
        return (
          <FlashSalePage
            user={user}
            products={products}
            loading={loading}
            onProductClick={handleProductClick}
            onLoginRequired={handleLoginRequired}
            onCartClick={handleCartClick}
            onAddToCart={handleQuickAddToCart}
          />
        );
      case 'orders':
        return <OrdersPage user={user} />;
      case 'account':
        return (
          <AccountPage
            user={user}
            onLogout={handleLogout}
            onNavigateToAdminProducts={handleNavigateToAdminProducts}
            onNavigateToAdminOrders={handleNavigateToAdminOrders}
            onNavigateToAdminReports={handleNavigateToAdminReports}
            onNavigateToAdminUsers={handleNavigateToAdminUsers}
            onNavigateToAdminCache={handleNavigateToAdminCache}
            onNavigateToAddressManagement={() => setCurrentPage('address-management')}
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
        return <AdminProductsPage onBack={() => setCurrentPage('account')} user={user} />;
      case 'admin-orders':
        return (
          <AdminOrdersPage
            onBack={() => setCurrentPage('account')}
            user={user}
            onRefreshProducts={refreshProducts}
            onNavigateToHome={() => setCurrentPage('home')}
          />
        );
      case 'admin-reports':
        return <AdminReportsPage onBack={() => setCurrentPage('account')} user={user} />;
      case 'admin-users':
        return <AdminUsersPage onBack={() => setCurrentPage('account')} user={user} />;
      case 'admin-cache':
        return <AdminCacheManagement onBack={() => setCurrentPage('account')} user={user} />;
        case 'ongkir-test':
        return <OngkirTestPage onBack={() => setCurrentPage('home')} />;
        case 'product-detail':
        return (
          <ProductDetail
            product={selectedProduct!}
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
            onLoadMore={loadMoreProducts}
            hasMore={hasMore}
            featuredProducts={featuredProducts}
            featuredLoading={featuredLoading}
            flashSaleProducts={flashSaleProducts}
            flashSaleLoading={flashSaleLoading}
          />
        );
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {renderCurrentPage()}
        {!showLogin && !currentPage.startsWith('admin-') && (
          <BottomNavigation currentPage={currentPage} onPageChange={setCurrentPage} />
        )}

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
  return (
    <AdminProvider>
      <AppContent />
    </AdminProvider>
  );
}

export default App;