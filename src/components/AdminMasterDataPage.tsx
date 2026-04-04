import React, { useEffect, useState } from 'react';
import { Tags, Plus, Trash2, CreditCard, Layers, Package, Check } from 'lucide-react';
import PageHeader from './PageHeader';
import EmptyState from './ui/EmptyState';
import { useToast } from './ToastProvider';
import { financialService, FinancialCategory, FinancialType, PaymentMethod } from '../services/financialService';
import { productCategoryService, ProductCategory } from '../services/productCategoryService';

// Available icons for category picker (matching files in /public/icons/)
const AVAILABLE_ICONS: { label: string; path: string }[] = [
  { label: 'Hijab', path: '/icons/hijab-icon.png' },
  { label: 'Gamis', path: '/icons/gamis-icon.svg' },
  { label: 'Khimar', path: '/icons/khimar-icon.svg' },
  { label: 'Tunik', path: '/icons/tunik-icon.png' },
  { label: 'Mukena', path: '/icons/mukena-icon.svg' },
  { label: 'Outer', path: '/icons/outer-icon.png' },
  { label: 'Dress', path: '/icons/dress-icon.svg' },
  { label: 'Aksesoris', path: '/icons/accessories-icon.png' },
  { label: 'One Set', path: '/icons/oneset-icon.svg' },
  { label: 'Skincare', path: '/icons/skincare-icon.svg' },
  { label: 'Set Rok', path: '/icons/setrok-icon.svg' },
  { label: 'Set Dress', path: '/icons/setdress-icon.svg' },
];

interface AdminMasterDataPageProps {
  onBack: () => void;
  user: any;
}

