import React, { useState, useEffect } from 'react';
import { AdminProvider } from './contexts/AdminContext';
// import { FlashSaleProvider } from './contexts/FlashSaleContext'; // DISABLED - Emergency fix
import { GlobalProductsProvider } from './hooks/useGlobalProducts';
import ErrorBoundary from './components/ErrorBoundary';

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
import AdminCacheManagement from './components/AdminCacheManagement';
import BottomNavigation from './components/BottomNavigation';
import { OngkirTestPage } from './pages/OngkirTestPage';
import { useUnifiedProducts } from './hooks/useUnifiedProducts';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';
import { useAdmin } from './contexts/AdminContext';
import { cartServiceOptimized } from './services/cartServiceOptimized';
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

      // 🔥 CRITICAL FIX: Call cartService.addToCart with correct parameters
      // cartService expects: (product, quantity, variant)
      const success = await cartServiceOptimized.addToCart(product, quantity, variant);

      if (success) {
        alert('Produk berhasil ditambahkan ke keranjang!');
      } else {
        alert('Gagal menambahkan produk ke keranjang');
      }
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
      const cartItems = await cartServiceOptimized.getCart();

      if (cartItems.length === 0) {
        alert('Keranjang belanja kosong!');
        return null;
      }

      console.log('🚀 Starting ATOMIC transaction for checkout...', cartItems.length, 'items');
      console.log('🔍 DEBUG: Cart items structure:', cartItems.map(item => ({
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
        for (const item of cartItems) {
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

      console.log('🎉 ATOMIC TRANSACTION SUCCESS:', {
        itemsProcessed: validatedItems.length,
        totalAmount: cartTotal
      });

      // Calculate final totals
      const calculatedSubtotal = cartTotal;
      const calculatedShippingCost = orderData.shippingCost || 0;
      const calculatedFinalTotal = calculatedSubtotal + calculatedShippingCost;

      // Clear cart from backend (after successful stock reduction)
      await cartServiceOptimized.clearCart();

      // Create single order record for both admin system and Firebase sync
      const orderRecord = {
        id: orderId,
        userId: user.uid,
        userName: user.displayName || 'User',
        userEmail: user.email || 'user@example.com',
        items: validatedItems.map(item => ({
          productId: item.productId,
          productName: item.name || 'Product',
          selectedVariant: {
            size: item.variant?.size || '',
            color: item.variant?.color || ''
          },
          quantity: item.quantity,
          price: item.price || 0,
          total: item.total || 0
        })),
        shippingInfo: orderData.shippingInfo,
        paymentMethod: orderData.paymentMethod,
        status: 'pending' as const,
        totalAmount: calculatedSubtotal,
        shippingCost: calculatedShippingCost,
        finalTotal: calculatedFinalTotal,
        notes: orderData.notes || '',
        timestamp: Date.now()
      };

      // Save to Firebase only - single source of truth
      const savedOrder = await ordersService.createOrder(orderRecord);

      console.log('✅ Order completed successfully with ATOMIC transaction');

      // ⚡ ATOMIC TRANSACTION already guarantees data consistency
      // Real-time sync automatically triggered by onSnapshot listeners
      // No need for forced batch refresh - eliminates 1 waste read

      return orderId;

    } catch (error) {
      console.error('❌ ATOMIC TRANSACTION FAILED:', error);

      // Show user-friendly error message
      if (error.message.includes('tidak mencukupi')) {
        alert(`⚠️ CHECKOUT GAGAL:\n\n${error.message}\n\nMohon periksa kembali keranjang Anda atau kurangi jumlah pesanan.`);
      } else if (error.message.includes('tidak ditemukan')) {
        alert(`⚠️ CHECKOUT GAGAL:\n\n${error.message}\n\nMohon refresh halaman dan coba lagi.`);
      } else {
        alert(`⚠️ CHECKOUT GAGAL:\n\nTerjadi kesalahan saat memproses pesanan. Silakan coba lagi.\n\nError: ${error.message}`);
      }

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
            onRefreshProducts={refresh}
            featuredProducts={featuredProducts}
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
            onRefreshProducts={refresh}
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
      <GlobalProductsProvider>
        {/* <FlashSaleProvider> - DISABLED Emergency fix untuk infinite loop */}
        <AppContent />
        {/* </FlashSaleProvider> */}
      </GlobalProductsProvider>
    </AdminProvider>
  );
}

export default App;