
import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Truck, Archive, CreditCard, ChevronRight, Gift, Tag, Trash2, Edit2, AlertCircle, ShoppingBag, Package, Loader2 } from 'lucide-react';
import { addressService } from '../services/addressService';
import AddressForm from './AddressForm';
import { komerceService, KomerceCostResult } from '../utils/komerceService';
import { cartServiceOptimized } from '../services/cartServiceOptimized';
import PageHeader from './PageHeader';
import EmptyState from './ui/EmptyState';
import { CardSkeleton, ListSkeleton } from './ui/Skeleton';
import { useToast } from './ToastProvider';
import { financialService, PaymentMethod } from '../services/financialService';
import { voucherService } from '../services/voucherService';
import { Voucher } from '../types/voucher';
// ✅ SIMPLIFIED: No longer needed at checkout
// Unique code generation moved to OrdersPage when customer is ready to pay

interface CheckoutPageProps {
  user: any;
  clearCart: (orderData: any, cartItems: any[]) => Promise<string | null>;
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

  // Voucher states
  const [userVouchers, setUserVouchers] = useState<Voucher[]>([]);
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);

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

  // Load user vouchers
  useEffect(() => {
    const loadUserVouchers = async () => {
      if (!user?.uid) return;
      try {
        const vouchers = await voucherService.getVouchersForUser(user.uid);
        setUserVouchers(vouchers);
      } catch (error) {
        console.error('Failed to load vouchers:', error);
      }
    };
    loadUserVouchers();
  }, [user]);

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
        throw new Error(`RajaOngkir API Error: ${response.status} `);
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
      }

      setFormData(prev => ({
        ...prev,
        shippingCost: cheapestService.cost,
        shippingService: cheapestService.service,
        shippingETD: cheapestService.etd
      }));
      setShippingCost(cheapestService.cost);
      return true;
    };

    setLoadingShipping(true);
    setShippingError('');

    let lastError: unknown = null;
    let resolved = false;

    try {
      for (const candidate of cleanedCandidates) {
        const cacheKey = `ongkos_${courierCode}_${candidate.id}_${optimizedWeight} `;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
          try {
            const { data, timestamp } = JSON.parse(cachedData);
            const now = Date.now();

            if (now - timestamp < 30 * 24 * 60 * 60 * 1000 && data?.length) {
              resolved = applyShippingResult(data, cacheKey, candidate.id, candidate.label, false);
              if (resolved) break;
            } else if (now - timestamp >= 30 * 24 * 60 * 60 * 1000) {
              localStorage.removeItem(cacheKey);
            }
          } catch (parseError) {
            localStorage.removeItem(cacheKey);
          }
        }

        try {
          const results = await callRajaOngkirDirectAPI(candidate.id);
          resolved = applyShippingResult(results, cacheKey, candidate.id, candidate.label, true);
          if (resolved) {
            break;
          }
        } catch (error) {
          lastError = error;
        }
      }

      if (!resolved) {
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

  // Shipping mode: 'delivery' = kirim ke alamat, 'keep' = atur alamat nanti
  // Default to 'keep' for reseller/admin/owner (they usually stock products)
  const userRole = user?.role || 'customer';
  const defaultMode = ['reseller', 'admin', 'owner'].includes(userRole) ? 'keep' : 'delivery';
  const [shippingMode, setShippingMode] = useState<'delivery' | 'keep'>(defaultMode);

  // Reset shipping cost when switching to 'keep' mode
  useEffect(() => {
    if (shippingMode === 'keep') {
      setShippingCost(0);
      setFormData(prev => ({
        ...prev,
        shippingCost: 0,
        shippingService: '',
        shippingETD: ''
      }));
    }
  }, [shippingMode]);

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

  // 🔥 UNIFIED shipping calculation effect - ONE useEffect only to prevent infinite loops
  // Use ref to track last calculation params and prevent duplicate calls
  const lastShippingCalcRef = React.useRef<string>('');

  useEffect(() => {
    const defaultAddr = getActiveAddress();
    const selectedCourier = shippingOptions.find(opt => opt.id === formData.shippingCourier);

    // Skip if missing required data
    if (!selectedCourier?.code || !defaultAddr || addresses.length === 0) {
      return;
    }

    const weight = calculateTotalWeight();
    if (weight <= 0) {
      return; // Wait for cart items to load
    }

    // Create unique key for this calculation
    const calcKey = `${selectedCourier.code}_${defaultAddr.subdistrictId || defaultAddr.districtId}_${weight} `;

    // Skip if we already calculated for these exact params
    if (lastShippingCalcRef.current === calcKey) {
      return;
    }

    const destinationCandidates = buildDestinationCandidates(defaultAddr);

    // Mark as calculated BEFORE calling to prevent race conditions
    lastShippingCalcRef.current = calcKey;

    // Use timeout to debounce
    const timeoutId = setTimeout(() => {
      calculateShippingCost(selectedCourier.code!, destinationCandidates, weight);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [formData.shippingCourier, selectedAddressId, addresses.length, cartItems.length]);


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
      // Reset shipping cost first
      setFormData(prev => ({
        ...prev,
        shippingCourier: newValue as string,
        shippingCost: 0,
        shippingService: '',
        shippingETD: ''
      }));

      // Clear previous results and reset calc tracker
      setOngkirResults([]);
      setSelectedService(null);
      lastShippingCalcRef.current = ''; // Reset to allow new calculation

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
        type: 'error',
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

  // Apply voucher handlers
  const handleApplyVoucher = async (voucher?: Voucher) => {
    const codeToApply = voucher?.code || voucherCode.trim().toUpperCase();
    if (!codeToApply) {
      showToast({ message: 'Masukkan kode voucher', type: 'warning' });
      return;
    }

    setVoucherLoading(true);
    try {
      const result = await voucherService.validateVoucher(codeToApply, user?.uid, getTotalPrice());
      if (result.valid && result.voucher) {
        setAppliedVoucher(result.voucher);
        setVoucherCode('');
        showToast({ message: `Voucher ${result.voucher.code} berhasil digunakan! Diskon Rp ${result.voucher.discountAmount.toLocaleString('id-ID')} `, type: 'success' });
      } else {
        showToast({ message: result.message || 'Voucher tidak valid', type: 'error' });
      }
    } catch (error) {
      showToast({ message: 'Gagal memvalidasi voucher', type: 'error' });
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    showToast({ message: 'Voucher dihapus', type: 'info' });
  };

  const handleSubmitOrder = async () => {
    console.log('🛒 CHECKOUT DEBUG: handleSubmitOrder called!', {
      shippingMode,
      formData,
      selectedPaymentMethod,
      cartItems: cartItems.length,
      totalPrice,
      loading
    });
    // Validasi alamat hanya jika mode 'delivery'
    if (shippingMode === 'delivery') {
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

      // Check if selected courier has valid shipping cost (only for delivery mode)
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
    }

    if (!selectedPaymentMethod) {
      showToast({
        type: 'warning',
        title: 'Metode pembayaran belum siap',
        message: 'Hubungi admin untuk menambahkan metode pembayaran.'
      });
      return;
    }

    // ✅ SIMPLIFIED: No unique code at checkout
    // Unique code will be generated when customer decides to pay

    // Hitung shipping fee berdasarkan mode
    const effectiveShippingFee = shippingMode === 'keep' ? 0 : shippingFee;
    const effectiveFinalTotal = Math.max(0, totalPrice + effectiveShippingFee - voucherDiscount);

    const orderData = {
      items: cartItems.map(item => ({
        ...item,
        price: item.price || 0,
        total: (item.price || 0) * (item.quantity || 1),
        productName: item.name || item.productName || 'Produk',
        productId: item.productId || item.id,
        productImage: item.image || item.productImage || item.images?.[0] || '',
        selectedVariant: item.variant,
        category: item.category || ''
      })),
      shippingInfo: shippingMode === 'keep' ? {
        name: user?.displayName || 'Belum diatur',
        phone: user?.phone || 'Belum diatur',
        address: 'Belum ditentukan (Keep)',
        isDropship: false,
        dropshipName: '',
        dropshipPhone: '',
        courier: null,
        shippingCost: null,
        shippingService: '',
        shippingETD: ''
      } : {
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
      // ✨ NEW: Shipping mode fields
      shippingMode: shippingMode,
      shippingConfigured: shippingMode === 'delivery', // true jika sudah lengkap
      paymentMethod: selectedPaymentMethod.name,
      notes: formData.notes,
      paymentMethodId: selectedPaymentMethod.id,
      paymentMethodName: selectedPaymentMethod.name,
      totalAmount: totalPrice,
      shippingCost: effectiveShippingFee,
      voucherCode: appliedVoucher?.code || null,
      voucherDiscount: voucherDiscount,
      finalTotal: effectiveFinalTotal
      // ✅ SIMPLIFIED: No unique code fields
      // These will be added when customer generates payment in OrdersPage
    };

    // Create order and get order ID (pass cartItems to eliminate duplicate read)
    const newOrderId = await clearCart(orderData, cartItems);

    // Handle case when order creation fails
    if (!newOrderId) {
      showToast({
        type: 'error',
        title: 'Gagal membuat pesanan',
        message: 'Terjadi kesalahan. Silakan coba lagi.'
      });
      return;
    }

    // Mark voucher as used AFTER order is created
    if (appliedVoucher) {
      try {
        await voucherService.useVoucher(appliedVoucher.id, newOrderId);
      } catch (error) {
        console.error('Failed to mark voucher as used:', error);
      }
    }

    // Show success message with instructions for payment
    showToast({
      type: 'success',
      title: 'Pesanan berhasil dibuat',
      message: `ID Pesanan ${newOrderId} siap diproses.Cek detail di menu Pesanan.`
    });

    // Redirect to home
    onBack();
  };

  const totalPrice = getTotalPrice();
  // Shipping fee is 0 for 'keep' mode (no delivery)
  const shippingFee = shippingMode === 'keep' ? 0 : (formData.shippingCost || shippingCost || 0);
  const voucherDiscount = appliedVoucher?.discountAmount || 0;
  const finalTotal = Math.max(0, totalPrice + shippingFee - voucherDiscount);
  const cartCount = cartItems?.length || 0;

  // ✅ SIMPLIFIED: Just show finalTotal (no unique code)
  const displayTotal = finalTotal;

  // Check if selected courier supports automatic shipping calculation
  const selectedCourierOption = shippingOptions.find(opt => opt.id === formData.shippingCourier);
  const supportsAutomatic = !!selectedCourierOption?.code;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <PageHeader
        title="Checkout"
        subtitle={cartCount > 0 ? `${cartCount} produk siap dikirim` : 'Review detail pesanan sebelum konfirmasi pembayaran'}
        onBack={onBack}
        variant="card"
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
              {/* ✨ Shipping Mode Toggle - Only show for PO items AND specific roles */}
              {(() => {
                // Check for PO items - check multiple possible field names
                const hasPOItems = cartItems.some((item: any) =>
                  item.status === 'po' ||
                  item.productStatus === 'po' ||
                  item.badge === 'po' ||
                  item.productBadge === 'po' ||
                  (item.status && item.status.toLowerCase() === 'po') ||
                  (item.badge && item.badge.toLowerCase() === 'po')
                );

                // Only show for reseller, admin, owner roles
                const allowedRoles = ['reseller', 'admin', 'owner'];
                const userRole = user?.role || 'customer';
                const isAllowedRole = allowedRoles.includes(userRole);

                if (!hasPOItems || !isAllowedRole) return null;

                return (
                  <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-md">
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Truck className="w-5 h-5 text-yellow-700" />
                      Mode Pengiriman
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <label
                        className={`flex items-center gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${shippingMode === 'delivery'
                          ? 'border-[#EBC66B] bg-yellow-50/30 shadow-md shadow-yellow-500/10'
                          : 'border-gray-200 hover:border-yellow-200 hover:shadow-sm'
                          }`}
                      >
                        <input
                          type="radio"
                          name="shippingMode"
                          value="delivery"
                          checked={shippingMode === 'delivery'}
                          onChange={() => setShippingMode('delivery')}
                          className="sr-only"
                        />
                        <Truck className={`w-7 h-7 ${shippingMode === 'delivery' ? 'text-yellow-500 drop-shadow-md' : 'text-gray-400'}`} />
                        <p className="font-bold text-gray-900">Kirim</p>
                      </label>

                      <label
                        className={`flex items-center gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${shippingMode === 'keep'
                          ? 'border-[#EBC66B] bg-yellow-50/30 shadow-md shadow-yellow-500/10'
                          : 'border-gray-200 hover:border-yellow-200 hover:shadow-sm'
                          }`}
                      >
                        <input
                          type="radio"
                          name="shippingMode"
                          value="keep"
                          checked={shippingMode === 'keep'}
                          onChange={() => setShippingMode('keep')}
                          className="sr-only"
                        />
                        <Archive className={`w-7 h-7 ${shippingMode === 'keep' ? 'text-yellow-500 drop-shadow-md' : 'text-gray-400'}`} />
                        <p className="font-bold text-gray-900">Keep</p>
                      </label>
                    </div>
                  </div>
                );
              })()}

              {/* Address Input - Only show when shippingMode is 'delivery' */}
              {shippingMode === 'delivery' && (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-md">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-yellow-700" />
                      Alamat Pengiriman
                    </h3>
                    <button
                      onClick={() => {
                        setEditingAddress(null);
                        setShowAddressModal(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-full border-2 border-yellow-500 px-4 py-2 text-sm font-bold text-yellow-600 transition hover:bg-yellow-50"
                    >
                      <Plus className="h-4 w-4" />
                      Tambah Alamat
                    </button>
                  </div>

                  {/* Address Selection */}
                  {addressesLoading ? (
                    <ListSkeleton items={3} />
                  ) : addresses.length > 0 ? (
                    <div className="mb-4 space-y-3">
                      {addresses.map((address) => (
                        <label
                          key={address.id}
                          className={`block rounded - xl border - 2 p - 4 transition cursor - pointer hover: shadow - sm ${selectedAddressId === address.id
                            ? 'border-yellow-500 bg-yellow-50/30 shadow-md shadow-yellow-500/10'
                            : 'border-gray-200 hover:border-yellow-400'
                            } `}
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
                                  className="h-4 w-4 text-yellow-600"
                                />
                                <span className="text-sm font-bold text-gray-900">{address.name}</span>
                                {address.isDefault && (
                                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
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
                                className="rounded-lg border border-gray-300 p-2 text-gray-600 transition hover:border-yellow-500 hover:text-yellow-600"
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
              )}

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
                      const itemImage = item.image || `data: image / svg + xml; base64, ${btoa('<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" fill="#f3f4f6"/><text x="40" y="45" text-anchor="middle" fill="#6b7280" font-size="12" font-family="Arial">Product</text></svg>')} `;
                      const itemPrice = item.price || 0;
                      const itemQuantity = item.quantity || 1;
                      const variant = item.variant || {};
                      const productId = item.productId || item.id || `product - ${index} `;

                      return (
                        <div key={`${productId} -${variant.size || 'default'} -${variant.color || 'default'} `} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/70 p-3">
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

              {/* Courier Selection - Only show when shippingMode is 'delivery' */}
              {shippingMode === 'delivery' && (
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
              )}

              {/* Payment Method */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-md">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-yellow-700" />
                  Metode Pembayaran
                </h3>
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
                      <label key={method.id} className={`flex items - center gap - 3 rounded - xl border - 2 px - 4 py - 3 transition cursor - pointer hover: shadow - sm ${formData.paymentMethodId === method.id ? 'border-[#EBC66B] bg-yellow-50/30 shadow-sm' : 'border-gray-200 hover:border-yellow-200'} `}>
                        <input
                          type="radio"
                          name="paymentMethodId"
                          value={method.id}
                          checked={formData.paymentMethodId === method.id}
                          onChange={handleInputChange}
                          className="h-4 w-4 border-gray-300 text-yellow-600 focus:ring-yellow-500"
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{method.name}</p>
                          <p className="text-xs text-slate-500">Metode pembayaran toko</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* ✅ SIMPLIFIED: No verification mode selection at checkout */}
              {/* Customers will choose auto/manual when ready to pay in OrdersPage */}

              {/* Voucher Section */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-md">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-yellow-700" />
                  Voucher
                </h3>

                {appliedVoucher ? (
                  <div className="bg-green-50 rounded-xl p-4 border-2 border-green-400 shadow-sm shadow-green-500/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono font-bold text-green-700">{appliedVoucher.code}</p>
                        <p className="text-sm text-green-600 font-semibold">
                          -Rp {appliedVoucher.discountAmount.toLocaleString('id-ID')}
                        </p>
                      </div>
                      <button
                        onClick={handleRemoveVoucher}
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Voucher code input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                        placeholder="Masukkan kode voucher..."
                        className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-xl text-sm font-mono uppercase focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition"
                      />
                      <button
                        onClick={() => handleApplyVoucher()}
                        disabled={voucherLoading || !voucherCode}
                        className="px-6 py-2.5 bg-[#EBC66B] hover:bg-[#DDAF4C] text-white rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                      >
                        {voucherLoading ? '...' : 'Pakai'}
                      </button>
                    </div>

                    {/* Available vouchers */}
                    {userVouchers.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-xs text-slate-500 mb-2">Voucher tersedia:</p>
                        <div className="space-y-2">
                          {userVouchers.map(v => (
                            <button
                              key={v.id}
                              onClick={() => handleApplyVoucher(v)}
                              disabled={getTotalPrice() < v.minPurchase}
                              className={`w - full text - left p - 3 rounded - lg border transition ${getTotalPrice() >= v.minPurchase
                                ? 'border-purple-200 bg-purple-50 hover:bg-purple-100'
                                : 'border-slate-200 bg-slate-50 opacity-60'
                                } `}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-mono text-sm font-bold text-purple-700">{v.code}</p>
                                  <p className="text-xs text-green-600">Diskon Rp {v.discountAmount.toLocaleString('id-ID')}</p>
                                  <p className="text-xs text-slate-500">Min. Rp {v.minPurchase.toLocaleString('id-ID')}</p>
                                </div>
                                <Tag className="w-4 h-4 text-purple-400" />
                              </div>
                              {getTotalPrice() < v.minPurchase && (
                                <p className="text-xs text-amber-600 mt-1">
                                  Belanja kurang Rp {(v.minPurchase - getTotalPrice()).toLocaleString('id-ID')} lagi
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
              {/* Order Summary - Desktop Sidebar */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-lg lg:sticky lg:top-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total Pembayaran</p>
                    <p className="text-2xl font-bold text-slate-900">
                      Rp {displayTotal.toLocaleString('id-ID')}
                    </p>
                    {/* ✅ SIMPLIFIED: No unique code display */}
                  </div>
                  <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
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
                    {shippingMode === 'keep' ? (
                      <span className="font-semibold text-amber-600">Belum dihitung</span>
                    ) : (
                      <span className="font-semibold text-slate-900">Rp {shippingFee.toLocaleString('id-ID')}</span>
                    )}
                  </div>
                  {appliedVoucher && (
                    <div className="flex items-center justify-between text-green-600">
                      <span className="flex items-center gap-1">
                        <Gift className="w-3 h-3" />
                        Diskon Voucher ({appliedVoucher.code})
                      </span>
                      <span className="font-semibold">-Rp {voucherDiscount.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  {formData.shippingService && (
                    <div className="text-xs text-slate-500">
                      Kurir: {formData.shippingCourier?.toUpperCase()} · {formData.shippingService} ({formData.shippingETD || 'estimasi cepat'})
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-5 text-sm text-gray-700">
                <h4 className="text-base font-bold text-yellow-700 flex items-center gap-2">💡 Tips Checkout</h4>
                <ul className="mt-3 space-y-2 list-disc pl-4 text-slate-700">
                  <li>Pastikan alamat lengkap beserta RT/RW dan patokan lokasi.</li>
                  <li>Untuk dropship, isi nama & nomor pengirim agar tercetak di resi.</li>
                  <li>Upload bukti transfer di menu Pesanan setelah pembayaran.</li>
                </ul>
              </div>
            </div>
          </div>
        )
        }
      </div>

      {/* Floating Checkout Button - Fixed Bottom */}
      {!loading && (
        <div className="fixed bottom-0 left-0 right-0 lg:bottom-4 lg:left-4 lg:right-4 z-40">
          <div className="bg-white/98 backdrop-blur-md shadow-2xl border-t lg:border lg:rounded-2xl border-gray-200 p-4">
            <div className="flex items-center justify-between gap-4 max-w-6xl mx-auto">
              {/* Total - Kiri */}
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Total Pembayaran</p>
                <p className="text-xl lg:text-2xl font-bold text-slate-900 truncate">
                  Rp {displayTotal.toLocaleString('id-ID')}
                </p>
                {/* ✅ SIMPLIFIED: No unique code display */}
              </div>

              {/* Button - Kanan */}
              <button
                onClick={handleSubmitOrder}
                className="relative h-12 px-8 rounded-full font-bold text-white text-base bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700 shadow-xl shadow-yellow-500/40 transition-all duration-200 active:scale-95 whitespace-nowrap flex-shrink-0 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/40 before:via-white/10 before:to-transparent before:rounded-full"
              >
                <span className="relative z-10">Buat Pesanan</span>
              </button>
            </div>
          </div>
        </div>
      )}

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