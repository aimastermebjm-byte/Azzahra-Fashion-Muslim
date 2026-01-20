import React, { useState, useEffect } from 'react';
import { MapPin, Edit, Trash2, Check, Home, Plus } from 'lucide-react';
import { addressService, Address } from '../services/addressService';
import AddressForm from './AddressForm';
import PageHeader from './PageHeader';
import EmptyState from './ui/EmptyState';
import { ListSkeleton } from './ui/Skeleton';
import { useToast } from './ToastProvider';

interface AddressManagementPageProps {
  user: any;
  onBack: () => void;
}

const AddressManagementPage: React.FC<AddressManagementPageProps> = ({ user, onBack }) => {
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Load addresses with real-time listener
  useEffect(() => {
    const unsubscribe = addressService.onAddressesChange((addressList) => {
      setAddresses(addressList);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, []);

  const handleAddAddress = () => {
    setShowAddForm(true);
    setEditingAddress(null);
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setShowAddForm(true);
  };

  const handleDeleteAddress = async (id: string) => {
    // No confirm needed - user can add address back easily
    try {
      await addressService.deleteAddress(id);
      showToast({
        type: 'success',
        title: 'Alamat dihapus',
        message: 'Alamat berhasil dihapus dari daftar kamu.'
      });
    } catch (error) {
      console.error('❌ Error deleting address:', error);
      showToast({
        type: 'error',
        title: 'Gagal menghapus',
        message: 'Terjadi kesalahan saat menghapus alamat.'
      });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await addressService.setAsDefault(id);
      showToast({
        type: 'success',
        title: 'Alamat utama diperbarui',
        message: 'Alamat ini sekarang menjadi alamat utama.'
      });
    } catch (error) {
      console.error('❌ Error setting default address:', error);
      showToast({
        type: 'error',
        title: 'Gagal mengatur utama',
        message: 'Terjadi kesalahan saat memperbarui alamat utama.'
      });
    }
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingAddress(null);
  };

  const handleAddressSubmit = async (addressData: any) => {
    try {
      if (editingAddress) {
        // Convert AddressForm data to AddressService format
        await addressService.updateAddress(editingAddress.id, {
          name: addressData.name,
          phone: addressData.phone,
          fullAddress: addressData.fullAddress,
          province: addressData.province,
          provinceId: addressData.provinceId,
          city: addressData.city,
          cityId: addressData.cityId,
          district: addressData.district,
          districtId: addressData.districtId,
          subdistrict: addressData.subdistrict,
          subdistrictId: addressData.subdistrictId,
          postalCode: addressData.postalCode,
          isDefault: addressData.isDefault,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Add new address
        await addressService.saveAddress({
          name: addressData.name,
          phone: addressData.phone,
          fullAddress: addressData.fullAddress,
          province: addressData.province,
          provinceId: addressData.provinceId,
          city: addressData.city,
          cityId: addressData.cityId,
          district: addressData.district,
          districtId: addressData.districtId,
          subdistrict: addressData.subdistrict,
          subdistrictId: addressData.subdistrictId,
          postalCode: addressData.postalCode,
          isDefault: addressData.isDefault
        });
      }

      showToast({
        type: 'success',
        title: editingAddress ? 'Alamat diperbarui' : 'Alamat disimpan',
        message: editingAddress ? 'Alamat kamu berhasil diperbarui.' : 'Alamat baru berhasil ditambahkan.'
      });
      handleCloseForm();
    } catch (error) {
      console.error('❌ Error saving address:', error);
      showToast({
        type: 'error',
        title: 'Gagal menyimpan alamat',
        message: 'Silakan coba lagi beberapa saat.'
      });
    }
  };

  const formatAddress = (address: Address) => {
    return `${address.fullAddress}, ${address.subdistrict}, ${address.district}, ${address.city}, ${address.province} ${address.postalCode}`;
  };

  const addressCount = addresses.length;
  const headerSubtitle = loading
    ? 'Memuat alamat tersimpan...'
    : addressCount > 0
      ? `${addressCount} alamat tersimpan`
      : 'Belum ada alamat tersimpan';

  if (showAddForm) {
    const formTitle = editingAddress ? 'Edit Alamat' : 'Tambah Alamat Baru';
    return (
      <div className="min-h-screen bg-brand-surface pb-16">
        <PageHeader
          title={formTitle}
          subtitle="Lengkapi detail alamat pengiriman"
          onBack={handleCloseForm}
          variant="card"
        />
        <div className="mx-auto max-w-3xl px-4 pb-16">
          <AddressForm
            initialData={editingAddress ? {
              name: editingAddress.name,
              phone: editingAddress.phone,
              fullAddress: editingAddress.fullAddress,
              province: editingAddress.province,
              provinceId: editingAddress.provinceId,
              city: editingAddress.city,
              cityId: editingAddress.cityId,
              district: editingAddress.district,
              districtId: editingAddress.districtId,
              subdistrict: editingAddress.subdistrict,
              subdistrictId: editingAddress.subdistrictId,
              postalCode: editingAddress.postalCode,
              isDefault: editingAddress.isDefault
            } : null}
            onSave={handleAddressSubmit}
            onCancel={handleCloseForm}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface pb-24">
      <PageHeader
        title="Alamat Pengiriman"
        subtitle={headerSubtitle}
        onBack={onBack}
        variant="card"
        actions={(
          <button
            onClick={handleAddAddress}
            className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-brand-card transition hover:bg-brand-primary/90"
          >
            <Plus className="h-4 w-4" />
            Tambah Alamat
          </button>
        )}
      />

      <div className="mx-auto max-w-4xl px-4 pb-24">
        {loading ? (
          <ListSkeleton items={3} />
        ) : error ? (
          <EmptyState
            title="Gagal memuat alamat"
            description={error}
            action={(
              <button onClick={onBack} className="btn-brand">
                Kembali
              </button>
            )}
          />
        ) : addressCount === 0 ? (
          <EmptyState
            icon={<MapPin className="h-10 w-10 text-brand-primary" />}
            title="Belum ada alamat"
            description="Tambahkan alamat pengiriman untuk memudahkan proses checkout."
            action={(
              <button onClick={handleAddAddress} className="btn-brand">
                Tambah Alamat Pertama
              </button>
            )}
          />
        ) : (
          <div className="space-y-4">
            {addresses.map((address) => (
              <div key={address.id} className="rounded-2xl border border-white/40 bg-white/95 p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                      <Home className="h-4 w-4 text-brand-primary" />
                      <span>{address.city || 'Tanpa Kota'}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">{address.name}</h3>
                    <p className="text-sm text-slate-500">{address.phone}</p>
                    <p className="mt-2 text-sm text-slate-600">{formatAddress(address)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {address.isDefault && (
                      <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
                        Utama
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    {address.updatedAt ? `Diperbarui ${new Date(address.updatedAt).toLocaleDateString('id-ID')}` : 'Alamat tersimpan'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditAddress(address)}
                      className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:text-brand-primary"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    {addresses.length > 1 && (
                      <button
                        onClick={() => handleDeleteAddress(address.id)}
                        className="rounded-full border border-slate-200 p-2 text-rose-500 transition hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {!address.isDefault && (
                      <button
                        onClick={() => handleSetDefault(address.id)}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600"
                      >
                        Jadikan Utama
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleAddAddress}
        className="fixed bottom-24 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-white shadow-brand-card transition hover:scale-105"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
};

export default AddressManagementPage;