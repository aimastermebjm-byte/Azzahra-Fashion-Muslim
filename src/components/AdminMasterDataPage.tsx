import React, { useEffect, useState } from 'react';
import { Tags, Plus, Trash2, CreditCard, Layers, Package } from 'lucide-react';
import PageHeader from './PageHeader';
import EmptyState from './ui/EmptyState';
import { useToast } from './ToastProvider';
import { financialService, FinancialCategory, FinancialType, PaymentMethod } from '../services/financialService';
import { productCategoryService, ProductCategory } from '../services/productCategoryService';

interface AdminMasterDataPageProps {
  onBack: () => void;
  user: any;
}

const AdminMasterDataPage: React.FC<AdminMasterDataPageProps> = ({ onBack, user }) => {
  const { showToast: toast } = useToast();
  const [activeTab, setActiveTab] = useState<'categories' | 'paymentMethods' | 'productCategories'>('categories');

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
  const [showAddProductCategory, setShowAddProductCategory] = useState(false);
  const [deletingProductCategoryId, setDeletingProductCategoryId] = useState<string | null>(null);

  const isOwner = user?.role === 'owner';

  useEffect(() => {
    if (!isOwner) return;

    const loadData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'categories') {
          const data = await financialService.listCategories();
          setCategories(data);
        } else if (activeTab === 'paymentMethods') {
          const data = await financialService.listPaymentMethods();
          setPaymentMethods(data);
        } else if (activeTab === 'productCategories') {
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
  }, [isOwner, activeTab, toast]);

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
      console.log('🔄 Attempting to add category:', newProductCategoryName.trim());
      const created = await productCategoryService.addCategory(newProductCategoryName.trim(), user?.uid, user?.role);
      console.log('✅ Category added successfully:', created);
      setProductCategories((prev) => [created, ...prev]);
      setNewProductCategoryName('');
      setShowAddProductCategory(false);
      toast({ title: 'Kategori produk ditambahkan', description: created.name, variant: 'success' });
    } catch (err) {
      console.error('❌ Failed to add product category:', err);
      console.error('Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : null,
        user: user?.uid,
        role: user?.role
      });
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

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-brand-surface">
        <PageHeader title="Data Master" subtitle="Akses Ditolak" onBack={onBack} />
        <div className="p-4">
          <EmptyState title="Akses ditolak" description="Fitur ini khusus untuk owner." />
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
        subtitle="Kelola kategori keuangan dan metode pembayaran"
        onBack={onBack}
        variant="gradient"
      />

      <div className="p-4 space-y-4">
        {/* Tabs - GOLD THEME */}
        <div className="flex gap-2 p-1 bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] overflow-x-auto shine-effect">
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'categories'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <Tags className="w-4 h-4" />
            Kategori Keuangan
          </button>
          <button
            onClick={() => setActiveTab('paymentMethods')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'paymentMethods'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <CreditCard className="w-4 h-4" />
            Metode Pembayaran
          </button>
          <button
            onClick={() => setActiveTab('productCategories')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'productCategories'
                ? 'bg-brand-primary text-white shadow-sm'
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
            {activeTab === 'categories' && (
              <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 shine-effect">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Layers className="w-4 h-4" />
                    <span className="text-sm font-semibold">Daftar Kategori</span>
                  </div>
                  <button
                    onClick={() => setShowAddCategory(!showAddCategory)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:text-brand-primary/80"
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
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
                      >
                        <option value="expense">Biaya</option>
                        <option value="income">Pendapatan</option>
                      </select>
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
                        placeholder="Nama Kategori (mis. Gaji Karyawan)"
                      />
                      <button
                        onClick={handleAddCategory}
                        disabled={!newCategoryName.trim()}
                        className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50"
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

            {activeTab === 'paymentMethods' && (
              <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 shine-effect">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-slate-700">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-sm font-semibold">Metode Pembayaran</span>
                  </div>
                  <button
                    onClick={() => setShowAddPaymentMethod(!showAddPaymentMethod)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:text-brand-primary/80"
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
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
                        placeholder="Nama Metode (mis. Transfer BCA, QRIS)"
                      />
                      <button
                        onClick={handleAddPaymentMethod}
                        disabled={!newPaymentMethodName.trim()}
                        className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50"
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
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:text-brand-primary/80"
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
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
                        placeholder="Nama Kategori (mis. Gamis, Hijab, Aksesoris)"
                      />
                      <button
                        onClick={handleAddProductCategory}
                        disabled={!newProductCategoryName.trim()}
                        className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>
                )}

                {productCategories.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Belum ada kategori produk tersimpan.</p>
                ) : (
                  <div className="space-y-2">
                    {productCategories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                        <span className="text-slate-800 font-medium">{cat.name}</span>
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
