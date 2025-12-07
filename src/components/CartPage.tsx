import React, { useState, useMemo } from 'react';
import { useRealTimeCartOptimized } from '../hooks/useRealTimeCartOptimized';
import { Plus, Minus, Trash2, ShoppingBag, ShieldCheck, Truck } from 'lucide-react';
import PageHeader from './PageHeader';
import EmptyState from './ui/EmptyState';

interface CartPageProps {
  user: any;
  onBack: () => void;
  onCheckout: (selectedItemIds: string[]) => void;
}

const CartPage: React.FC<CartPageProps> = ({
  user,
  onBack,
  onCheckout
}) => {
  const { cartItems, loading, error, updateQuantity: updateCartItem, removeFromCart: removeCartItem, removeBulkFromCart: removeBulkCartItems, getCartTotal } = useRealTimeCartOptimized();
  
  // State untuk checkbox selection
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Select all items by default when cart loads
  React.useEffect(() => {
    if (cartItems.length > 0 && selectedItems.size === 0) {
      const allItemIds = cartItems.map(item => item.id);
      setSelectedItems(new Set(allItemIds));
    }
  }, [cartItems]);

  // Update quantity using item ID directly
  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    try {
      if (newQuantity === 0) {
        await removeCartItem(itemId);
      } else {
        await updateCartItem(itemId, newQuantity);
      }
    } catch (error) {
      console.error('❌ Failed to update quantity:', error);
    }
  };

  // Remove single item
  const handleRemoveFromCart = async (itemId: string) => {
    try {
      await removeCartItem(itemId);
      // Also remove from selection
      const newSelection = new Set(selectedItems);
      newSelection.delete(itemId);
      setSelectedItems(newSelection);
    } catch (error) {
      console.error('❌ Failed to remove from cart:', error);
    }
  };

  // Bulk delete selected items
  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    
    const itemCount = selectedItems.size; // Save count before clearing
    const confirmDelete = window.confirm(`Hapus ${itemCount} produk dari keranjang?`);
    if (!confirmDelete) return;

    try {
      // Delete all selected items in one Firestore operation (no race condition)
      const itemIdsToDelete = Array.from(selectedItems);
      await removeBulkCartItems(itemIdsToDelete);
      
      // Clear selection after successful delete
      setSelectedItems(new Set());
      console.log(`✅ Berhasil menghapus ${itemCount} produk`);
    } catch (error) {
      console.error('❌ Failed to bulk delete:', error);
    }
  };

  // Toggle item selection
  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedItems.size === cartItems.length) {
      setSelectedItems(new Set());
    } else {
      const allItemIds = cartItems.map(item => item.id);
      setSelectedItems(new Set(allItemIds));
    }
  };

  // Calculate total for selected items only
  const getTotalPrice = () => {
    return cartItems.reduce((total: number, item: any) => {
      if (!item || !selectedItems.has(item.id)) return total;
      const itemPrice = item.price || 0;
      const itemQuantity = item.quantity || 1;
      return total + (itemPrice * itemQuantity);
    }, 0);
  };

  const totalPrice = getTotalPrice();
  const cartCount = cartItems?.length || 0;
  const selectedCount = selectedItems.size;
  const orderSubtotal = totalPrice;
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
        {/* Select All Checkbox & Bulk Delete */}
        <div className="rounded-2xl border border-white/40 bg-white/95 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedItems.size === cartItems.length && cartItems.length > 0}
                onChange={toggleSelectAll}
                className="h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
              />
              <span className="font-semibold text-slate-900">
                Pilih Semua ({cartItems.length} produk)
              </span>
            </label>
            
            {selectedItems.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
              >
                <Trash2 className="h-4 w-4" />
                Hapus ({selectedItems.size})
              </button>
            )}
          </div>
        </div>

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

                const isSelected = selectedItems.has(item.id);

                return (
                  <div key={`${productId}-${variant.size || 'default'}-${variant.color || 'default'}`} className={`rounded-2xl border p-4 shadow-sm transition-all ${isSelected ? 'border-brand-primary bg-brand-primary/5' : 'border-white/40 bg-white/95'}`}>
                    <div className="flex flex-col gap-4 sm:flex-row">
                      {/* Checkbox */}
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleItemSelection(item.id)}
                          className="mt-1 h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
                        />
                        <img
                          src={itemImage}
                          alt={itemName}
                          className="h-24 w-24 rounded-xl object-cover"
                        />
                      </div>
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
                            <button
                              onClick={() => handleUpdateQuantity(item.id, itemQuantity - 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-slate-200"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-semibold">{itemQuantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, itemQuantity + 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-slate-200"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* Trash button separately */}
                          <button
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="rounded-lg p-2 text-rose-500 transition-colors hover:bg-rose-50"
                            title="Hapus produk"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                <span>Produk Dipilih</span>
                <span className="font-semibold text-slate-900">{selectedCount} dari {cartCount}</span>
              </div>
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
              onClick={() => onCheckout(Array.from(selectedItems))}
              disabled={selectedCount === 0}
              className="btn-brand mt-4 w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Checkout ({selectedCount} Produk)
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