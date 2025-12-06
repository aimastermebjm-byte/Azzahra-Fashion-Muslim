import React from 'react';
import { useRealTimeCartOptimized } from '../hooks/useRealTimeCartOptimized';
import { Plus, Minus, Trash2, ShoppingBag, ShieldCheck, Truck } from 'lucide-react';
import PageHeader from './PageHeader';
import EmptyState from './ui/EmptyState';

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

  const totalPrice = getTotalPrice();
  const cartCount = cartItems?.length || 0;
  const orderSubtotal = typeof getCartTotal === 'function' ? getCartTotal() : totalPrice;
  const formatCurrency = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;

  const pageHeader = (
    <div className="px-4 pt-4">
      <PageHeader
        title="Keranjang Belanja"
        subtitle={cartCount > 0 ? `${cartCount} produk siap checkout` : 'Belum ada produk dalam keranjang.'}
        onBack={onBack}
        variant="card"
        actions={cartCount > 0 ? (
          <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
            {cartCount} produk
          </span>
        ) : undefined}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-surface pb-24">
        {pageHeader}
        <div className="flex flex-col items-center justify-center py-24">
          <div className="mb-4 h-14 w-14 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary"></div>
          <p className="text-sm font-medium text-slate-500">Memuat keranjang...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-surface pb-24">
        {pageHeader}
        <div className="px-4">
          <EmptyState
            className="mx-auto mt-10 max-w-md"
            icon={<ShoppingBag className="h-10 w-10 text-rose-500" />}
            title="Gagal memuat keranjang"
            description={error}
            action={(
              <button onClick={onBack} className="btn-brand">
                Kembali
              </button>
            )}
          />
        </div>
      </div>
    );
  }

  if (cartCount === 0) {
    return (
      <div className="min-h-screen bg-brand-surface pb-24">
        {pageHeader}
        <div className="px-4">
          <EmptyState
            className="mx-auto mt-10 max-w-md"
            icon={<ShoppingBag className="h-10 w-10 text-brand-primary" />}
            title="Keranjang masih kosong"
            description="Belum ada produk yang ditambahkan. Jelajahi katalog dan temukan koleksi favoritmu!"
            action={(
              <button onClick={onBack} className="btn-brand">
                Mulai Belanja
              </button>
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface pb-32">
      {pageHeader}

      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="space-y-4">
            {cartItems
              .map((item, index) => {
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
                  <div key={`${productId}-${variant.size || 'default'}-${variant.color || 'default'}`} className="rounded-2xl border border-white/40 bg-white/95 p-4 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <img
                        src={itemImage}
                        alt={itemName}
                        className="h-24 w-24 rounded-xl object-cover"
                      />
                      <div className="flex-1">
                        <h3 className="mb-1 text-base font-semibold text-slate-900">{itemName}</h3>

                        {variant && (variant.size || variant.color) && (
                          <p className="mb-2 text-sm text-slate-500">
                            Ukuran: {variant.size || 'Standard'} | Warna: {variant.color || 'Default'}
                          </p>
                        )}

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center space-x-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                            <span>Rp {itemPrice.toLocaleString('id-ID')} / pcs</span>
                          </div>

                          <div className="flex items-center space-x-2 rounded-full bg-slate-100 px-2 py-1">
                            {itemQuantity > 1 ? (
                              <button
                                onClick={() => handleUpdateQuantity(productId, variant, itemQuantity - 1)}
                                className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-slate-200"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRemoveFromCart(productId, variant)}
                                className="flex h-8 w-8 items-center justify-center rounded-md text-rose-500 transition-colors hover:bg-rose-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            <span className="w-8 text-center font-semibold">{itemQuantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(productId, variant, itemQuantity + 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-slate-200"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                          <span>Total</span>
                          <span className="text-base font-semibold text-slate-900">
                            Rp {itemTotal.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
              .filter(Boolean)}
          </div>

          <div className="self-start rounded-2xl border border-white/40 bg-white/95 p-5 shadow-lg lg:sticky lg:top-4">
            <h3 className="text-lg font-semibold text-slate-900">Ringkasan Pesanan</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">{formatCurrency(orderSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Estimasi Ongkir</span>
                <span className="text-xs text-slate-500">Dihitung saat checkout</span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold text-slate-900">
                <span>Total</span>
                <span>{formatCurrency(orderSubtotal)}</span>
              </div>
            </div>
            <button
              onClick={onCheckout}
              className="btn-brand mt-4 w-full"
            >
              Lanjut ke Checkout
            </button>
            <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              <p className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-primary" />
                Pembayaran aman & bisa COD (opsional)
              </p>
              <p className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-brand-primary" />
                Pengiriman via ekspedisi terpercaya
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;