const AdminMasterDataPage: React.FC<AdminMasterDataPageProps> = ({ onBack, user }) => {
  const { showToast: toast } = useToast();
  const [activeTab, setActiveTab] = useState<'categories' | 'paymentMethods' | 'productCategories'>('productCategories');

  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Category Form
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<FinancialType>('expense');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  // Payment Method Form
  const [newPaymentMethodName, setNewPaymentMethodName] = useState('');
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [deletingPaymentMethodId, setDeletingPaymentMethodId] = useState<string | null>(null);

  // Product Category Form
  const [newProductCategoryName, setNewProductCategoryName] = useState('');
  const [newProductCategoryIcon, setNewProductCategoryIcon] = useState('');
  const [showAddProductCategory, setShowAddProductCategory] = useState(false);
  const [deletingProductCategoryId, setDeletingProductCategoryId] = useState<string | null>(null);

  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin';
  const isAdminOrOwner = isOwner || isAdmin;

  // Admin defaults to productCategories tab (only tab they can access)
  useEffect(() => {
    if (isAdmin && activeTab !== 'productCategories') {
      setActiveTab('productCategories');
    }
  }, [isAdmin, activeTab]);

  useEffect(() => {
    if (!isAdminOrOwner) return;

    const loadData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'categories' && isOwner) {
          const data = await financialService.listCategories();
          setCategories(data);
        } else if (activeTab === 'paymentMethods' && isOwner) {
          const data = await financialService.listPaymentMethods();
          setPaymentMethods(data);
        } else if (activeTab === 'productCategories') {
          // Clear cache to always get fresh data from Firestore
          productCategoryService.clearCache();
          const data = await productCategoryService.listCategories();
          setProductCategories(data);
        }
      } catch (err) {
        console.error('Failed to load master data', err);
        toast({ title: 'Gagal memuat data', description: 'Periksa koneksi atau izin akses.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isAdminOrOwner, isOwner, activeTab, toast]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const created = await financialService.addCategory(newCategoryName.trim(), newCategoryType, user?.uid, user?.role);
      setCategories((prev) => [created, ...prev]);
      setNewCategoryName('');
      setShowAddCategory(false);
      toast({ title: 'Kategori ditambahkan', description: created.name, variant: 'success' });
    } catch (err) {
      console.error('Failed to add category', err);
      toast({ title: 'Gagal menambah kategori', variant: 'destructive' });
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const target = categories.find((cat) => cat.id === categoryId);
    if (!target) return;
    if (!window.confirm(`Hapus kategori "${target.name}"?`)) {
      return;
    }
    try {
      setDeletingCategoryId(categoryId);
      await financialService.deleteCategory(categoryId);
      setCategories((prev) => prev.filter((cat) => cat.id !== categoryId));
      toast({ title: 'Kategori dihapus', description: target.name });
    } catch (err) {
      console.error('Failed to delete category', err);
      toast({ title: 'Gagal hapus kategori', variant: 'destructive' });
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const handleAddPaymentMethod = async () => {
    if (!newPaymentMethodName.trim()) return;
    try {
      const created = await financialService.addPaymentMethod(newPaymentMethodName.trim(), user?.uid, user?.role);
      setPaymentMethods((prev) => [created, ...prev]);
      setNewPaymentMethodName('');
      setShowAddPaymentMethod(false);
      toast({ title: 'Metode ditambahkan', description: created.name, variant: 'success' });
    } catch (err) {
      console.error('Failed to add payment method', err);
      const message = err instanceof Error ? err.message : 'Periksa koneksi atau izin akses.';
      toast({ title: 'Gagal menambah metode', description: message, variant: 'destructive' });
    }
  };

  const handleDeletePaymentMethod = async (methodId: string) => {
    const target = paymentMethods.find((method) => method.id === methodId);
    if (!target) return;
    if (!window.confirm(`Hapus metode "${target.name}"?`)) {
      return;
    }
    try {
      setDeletingPaymentMethodId(methodId);
      await financialService.deletePaymentMethod(methodId);
      setPaymentMethods((prev) => prev.filter((method) => method.id !== methodId));
      toast({ title: 'Metode dihapus', description: target.name });
    } catch (err) {
      console.error('Failed to delete payment method', err);
      const message = err instanceof Error ? err.message : 'Periksa koneksi atau izin akses.';
      toast({ title: 'Gagal hapus metode', description: message, variant: 'destructive' });
    } finally {
      setDeletingPaymentMethodId(null);
    }
  };

  const handleAddProductCategory = async () => {
    if (!newProductCategoryName.trim()) return;
    try {
      console.log('🔄 Attempting to add category:', newProductCategoryName.trim(), 'icon:', newProductCategoryIcon);
      const created = await productCategoryService.addCategory(
        newProductCategoryName.trim(),
        user?.uid,
        user?.role,
        newProductCategoryIcon || undefined
      );
      console.log('✅ Category added successfully:', created);
      setProductCategories((prev) => [created, ...prev]);
      setNewProductCategoryName('');
      setNewProductCategoryIcon('');
      setShowAddProductCategory(false);
      toast({ title: 'Kategori produk ditambahkan', description: created.name, variant: 'success' });
    } catch (err) {
      console.error('❌ Failed to add product category:', err);
      const message = err instanceof Error ? err.message : 'Periksa koneksi atau izin akses.';
      toast({ title: 'Gagal menambah kategori produk', description: message, variant: 'destructive' });
    }
  };

  const handleDeleteProductCategory = async (categoryId: string) => {
    const target = productCategories.find((cat) => cat.id === categoryId);
    if (!target) return;
    if (!window.confirm(`Hapus kategori produk "${target.name}"?`)) {
      return;
    }
    try {
      setDeletingProductCategoryId(categoryId);
      await productCategoryService.deleteCategory(categoryId);
      setProductCategories((prev) => prev.filter((cat) => cat.id !== categoryId));
      toast({ title: 'Kategori produk dihapus', description: target.name });
    } catch (err) {
      console.error('Failed to delete product category', err);
      const message = err instanceof Error ? err.message : 'Periksa koneksi atau izin akses.';
      toast({ title: 'Gagal hapus kategori produk', description: message, variant: 'destructive' });
    } finally {
      setDeletingProductCategoryId(null);
    }
  };

  // Block non-admin/non-owner completely
  if (!isAdminOrOwner) {
    return (
      <div className="min-h-screen bg-brand-surface">
        <PageHeader title="Data Master" subtitle="Akses Ditolak" onBack={onBack} />
        <div className="p-4">
          <EmptyState title="Akses ditolak" description="Fitur ini khusus untuk admin dan owner." />
        </div>
      </div>
    );
  }

  const expenseCategories = categories.filter((cat) => cat.type === 'expense');
  const incomeCategories = categories.filter((cat) => cat.type === 'income');

  return (
    <div className="min-h-screen bg-brand-surface">
      <PageHeader
        title="Data Master"
        subtitle={isAdmin ? 'Kelola kategori produk' : 'Kelola kategori keuangan dan metode pembayaran'}
        onBack={onBack}
      />

      <div className="p-4 space-y-4">
        {/* Tabs - GOLD THEME */}
        <div className="flex gap-2 p-1 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] overflow-x-auto shine-effect">
          {/* Only show financial tabs for owner */}
          {isOwner && (
            <>
              <button
                onClick={() => setActiveTab('categories')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'categories'
                  ? 'bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white shadow-sm font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <Tags className="w-4 h-4" />
                Kategori Keuangan
              </button>
              <button
                onClick={() => setActiveTab('paymentMethods')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'paymentMethods'
                  ? 'bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white shadow-sm font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <CreditCard className="w-4 h-4" />
                Metode Pembayaran
              </button>
            </>
          )}
          <button
            onClick={() => setActiveTab('productCategories')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'productCategories'
              ? 'bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white shadow-sm font-bold'
              : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <Package className="w-4 h-4" />
            Kategori Produk
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {activeTab === 'categories' && isOwner && (
              <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 shine-effect">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Layers className="w-4 h-4" />
                    <span className="text-sm font-semibold">Daftar Kategori</span>
                  </div>
                  <button
                    onClick={() => setShowAddCategory(!showAddCategory)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#997B2C] hover:text-[#997B2C]/80"
                  >
                    <Plus className="w-4 h-4" /> Tambah Baru
                  </button>
                </div>

                {showAddCategory && (
                  <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Tambah Kategori Baru</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <select
                        value={newCategoryType}
                        onChange={(e) => setNewCategoryType(e.target.value as FinancialType)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/60"
                      >
                        <option value="expense">Biaya</option>
                        <option value="income">Pendapatan</option>
                      </select>
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/60"
                        placeholder="Nama Kategori (mis. Gaji Karyawan)"
                      />
                      <button
                        onClick={handleAddCategory}
                        disabled={!newCategoryName.trim()}
                        className="rounded-lg bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] px-3 py-2 text-sm font-bold text-white hover:shadow-lg transition-all disabled:opacity-50"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2 border-b border-slate-100 pb-1">Biaya</p>
                    <div className="space-y-2">
                      {expenseCategories.length === 0 && (
                        <p className="text-xs text-slate-400 py-2">Belum ada kategori biaya</p>
                      )}
                      {expenseCategories.map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                          <span className="text-slate-800">{cat.name}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id)}
                            disabled={deletingCategoryId === cat.id}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2 border-b border-slate-100 pb-1">Pendapatan</p>
                    <div className="space-y-2">
                      {incomeCategories.length === 0 && (
                        <p className="text-xs text-slate-400 py-2">Belum ada kategori pendapatan</p>
                      )}
                      {incomeCategories.map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                          <span className="text-slate-800">{cat.name}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id)}
                            disabled={deletingCategoryId === cat.id}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'paymentMethods' && isOwner && (
              <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 shine-effect">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-slate-700">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-sm font-semibold">Metode Pembayaran</span>
                  </div>
                  <button
                    onClick={() => setShowAddPaymentMethod(!showAddPaymentMethod)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#997B2C] hover:text-[#997B2C]/80"
                  >
                    <Plus className="w-4 h-4" /> Tambah Baru
                  </button>
                </div>

                {showAddPaymentMethod && (
                  <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Tambah Metode Baru</p>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newPaymentMethodName}
                        onChange={(e) => setNewPaymentMethodName(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/60"
                        placeholder="Nama Metode (mis. Transfer BCA, QRIS)"
                      />
                      <button
                        onClick={handleAddPaymentMethod}
                        disabled={!newPaymentMethodName.trim()}
                        className="rounded-lg bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] px-3 py-2 text-sm font-bold text-white hover:shadow-lg transition-all disabled:opacity-50"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>
                )}

                {paymentMethods.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Belum ada metode pembayaran tersimpan.</p>
                ) : (
                  <div className="space-y-2">
                    {paymentMethods.map((method) => (
                      <div key={method.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                        <span className="text-slate-800 font-medium">{method.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeletePaymentMethod(method.id)}
                          disabled={deletingPaymentMethodId === method.id}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" /> Hapus
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'productCategories' && (
              <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 shine-effect">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Package className="w-4 h-4" />
                    <span className="text-sm font-semibold">Kategori Produk</span>
                  </div>
                  <button
                    onClick={() => setShowAddProductCategory(!showAddProductCategory)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#997B2C] hover:text-[#997B2C]/80"
                  >
                    <Plus className="w-4 h-4" /> Tambah Baru
                  </button>
                </div>

                {showAddProductCategory && (
                  <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Tambah Kategori Produk Baru</p>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newProductCategoryName}
                        onChange={(e) => setNewProductCategoryName(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/60"
                        placeholder="Nama Kategori (mis. Gamis, Hijab, Aksesoris)"
                      />
                      <button
                        onClick={handleAddProductCategory}
                        disabled={!newProductCategoryName.trim()}
                        className="rounded-lg bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] px-3 py-2 text-sm font-bold text-white hover:shadow-lg transition-all disabled:opacity-50"
                      >
                        Simpan
                      </button>
                    </div>

                    {/* Icon Picker */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Pilih Icon Kategori</p>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {AVAILABLE_ICONS.map((iconItem) => {
                          const isSelected = newProductCategoryIcon === iconItem.path;
                          return (
                            <button
                              key={iconItem.path}
                              type="button"
                              onClick={() => setNewProductCategoryIcon(isSelected ? '' : iconItem.path)}
                              className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all duration-200 ${
                                isSelected
                                  ? 'border-[#D4AF37] bg-[#D4AF37]/10 shadow-md ring-2 ring-[#D4AF37]/30'
                                  : 'border-slate-200 bg-white hover:border-[#D4AF37]/50 hover:bg-slate-50'
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#D4AF37] rounded-full flex items-center justify-center shadow-sm">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                              <img
                                src={iconItem.path}
                                alt={iconItem.label}
                                className="w-8 h-8 object-contain"
                                style={{ mixBlendMode: 'multiply' }}
                              />
                              <span className="text-[9px] text-slate-500 font-medium leading-tight text-center">{iconItem.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {!newProductCategoryIcon && (
                        <p className="text-[10px] text-slate-400 mt-1.5">* Opsional. Jika tidak dipilih, akan menggunakan icon default.</p>
                      )}
                    </div>
                  </div>
                )}

                {productCategories.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Belum ada kategori produk tersimpan.</p>
                ) : (
                  <div className="space-y-2">
                    {productCategories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                        <div className="flex items-center gap-2.5">
                          {cat.icon ? (
                            <img
                              src={cat.icon}
                              alt={cat.name}
                              className="w-7 h-7 object-contain flex-shrink-0"
                              style={{ mixBlendMode: 'multiply' }}
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 text-slate-400" />
                            </div>
                          )}
                          <span className="text-slate-800 font-medium">{cat.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteProductCategory(cat.id)}
                          disabled={deletingProductCategoryId === cat.id}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" /> Hapus
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminMasterDataPage;
