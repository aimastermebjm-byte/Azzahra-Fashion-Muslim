import React from 'react';
import { useRealTimeCartOptimized } from '../hooks/useRealTimeCartOptimized';
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
  const { cartItems, loading, error, updateQuantity: updateCartItem, removeFromCart: removeCartItem, getCartTotal } = useRealTimeCartOptimized();

  const handleUpdateQuantity = async (productId: string, variant: any, newQuantity: number) => {
    try {
      // Find the item in cart to get its ID
      const item = cartItems.find((item: any) =>
        item.productId === productId &&
        JSON.stringify(item.variant) === JSON.stringify(variant)
      );

      if (!item) {
        console.error('❌ Item not found in cart');
        return;
      }

      if (newQuantity === 0) {
        await removeCartItem(item.id);
      } else {
        await updateCartItem(item.id, newQuantity);
      }
    } catch (error) {
      console.error('❌ Failed to update quantity:', error);
    }
  };

  const handleRemoveFromCart = async (productId: string, variant: any) => {
    try {
      // Find the item in cart to get its ID
      const item = cartItems.find((item: any) =>
        item.productId === productId &&
        JSON.stringify(item.variant) === JSON.stringify(variant)
      );

      if (!item) {
        console.error('❌ Item not found in cart');
        return;
      }

      await removeCartItem(item.id);
    } catch (error) {
      console.error('❌ Failed to remove from cart:', error);
    }
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total: number, item: any) => {
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
          <div className="w-16 h-16 border-4 border-gray-300 border-t-brand-accent rounded-full animate-spin mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Memuat Keranjang...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-surface">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="flex items-center p-4">
            <button onClick={onBack} className="mr-4">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-lg font-semibold">Keranjang Belanja</h1>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center h-96">
          <ShoppingBag className="w-16 h-16 text-red-300 mb-4" />
          <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Cart</h3>
          <p className="text-gray-500 text-center mb-6">{error}</p>
          <button
            onClick={onBack}
            className="btn-brand px-8"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-brand-surface">
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
            className="btn-brand px-8"
          >
            Mulai Belanja
          </button>
        </div>
      </div>
    );
  }

  const totalPrice = getTotalPrice();

  return (
    <div className="min-h-screen bg-brand-surface pb-32">
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4">
          <button onClick={onBack} className="mr-4">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold">Keranjang Belanja</h1>
          <span className="ml-2 bg-brand-accentMuted text-brand-primary text-xs px-2 py-1 rounded-full">
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
                      <span className="text-lg font-bold text-brand-accent">
                        Rp {itemPrice.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                        {itemQuantity > 1 ? (
                          <button
                            onClick={() => handleUpdateQuantity(productId, variant, itemQuantity - 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRemoveFromCart(productId, variant)}
                            className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <span className="w-8 text-center font-semibold">{itemQuantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(productId, variant, itemQuantity + 1)}
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
          <span className="text-xl font-bold text-brand-accent">
            Rp {totalPrice.toLocaleString('id-ID')}
          </span>
        </div>
        
        <button
          onClick={onCheckout}
          className="w-full btn-brand text-center"
        >
          Checkout Sekarang
        </button>
      </div>
    </div>
  );
};

export default CartPage;