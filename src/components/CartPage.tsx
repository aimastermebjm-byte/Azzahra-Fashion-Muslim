import React, { useEffect, useState } from 'react';
import { cartService } from '../services/cartService';
import { ArrowLeft, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';

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
  
  // Load cart from backend
  const loadCart = async () => {
    try {
      setLoading(true);
      const items = await cartService.getCart();
      console.log('🛒 Cart loaded:', items);
      console.log('🛒 Cart item details:', items?.map((item, i) => ({
        index: i,
        id: item?.id,
        productId: item?.productId,
        name: item?.name,
        price: item?.price,
        image: item?.image ? 'has image' : 'no image',
        quantity: item?.quantity
      })));
      setCartItems(items || []);
      console.log('🛒 Cart loaded from backend:', items?.length || 0, 'items');
    } catch (error) {
      console.error('❌ Failed to load cart:', error);
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  
  useEffect(() => {
    loadCart(); // Load cart regardless of user state
  }, [user]); // Reload when user changes

  const updateQuantity = async (productId: string, variant: any, newQuantity: number) => {
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
    return cartItems.reduce((total, item) => {
      if (!item) return total;
      const itemPrice = item.price || 0;
      const itemQuantity = item.quantity || 1;
      return total + (itemPrice * itemQuantity);
    }, 0);
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
          <div className="w-16 h-16 border-4 border-gray-300 border-t-pink-500 rounded-full animate-spin mb-4"></div>
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
        </div>
      </div>

      <div className="p-4 space-y-4">
        {cartItems.map((item, index) => {
          // Safety checks for item properties
          if (!item) {
            console.error('❌ Cart item is null or undefined at index:', index);
            return null;
          }

          const itemPrice = item.price || 0;
          const itemQuantity = item.quantity || 1;
          const itemTotal = itemPrice * itemQuantity;

          const itemName = item.name || 'Product';
          const itemImage = item.image || `data:image/svg+xml;base64,${btoa('<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" fill="#f3f4f6"/><text x="40" y="45" text-anchor="middle" fill="#6b7280" font-size="12" font-family="Arial">Product</text></svg>')}`;
          const productId = item.productId || item.id || `product-${index}`;
          const variant = item.variant || {};

          return (
            <div key={`${productId}-${variant.size || 'default'}-${variant.color || 'default'}`} className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex space-x-4">
                <img
                  src={itemImage}
                  alt={itemName}
                  className="w-20 h-20 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-1">{itemName}</h3>

                  {variant && (variant.size || variant.color) && (
                    <p className="text-sm text-gray-500 mb-2">
                      Ukuran: {variant.size || 'Standard'} | Warna: {variant.color || 'Default'}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-pink-600">
                        Rp {itemPrice.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                        {itemQuantity > 1 ? (
                          <button
                            onClick={() => updateQuantity(productId, variant, itemQuantity - 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => removeFromCart(productId, variant)}
                            className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <span className="w-8 text-center font-semibold">{itemQuantity}</span>
                        <button
                          onClick={() => updateQuantity(productId, variant, itemQuantity + 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
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
        }).filter(Boolean)}
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