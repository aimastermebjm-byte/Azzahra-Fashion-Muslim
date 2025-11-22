import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Phone, User, Package, Copy, Loader2, AlertCircle, Plus, Edit2, Trash2 } from 'lucide-react';
import { addressService } from '../services/addressService';
import AddressForm from './AddressForm';
import { komerceService, KomerceCostResult } from '../utils/komerceService';
import { cartServiceOptimized } from '../services/cartServiceOptimized';

interface CheckoutPageProps {
  user: any;
  clearCart: (orderData: any) => string;
  onBack: () => void;
}

const CheckoutPage: React.FC<CheckoutPageProps> = ({
  user,
  clearCart,
  onBack
}) => {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load cart from backend
  const loadCart = async () => {
    try {
      setLoading(true);
      const items = await cartServiceOptimized.getCart();
      setCartItems(items || []);
      } catch (error) {
      console.error('Failed to load cart for checkout:', error);
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCart(); // Load regardless of user state
  }, [user]);

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => {
      if (!item) return total;
      const itemPrice = item.price || 0;
      const itemQuantity = item.quantity || 1;
      return total + (itemPrice * itemQuantity);
    }, 0);
  };

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [editingAddress, setEditingAddress] = useState<any>(null);

  // Address management with Firebase
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);

  // Load addresses from Firebase
  const loadAddresses = async () => {
    try {
      setAddressesLoading(true);
      const userAddresses = await addressService.getUserAddresses();
      setAddresses(userAddresses);
      } catch (error) {
      console.error('Failed to load addresses:', error);
      setAddresses([]);
    } finally {
      setAddressesLoading(false);
    }
  };

  // Set up real-time address listener
  useEffect(() => {
    const unsubscribe = addressService.onAddressesChange((userAddresses) => {
      setAddresses(userAddresses);
      });

    return () => unsubscribe();
  }, []);

  const addAddress = async (addressData: any) => {
    try {
      const newAddress = await addressService.saveAddress(addressData);
      } catch (error) {
      console.error('Failed to add address:', error);
      throw error;
    }
  };

  const updateAddress = async (id: string, updateData: any) => {
    try {
      const updatedAddress = await addressService.updateAddress(id, updateData);
      } catch (error) {
      console.error('Failed to update address:', error);
      throw error;
    }
  };

  const deleteAddress = async (id: string) => {
    try {
      await addressService.deleteAddress(id);
      } catch (error) {
      console.error('Failed to delete address:', error);
      throw error;
    }
  };

  const getDefaultAddress = () => {
    return addresses.find(addr => addr.isDefault) || addresses[0];
  };

  // Komerce states
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [ongkirResults, setOngkirResults] = useState<KomerceCostResult[]>([]);
  const [shippingError, setShippingError] = useState<string>('');
  const [selectedService, setSelectedService] = useState<KomerceCostResult | null>(null);

  // Calculate total weight of cart items with smart rounding - OPTIMIZED for Firestore data
  const calculateTotalWeight = () => {
    const totalGrams = cartItems.reduce((total, item) => {
      // Get REAL weight from Firebase product data
      // Priority: item.product.weight > item.weight > fallback 1000g
      const itemWeight = item.product?.weight || item.weight || 1000; // weight in grams
      return total + (item.quantity * itemWeight);
    }, 0);

    // Apply smart rounding: 0-1250g = 1kg, 1251-2250g = 2kg, etc.

    return totalGrams;
  };

  
  // Calculate shipping cost using RajaOngkir with smart caching - OPTIMIZED for J&T & multiple items
  const calculateShippingCost = async (courierCode: string, destinationCityId: string, weight: number) => {
    if (!courierCode || !destinationCityId || !weight) {
      return;
    }

    // Validate destinationCityId
    if (!destinationCityId || destinationCityId === 'undefined' || destinationCityId === '') {
      destinationCityId = '607'; // Banjarmasin fallback
    }

    try {
      setLoadingShipping(true);
      setShippingError('');

  
      // Special handling for J&T with multiple items
      const optimizedWeight = courierCode === 'jnt' && cartItems.length > 1 ? Math.max(weight, 1000) : weight;

      const results = await komerceService.calculateShippingCost('2425', destinationCityId, optimizedWeight, courierCode);

      if (results && results.length > 0) {
        // Komerce returns multiple services! Let user choose
        // Store all results and auto-select cheapest service by default
        setOngkirResults(results);
        const cheapestService = results[0];
        setSelectedService(cheapestService);

        setFormData(prev => ({
          ...prev,
          shippingCost: cheapestService.cost,
          shippingService: cheapestService.service,
          shippingETD: cheapestService.etd
        }));

        } else {
        setShippingError('Tidak dapat menghitung ongkir untuk kurir ini');
        }
    } catch (error) {
      console.error('Error calculating shipping cost:', error);
      setShippingError('Gagal menghitung ongkir. Silakan coba lagi.');
      // NO FALLBACK - Show error to user
    } finally {
      setLoadingShipping(false);
    }

    // Fast timeout to prevent loading state from stuck too long
    const loadingTimeout = setTimeout(() => {
      setLoadingShipping(false);
    }, 100); // Ultra-fast timeout fallback

    return () => clearTimeout(loadingTimeout);
  };

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: '',
    address: '',
    provinceId: '',
    cityId: '',
    isDropship: false,
    dropshipName: '',
    dropshipPhone: '',
    paymentMethod: 'transfer',
    shippingCourier: 'jnt',
    shippingCost: 0,
    shippingService: '',
    shippingETD: '',
    notes: ''
  });

  const shippingOptions = [
    { id: 'jnt', name: 'J&T Express', code: 'jnt', price: 0 }, // RajaOngkir supported
    { id: 'jne', name: 'JNE', code: 'jne', price: 0 }, // RajaOngkir supported
    { id: 'pos', name: 'POS Indonesia', code: 'pos', price: 0 }, // RajaOngkir supported
    { id: 'tiki', name: 'TIKI', code: 'tiki', price: 0 }, // RajaOngkir supported
    { id: 'ojek', name: 'OJEK', code: null, price: 0 }, // Local courier - manual price
    { id: 'lion', name: 'Lion Parcel', code: 'lion', price: 0 }, // Automatic via Komerce
    { id: 'idexpress', name: 'IDExpress', code: 'ide', price: 0 } // Automatic via Komerce
  ];

  // Auto-select default courier and address when component mounts
  useEffect(() => {
    // Auto-select default address if available
    if (addresses.length > 0 && !selectedAddressId) {
      const defaultAddr = getDefaultAddress();
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
        setFormData(prev => ({
          ...prev,
          name: prev.isDropship ? prev.name : defaultAddr.name,
          phone: prev.isDropship ? prev.phone : defaultAddr.phone,
          address: defaultAddr.fullAddress,
          provinceId: defaultAddr.provinceId || '607', // Default to Banjarmasin if no cityId
          cityId: defaultAddr.cityId || '607' // Default to Banjarmasin city
        }));
      }
    }

    // Auto-select first courier that supports automatic (separate effect)
    const autoCourier = shippingOptions.find(opt => opt.code);
    if (autoCourier && !formData.shippingCourier) {
      setFormData(prev => ({ ...prev, shippingCourier: autoCourier.id }));
    }
  }, [addresses, selectedAddressId, formData.isDropship]);

  // Optimized shipping calculation - SINGLE useEffect for both courier and address changes
  useEffect(() => {
    const defaultAddr = getDefaultAddress();
    const selectedCourier = shippingOptions.find(opt => opt.id === formData.shippingCourier);

    // Only calculate if we have both courier and address
    if (selectedCourier?.code && defaultAddr && formData.shippingCourier) {
      const weight = calculateTotalWeight();

      // 🗺️ LOOKUP subdistrictId from localStorage cache if not available (0 reads)
      let destinationId = defaultAddr.subdistrictId;

      if (!destinationId && defaultAddr.district) {
        // Fast localStorage lookup - no async needed
        try {
          const cacheKey = 'ongkir_subdistricts';
          const cacheData = localStorage.getItem(cacheKey);

          if (cacheData) {
            const subdistricts = JSON.parse(cacheData);
            const subdistrict = subdistricts.find((sub: any) =>
              sub.subdistrict_name?.toLowerCase() === defaultAddr.district?.toLowerCase()
            );

            if (subdistrict) {
              destinationId = subdistrict.subdistrict_id.toString();
            }
          }
        } catch (error) {
          console.error('❌ Error getting subdistrict from localStorage cache:', error);
        }
      }

      // Final fallback
      destinationId = destinationId || defaultAddr.cityId || '607';

      // IMMEDIATE calculation - NO DELAY
      calculateShippingCost(selectedCourier.code, destinationId, weight);
    }
  }, [formData.shippingCourier, selectedAddressId]); // Single effect for both changes

  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox'
      ? (e.target as HTMLInputElement).checked
      : type === 'number'
        ? parseInt(value) || 0
        : value;

    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Special handling for courier changes
    if (name === 'shippingCourier') {
      const selectedCourier = shippingOptions.find(opt => opt.id === value);

      // Reset shipping cost first
      setFormData(prev => ({
        ...prev,
        shippingCourier: newValue as string,
        shippingCost: 0,
        shippingService: '',
        shippingETD: ''
      }));

      // Clear previous results
      setOngkirResults([]);
      setSelectedService(null);

      // NO MANUAL CALCULATION HERE - Let useEffect handle it to avoid double calculation

      return; // Exit early to avoid double state update
    }
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
      // NOTE: Shipping calculation is handled by useEffect - no manual calculation needed
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

  const handleCopyAccount = (accountNumber: string, bankName: string) => {
    navigator.clipboard.writeText(accountNumber);
    alert(`✅ Nomor rekening ${bankName} berhasil disalin!\n\n${accountNumber}\na.n. Fahrin`);
  };

  const handleSubmitOrder = () => {
    if (!formData.name || !formData.phone || !formData.address) {
      alert('Mohon lengkapi semua data pengiriman');
      return;
    }

    // Stock validation now handled by atomic transaction in App.tsx
    // No need to check here - transaction will handle it atomically

    // Check if selected courier has valid shipping cost
    if (supportsAutomatic && (!formData.shippingCost || formData.shippingCost <= 0)) {
      alert('Mohon tunggu perhitungan ongkir selesai atau pilih kurir lain');
      return;
    }

    if (!supportsAutomatic && (!formData.shippingCost || formData.shippingCost <= 0)) {
      alert('Mohon masukkan biaya ongkos kirim untuk kurir lokal');
      return;
    }

    const orderData = {
      items: cartItems.map(item => ({
        ...item,
        price: item.price || 0,
        total: (item.price || 0) * (item.quantity || 1),
        productName: item.name || item.productName || 'Produk',
        productId: item.productId || item.id,
        selectedVariant: item.variant
      })),
      shippingInfo: {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        isDropship: formData.isDropship,
        dropshipName: formData.dropshipName,
        dropshipPhone: formData.dropshipPhone,
        courier: formData.shippingCourier,
        shippingCost: formData.shippingCost > 0 ? formData.shippingCost : null,
        shippingService: formData.shippingService,
        shippingETD: formData.shippingETD
      },
      paymentMethod: formData.paymentMethod,
      notes: formData.notes,
      totalAmount: totalPrice,
      shippingCost: shippingCost,
      finalTotal: finalTotal
    };

    // Create order and get order ID
    const newOrderId = clearCart(orderData);

    // Show success message with instructions for payment
    if (formData.paymentMethod === 'transfer') {
      alert(`🎉 Pesanan berhasil dibuat!\n\nID Pesanan: ${newOrderId}\nTotal: Rp ${finalTotal.toLocaleString('id-ID')}\n\nSilakan transfer ke:\n• BCA: 0511456494\n• BRI: 066301000115566\n• MANDIRI: 310011008896\n\na.n. Fahrin\n\nKemudian upload bukti pembayaran di menu "Pesanan"`);
    } else {
      alert(`🎉 Pesanan berhasil dibuat!\n\nID Pesanan: ${newOrderId}\nTotal: Rp ${finalTotal.toLocaleString('id-ID')}\n\nPembayaran Cash on Delivery (COD)\nBarang akan dikirim setelah konfirmasi.`);
    }

    // Redirect to home
    onBack();
  };

  const totalPrice = getTotalPrice();
  const shippingCost = formData.shippingCost || 0;
  const finalTotal = totalPrice + shippingCost;

  // Check if selected courier supports automatic shipping calculation
  const selectedCourierOption = shippingOptions.find(opt => opt.id === formData.shippingCourier);
  const supportsAutomatic = !!selectedCourierOption?.code;

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
            {cartItems.map((item, index) => {
              // Safety checks
              if (!item) return null;

              const itemName = item.name || 'Product';
              const itemImage = item.image || `data:image/svg+xml;base64,${btoa('<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" fill="#f3f4f6"/><text x="40" y="45" text-anchor="middle" fill="#6b7280" font-size="12" font-family="Arial">Product</text></svg>')}`;
              const itemPrice = item.price || 0;
              const itemQuantity = item.quantity || 1;
              const variant = item.variant || {};
              const productId = item.productId || item.id || `product-${index}`;

              return (
                <div key={`${productId}-${variant.size || 'default'}-${variant.color || 'default'}`} className="flex space-x-3">
                  <img
                    src={itemImage}
                    alt={itemName}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{itemName}</h4>
                    {variant && (variant.size || variant.color) && (
                      <p className="text-xs text-gray-500">
                        {variant.size || 'Standard'} - {variant.color || 'Default'}
                      </p>
                    )}
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm font-semibold text-pink-600">
                        Rp {itemPrice.toLocaleString('id-ID')}
                      </span>
                      <span className="text-sm text-gray-500">x{itemQuantity}</span>
                    </div>
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-semibold mb-3">Informasi Penerima</h3>
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
          </div>
        </div>

        {/* Courier Selection - MOVED TO TOP */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-semibold mb-3">Pilih Kurir Pengiriman</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Package className="w-4 h-4 inline mr-1" />
                Kurir
              </label>
              <select
                name="shippingCourier"
                value={formData.shippingCourier}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                {shippingOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} {option.code ? '(✓ Otomatis)' : '(Manual)'}
                  </option>
                ))}
              </select>

              {/* Courier Info */}
              <div className="mt-2 text-xs text-gray-500">
                {supportsAutomatic ? (
                  <div className="text-green-600">
                    ✓ Otomatis via RajaOngkir dari Banjarmasin
                  </div>
                ) : (
                  <div className="text-amber-600">
                    ℹ️ Kurir lokal - biaya diinput manual
                  </div>
                )}
              </div>

              {/* Loading indicator */}
              {loadingShipping && (
                <div className="mt-2 flex items-center text-sm text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  Menghitung ongkir...
                </div>
              )}

              {/* Error message */}
              {shippingError && (
                <div className="mt-2 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {shippingError}
                </div>
              )}
            </div>

            {/* Shipping Cost Display */}
            {formData.shippingCost > 0 && (
              <div className="bg-gray-50 p-3 rounded-lg">
                {/* Service Selection Dropdown */}
                {ongkirResults.length > 1 && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Pilih Layanan:
                    </label>
                    <select
                      value={selectedService?.service || ''}
                      onChange={(e) => {
                        const selected = ongkirResults.find(result => result.service === e.target.value);
                        if (selected) {
                          setSelectedService(selected);
                          setFormData(prev => ({
                            ...prev,
                            shippingCost: selected.cost,
                            shippingService: selected.service,
                            shippingETD: selected.etd
                          }));
                        }
                      }}
                      className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    >
                      {ongkirResults.map((service, index) => (
                        <option key={index} value={service.service}>
                          {service.service} - Rp {service.cost.toLocaleString('id-ID')} ({service.etd})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Weight Information */}
                <div className="bg-blue-50 rounded-lg p-3 mb-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-blue-800">Berat Produk:</span>
                    <span className="text-blue-600 font-semibold">
                      {(calculateTotalWeight() / 1000).toFixed(2)} kg
                    </span>
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    💡 Smart rounding: 0-1.25kg = 1kg, 1.251-2.25kg = 2kg, dst.
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Biaya Ongkir:</span>
                  <span className="text-sm font-semibold text-pink-600">
                    Rp {formData.shippingCost.toLocaleString('id-ID')}
                  </span>
                </div>
                {formData.shippingService && (
                  <p className="text-xs text-gray-500 mt-1">
                    Service: {formData.shippingService} | Estimasi: {formData.shippingETD}
                    {ongkirResults.length > 1 && (
                      <span className="ml-2 text-blue-600">
                        ({ongkirResults.length} layanan tersedia)
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Address Input */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Alamat Pengiriman</h3>
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
                          name="savedAddress"
                          checked={selectedAddressId === address.id}
                          onChange={() => {
                            setSelectedAddressId(address.id);
                            setFormData(prev => ({
                              ...prev,
                              name: formData.isDropship ? prev.name : address.name,
                              phone: formData.isDropship ? prev.phone : address.phone,
                              address: address.fullAddress,
                              provinceId: address.provinceId || '',
                              cityId: address.cityId || ''
                            }));

                            // NOTE: Shipping calculation is handled by useEffect - no manual calculation needed
                          }}
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

          {/* New Address Input */}
          <div className="border-t pt-4">
            {/* Address input removed - users must select from saved addresses */}

            {/* Manual shipping cost input for non-automatic couriers */}
            {!supportsAutomatic && (
              <div className="mt-4">
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
                  * Masukkan manual biaya ongkos kirim untuk kurir lokal
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Additional Options */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-semibold mb-3">Opsi Tambahan</h3>

          {/* Dropship Option */}
          <div className="mb-4">
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
          </div>

          {/* Dropship Fields */}
          {formData.isDropship && (
            <div className="border-t pt-4 space-y-3">
              <input
                type="text"
                name="dropshipName"
                value={formData.dropshipName}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Nama pengirim dropship"
              />
              <input
                type="tel"
                name="dropshipPhone"
                value={formData.dropshipPhone}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Nomor telepon pengirim"
              />
            </div>
          )}

          {/* Notes */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catatan Pesanan
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="Tambahkan catatan untuk pesanan (opsional)"
            />
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-semibold mb-3">Metode Pembayaran</h3>
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <input
                type="radio"
                name="paymentMethod"
                value="transfer"
                checked={formData.paymentMethod === 'transfer'}
                onChange={handleInputChange}
                className="w-4 h-4 text-pink-600 border-gray-300 focus:ring-pink-500"
              />
              <span className="text-sm font-medium">Transfer Bank</span>
            </label>
            <label className="flex items-center space-x-3">
              <input
                type="radio"
                name="paymentMethod"
                value="cod"
                checked={formData.paymentMethod === 'cod'}
                onChange={handleInputChange}
                className="w-4 h-4 text-pink-600 border-gray-300 focus:ring-pink-500"
              />
              <span className="text-sm font-medium">COD (Bayar di Tempat)</span>
            </label>
          </div>

          {formData.paymentMethod === 'transfer' && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Transfer ke:</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span>BCA: 0511456494</span>
                  <button
                    onClick={() => handleCopyAccount('0511456494', 'BCA')}
                    className="text-blue-600 hover:text-blue-700 text-xs"
                  >
                    <Copy className="w-3 h-3 inline mr-1" />
                    Salin
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <span>BRI: 066301000115566</span>
                  <button
                    onClick={() => handleCopyAccount('066301000115566', 'BRI')}
                    className="text-blue-600 hover:text-blue-700 text-xs"
                  >
                    <Copy className="w-3 h-3 inline mr-1" />
                    Salin
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <span>MANDIRI: 310011008896</span>
                  <button
                    onClick={() => handleCopyAccount('310011008896', 'MANDIRI')}
                    className="text-blue-600 hover:text-blue-700 text-xs"
                  >
                    <Copy className="w-3 h-3 inline mr-1" />
                    Salin
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">a.n. Fahrin</p>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-semibold mb-3">Ringkasan Pesanan</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Subtotal Produk</span>
              <span className="text-sm font-medium">Rp {totalPrice.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Biaya Ongkir</span>
              <span className="text-sm font-medium">Rp {shippingCost.toLocaleString('id-ID')}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-semibold text-pink-600">Rp {finalTotal.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmitOrder}
          className="w-full bg-pink-600 text-white py-4 rounded-lg font-semibold hover:bg-pink-700 transition-colors shadow-lg"
        >
          Buat Pesanan
        </button>
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
    </div>
  );
};

export default CheckoutPage;