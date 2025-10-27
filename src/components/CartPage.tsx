import React, { useEffect, useState } from 'react';
import { cartService } from '../services/cartService';
import { ArrowLeft, Plus, Minus, Trash2, ShoppingBag, RefreshCw } from 'lucide-react';

interface CartPageProps {
  user: any;
  onBack: () => void;
  onCheckout: () => void;
}

const CartPage: React.FC<CartPageProps> = ({
  user,
  onBack,
  onCheckout
}) => {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Load cart from backend
  const loadCart = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const items = await cartService.getCart();
      setCartItems(items);
      console.log('🛒 Cart loaded from backend:', items.length, 'items');
    } catch (error) {
      console.error('❌ Failed to load cart:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sync cart from local storage to backend
  const syncCartToBackend = async () => {
    if (!user?.uid) return;

    try {
      setSyncing(true);
      console.log('🔄 Syncing cart to backend...');

      // Get local cart
      const localCart = localStorage.getItem(`cart_${user.uid}`);
      if (localCart) {
        const localItems = JSON.parse(localCart);

        // Sync each item to backend
        for (const item of localItems) {
          await cartService.addToCart({
            productId: item.productId,
            variant: item.variant,
            quantity: item.quantity,
            name: item.name || 'Product',
            price: item.price || 0
          });
        }

        // Clear local cart after sync
        localStorage.removeItem(`cart_${user.uid}`);

        // Reload cart from backend
        await loadCart();
        console.log('✅ Cart synced successfully');
      }
    } catch (error) {
      console.error('❌ Failed to sync cart:', error);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      loadCart();
    }
  }, [user]);

  const updateQuantity = async (productId: string, variant: any, newQuantity: number) => {
    if (!user?.uid) return;

    try {
      // Find the item in cart to get its ID
      const item = cartItems.find(item =>
        item.productId === productId &&
        JSON.stringify(item.variant) === JSON.stringify(variant)
      );

      if (!item) {
        console.error('❌ Item not found in cart');
        return;
      }

      if (newQuantity === 0) {
        await cartService.removeFromCart(item.id);
      } else {
        await cartService.updateQuantity(item.id, newQuantity);
      }
      await loadCart(); // Reload cart
    } catch (error) {
      console.error('❌ Failed to update quantity:', error);
    }
  };

  const removeFromCart = async (productId: string, variant: any) => {
    if (!user?.uid) return;

    try {
      // Find the item in cart to get its ID
      const item = cartItems.find(item =>
        item.productId === productId &&
        JSON.stringify(item.variant) === JSON.stringify(variant)
      );

      if (!item) {
        console.error('❌ Item not found in cart');
        return;
      }

      await cartService.removeFromCart(item.id);
      await loadCart(); // Reload cart
    } catch (error) {
      console.error('❌ Failed to remove from cart:', error);
    }
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="flex items-center p-4">
            <button onClick={onBack} className="mr-4">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-lg font-semibold">Keranjang Belanja</h1>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center h-96">
          <RefreshCw className="w-16 h-16 text-gray-300 mb-4 animate-spin" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Memuat Keranjang...</h3>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="flex items-center p-4">
            <button onClick={onBack} className="mr-4">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-lg font-semibold">Keranjang Belanja</h1>
            <button
              onClick={syncCartToBackend}
              disabled={syncing}
              className="ml-auto mr-2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
              title="Sync keranjang dari lokal"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center h-96">
          <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Keranjang Kosong</h3>
          <p className="text-gray-500 text-center mb-6">
            Belum ada produk di keranjang Anda.<br />
            Yuk mulai belanja!
          </p>
          <button
            onClick={onBack}
            className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-pink-600 hover:to-purple-700 transition-all"
          >
            Mulai Belanja
          </button>
        </div>
      </div>
    );
  }

  const totalPrice = getTotalPrice();

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4">
          <button onClick={onBack} className="mr-4">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold">Keranjang Belanja</h1>
          <span className="ml-2 bg-pink-100 text-pink-600 text-xs px-2 py-1 rounded-full">
            {cartItems.length}
          </span>
          <button
            onClick={syncCartToBackend}
            disabled={syncing}
            className="ml-auto mr-2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
            title="Sync keranjang dari lokal ke server"
          >
            <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {cartItems.map((item) => {
          const itemTotal = item.price * item.quantity;

          return (
            <div key={`${item.productId}-${item.variant?.size || 'default'}-${item.variant?.color || 'default'}`} className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex space-x-4">
                <img
                  src={item.image || 'https://via.placeholder.com/80x80?text=Product'}
                  alt={item.name}
                  className="w-20 h-20 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-1">{item.name}</h3>

                  {item.variant && (
                    <p className="text-sm text-gray-500 mb-2">
                      Ukuran: {item.variant.size || 'Standard'} | Warna: {item.variant.color || 'Default'}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-pink-600">
                        Rp {item.price.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                        <button
                          onClick={() => updateQuantity(item.productId, item.variant, Math.max(1, item.quantity - 1))}
                          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.variant, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.productId, item.variant)}
                        className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 text-right">
                    <span className="text-sm text-gray-600">Subtotal: </span>
                    <span className="font-semibold text-gray-800">
                      Rp {itemTotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Checkout Bar */}
      <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-600">Total ({cartItems.length} item)</span>
          <span className="text-xl font-bold text-pink-600">
            Rp {totalPrice.toLocaleString('id-ID')}
          </span>
        </div>
        
        <button
          onClick={onCheckout}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-lg font-semibold hover:from-pink-600 hover:to-purple-700 transition-all"
        >
          Checkout Sekarang
        </button>
      </div>
    </div>
  );
};

export default CartPage;