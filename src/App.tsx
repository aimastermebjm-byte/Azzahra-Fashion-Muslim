import React, { useState } from 'react';
import { AdminProvider } from './contexts/AdminContext';
import HomePage from './components/HomePage';
import ProductDetail from './components/ProductDetail';
import CartPage from './components/CartPage';
import CheckoutPage from './components/CheckoutPage';
import LoginForm from './components/LoginForm';
import FlashSalePage from './components/FlashSalePage';
import OrdersPage from './components/OrdersPage';
import AccountPage from './components/AccountPage';
import AdminDashboard from './components/AdminDashboard';
import BottomNavigation from './components/BottomNavigation';
import { useProducts } from './hooks/useProducts';
import { useAdmin } from './contexts/AdminContext';

type Page = 'home' | 'flash-sale' | 'orders' | 'account' | 'product-detail' | 'cart' | 'checkout' | 'login' | 'admin-dashboard';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const { products, loading, updateProductStock } = useProducts();
  const { addOrder } = useAdmin();

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setCurrentPage('product-detail');
  };

  const handleLoginRequired = () => {
    setShowLogin(true);
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    // This will be handled by LoginForm component
  };

  const handleLoginWithUser = (user: any) => {
    setShowLogin(false);
    setUser(user);
    console.log('User logged in:', user);
  };

  const handleLogout = () => {
    console.log('User logging out');
    setUser(null);
    setCartItems([]);
    setCurrentPage('home');
  };

  const handleAddToCart = (product: any, variant: any, quantity: number) => {
    const cartItem = {
      ...product,
      selectedVariant: variant,
      quantity,
      cartId: `${product.id}-${variant?.size}-${variant?.color}`
    };
    
    setCartItems(prev => {
      const existingIndex = prev.findIndex(item => 
        item.id === product.id && 
        item.selectedVariant?.size === variant?.size &&
        item.selectedVariant?.color === variant?.color
      );
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
      }
      
      return [...prev, cartItem];
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
    setCartItems(prev => 
      prev.map(item => 
        item.id === productId && 
        item.selectedVariant?.size === variant?.size &&
        item.selectedVariant?.color === variant?.color
          ? { ...item, quantity: Math.max(1, newQuantity) }
          : item
      )
    );
  };

  const removeFromCart = (productId: string, variant: any) => {
    setCartItems(prev => 
      prev.filter(item => 
        !(item.id === productId && 
          item.selectedVariant?.size === variant?.size &&
          item.selectedVariant?.color === variant?.color)
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
    
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
    
    // Clear cart
    setCartItems([]);
    
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

  const renderCurrentPage = () => {
    if (showLogin) {
      return (
        <LoginForm 
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
        return <AccountPage user={user} onLogout={handleLogout} onNavigateToAdmin={() => setCurrentPage('admin-dashboard')} />;
      case 'admin-dashboard':
        console.log('App: Rendering AdminDashboard with user:', user);
        return <AdminDashboard onBack={() => setCurrentPage('account')} user={user} />;
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
            cartItems={cartItems}
            user={user}
            updateQuantity={updateCartQuantity}
            removeFromCart={removeFromCart}
            getTotalPrice={getTotalPrice}
            onBack={() => setCurrentPage('home')}
            onCheckout={handleCheckout}
          />
        );
      case 'checkout':
        return (
          <CheckoutPage 
            cartItems={cartItems}
            user={user}
            getTotalPrice={getTotalPrice}
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
    <div className="min-h-screen bg-gray-50">
      {renderCurrentPage()}
      {!showLogin && currentPage !== 'admin-dashboard' && (
        <BottomNavigation currentPage={currentPage} onPageChange={setCurrentPage} />
      )}
    </div>
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