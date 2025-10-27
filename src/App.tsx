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
import AdminProductsPage from './components/AdminProductsPage';
import AdminOrdersPage from './components/AdminOrdersPage';
import AdminReportsPage from './components/AdminReportsPage';
import AdminUsersPage from './components/AdminUsersPage';
import BottomNavigation from './components/BottomNavigation';
import { OngkirTestPage } from './pages/OngkirTestPage';
import { useFirebaseProducts } from './hooks/useFirebaseProducts';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';
import { useAdmin } from './contexts/AdminContext';
import { AppStorage } from './utils/appStorage';

type Page = 'home' | 'flash-sale' | 'orders' | 'account' | 'product-detail' | 'cart' | 'checkout' | 'login' | 'admin-products' | 'admin-orders' | 'admin-reports' | 'admin-users' | 'ongkir-test';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);

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

    // Restore cart from localStorage (keep cart persistence)
    const savedCart = localStorage.getItem('azzahra_cart');
    if (savedCart) {
      try {
        const cart = JSON.parse(savedCart);
        setCartItems(cart);
        console.log('✅ Cart restored:', cart.length, 'items');
      } catch (error) {
        console.error('❌ Error restoring cart:', error);
        localStorage.removeItem('azzahra_cart');
      }
    } else {
      console.log('ℹ️ No saved cart found');
    }

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
    setCartItems([]);
    setCurrentPage('home');

    // Clear cart from localStorage (keep only cart, not user)
    localStorage.removeItem('azzahra_cart');
    console.log('✅ Firebase logout successful');
    console.log('📦 Cart cleared from localStorage');
  };

  const handleAddToCart = (product: any, variant: any, quantity: number) => {
    const cartItem = {
      ...product,
      selectedVariant: variant,
      quantity,
      cartId: `${product.id}-${variant?.size}-${variant?.color}`,
      addedAt: new Date().toISOString()
    };

    setCartItems(prev => {
      const existingIndex = prev.findIndex(item =>
        item.id === product.id &&
        item.selectedVariant?.size === variant?.size &&
        item.selectedVariant?.color === variant?.color
      );

      let updatedCart;
      if (existingIndex >= 0) {
        updatedCart = [...prev];
        updatedCart[existingIndex].quantity += quantity;
        updatedCart[existingIndex].addedAt = new Date().toISOString();
      } else {
        updatedCart = [...prev, cartItem];
      }

      // Save cart to localStorage
      localStorage.setItem('azzahra_cart', JSON.stringify(updatedCart));
      console.log('💾 Cart saved to localStorage:', updatedCart.length, 'items');

      return updatedCart;
    });

    // Show success message
    alert('Produk berhasil ditambahkan ke keranjang!');
  };

  const handleQuickAddToCart = (product: any) => {
    if (!user) {
      handleLoginRequired();
      return;
    }
    
    // Add with default variant (first available)
    const defaultVariant = {
      size: product.variants.sizes[0],
      color: product.variants.colors[0]
    };
    
    handleAddToCart(product, defaultVariant, 1);
  };

  const handleBuyNow = (product: any, variant: any, quantity: number) => {
    if (!user) {
      handleLoginRequired();
      return;
    }

    // Add to cart first
    handleAddToCart(product, variant, quantity);
    
    // Then go to checkout
    setTimeout(() => {
      setCurrentPage('checkout');
    }, 500);
  };
  const updateCartQuantity = (productId: string, variant: any, newQuantity: number) => {
    setCartItems(prev => {
      const updatedCart = prev.map(item =>
        item.id === productId &&
        item.selectedVariant?.size === variant?.size &&
        item.selectedVariant?.color === variant?.color
          ? { ...item, quantity: Math.max(1, newQuantity) }
          : item
      );

      // Save updated cart to localStorage
      localStorage.setItem('azzahra_cart', JSON.stringify(updatedCart));

      return updatedCart;
    });
  };

  const removeFromCart = (productId: string, variant: any) => {
    setCartItems(prev => {
      const updatedCart = prev.filter(item =>
        !(item.id === productId &&
          item.selectedVariant?.size === variant?.size &&
          item.selectedVariant?.color === variant?.color)
      );

      // Save updated cart to localStorage
      localStorage.setItem('azzahra_cart', JSON.stringify(updatedCart));

      return updatedCart;
    });
  };

  const clearCart = () => {
    setCartItems([]);

    // Clear cart from localStorage
    localStorage.removeItem('azzahra_cart');

    // Update product stock when order is completed
    cartItems.forEach(item => {
      updateProductStock(item.id, item.quantity);
    });
  };

  const handleOrderComplete = (orderData: any) => {
    const orderId = 'AZF' + Date.now().toString().slice(-8);

    // Add order to admin system
    addOrder({
      id: orderId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      items: cartItems.map(item => ({
        productId: item.id,
        productName: item.name,
        selectedVariant: item.selectedVariant,
        quantity: item.quantity,
        price: user?.role === 'reseller' ? item.resellerPrice : item.retailPrice,
        total: (user?.role === 'reseller' ? item.resellerPrice : item.retailPrice) * item.quantity
      })),
      shippingInfo: orderData.shippingInfo,
      paymentMethod: orderData.paymentMethod,
      status: 'pending',
      totalAmount: getTotalPrice(),
      shippingCost: 15000,
      finalTotal: getTotalPrice() + 15000,
      notes: orderData.notes
    });

    // Update stock for each item
    cartItems.forEach(item => {
      updateProductStock(item.id, item.quantity);
    });

    // Clear cart and localStorage
    setCartItems([]);
    localStorage.removeItem('azzahra_cart');
    console.log('Cart cleared after order completion');

    return orderId;
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => {
      const price = user?.role === 'reseller' ? item.resellerPrice : item.retailPrice;
      return total + (price * item.quantity);
    }, 0);
  };
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
            cartItems={cartItems}
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
            cartItems={cartItems}
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
            cartItems={cartItems}
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