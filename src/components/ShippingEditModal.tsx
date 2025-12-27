import React, { useState, useEffect } from 'react';
import { X, MapPin, Phone, User, Truck, Loader2, Package } from 'lucide-react';
import { ordersService } from '../services/ordersService';
import { addressService } from '../services/addressService';
import { useToast } from './ToastProvider';

// Shipping options (same as CheckoutPage)
const shippingOptions = [
    { id: 'jnt', name: 'J&T Express', code: 'jnt' },
    { id: 'jne', name: 'JNE', code: 'jne' },
    { id: 'pos', name: 'POS Indonesia', code: 'pos' },
    { id: 'tiki', name: 'TIKI', code: 'tiki' },
    { id: 'ojek', name: 'OJEK (Lokal)', code: null },
    { id: 'lion', name: 'Lion Parcel', code: 'lion' },
    { id: 'idexpress', name: 'IDExpress', code: 'ide' }
];

interface ShippingEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: any;
    bulkOrders?: any[]; // For applying same address to multiple orders
    onSuccess: () => void;
}

const ShippingEditModal: React.FC<ShippingEditModalProps> = ({
    isOpen,
    onClose,
    order,
    bulkOrders,
    onSuccess
}) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [loadingShipping, setLoadingShipping] = useState(false);
    const [addresses, setAddresses] = useState<any[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [selectedCityId, setSelectedCityId] = useState<string>(''); // For auto shipping calc
    const [shippingError, setShippingError] = useState('');
    const [shippingService, setShippingService] = useState('');
    const [shippingETD, setShippingETD] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
        courier: 'jnt',
        shippingCost: 0,
        isDropship: false,
        dropshipName: '',
        dropshipPhone: ''
    });

    // Load user addresses
    useEffect(() => {
        if (isOpen) {
            loadAddresses();
            // Pre-fill with existing order data
            if (order?.shippingInfo) {
                setFormData({
                    name: order.shippingInfo.name || '',
                    phone: order.shippingInfo.phone || '',
                    address: order.shippingInfo.address || '',
                    courier: order.shippingInfo.courier || 'jnt',
                    shippingCost: order.shippingCost || 0,
                    isDropship: order.shippingInfo.isDropship || false,
                    dropshipName: order.shippingInfo.dropshipName || '',
                    dropshipPhone: order.shippingInfo.dropshipPhone || ''
                });
            }
        }
    }, [isOpen, order]);

    const loadAddresses = async () => {
        try {
            const userAddresses = await addressService.getUserAddresses();
            setAddresses(userAddresses);
        } catch (error) {
            console.error('Failed to load addresses:', error);
        }
    };

    const handleSelectAddress = (address: any) => {
        console.log('📍 Selected address:', address);
        setSelectedAddressId(address.id);

        // Save destination ID for shipping calculation (prioritize subdistrictId > districtId > cityId)
        const destId = address.subdistrictId || address.subdistrict_id ||
            address.districtId || address.district_id ||
            address.cityId || address.city_id || '';
        console.log('🏙️ Destination ID for shipping:', destId);
        setSelectedCityId(destId);

        // Build address string from available fields, filter out undefined/empty values
        const addressParts = [
            address.address || address.fullAddress || address.addressLine || address.detail || '',
            address.subDistrict || address.kelurahan || '',
            address.district || address.kecamatan || '',
            address.city || address.kota || address.regency || '',
            address.province || address.provinsi || ''
        ].filter(part => part && part.trim() !== '');

        const fullAddressString = addressParts.join(', ');

        setFormData(prev => ({
            ...prev,
            name: address.recipientName || address.name || address.label || '',
            phone: address.phone || address.phoneNumber || '',
            address: fullAddressString,
            shippingCost: 0 // Reset shipping cost when address changes
        }));

        setShippingError('');
        setShippingService('');
        setShippingETD('');
    };

    // Auto-calculate shipping when cityId and courier are selected
    useEffect(() => {
        if (!selectedCityId || !formData.courier) return;

        const selectedCourier = shippingOptions.find(opt => opt.id === formData.courier);
        if (!selectedCourier?.code) {
            // Manual courier - don't auto-calculate
            setShippingError('Kurir lokal - isi ongkir manual');
            return;
        }

        const calculateShipping = async () => {
            setLoadingShipping(true);
            setShippingError('');

            try {
                // Origin: Banjarmasin city ID (same as CheckoutPage)
                const origin = '2425';
                const weight = 1000; // Default 1kg

                console.log(`🚚 Calculating shipping (cached): ${selectedCourier.code} to ${selectedCityId}`);

                // Call RajaOngkir CACHED API (same as CheckoutPage for cache hit)
                const response = await fetch('/api/rajaongkir/cost-cached', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        origin: origin,
                        destination: selectedCityId,
                        weight: weight,
                        courier: selectedCourier.code,
                        price: 'lowest'
                    })
                });

                if (!response.ok) {
                    throw new Error(`API Error: ${response.status}`);
                }

                const data = await response.json();

                if (data.meta?.status === 'success' && data.data?.length > 0) {
                    // Get cheapest option
                    const cheapest = data.data.reduce((min: any, r: any) =>
                        (r.price || r.cost) < (min.price || min.cost) ? r : min, data.data[0]);

                    const cost = cheapest.price || cheapest.cost || 0;
                    setFormData(prev => ({ ...prev, shippingCost: cost }));
                    setShippingService(cheapest.service || cheapest.service_name || '');
                    setShippingETD(cheapest.etd || '');
                    console.log(`✅ Shipping cost: ${cost} (${cheapest.service})`);
                } else {
                    setShippingError('Tidak ada layanan tersedia');
                }
            } catch (error: any) {
                console.error('❌ Shipping calculation failed:', error);
                setShippingError('Gagal hitung ongkir - isi manual');
            } finally {
                setLoadingShipping(false);
            }
        };

        calculateShipping();
    }, [selectedCityId, formData.courier]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked :
                type === 'number' ? Number(value) : value
        }));
    };

    const handleSubmit = async () => {
        // Validate
        if (!formData.name || !formData.phone || !formData.address) {
            showToast({
                type: 'warning',
                title: 'Data belum lengkap',
                message: 'Isi nama, telepon, dan alamat pengiriman.'
            });
            return;
        }

        // Validate shipping cost for non-automatic couriers
        const selectedCourier = shippingOptions.find(opt => opt.id === formData.courier);
        if (!selectedCourier?.code && formData.shippingCost <= 0) {
            showToast({
                type: 'warning',
                title: 'Isi biaya ongkir',
                message: 'Masukkan biaya ongkos kirim untuk kurir lokal.'
            });
            return;
        }

        setLoading(true);
        try {
            // Determine which orders to update
            const ordersToUpdate = bulkOrders && bulkOrders.length > 0 ? bulkOrders : [order];

            for (const targetOrder of ordersToUpdate) {
                // Calculate new final total for each order
                const newFinalTotal = (targetOrder.totalAmount || 0) + formData.shippingCost - (targetOrder.voucherDiscount || 0);

                // Update order in Firestore
                await ordersService.updateOrder(targetOrder.id, {
                    shippingInfo: {
                        name: formData.name,
                        phone: formData.phone,
                        address: formData.address,
                        courier: formData.courier,
                        shippingCost: formData.shippingCost,
                        isDropship: formData.isDropship,
                        dropshipName: formData.dropshipName,
                        dropshipPhone: formData.dropshipPhone,
                        shippingService: '',
                        shippingETD: ''
                    },
                    shippingCost: formData.shippingCost,
                    finalTotal: Math.max(0, newFinalTotal),
                    shippingConfigured: true, // Mark as configured
                    shippingMode: 'delivery' // Change from 'keep' to 'delivery'
                } as any);
            }

            showToast({
                type: 'success',
                title: 'Berhasil!',
                message: ordersToUpdate.length > 1
                    ? `Alamat berhasil diterapkan ke ${ordersToUpdate.length} pesanan.`
                    : 'Alamat pengiriman berhasil diperbarui.'
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to update shipping:', error);
            showToast({
                type: 'error',
                title: 'Gagal menyimpan',
                message: 'Terjadi kesalahan. Coba lagi.'
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const selectedCourier = shippingOptions.find(opt => opt.id === formData.courier);
    const isManualCourier = !selectedCourier?.code;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Atur Alamat Pengiriman</h2>
                        <p className="text-sm text-slate-500">Order #{order?.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Saved Addresses */}
                    {addresses.length > 0 && (
                        <div>
                            <label className="text-sm font-semibold text-slate-700 mb-2 block">
                                Pilih dari Alamat Tersimpan
                            </label>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                {addresses.map((addr) => (
                                    <button
                                        key={addr.id}
                                        onClick={() => handleSelectAddress(addr)}
                                        className={`w-full text-left p-3 rounded-xl border transition ${selectedAddressId === addr.id
                                            ? 'border-brand-primary bg-brand-primary/5'
                                            : 'border-slate-200 hover:border-brand-primary/40'
                                            }`}
                                    >
                                        <p className="font-medium text-sm">{addr.recipientName || addr.label}</p>
                                        <p className="text-xs text-slate-500 truncate">{addr.address}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Manual Input */}
                    <div className="space-y-4">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <User className="w-4 h-4 text-brand-primary" />
                                Nama Penerima
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="w-full rounded-xl border border-slate-200 p-3 focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                placeholder="Nama lengkap penerima"
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <Phone className="w-4 h-4 text-brand-primary" />
                                Nomor Telepon
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                className="w-full rounded-xl border border-slate-200 p-3 focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                placeholder="08xxxxxxxxxx"
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <MapPin className="w-4 h-4 text-brand-primary" />
                                Alamat Lengkap
                            </label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleInputChange}
                                rows={3}
                                className="w-full rounded-xl border border-slate-200 p-3 focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
                                placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota, Provinsi"
                            />
                        </div>

                        {/* Courier Selection */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <Truck className="w-4 h-4 text-brand-primary" />
                                Pilih Kurir
                            </label>
                            <select
                                name="courier"
                                value={formData.courier}
                                onChange={handleInputChange}
                                className="w-full rounded-xl border border-slate-200 p-3 focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            >
                                {shippingOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.name} {option.code ? '(Ekspedisi)' : '(Lokal)'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Manual Shipping Cost */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <Package className="w-4 h-4 text-brand-primary" />
                                Biaya Ongkir (Rp)
                            </label>

                            {/* Loading indicator */}
                            {loadingShipping && (
                                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl mb-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                    <span className="text-sm text-blue-600">Menghitung ongkir...</span>
                                </div>
                            )}

                            {/* Error message */}
                            {shippingError && !loadingShipping && (
                                <p className="text-xs text-amber-600 mb-2">
                                    ⚠️ {shippingError}
                                </p>
                            )}

                            {/* Show service and ETD if calculated */}
                            {shippingService && formData.shippingCost > 0 && !loadingShipping && (
                                <div className="p-3 bg-green-50 rounded-xl mb-2">
                                    <p className="text-sm font-medium text-green-700">
                                        ✅ {shippingService} - Rp {formData.shippingCost.toLocaleString('id-ID')}
                                    </p>
                                    {shippingETD && (
                                        <p className="text-xs text-green-600">Estimasi: {shippingETD} hari</p>
                                    )}
                                </div>
                            )}

                            <input
                                type="number"
                                name="shippingCost"
                                value={formData.shippingCost || ''}
                                onChange={handleInputChange}
                                min="0"
                                disabled={loadingShipping}
                                className="w-full rounded-xl border border-slate-200 p-3 focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100"
                                placeholder="Masukkan biaya ongkos kirim"
                            />
                            {isManualCourier && (
                                <p className="mt-1 text-xs text-amber-600">
                                    * Kurir lokal - wajib isi biaya ongkir manual
                                </p>
                            )}
                        </div>

                        {/* Dropship Toggle */}
                        <div className="border-t pt-4">
                            <label className="flex items-center space-x-3 mb-3">
                                <input
                                    type="checkbox"
                                    name="isDropship"
                                    checked={formData.isDropship}
                                    onChange={handleInputChange}
                                    className="h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                />
                                <span className="text-sm font-medium text-slate-700">Kirim sebagai dropship</span>
                            </label>

                            {formData.isDropship && (
                                <div className="space-y-3 pl-7">
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

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t px-5 py-4 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 py-3 rounded-xl bg-brand-primary text-white font-semibold hover:bg-brand-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Menyimpan...
                            </>
                        ) : (
                            'Simpan Alamat'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShippingEditModal;
