import React, { useState, useEffect } from 'react';
import { MapPin, Phone, User, Package, Copy, Loader2, AlertCircle, Plus, Edit2, Trash2 } from 'lucide-react';
import { addressService } from '../services/addressService';
import AddressForm from './AddressForm';
import { komerceService, KomerceCostResult } from '../utils/komerceService';
import { cartServiceOptimized } from '../services/cartServiceOptimized';
import PageHeader from './PageHeader';
import EmptyState from './ui/EmptyState';
import { CardSkeleton, ListSkeleton } from './ui/Skeleton';
import { useToast } from './ToastProvider';
import { financialService, PaymentMethod } from '../services/financialService';

interface CheckoutPageProps {
  user: any;
  clearCart: (orderData: any, cartItems: any[]) => string;
  onBack: () => void;
  selectedCartItemIds?: string[];
}

const CheckoutPage: React.FC<CheckoutPageProps> = ({
  user,
  clearCart,
  onBack,
  selectedCartItemIds = []
}) => {
  const [allCartItems, setAllCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);

  // Load cart from backend
  const loadCart = async () => {
    try {
      setLoading(true);
      const items = await cartServiceOptimized.getCart();
      setAllCartItems(items || []);
      } catch (error) {
      console.error('Failed to load cart for checkout:', error);
      setAllCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCart(); // Load regardless of user state
  }, [user]);

  // Filter cart items based on selected IDs
  const cartItems = selectedCartItemIds.length > 0
    ? allCartItems.filter(item => selectedCartItemIds.includes(item.id))
    : allCartItems;

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

  useEffect(() => {
    loadAddresses();
  }, [user]);

  // Set up real-time address listener
  useEffect(() => {
    const unsubscribe = addressService.onAddressesChange((userAddresses) => {
      setAddresses(userAddresses);
      setAddressesLoading(false);
      });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    const loadPaymentMethods = async () => {
      try {
        const methods = await financialService.listPaymentMethods();
        if (!active) return;
        setPaymentMethods(methods);
        if (methods.length > 0) {
          // Default to "Transfer Bank" if available, otherwise first method
          const transferMethod = methods.find(m => m.name.toLowerCase().includes('transfer') || m.name.toLowerCase().includes('bank'));
          const defaultMethodId = transferMethod ? transferMethod.id : methods[0].id;
          setFormData(prev => prev.paymentMethodId ? prev : { ...prev, paymentMethodId: defaultMethodId });
        }
      } catch (error) {
        console.error('Failed to load payment methods for checkout:', error);
      } finally {
        if (active) {
          setPaymentMethodsLoading(false);
        }
      }
    };

    loadPaymentMethods();
    return () => {
      active = false;
    };
  }, []);

  const addAddress = async (addressData: any) => {
    try {
      const newAddress = await addressService.saveAddress(addressData);
      return newAddress;
    } catch (error) {
      console.error('Failed to add address:', error);
      throw error;
    }
  };

  const updateAddress = async (id: string, updateData: any) => {
    try {
      const updatedAddress = await addressService.updateAddress(id, updateData);
      return updatedAddress;
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

  const getActiveAddress = () => {
    if (selectedAddressId) {
      return addresses.find(addr => addr.id === selectedAddressId) || null;
    }
    return getDefaultAddress() || null;
  };

  const buildDestinationCandidates = (address?: any) => {
    const candidates: { id: string; label: string }[] = [];

    const normalizeId = (value?: string | number | null) => {
      if (!value && value !== 0) return '';
      return String(value).trim();
    };

    const subdistrictId = normalizeId(address?.subdistrictId);
    const districtId = normalizeId(address?.districtId);

    if (subdistrictId) {
      candidates.push({ id: subdistrictId, label: 'Kelurahan/Desa' });
    }
    if (districtId) {
      candidates.push({ id: districtId, label: 'Kecamatan' });
    }

    // Deduplicate by destination id
    return candidates.filter(
      (candidate, index, self) => candidate.id && self.findIndex(item => item.id === candidate.id) === index
    );
  };

  // Komerce states
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [ongkirResults, setOngkirResults] = useState<KomerceCostResult[]>([]);
  const [shippingError, setShippingError] = useState<string>('');
  const [selectedService, setSelectedService] = useState<KomerceCostResult | null>(null);
  const [shippingCost, setShippingCost] = useState<number>(0);

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

  
  // Calculate shipping cost using RajaOngkir with localStorage cache PRIORITY - 0 reads for cached results
  const calculateShippingCost = async (
    courierCode: string,
    destinationCandidates: { id: string; label: string }[],
    weight: number
  ) => {
    if (!courierCode || !destinationCandidates?.length || !weight) {
      return;
    }

    const cleanedCandidates = destinationCandidates
      .map(candidate => ({ ...candidate, id: candidate.id?.toString().trim() || '' }))
      .filter(candidate => candidate.id && candidate.id !== 'undefined');

    if (!cleanedCandidates.length) {
      setShippingError('Alamat belum lengkap. Mohon pilih kecamatan/kelurahan terlebih dahulu.');
      setFormData(prev => ({
        ...prev,
        shippingCost: 0,
        shippingService: '',
        shippingETD: ''
      }));
      setShippingCost(0);
      return;
    }

    const optimizedWeight = courierCode === 'jnt' && cartItems.length > 1 ? Math.max(weight, 1000) : weight;
    const callRajaOngkirDirectAPI = async (
      destinationId: string
    ): Promise<KomerceCostResult[]> => {
      const response = await fetch('/api/rajaongkir/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: '2425', // Banjarmasin city ID
          destination: destinationId,
          weight: optimizedWeight,
          courier: courierCode,
          price: 'lowest'
        })
      });

      if (!response.ok) {
        throw new Error(`RajaOngkir API Error: ${response.status}`);
      }

      const data = await response.json();
      if (data.meta && data.meta.status === 'success' && data.meta.code === 200) {
        if (!data.data || data.data.length === 0) {
          throw new Error('No shipping services available for this destination');
        }

        return data.data.map((service: any) => ({
          name: service.courier_name || courierCode.toUpperCase(),
          code: courierCode,
          service: service.service,
          description: service.service_name || service.description,
          cost: service.price || service.cost,
          etd: service.etd || '1-2 days'
        }));
      }

      const errorMessage = data.meta?.message || data.rajaongkir?.status?.description || 'Unknown API error';
      throw new Error(errorMessage);
    };

    const applyShippingResult = (
      results: KomerceCostResult[],
      cacheKey: string,
      destinationId: string,
      destinationLabel: string,
      shouldPersistCache: boolean
    ) => {
      if (!results.length) return false;

      setOngkirResults(results);
      const cheapestService = results[0];
      setSelectedService(cheapestService);

      if (shouldPersistCache) {
        localStorage.setItem(cacheKey, JSON.stringify({ data: results, timestamp: Date.now() }));
        console.log(`💾 ONGKIR CACHE SAVED: ${courierCode} → ${destinationId} (${optimizedWeight}g)`);
      }

      setFormData(prev => ({
        ...prev,
        shippingCost: cheapestService.cost,
        shippingService: cheapestService.service,
        shippingETD: cheapestService.etd
      }));
      setShippingCost(cheapestService.cost);
      console.log(`✅ Ongkir ${courierCode} pakai ${destinationLabel} (${destinationId})`);
      return true;
    };

    setLoadingShipping(true);
    setShippingError('');

    let lastError: unknown = null;
    let resolved = false;

    try {
      for (const candidate of cleanedCandidates) {
        const cacheKey = `ongkos_${courierCode}_${candidate.id}_${optimizedWeight}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
          try {
            const { data, timestamp } = JSON.parse(cachedData);
            const now = Date.now();

            if (now - timestamp < 30 * 24 * 60 * 60 * 1000 && data?.length) {
              console.log(`🚀 ONGKIR CACHE HIT: ${courierCode} → ${candidate.id} (${optimizedWeight}g)`);
              resolved = applyShippingResult(data, cacheKey, candidate.id, candidate.label, false);
              if (resolved) break;
            } else if (now - timestamp >= 30 * 24 * 60 * 60 * 1000) {
              localStorage.removeItem(cacheKey);
            }
          } catch (parseError) {
            console.error('❌ Error parsing ongkir cache:', parseError);
            localStorage.removeItem(cacheKey);
          }
        }

        try {
          console.log(`📡 ONGKIR FETCH: ${courierCode} (${candidate.label}) → ${candidate.id}`);
          const results = await callRajaOngkirDirectAPI(candidate.id);
          resolved = applyShippingResult(results, cacheKey, candidate.id, candidate.label, true);
          if (resolved) {
            break;
          }
        } catch (error) {
          lastError = error;
          console.warn(`⚠️ Ongkir gagal (${candidate.label}):`, error);
        }
      }

      if (!resolved) {
        console.error('❌ Tidak ada kurir yang menjangkau tujuan ini', lastError);
        setShippingError('Tujuan tidak terjangkau untuk kurir ini. Coba ganti kurir atau alamat.');
        setFormData(prev => ({
          ...prev,
          shippingCost: 0,
          shippingService: '',
          shippingETD: ''
        }));
        setShippingCost(0);
      }
    } finally {
      setLoadingShipping(false);
      setTimeout(() => setLoadingShipping(false), 120);
    }
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
    paymentMethodId: '',
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

  const selectedPaymentMethod = paymentMethods.find(method => method.id === formData.paymentMethodId);

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

  // 🔥 CRITICAL FIX: Trigger shipping calculation AFTER addresses are fully loaded
  useEffect(() => {
    const defaultAddr = getActiveAddress();
    const autoCourier = shippingOptions.find(opt => opt.code);

    console.log('🔍 AUTO-CALC DEBUG:', {
      autoCourier: autoCourier?.code,
      hasDefaultAddr: !!defaultAddr,
      shippingCourier: formData.shippingCourier,
      addressesLoaded: addresses.length > 0,
      shouldTrigger: !!(autoCourier && defaultAddr && formData.shippingCourier === autoCourier.id && addresses.length > 0)
    });

    // 🔥 IMPORTANT: Only trigger if we have courier, address, AND addresses are loaded
    if (autoCourier && defaultAddr && formData.shippingCourier === autoCourier.id && addresses.length > 0) {
      const weight = calculateTotalWeight();
      console.log('🚀 AUTO-CALCULATION: Triggering shipping cost for auto-selected courier:', {
        courier: autoCourier.code,
        courierId: formData.shippingCourier,
        hasDefaultAddr: !!defaultAddr,
        addressesLoaded: addresses.length > 0,
        weight: weight,
        cartItemsCount: cartItems.length,
        hasValidWeight: weight > 0
      });

      // Only calculate if we have valid weight
      if (weight <= 0) {
        console.log('⚠️ SKIP: Weight is 0, waiting for cart items to load...');
        return;
      }

      const destinationCandidates = buildDestinationCandidates(defaultAddr);

      // Trigger calculation with longer delay to ensure UI is updated
      setTimeout(() => {
        if (autoCourier.code) {
          calculateShippingCost(autoCourier.code, destinationCandidates, weight);
        }
      }, 500); // Longer delay to ensure address UI is fully loaded
    }
  }, [formData.shippingCourier, addresses, cartItems, selectedAddressId]); // Also trigger when cart items load with valid weight

  // Optimized shipping calculation - SINGLE useEffect for both courier and address changes
  useEffect(() => {
    const defaultAddr = getActiveAddress();
    const selectedCourier = shippingOptions.find(opt => opt.id === formData.shippingCourier);

    console.log('🔍 SHIPPING DEBUG:', {
      selectedCourier,
      hasDefaultAddr: !!defaultAddr,
      shippingCourier: formData.shippingCourier,
      courierCode: selectedCourier?.code,
      defaultAddrData: defaultAddr ? {
        id: defaultAddr.id,
        fullAddress: defaultAddr.fullAddress,
        subdistrictId: defaultAddr.subdistrictId,
        district: defaultAddr.district,
        cityId: defaultAddr.cityId
      } : null
    });

    // Only calculate if we have both courier and address
    if (selectedCourier?.code && defaultAddr && formData.shippingCourier) {
      const weight = calculateTotalWeight();
      const destinationCandidates = buildDestinationCandidates(defaultAddr);

      // IMMEDIATE calculation - NO DELAY
      calculateShippingCost(selectedCourier.code, destinationCandidates, weight);
    }
  }, [formData.shippingCourier, selectedAddressId, addresses]); // Single effect for both changes

  
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
    const defaultAddr = getActiveAddress();
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
        address: formData.isDropship ? prev.address : address.fullAddress,
        provinceId: address.provinceId || prev.provinceId,
        cityId: address.cityId || prev.cityId,
        shippingCost: 0,
        shippingService: '',
        shippingETD: ''
      }));
      setOngkirResults([]);
      setSelectedService(null);
      // NOTE: Shipping calculation is handled by useEffect - no manual calculation needed
    }
  };

  const handleSaveAddress = async (addressData: any) => {
    try {
      if (editingAddress) {
        await updateAddress(editingAddress.id, addressData);
        setSelectedAddressId(editingAddress.id);
      } else {
        const created = await addAddress(addressData);
        if (created?.id) {
          setSelectedAddressId(created.id);
        }
      }
      setShowAddressModal(false);
      setEditingAddress(null);
    } catch (error) {
      console.error('Failed to save address:', error);
      showToast({
        type: 'danger',
        title: 'Gagal menyimpan alamat',
        message: 'Periksa koneksi dan coba lagi.'
      });
    }
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
    showToast({
      type: 'success',
      title: 'Nomor rekening disalin',
      message: `${bankName} ${accountNumber} siap ditempel.`
    });
  };

  const handleSubmitOrder = () => {
    if (!formData.name || !formData.phone || !formData.address) {
      showToast({
        type: 'warning',
        title: 'Data belum lengkap',
        message: 'Lengkapi nama, telepon, dan alamat penerima.'
      });
      return;
    }

    // Stock validation now handled by atomic transaction in App.tsx
    // No need to check here - transaction will handle it atomically

    // Check if selected courier has valid shipping cost
    if (supportsAutomatic && (!formData.shippingCost || formData.shippingCost <= 0)) {
      showToast({
        type: 'warning',
        title: 'Ongkir belum siap',
        message: 'Tunggu perhitungan ongkir selesai atau pilih kurir lain.'
      });
      return;
    }

    if (!supportsAutomatic && (!formData.shippingCost || formData.shippingCost <= 0)) {
      showToast({
        type: 'warning',
        title: 'Isi biaya ongkir',
        message: 'Masukkan biaya ongkos kirim untuk kurir lokal.'
      });
      return;
    }

    if (!selectedPaymentMethod) {
      showToast({
        type: 'warning',
        title: 'Metode pembayaran belum siap',
        message: 'Hubungi admin untuk menambahkan metode pembayaran.'
      });
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
      paymentMethod: selectedPaymentMethod.name,
      notes: formData.notes,
      paymentMethodId: selectedPaymentMethod.id,
      paymentMethodName: selectedPaymentMethod.name,
      totalAmount: totalPrice,
      shippingCost: shippingFee,
      finalTotal: finalTotal
    };

    // Create order and get order ID (pass cartItems to eliminate duplicate read)
    const newOrderId = clearCart(orderData, cartItems);

    // Show success message with instructions for payment
    showToast({
      type: 'success',
      title: 'Pesanan berhasil dibuat',
      message: `ID Pesanan ${newOrderId} siap diproses. Cek detail di menu Pesanan.`
    });

    // Redirect to home
    onBack();
  };

  const totalPrice = getTotalPrice();
  const shippingFee = formData.shippingCost || shippingCost || 0;
  const finalTotal = totalPrice + shippingFee;
  const cartCount = cartItems?.length || 0;

  // Check if selected courier supports automatic shipping calculation
  const selectedCourierOption = shippingOptions.find(opt => opt.id === formData.shippingCourier);
  const supportsAutomatic = !!selectedCourierOption?.code;

  return (
    <div className="min-h-screen bg-brand-surface pb-16">
      <PageHeader
        title="Checkout"
        subtitle={cartCount > 0 ? `${cartCount} produk siap dikirim` : 'Review detail pesanan sebelum konfirmasi pembayaran'}
        onBack={onBack}
        variant="card"
        actions={(
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total sementara</p>
            <p className="text-2xl font-bold text-brand-primary">Rp {finalTotal.toLocaleString('id-ID')}</p>
          </div>
        )}
      />

      <div className="mx-auto max-w-6xl px-4 pb-16">
        {loading ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
            <CardSkeleton lines={6} />
            <CardSkeleton lines={4} />
          </div>
        ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
          <div className="space-y-6">
        {/* Address Input */}
        <div className="rounded-2xl border border-white/40 bg-white/95 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Alamat Pengiriman</h3>
            <button
              onClick={() => {
                setEditingAddress(null);
                setShowAddressModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-brand-primary/30 px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/5"
            >
              <Plus className="h-4 w-4" />
              Tambah Alamat
            </button>
          </div>

          {/* Address Selection */}
          {addressesLoading ? (
            <ListSkeleton items={3} />
          ) : addresses.length > 0 ? (
            <div className="mb-4 space-y-2">
              {addresses.map((address) => (
                <label
                  key={address.id}
                  className={`block rounded-2xl border p-3 transition ${
                    selectedAddressId === address.id
                      ? 'border-brand-primary bg-brand-primary/5 shadow-sm'
                      : 'border-slate-200 hover:border-brand-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
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
                          }}
                          className="h-4 w-4 text-brand-primary"
                        />
                        <span className="text-sm font-semibold text-slate-900">{address.name}</span>
                        {address.isDefault && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                            Utama
                          </span>
                        )}
                      </div>
                      <p className="ml-6 text-xs text-slate-500">{address.phone}</p>
                      <p className="ml-6 text-sm text-slate-600">{address.fullAddress}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingAddress(address);
                          setShowAddressModal(true);
                        }}
                        className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:text-brand-primary"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {addresses.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAddress(address.id);
                          }}
                          className="rounded-full border border-slate-200 p-2 text-rose-500 transition hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Belum ada alamat"
              description="Tambahkan alamat pengiriman untuk mempercepat proses checkout."
              action={(
                <button onClick={() => setShowAddressModal(true)} className="btn-brand">
                  Tambah Alamat Baru
                </button>
              )}
            />
          )}

          {/* Manual shipping cost input for non-automatic couriers */}
          {!supportsAutomatic && (
            <div className="mt-4 border-t border-dashed border-slate-200 pt-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Biaya Ongkos Kirim (Rp)
              </label>
              <input
                type="number"
                name="shippingCost"
                value={formData.shippingCost || ''}
                onChange={handleInputChange}
                min="0"
                className="w-full rounded-xl border border-slate-200 p-3 focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                placeholder="Masukkan biaya ongkos kirim"
              />
              <p className="mt-1 text-xs text-slate-500">
                * Masukkan manual biaya ongkos kirim untuk kurir lokal
              </p>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="rounded-2xl border border-white/40 bg-white/95 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Produk Pesanan</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{cartCount} produk</span>
          </div>
          <div className="mt-4 space-y-3">
            {cartCount === 0 ? (
              <EmptyState
                compact
                title="Belum ada produk"
                description="Silakan kembali ke katalog untuk menambahkan produk ke keranjang."
                action={(
                  <button onClick={onBack} className="btn-brand">
                    Kembali Belanja
                  </button>
                )}
              />
            ) : (
            cartItems.map((item, index) => {
              // Safety checks
              if (!item) return null;

              const itemName = item.name || 'Product';
              const itemImage = item.image || `data:image/svg+xml;base64,${btoa('<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" fill="#f3f4f6"/><text x="40" y="45" text-anchor="middle" fill="#6b7280" font-size="12" font-family="Arial">Product</text></svg>')}`;
              const itemPrice = item.price || 0;
              const itemQuantity = item.quantity || 1;
              const variant = item.variant || {};
              const productId = item.productId || item.id || `product-${index}`;

              return (
                <div key={`${productId}-${variant.size || 'default'}-${variant.color || 'default'}`} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/70 p-3">
                  <img
                    src={itemImage}
                    alt={itemName}
                    className="h-16 w-16 rounded-lg object-cover shadow-sm"
                  />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-900">{itemName}</h4>
                    {variant && (variant.size || variant.color) && (
                      <p className="text-xs text-slate-500">
                        {variant.size || 'Standard'} · {variant.color || 'Default'}
                      </p>
                    )}
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-semibold text-brand-primary">
                        Rp {itemPrice.toLocaleString('id-ID')}
                      </span>
                      <span className="text-xs text-slate-500">x{itemQuantity}</span>
                    </div>
                  </div>
                </div>
              );
            }).filter(Boolean)
            )}
          </div>
        </div>

        {/* Courier Selection */}
        <div className="rounded-2xl border border-white/40 bg-white/95 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Pilih Kurir Pengiriman</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Package className="h-4 w-4 text-brand-primary" />
                Kurir
              </label>
              <select
                name="shippingCourier"
                value={formData.shippingCourier}
                onChange={handleInputChange}
                className="w-full rounded-xl border border-slate-200 p-3 focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                {shippingOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} {option.code ? '(✓ Otomatis)' : '(Manual)'}
                  </option>
                ))}
              </select>

              {/* Courier Info */}
              <div className="mt-2 text-xs text-slate-500">
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
                <div className="mt-2 flex items-center text-sm text-brand-primary">
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Menghitung ongkir...
                </div>
              )}

              {/* Error message */}
              {shippingError && (
                <div className="mt-2 flex items-center text-sm text-red-600">
                  <AlertCircle className="mr-1 h-4 w-4" />
                  {shippingError}
                </div>
              )}
            </div>

            {/* Shipping Cost Display */}
            {shippingFee > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
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
                      className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    >
                      {ongkirResults.map((service, index) => (
                        <option key={index} value={service.service}>
                          {service.service} - Rp {service.cost.toLocaleString('id-ID')} ({service.etd})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Biaya Ongkir:</span>
                  <span className="text-sm font-semibold text-brand-primary">
                    Rp {shippingFee.toLocaleString('id-ID')}
                  </span>
                </div>
                {formData.shippingService && (
                  <p className="mt-1 text-xs text-slate-500">
                    Service: {formData.shippingService} | Estimasi: {formData.shippingETD}
                    {ongkirResults.length > 1 && (
                      <span className="ml-2 text-brand-primary">
                        ({ongkirResults.length} layanan tersedia)
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Payment Method */}
        <div className="rounded-2xl border border-white/40 bg-white/95 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Metode Pembayaran</h3>
          {paymentMethodsLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, idx) => (
                <div key={idx} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
              Metode pembayaran belum dikonfigurasi. Silakan hubungi admin agar dapat melanjutkan checkout.
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <label key={method.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${formData.paymentMethodId === method.id ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-200 bg-white'}`}>
                  <input
                    type="radio"
                    name="paymentMethodId"
                    value={method.id}
                    checked={formData.paymentMethodId === method.id}
                    onChange={handleInputChange}
                    className="h-4 w-4 border-slate-300 text-brand-primary focus:ring-brand-primary"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{method.name}</p>
                    <p className="text-xs text-slate-500">Metode pembayaran toko</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {selectedPaymentMethod && selectedPaymentMethod.name.toLowerCase().includes('transfer') && (
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">Transfer ke:</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>BCA: 0511456494</span>
                  <button
                    onClick={() => handleCopyAccount('0511456494', 'BCA')}
                    className="text-xs font-semibold text-brand-primary hover:text-brand-primary/80"
                  >
                    <Copy className="mr-1 inline h-3 w-3" />
                    Salin
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span>BRI: 066301000115566</span>
                  <button
                    onClick={() => handleCopyAccount('066301000115566', 'BRI')}
                    className="text-xs font-semibold text-brand-primary hover:text-brand-primary/80"
                  >
                    <Copy className="mr-1 inline h-3 w-3" />
                    Salin
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span>MANDIRI: 310011008896</span>
                  <button
                    onClick={() => handleCopyAccount('310011008896', 'MANDIRI')}
                    className="text-xs font-semibold text-brand-primary hover:text-brand-primary/80"
                  >
                    <Copy className="mr-1 inline h-3 w-3" />
                    Salin
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">a.n. Fahrin</p>
            </div>
          )}
        </div>

        {/* Additional Options */}
        <div className="rounded-2xl border border-white/40 bg-white/95 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Opsi Tambahan</h3>

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catatan Pesanan
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-3 focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              placeholder="Tambahkan catatan untuk pesanan (opsional)"
            />
          </div>

          {/* Dropship Option */}
          <div className="border-t pt-4">
            <label className="flex items-center space-x-3 mb-4">
              <input
                type="checkbox"
                name="isDropship"
                checked={formData.isDropship}
                onChange={handleInputChange}
                className="h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
              />
              <span className="text-sm font-medium text-slate-700">Kirim sebagai dropship</span>
            </label>

            {/* Dropship Fields */}
            {formData.isDropship && (
              <div className="space-y-3">
                <input
                  type="text"
                  name="dropshipName"
                  value={formData.dropshipName}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 p-3 focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="Nama pengirim dropship"
                />
                <input
                  type="tel"
                  name="dropshipPhone"
                  value={formData.dropshipPhone}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 p-3 focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="Nomor telepon pengirim"
                />
              </div>
            )}
          </div>
        </div>

          </div>
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="rounded-2xl border border-white/40 bg-white/95 p-5 shadow-lg lg:sticky lg:top-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total Pembayaran</p>
                  <p className="text-2xl font-bold text-brand-primary">Rp {finalTotal.toLocaleString('id-ID')}</p>
                </div>
                <div className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
                  {selectedPaymentMethod?.name || 'Metode belum dipilih'}
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Subtotal Produk</span>
                  <span className="font-semibold text-slate-900">Rp {totalPrice.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Biaya Ongkir</span>
                  <span className="font-semibold text-slate-900">Rp {shippingFee.toLocaleString('id-ID')}</span>
                </div>
                {formData.shippingService && (
                  <div className="text-xs text-slate-500">
                    Kurir: {formData.shippingCourier?.toUpperCase()} · {formData.shippingService} ({formData.shippingETD || 'estimasi cepat'})
                  </div>
                )}
              </div>
              <button
                onClick={handleSubmitOrder}
                className="btn-brand mt-6 w-full text-center"
              >
                Buat Pesanan
              </button>
              <p className="mt-3 text-center text-xs text-slate-500">
                Dengan melanjutkan, kamu menyetujui syarat & ketentuan Azzahra Fashion Muslim.
              </p>
            </div>

            <div className="rounded-2xl border border-dashed border-brand-primary/30 bg-brand-primary/5 p-4 text-sm text-slate-600">
              <h4 className="text-base font-semibold text-brand-primary">Tips Checkout</h4>
              <ul className="mt-3 space-y-2 list-disc pl-4">
                <li>Pastikan alamat lengkap beserta RT/RW dan patokan lokasi.</li>
                <li>Untuk dropship, isi nama & nomor pengirim agar tercetak di resi.</li>
                <li>Upload bukti transfer di menu Pesanan setelah pembayaran.</li>
              </ul>
            </div>
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
    </div>
  );
};

export default CheckoutPage;