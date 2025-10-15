import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Phone, User, Package, CreditCard, Plus, Edit2, Trash2 } from 'lucide-react';
import { useAddresses } from '../hooks/useAddresses';
import AddressForm from './AddressForm';

interface CheckoutPageProps {
  cartItems: any[];
  user: any;
  getTotalPrice: () => number;
  clearCart: (orderData: any) => string;
  onBack: () => void;
}

const CheckoutPage: React.FC<CheckoutPageProps> = ({
  cartItems,
  user,
  getTotalPrice,
  clearCart,
  onBack
}) => {
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const { addresses, addAddress, updateAddress, deleteAddress, getDefaultAddress } = useAddresses();

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: '',
    address: '',
    isDropship: false,
    dropshipName: '',
    dropshipPhone: '',
    paymentMethod: 'transfer',
    shippingCourier: 'jnt',
    shippingCost: 0,
    notes: ''
  });

  const shippingOptions = [
    { id: 'ojek', name: 'OJEK', price: 0 },
    { id: 'jnt', name: 'J&T', price: 0 },
    { id: 'jne', name: 'JNE', price: 0 },
    { id: 'pos', name: 'POS Indonesia', price: 0 },
    { id: 'tiki', name: 'TIKI', price: 0 },
    { id: 'lion', name: 'Lion Parcel', price: 0 },
    { id: 'idexpress', name: 'ID Express', price: 0 }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : type === 'number'
          ? parseInt(value) || 0
          : value
    }));
  };

  
  useEffect(() => {
    const defaultAddr = getDefaultAddress();
    if (defaultAddr) {
      setSelectedAddressId(defaultAddr.id);
      setFormData(prev => ({
        ...prev,
        name: defaultAddr.name,
        phone: defaultAddr.phone,
        address: defaultAddr.fullAddress
      }));
    }
  }, [addresses]);

  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);
    const address = addresses.find(a => a.id === addressId);
    if (address) {
      setFormData(prev => ({
        ...prev,
        name: formData.isDropship ? prev.name : address.name,
        phone: formData.isDropship ? prev.phone : address.phone,
        address: formData.isDropship ? prev.address : address.fullAddress
      }));
    }
  };

  const handleSaveAddress = (addressData: any) => {
    if (editingAddress) {
      updateAddress(editingAddress.id, addressData);
    } else {
      addAddress(addressData);
    }
    setShowAddressModal(false);
    setEditingAddress(null);
  };

  const handleDeleteAddress = (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus alamat ini?')) {
      deleteAddress(id);
      if (selectedAddressId === id) {
        const newDefault = getDefaultAddress();
        if (newDefault) {
          handleAddressSelect(newDefault.id);
        }
      }
    }
  };

  const handleSubmitOrder = () => {
    if (!formData.name || !formData.phone || !formData.address) {
      alert('Mohon lengkapi semua data pengiriman');
      return;
    }

    const orderData = {
      shippingInfo: {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        isDropship: formData.isDropship,
        dropshipName: formData.dropshipName,
        dropshipPhone: formData.dropshipPhone,
        courier: formData.shippingCourier
      },
      paymentMethod: formData.paymentMethod,
      notes: formData.notes
    };

    // Create order and get order ID
    const newOrderId = clearCart(orderData);

    // Show success message with instructions for payment
    if (formData.paymentMethod === 'transfer') {
      alert(`🎉 Pesanan berhasil dibuat!\n\nID Pesanan: ${newOrderId}\nTotal: Rp ${finalTotal.toLocaleString('id-ID')}\n\nSilakan transfer ke:\n• BRI: 1234-5678-9012\n• BCA: 9876-5432-1098\n• Mandiri: 1122-3344-5566\n\nKemudian upload bukti pembayaran di menu "Pesanan"`);
    } else {
      alert(`🎉 Pesanan berhasil dibuat!\n\nID Pesanan: ${newOrderId}\nTotal: Rp ${finalTotal.toLocaleString('id-ID')}\n\nPembayaran Cash on Delivery (COD)\nBarang akan dikirim setelah konfirmasi.`);
    }

    // Redirect to home
    onBack();
  };

  
  const totalPrice = getTotalPrice();
  const shippingCost = formData.shippingCost || 0;
  const finalTotal = totalPrice + shippingCost;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4">
          <button onClick={onBack} className="mr-4">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold">Checkout</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Order Items */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-semibold mb-3">Produk Pesanan</h3>
          <div className="space-y-3">
            {cartItems.map((item) => (
              <div key={`${item.id}-${item.selectedVariant?.size}-${item.selectedVariant?.color}`} className="flex space-x-3">
                <img
                  src={item.images[0]}
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{item.name}</h4>
                  {item.selectedVariant && (
                    <p className="text-xs text-gray-500">
                      {item.selectedVariant.size} - {item.selectedVariant.color}
                    </p>
                  )}
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm font-semibold text-pink-600">
                      Rp {(user?.role === 'reseller' ? item.resellerPrice : item.retailPrice).toLocaleString('id-ID')}
                    </span>
                    <span className="text-sm text-gray-500">x{item.quantity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shipping Information */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Informasi Pengiriman</h3>
            <button
              onClick={() => setShowAddressModal(true)}
              className="text-pink-600 hover:text-pink-700 flex items-center text-sm font-medium"
            >
              <Plus className="w-4 h-4 mr-1" />
              Tambah Alamat
            </button>
          </div>

          {/* Address Selection */}
          {addresses.length > 0 && (
            <div className="space-y-2 mb-4">
              {addresses.map((address) => (
                <label
                  key={address.id}
                  className={`block p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedAddressId === address.id
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <input
                          type="radio"
                          name="address"
                          checked={selectedAddressId === address.id}
                          onChange={() => handleAddressSelect(address.id)}
                          className="w-4 h-4 text-pink-600 mr-2"
                        />
                        <span className="font-medium">{address.name}</span>
                        {address.isDefault && (
                          <span className="ml-2 text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">
                            Utama
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 ml-6">{address.phone}</p>
                      <p className="text-sm text-gray-600 ml-6">{address.fullAddress}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingAddress(address);
                          setShowAddressModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {addresses.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAddress(address.id);
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Dropship Fields (if enabled) */}
          {formData.isDropship && (
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm text-gray-700 mb-3">Informasi Pengirim (Dropship)</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  name="dropshipName"
                  value={formData.dropshipName}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Nama pengirim dropship"
                />
                <input
                  type="tel"
                  name="dropshipPhone"
                  value={formData.dropshipPhone}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Nomor telepon pengirim"
                />
              </div>
            </div>
          )}
        </div>

        {/* Address Modal */}
        {showAddressModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">
                {editingAddress ? 'Edit Alamat' : 'Tambah Alamat Baru'}
              </h3>
              <AddressForm
                initialData={editingAddress}
                onSave={handleSaveAddress}
                onCancel={() => {
                  setShowAddressModal(false);
                  setEditingAddress(null);
                }}
              />
            </div>
          </div>
        )}

        {/* Courier Selection */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-semibold mb-3">Kurir Pengiriman</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Nama Penerima
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Masukkan nama penerima"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-4 h-4 inline mr-1" />
                Nomor Telepon
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Masukkan nomor telepon"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="w-4 h-4 inline mr-1" />
                Alamat Lengkap
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Masukkan alamat lengkap"
              />
            </div>

            {/* Courier Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pilih Kurir Pengiriman
              </label>
              <select
                name="shippingCourier"
                value={formData.shippingCourier}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                {shippingOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Shipping Cost Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Biaya Ongkos Kirim (Rp)
              </label>
              <input
                type="number"
                name="shippingCost"
                value={formData.shippingCost || ''}
                onChange={handleInputChange}
                min="0"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Masukkan biaya ongkos kirim"
              />
              <p className="text-xs text-gray-500 mt-1">
                * Masukkan 0 jika gratis ongkir
              </p>
            </div>

            {/* Dropship Option */}
            <div className="border-t pt-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  name="isDropship"
                  checked={formData.isDropship}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                />
                <span className="text-sm font-medium text-gray-700">Kirim sebagai dropship</span>
              </label>

              {formData.isDropship && (
                <div className="mt-3 space-y-3 pl-7">
                  <input
                    type="text"
                    name="dropshipName"
                    value={formData.dropshipName}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Nama pengirim dropship"
                  />
                  <input
                    type="tel"
                    name="dropshipPhone"
                    value={formData.dropshipPhone}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Nomor telepon pengirim"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-semibold mb-3">Metode Pembayaran</h3>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="paymentMethod"
                value="transfer"
                checked={formData.paymentMethod === 'transfer'}
                onChange={handleInputChange}
                className="w-4 h-4 text-pink-600"
              />
              <CreditCard className="w-5 h-5 text-gray-400" />
              <span>Transfer Bank</span>
            </label>
            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="paymentMethod"
                value="cash"
                checked={formData.paymentMethod === 'cash'}
                onChange={handleInputChange}
                className="w-4 h-4 text-pink-600"
              />
              <Package className="w-5 h-5 text-gray-400" />
              <span>Cash on Delivery (COD)</span>
            </label>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-semibold mb-3">Ringkasan Pembayaran</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal ({cartItems.length} item)</span>
              <span>Rp {totalPrice.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Ongkos Kirim ({shippingOptions.find(o => o.id === formData.shippingCourier)?.name})</span>
              <span>Rp {shippingCost.toLocaleString('id-ID')}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-semibold text-lg">
                <span>Total Pembayaran</span>
                <span className="text-pink-600">Rp {finalTotal.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmitOrder}
          disabled={!formData.name || !formData.phone || !formData.address}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-lg font-semibold hover:from-pink-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Buat Pesanan
        </button>
      </div>
    </div>
  );
};

export default CheckoutPage;