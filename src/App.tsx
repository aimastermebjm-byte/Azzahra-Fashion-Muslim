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
import { useFirebaseProducts } from './hooks/useFirebaseProducts';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';
import { useAdmin } from './contexts/AdminContext';
import { AppStorage } from './utils/appStorage';
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
  const { products, loading, updateProductStock } = useFirebaseProducts();
  const { addOrder } = useAdmin();

  // Initialize AppStorage on app start
  useEffect(() => {
    console.log('🚀 App initializing... Checking localStorage');
    AppStorage.initializeApp();

    // Validate and sync featured products on app startup
    AppStorage.validateAndSyncFeaturedProducts();
    console.log('🚀 App initialized with featured products validation');

    // Cart management now handled by cartService in components
    // No longer need localStorage cart restoration

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
    console.log('✅ Firebase user logged in:', user.name, user.role);
  };

  const handleRegistrationSuccess = (user: any) => {
    setShowRegistration(false);
    console.log('✅ Firebase user registered:', user.name, user.role);
  };

  const handleLogout = () => {
    console.log('🔃 User logging out from Firebase');

    // Firebase logout
    logout();
    setCurrentPage('home');

    // Clear cart from cartService and localStorage
    cartService.clearCart().catch(error => {
      console.error('❌ Error clearing cart on logout:', error);
    });
    localStorage.removeItem('azzahra_cart');
    console.log('✅ Firebase logout successful');
    console.log('📦 Cart cleared from cartService and localStorage');
  };

  const handleAddToCart = async (product: any, variant: any, quantity: number) => {
    if (!user?.uid) {
      console.log('❌ Cannot add to cart: User not logged in');
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
      console.log('✅ Product added to cart:', product.name, 'Price:', price);
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

      // Calculate totals from cart items
      const calculatedSubtotal = cartItems.reduce((total, item) => {
        const itemPrice = item.price || 0;
        const itemQuantity = item.quantity || 1;
        return total + (itemPrice * itemQuantity);
      }, 0);

      const calculatedShippingCost = orderData.shippingCost || 0;
      const calculatedFinalTotal = calculatedSubtotal + calculatedShippingCost;

      // Add order to admin system
      addOrder({
        id: orderId,
        userId: user.uid,
        userName: user.displayName || 'User',
        userEmail: user.email || 'user@example.com',
        items: cartItems.map(item => ({
          productId: item.productId,
          productName: item.name || 'Product',
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

      // Update stock for each item
      cartItems.forEach(item => {
        updateProductStock(item.productId, item.quantity);
      });

      // Clear cart from backend
      await cartService.clearCart();

      // Save order to Firebase for cross-device sync using OrdersService
      const orderRecord = {
        items: cartItems.map(item => ({
          productId: item.productId,
          productName: item.name || 'Product',
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
        // Save to Firebase using OrdersService
        await ordersService.createOrder(orderRecord);
        console.log('🔥 Order saved to Firebase via OrdersService:', orderId);

        // Also save to AppStorage (localStorage) as backup
        AppStorage.saveOrder({
          ...orderRecord,
          createdAt: new Date().toISOString(),
          timestamp: Date.now()
        });
        console.log('💾 Order saved to AppStorage as backup:', orderId);
      } catch (firebaseError) {
        console.error('❌ Error saving order via OrdersService:', firebaseError);
        // Fallback to AppStorage only
        AppStorage.saveOrder({
          ...orderRecord,
          createdAt: new Date().toISOString(),
          timestamp: Date.now()
        });
        console.log('💾 Order saved to AppStorage (fallback):', orderId);
      }

      console.log('✅ Order completed and cart cleared:', orderId);
      return orderId;
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
            onNavigateToOngkirTest={handleNavigateToOngkirTest}
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
        console.log('App: Rendering AccountPage with user:', user);
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
        console.log('App: Rendering AddressManagementPage with user:', user);
        return (
          <AddressManagementPage
            user={user}
            onBack={() => setCurrentPage('account')}
          />
        );
        case 'admin-products':
        console.log('App: Rendering AdminProductsPage with user:', user);
        return <AdminProductsPage onBack={() => setCurrentPage('account')} user={user} />;
      case 'admin-orders':
        console.log('App: Rendering AdminOrdersPage with user:', user);
        return <AdminOrdersPage onBack={() => setCurrentPage('account')} user={user} />;
      case 'admin-reports':
        console.log('App: Rendering AdminReportsPage with user:', user);
        return <AdminReportsPage onBack={() => setCurrentPage('account')} user={user} />;
      case 'admin-users':
        console.log('App: Rendering AdminUsersPage with user:', user);
        return <AdminUsersPage onBack={() => setCurrentPage('account')} user={user} />;
      case 'admin-cache':
        console.log('App: Rendering AdminCacheManagement with user:', user);
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