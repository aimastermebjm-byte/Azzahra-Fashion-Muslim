
import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Plus, Truck, Archive, CreditCard, ChevronRight, Gift, Tag, Trash2, Edit2, AlertCircle, ShoppingBag, Package, Loader2, Check, Award } from 'lucide-react';
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
import { pointService, PointSettings } from '../services/pointService';
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

  // Metric Calculations (Cart Items) - Moved UP for scope dependencies
  const cartItems = selectedCartItemIds.length > 0
    ? allCartItems.filter(item => selectedCartItemIds.includes(item.id))
    : allCartItems;

  // Shipping mode: 'delivery' = kirim ke alamat, 'keep' = atur alamat nanti, 'pickup' = ambil di toko
  // RULES:
  // 1. Ready stock (ALL roles) → ALWAYS 'delivery', NO 'keep' option
  // 2. PO + Customer → ALWAYS 'delivery', NO 'keep' option
  // 3. PO + Owner/Reseller → CAN CHOOSE 'keep' or 'delivery', default 'keep'
  // 4. Pickup option → available for owner, admin, reseller (not customer)
  const userRole = user?.role || 'customer';
  const hasPOItems = cartItems.some(item => item.status === 'po');
  const hasReadyItems = cartItems.some(item => item.status !== 'po');
  const isOwnerOrReseller = ['owner', 'reseller'].includes(userRole);
  const isPrivilegedUser = ['owner', 'admin', 'reseller'].includes(userRole);

  // Only owner/reseller with ONLY PO items can see the 'keep' option
  const canShowKeepOption = isOwnerOrReseller && hasPOItems && !hasReadyItems;

  // Pickup option available for owner, admin, reseller (always)
  const canShowPickupOption = isPrivilegedUser;

  // Default mode: 'keep' only for owner/reseller with PO only, otherwise always 'delivery'
  const defaultMode = canShowKeepOption ? 'keep' : 'delivery';
  const [shippingMode, setShippingMode] = useState<'delivery' | 'keep' | 'pickup'>(defaultMode);

  // Reset shipping cost when switching to 'keep' or 'pickup' mode
  // 🔥 FIX: Also trigger recalculation when switching BACK to 'delivery' mode
  useEffect(() => {
    if (shippingMode === 'keep' || shippingMode === 'pickup') {
      setShippingCost(0);
      setFormData(prev => ({
        ...prev,
        shippingCost: 0,
        shippingService: '',
        shippingETD: ''
      }));
    } else if (shippingMode === 'delivery') {
      // 🔥 FIX: Reset cache key to force recalculation of shipping cost
      lastShippingCalcRef.current = '';
    }
  }, [shippingMode]);

  // Point System State
  const [usePoints, setUsePoints] = useState(false);
  const [pointSettings, setPointSettings] = useState<PointSettings | null>(null);

  // Load point settings
  useEffect(() => {
    pointService.getSettings().then(setPointSettings);
  }, []);

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



  const shippingFee = (shippingMode === 'keep' || shippingMode === 'pickup') ? 0 : formData.shippingCost || 0;
  const voucherDiscount = appliedVoucher ? appliedVoucher.discountAmount : 0;

  // Point Calculation
  const userPoints = user?.points || 0;

  // ⛔ RESTRICTION CHECK
  // Check if any item is Flash Sale OR Discounted
  // Check if any item is Flash Sale OR Discounted
  const hasRestrictedItems = cartItems.some(item => {
    const isFlashSale = item.isFlashSale || item.productStatus === 'flash_sale';
    const currentPrice = item.price || 0;
    const originalPrice = item.originalResellerPrice || item.originalRetailPrice || item.originalPrice || 0;
    const isDiscounted = originalPrice > currentPrice;

    return isFlashSale || isDiscounted;
  });

  // 🔥 PRICE MODE TOGGLE (Admin/Owner Only)
  const isAdminOrOwner = ['admin', 'owner'].includes(user?.role || '');
  const [priceMode, setPriceMode] = useState<'retail' | 'reseller'>('retail');

  // Recalculate cart items based on price mode
  const recalculatedCartItems = useMemo(() => {
    if (!isAdminOrOwner) return cartItems;

    return cartItems.map(item => {
      // 🔥 CRITICAL: DON'T override flash sale prices!
      if (item.isFlashSale || item.productStatus === 'flash_sale') {
        return item;
      }

      let newPrice = item.price;
      const variant = item.variant;

      if (priceMode === 'reseller') {
        // RESELLER Mode: Check Variant Reseller -> Product Reseller -> Original Reseller
        if (variant?.resellerPrice && Number(variant.resellerPrice) > 0) {
          newPrice = Number(variant.resellerPrice);
        } else if (item.resellerPrice && item.resellerPrice > 0) {
          newPrice = item.resellerPrice;
        } else if (item.originalResellerPrice && item.originalResellerPrice > 0) {
          newPrice = item.originalResellerPrice;
        }
      } else {
        // RETAIL Mode: Check Variant Retail -> Product Retail -> Original Retail
        if (variant?.retailPrice && Number(variant.retailPrice) > 0) {
          newPrice = Number(variant.retailPrice);
        } else if (item.retailPrice && item.retailPrice > 0) {
          newPrice = item.retailPrice;
        } else if (item.originalRetailPrice && item.originalRetailPrice > 0) {
          newPrice = item.originalRetailPrice;
        }
      }

      return { ...item, price: newPrice };
    });
  }, [cartItems, priceMode, isAdminOrOwner]);

  // Use recalculated items for total calculation if admin/owner
  const effectiveCartItems = isAdminOrOwner ? recalculatedCartItems : cartItems;

  const totalPrice = effectiveCartItems.reduce((total, item) => {
    if (!item) return total;
    const itemPrice = item.price || 0;
    const itemQuantity = item.quantity || 1;
    return total + (itemPrice * itemQuantity);
  }, 0);

  // Calculate max points usable (can't go below 0 total)
  // Use points to cover Total + Shipping - Voucher
  const maxRedeemablePoints = Math.max(0, Math.min(userPoints, totalPrice + shippingFee - voucherDiscount));

  // Only apply discount if toggle is ON, user is RESELLER, settings enabled, and has points
  const pointDiscount = (usePoints && user?.role === 'reseller' && pointSettings?.isEnabled && maxRedeemablePoints > 0)
    ? maxRedeemablePoints
    : 0;

  const effectiveFinalTotal = Math.max(0, totalPrice + shippingFee - voucherDiscount - pointDiscount);
  // Alias for legacy usage
  const effectiveShippingFee = shippingFee;

  const shippingOptions = [
    { id: 'jnt', name: 'J&T Express', code: 'jnt', price: 0 }, // RajaOngkir supported
    { id: 'jne', name: 'JNE', code: 'jne', price: 0 }, // RajaOngkir supported
    { id: 'pos', name: 'POS Indonesia', code: 'pos', price: 0 }, // RajaOngkir supported
    { id: 'tiki', name: 'TIKI', code: 'tiki', price: 0 }, // RajaOngkir supported
    { id: 'ojek', name: 'OJEK', code: null, price: 0 }, // Local courier - manual price
    { id: 'lion', name: 'Lion Parcel', code: 'lion', price: 0 }, // Automatic via Komerce
    { id: 'idexpress', name: 'IDExpress', code: 'ide', price: 0 }, // Automatic via Komerce
    { id: 'pickup', name: 'Ambil di Toko', code: 'pickup', price: 0 } // ✨ NEW: Pickup option (Free)
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
  }, [formData.shippingCourier, selectedAddressId, addresses.length, cartItems.length, totalPrice]);


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
    // No confirm needed - user can add address back easily
    deleteAddress(id);
    if (selectedAddressId === id) {
      const newDefault = getDefaultAddress();
      if (newDefault) {
        handleAddressSelect(newDefault.id);
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
      const result = await voucherService.validateVoucher(codeToApply, user?.uid, totalPrice);
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
      // BYPASS if courier is 'pickup'
      if (formData.shippingCourier !== 'pickup') {
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

    // Metric vars are now calculated at component level (effectiveFinalTotal, etc)

    // 🔥 Use effectiveCartItems to ensure correct pricing (Retail/Reseller) is saved!
    const orderData = {
      items: effectiveCartItems.map(item => ({
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
      } : (() => {
        const activeAddr = getActiveAddress();
        return {
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          // ✨ NEW: Add provincial address fields for print label
          provinceName: activeAddr?.provinceName || '',
          cityName: activeAddr?.cityName || '',
          district: activeAddr?.district || '',
          subdistrict: activeAddr?.subdistrict || '',
          postalCode: activeAddr?.postalCode || '',
          isDropship: formData.isDropship,
          dropshipName: formData.dropshipName,
          dropshipPhone: formData.dropshipPhone,
          courier: formData.shippingCourier,
          shippingCost: formData.shippingCost > 0 ? formData.shippingCost : null,
          shippingService: formData.shippingService,
          shippingETD: formData.shippingETD
        };
      })(),
      // ✨ NEW: Shipping mode fields
      shippingMode: shippingMode,
      shippingConfigured: shippingMode === 'delivery', // true jika sudah lengkap
      paymentMethod: selectedPaymentMethod.name,
      notes: formData.notes || '',
      paymentMethodId: selectedPaymentMethod.id,
      paymentMethodName: selectedPaymentMethod.name,
      totalAmount: totalPrice,
      shippingCost: effectiveShippingFee,
      voucherCode: appliedVoucher?.code || null,
      voucherDiscount: voucherDiscount,
      // ✨ Point System Fields
      usedPoints: pointDiscount,
      pointDiscount: pointDiscount,
      finalTotal: effectiveFinalTotal
      // Note: cashReceived/cashChange will be added by Admin via POS modal when verifying
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

    // ✨ NEW: Deduct points if used
    if (pointDiscount > 0 && newOrderId) {
      try {
        console.log(`💎 Deducting ${pointDiscount} points...`);
        await pointService.deductPoints(user.uid, pointDiscount, newOrderId);
        console.log('✅ Points deducted.');
      } catch (error) {
        console.error('❌ Failed to deduct points:', error);
        // Note: Code continues, as order is already created. Admin might need to reconcile manually if this fails.
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

  const finalTotal = effectiveFinalTotal;
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

                // Use the canShowKeepOption flag defined at component level
                // Show section if either keep or pickup options are available
                if (!canShowKeepOption && !canShowPickupOption) return null;

                return (
                  <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-md">
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Truck className="w-5 h-5 text-yellow-700" />
                      Mode Pengiriman
                    </h3>
                    <div className={`grid gap-3 ${canShowKeepOption && canShowPickupOption ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      {/* Kirim option - always visible when section shows */}
                      <label
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden group ${shippingMode === 'delivery'
                          ? 'bg-gradient-to-br from-white to-[#FEFAE0] shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                          : 'bg-white border border-gray-100 hover:border-[#D4AF37]/30 hover:shadow-md'
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
                        <div className={`p-2.5 rounded-full transition-all duration-300 ${shippingMode === 'delivery' ? 'bg-gradient-to-br from-[#D4AF37] to-[#B8860B] shadow-inner' : 'bg-gray-50 group-hover:bg-[#D4AF37]/10'}`}>
                          <Truck className={`w-5 h-5 transition-colors duration-300 ${shippingMode === 'delivery' ? 'text-white' : 'text-gray-400 group-hover:text-[#B8860B]'}`} />
                        </div>
                        <p className={`font-bold text-sm transition-colors duration-300 ${shippingMode === 'delivery' ? 'text-[#996515]' : 'text-gray-600 group-hover:text-[#996515]'}`}>Kirim</p>
                      </label>

                      {/* Keep option - only for owner/reseller with PO items */}
                      {canShowKeepOption && (
                        <label
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden group ${shippingMode === 'keep'
                            ? 'bg-gradient-to-br from-white to-[#FEFAE0] shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                            : 'bg-white border border-gray-100 hover:border-[#D4AF37]/30 hover:shadow-md'
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
                          <div className={`p-2.5 rounded-full transition-all duration-300 ${shippingMode === 'keep' ? 'bg-gradient-to-br from-[#D4AF37] to-[#B8860B] shadow-inner' : 'bg-gray-50 group-hover:bg-[#D4AF37]/10'}`}>
                            <Archive className={`w-5 h-5 transition-colors duration-300 ${shippingMode === 'keep' ? 'text-white' : 'text-gray-400 group-hover:text-[#B8860B]'}`} />
                          </div>
                          <p className={`font-bold text-sm transition-colors duration-300 ${shippingMode === 'keep' ? 'text-[#996515]' : 'text-gray-600 group-hover:text-[#996515]'}`}>Keep</p>
                        </label>
                      )}

                      {/* Pickup option - for owner/admin/reseller */}
                      {canShowPickupOption && (
                        <label
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden group ${shippingMode === 'pickup'
                            ? 'bg-gradient-to-br from-white to-[#FEFAE0] shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                            : 'bg-white border border-gray-100 hover:border-[#D4AF37]/30 hover:shadow-md'
                            }`}
                        >
                          <input
                            type="radio"
                            name="shippingMode"
                            value="pickup"
                            checked={shippingMode === 'pickup'}
                            onChange={() => setShippingMode('pickup')}
                            className="sr-only"
                          />
                          <div className={`p-2.5 rounded-full transition-all duration-300 ${shippingMode === 'pickup' ? 'bg-gradient-to-br from-[#D4AF37] to-[#B8860B] shadow-inner' : 'bg-gray-50 group-hover:bg-[#D4AF37]/10'}`}>
                            <Package className={`w-5 h-5 transition-colors duration-300 ${shippingMode === 'pickup' ? 'text-white' : 'text-gray-400 group-hover:text-[#B8860B]'}`} />
                          </div>
                          <p className={`font-bold text-sm transition-colors duration-300 text-center ${shippingMode === 'pickup' ? 'text-[#996515]' : 'text-gray-600 group-hover:text-[#996515]'}`}>Ambil di Toko</p>
                        </label>
                      )}
                    </div>

                    {/* Info text for pickup mode */}
                    {shippingMode === 'pickup' && (
                      <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-700">
                        <p className="font-medium">📍 Ambil langsung di toko</p>
                        <p className="text-xs text-amber-600 mt-1">Ongkir Rp 0 - Tidak perlu alamat pengiriman</p>
                      </div>
                    )}
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
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white transition-all transform hover:scale-105 active:scale-95 shadow-md bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] hover:bg-[100%_0] border border-[#D4AF37]/20"
                    >
                      <Plus className="h-3 w-3 drop-shadow-sm text-[#5d4008]" />
                      <span className="drop-shadow-sm text-[#5d4008]">Tambah Alamat</span>
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
                                <div className={`flex items-center justify-center h-5 w-5 rounded-full border transition-all duration-300 ${selectedAddressId === address.id ? 'border-[#B8860B] bg-white' : 'border-gray-300 bg-white group-hover:border-[#D4AF37]'}`}>
                                  {selectedAddressId === address.id && <div className="h-3 w-3 rounded-full bg-[#B8860B] shadow-sm transform scale-110" />}
                                </div>
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
                                  className="sr-only"
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

                  {/* Manual shipping cost input for non-automatic couriers, EXCEPT pickup */}
                  {!supportsAutomatic && formData.shippingCourier !== 'pickup' && (
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

                  {/* Pickup Info */}
                  {formData.shippingCourier === 'pickup' && (
                    <div className="mt-4 rounded-xl bg-green-50 p-4 border border-green-200">
                      <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Ambil Sendiri di Toko
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        Gratis Ongkir. Silakan ambil pesanan Anda langsung di toko.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Order Items */}
              <div className="rounded-2xl border border-white/40 bg-white/95 p-5 shadow-sm">

                {/* 💼 ADMIN PRICE TOGGLE */}
                {isAdminOrOwner && (
                  <div className="mb-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-amber-600" />
                        <div>
                          <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Mode Harga</p>
                          <p className="text-[10px] text-amber-600">Pilih harga untuk order ini</p>
                        </div>
                      </div>
                      <div className="flex bg-white rounded-lg p-1 border border-amber-100 shadow-sm">
                        <button
                          onClick={() => setPriceMode('retail')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${priceMode === 'retail'
                            ? 'bg-amber-100 text-amber-800 shadow-sm'
                            : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                          Retail
                        </button>
                        <button
                          onClick={() => setPriceMode('reseller')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${priceMode === 'reseller'
                            ? 'bg-amber-100 text-amber-800 shadow-sm'
                            : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                          Reseller
                        </button>
                      </div>
                    </div>
                  </div>
                )}

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
                    effectiveCartItems.map((item, index) => {
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
                    {paymentMethods.map((method) => {
                      const isSelected = formData.paymentMethodId === method.id;

                      return (
                        <div key={method.id}>
                          <label className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300 cursor-pointer relative overflow-hidden group ${isSelected
                            ? 'bg-gradient-to-br from-white to-[#FEFAE0] shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                            : 'bg-white border border-gray-100 hover:border-[#D4AF37]/30 hover:shadow-md'
                            }`}>
                            <div className={`flex items-center justify-center h-5 w-5 rounded-full border transition-all duration-300 ${isSelected ? 'border-[#B8860B] bg-white' : 'border-gray-300 group-hover:border-[#D4AF37]'}`}>
                              {isSelected && <div className="h-3 w-3 rounded-full bg-[#B8860B] shadow-sm transform scale-110" />}
                            </div>
                            <input
                              type="radio"
                              name="paymentMethodId"
                              value={method.id}
                              checked={isSelected}
                              onChange={handleInputChange}
                              className="sr-only"
                            />
                            <div>
                              <p className={`text-sm font-bold transition-colors duration-300 ${isSelected ? 'text-[#996515]' : 'text-gray-900 group-hover:text-[#996515]'}`}>{method.name}</p>
                              <p className="text-xs text-slate-500">Metode pembayaran toko</p>
                            </div>
                          </label>

                          {/* Cash payment: no input needed at checkout - admin will handle via POS modal */}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ✅ SIMPLIFIED: No verification mode selection at checkout */}
              {/* Customers will choose auto/manual when ready to pay in OrdersPage */}

              {/* Point Redemption Section (Reseller Only) */}
              {user?.role === 'reseller' && pointSettings?.isEnabled && user?.points > 0 && (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-md">
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Award className="w-5 h-5 text-blue-600" />
                    Tukar Poin Reseller
                  </h3>

                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm text-blue-800 font-medium">Saldo Poin Anda</p>
                        <p className="text-2xl font-bold text-blue-600">{user.points.toLocaleString('id-ID')} pts</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-blue-600">Nilai Tukar</p>
                        <p className="text-sm font-bold text-blue-800">1 Poin = Rp 1</p>
                      </div>
                    </div>

                    <label className={`flex items-center gap-3 p-3 bg-white rounded-lg border transition-colors ${hasRestrictedItems || (!!pointSettings?.minOrderForRedeem && totalPrice < pointSettings.minOrderForRedeem) ? 'border-gray-200 opacity-60 cursor-not-allowed' : 'border-blue-100 cursor-pointer hover:border-blue-300'}`}>
                      <div className="relative inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={usePoints}
                          onChange={(e) => !hasRestrictedItems && (!pointSettings?.minOrderForRedeem || totalPrice >= pointSettings.minOrderForRedeem) && setUsePoints(e.target.checked)}
                          disabled={hasRestrictedItems || (!!pointSettings?.minOrderForRedeem && totalPrice < pointSettings.minOrderForRedeem)}
                          className="sr-only peer"
                        />
                        <div className={`w-11 h-6 rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${hasRestrictedItems || (!!pointSettings?.minOrderForRedeem && totalPrice < pointSettings.minOrderForRedeem) ? 'bg-gray-200' : 'bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:bg-blue-600'}`}></div>
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold ${hasRestrictedItems || (!!pointSettings?.minOrderForRedeem && totalPrice < pointSettings.minOrderForRedeem) ? 'text-gray-500' : 'text-gray-900'}`}>Gunakan Poin</p>
                        <p className="text-xs text-gray-500">
                          {hasRestrictedItems
                            ? 'Tidak tersedia item Promo/Flash Sale'
                            : (!!pointSettings?.minOrderForRedeem && totalPrice < pointSettings.minOrderForRedeem)
                              ? `Min. belanja Rp ${pointSettings.minOrderForRedeem.toLocaleString('id-ID')}`
                              : (usePoints
                                ? `Hemat Rp ${pointDiscount.toLocaleString('id-ID')}`
                                : 'Tukarkan poin untuk diskon')}
                        </p>
                      </div>
                    </label>

                    {(hasRestrictedItems || (!!pointSettings?.minOrderForRedeem && totalPrice < pointSettings.minOrderForRedeem)) && (
                      <div className="mt-3 flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>
                          {hasRestrictedItems
                            ? "Penukaran poin dinonaktifkan karena terdapat produk Flash Sale/Diskon."
                            : `Minimal belanja Rp ${pointSettings?.minOrderForRedeem?.toLocaleString('id-ID')} untuk tukar poin.`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all transform hover:scale-105 active:scale-95 shadow-md bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] hover:bg-[100%_0] border border-[#D4AF37]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="drop-shadow-sm text-[#5d4008]">
                          {voucherLoading ? '...' : 'Pakai'}
                        </span>
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
                              disabled={totalPrice < v.minPurchase}
                              className={`w-full text-left p-3 rounded-lg border transition ${totalPrice >= v.minPurchase
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
                              {totalPrice < v.minPurchase && (
                                <p className="text-xs text-amber-600 mt-1">
                                  Belanja kurang Rp {(v.minPurchase - totalPrice).toLocaleString('id-ID')} lagi
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
                    <div className={`flex items-center justify-center h-5 w-5 rounded border transition-all duration-300 ${formData.isDropship ? 'border-[#B8860B] bg-[#B8860B]' : 'border-gray-300 bg-white group-hover:border-[#D4AF37]'}`}>
                      {formData.isDropship && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                    </div>
                    <input
                      type="checkbox"
                      name="isDropship"
                      checked={formData.isDropship}
                      onChange={handleInputChange}
                      className="sr-only"
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


            </div>
          </div>
        )
        }
      </div>

      {/* Floating Checkout Button - Fixed Bottom */}
      {!loading && (
        <div className="fixed bottom-0 left-0 right-0 lg:bottom-4 lg:left-4 lg:right-4 z-40">
          <div className="bg-white shadow-2xl border-t lg:border lg:rounded-2xl border-gray-200 p-4">
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
                disabled={loading || (shippingMode === 'delivery' && !selectedAddressId) || !formData.paymentMethodId}
                className="bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-white px-6 py-2.5 rounded-full font-bold text-base shadow-[0_4px_14px_0_rgba(153,123,44,0.39)] hover:shadow-[0_6px_20px_rgba(153,123,44,0.23)] hover:bg-[100%_0] transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none relative overflow-hidden group border border-[#D4AF37]/20"
              >
                <span className="relative z-10 flex items-center gap-2 drop-shadow-sm text-[#5d4008]">
                  {loading ? 'Memproses...' : (
                    <>
                      Buat Pesanan
                    </>
                  )}
                </span>
                {/* Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/60 to-transparent skew-x-12 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out" />
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