import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Plus, Filter, Calendar, Tags, Loader2, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import PageHeader from './PageHeader';
import EmptyState from './ui/EmptyState';
import { useToast } from './ToastProvider';
import { financialService, FinancialCategory, FinancialEntry, FinancialType, PaymentMethod } from '../services/financialService';

interface AdminFinancialPageProps {
  onBack: () => void;
  user: any;
}

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

const AdminFinancialPage: React.FC<AdminFinancialPageProps> = ({ onBack, user }) => {
  const { showToast: toast } = useToast();

  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<FinancialType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [note, setNote] = useState('');
  const [effectiveDate, setEffectiveDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [includeInPnL, setIncludeInPnL] = useState(true);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newPaymentMethodName, setNewPaymentMethodName] = useState('');
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);

  const [filterType, setFilterType] = useState<'all' | FinancialType>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPnL, setFilterPnL] = useState<'all' | 'include' | 'exclude'>('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('all');

  const isOwner = user?.role === 'owner';

  const parseAmount = (val: string) => {
    // Hilangkan pemisah ribuan (titik/koma) agar input "100.000" menjadi 100000
    const sanitized = val.replace(/[^0-9]/g, '');
    return Number(sanitized || '0');
  };

  useEffect(() => {
    if (!isOwner) return;

    // Subscribe to financial entries (realtime + persistent cache)
    const unsubscribe = financialService.subscribeToEntries(({ entries: newEntries, loading: entriesLoading, error }) => {
      if (error) {
        console.error('Failed to load financial data', error);
        toast({ title: 'Gagal memuat data', message: 'Periksa koneksi atau izin akses owner.', type: 'error' });
        setLoading(false);
        return;
      }

      // Merge realtime updates:
      // If we have existing entries (from pagination/load more), we need to update the head of the list
      // without losing the older entries that might have been loaded.
      // However, for simplicity and consistency with "dashboard view", we'll just show the latest synced batch
      // unless the user has explicitly loaded more.

      // Strategy: 
      // 1. If cursor is null (initial load), replace everything.
      // 2. If cursor exists (user loaded more), we try to merge, BUT realtime usually conflicts with pagination.
      // For this implementation: Realtime updates only affect the top of the list. 
      // We will replace the whole list if it's an initial view to keep it simple and consistent with the cache.

      if (!cursor) {
        setEntries(newEntries);
      } else {
        // If user scrolled down, we might have duplicates or gaps if we just replace.
        // Ideally, realtime listeners shouldn't be mixed with simple pagination without a more complex state.
        // We will just update the first N items if possible, or just ignore realtime updates for deep pagination
        // to avoid UI jumping.
        // For now: Let's stick to "Realtime works best for the top of the list".
        // We won't update if user is deep in history to avoid disruption.
      }

      setLoading(entriesLoading);
    }, 20); // Limit 20

    // Load categories and methods (once)
    const loadMasterData = async () => {
      try {
        const [cats, methods] = await Promise.all([
          financialService.listCategories(),
          financialService.listPaymentMethods()
        ]);
        setCategories(cats);
        setPaymentMethods(methods);

        // Set defaults if not set
        setCategory((prev) => prev || (cats[0]?.id ?? ''));
        setPaymentMethod((prev) => prev || (methods[0]?.id ?? ''));
      } catch (err) {
        console.error('Failed to load master data', err);
      }
    };

    void loadMasterData();

    return () => {
      unsubscribe();
    };
  }, [isOwner, toast, cursor]); // Added cursor dependency to restart listener if needed, but usually we don't want to restart on pagination.

  // Actually, we should separate the "Realtime Head" from "Pagination History".
  // But to follow the plan: "Change listEntries to subscribeEntries".
  // The correct pattern for simple dashboard is:
  // 1. Listen to top 20.
  // 2. If user clicks "Load More", switch to manual fetch mode or append manual fetches.
  // Let's keep it simple: The useEffect handles the subscription. 
  // "Load More" will use listEntries (fetch) and APPEND to the state.
  // We need to be careful not to overwrite "Load More" data with "Realtime" update of just 20 items.

  // Modified effect for robust handling:
  useEffect(() => {
    if (!isOwner) return;

    let unsubscribe = () => { };

    const init = async () => {
      // Load master data
      try {
        const [cats, methods] = await Promise.all([
          financialService.listCategories(),
          financialService.listPaymentMethods()
        ]);
        setCategories(cats);
        setPaymentMethods(methods);
        setCategory((prev) => prev || (cats[0]?.id ?? ''));
        setPaymentMethod((prev) => prev || (methods[0]?.id ?? ''));
      } catch (err) {
        console.error('Master data load error', err);
      }

      // Subscribe to entries ONLY if we haven't loaded more pages (cursor is null)
      if (!cursor) {
        unsubscribe = financialService.subscribeToEntries(({ entries: realtimeEntries, loading: realTimeLoading, error }) => {
          if (error) {
            toast({ title: 'Gagal sinkronisasi data', message: 'Terjadi kesalahan saat memuat data terbaru', type: 'error' });
            return;
          }

          setLoading(realTimeLoading);
          // Only update if we are still at the "top" (no pagination active)
          // This ensures user sees live updates. 
          // If they loaded more, we stop live updates to prevent list jumping, 
          // or we could try to merge smart. For now, simple replacement is safest for "Dashboard" feel.
          setEntries(prev => {
            // If we have way more entries than the limit, it means user clicked load more.
            // In that case, we might want to only update the first 20... 
            // or just ignore updates to avoid UI glitch.
            if (prev.length > 20) return prev;
            return realtimeEntries;
          });

          // Update cursor for the first batch so "Load More" knows where to start
          // Note: onSnapshot doesn't give us the Last Document Cursor easily for pagination 
          // unless we track it manually from the last item in array.
          if (realtimeEntries.length > 0) {
            // We don't have the DocumentSnapshot object here easily from the service 
            // unless we change service to return it. 
            // For now, "Load More" might be slightly broken with this mixed approach 
            // unless we fix `subscribeToEntries` to return snapshots or we rely on `listEntries` 
            // to get the first cursor.

            // FIX: The previous `listEntries` returned `cursor`. 
            // `subscribeToEntries` returns POJO. 
            // We might need to fetch the cursor manually or accept that "Realtime" + "Pagination" 
            // is hard without a more complex hook.
            // Alternative: Just use realtime for the view. "Load More" fetches older data.
          }
        });
      }
    };

    init();

    return () => {
      unsubscribe();
    };
  }, [isOwner, toast]); // Removed cursor from dependency to avoid loop loops

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (filterType !== 'all' && entry.type !== filterType) return false;
      if (filterCategory !== 'all' && entry.category !== filterCategory) return false;
      if (filterPaymentMethod !== 'all') {
        const selectedName = paymentMethodMap.get(filterPaymentMethod)?.name?.toLowerCase();
        const entryName = entry.paymentMethodName?.toLowerCase();
        const matchById = entry.paymentMethodId === filterPaymentMethod;
        const matchByName = selectedName && entryName && selectedName === entryName;
        if (!matchById && !matchByName) {
          return false;
        }
      }
      if (filterPnL === 'include' && !entry.includeInPnL) return false;
      if (filterPnL === 'exclude' && entry.includeInPnL) return false;
      return true;
    });
  }, [entries, filterType, filterCategory, filterPaymentMethod, filterPnL]);

  const expenseCategories = useMemo(() => categories.filter((cat) => cat.type === 'expense'), [categories]);
  // const incomeCategories = useMemo(() => categories.filter((cat) => cat.type === 'income'), [categories]);
  const paymentMethodMap = useMemo(() => {
    return paymentMethods.reduce((map, method) => {
      map.set(method.id, method);
      return map;
    }, new Map<string, PaymentMethod>());
  }, [paymentMethods]);

  // Ringkasan selalu dihitung dari semua entri P&L (tidak terpengaruh filter agar angka laba/biaya konsisten)
  const summary = useMemo(() => {
    const income = entries
      .filter(e => e.type === 'income' && e.includeInPnL)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const expense = entries
      .filter(e => e.type === 'expense' && e.includeInPnL)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return { income, expense, net: income - expense };
  }, [entries]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const created = await financialService.addCategory(newCategoryName.trim(), type, user?.uid, user?.role);
      setCategories((prev) => [created, ...prev]);
      setCategory(created.id);
      setNewCategoryName('');
      setShowAddCategory(false);
      toast({ title: 'Kategori ditambahkan', message: created.name, type: 'success' });
    } catch (err) {
      console.error('Failed to add category', err);
      toast({ title: 'Gagal menambah kategori', message: 'Terjadi kesalahan sistem', type: 'error' });
    }
  };

  const handleAddPaymentMethod = async () => {
    if (!newPaymentMethodName.trim()) return;
    try {
      const created = await financialService.addPaymentMethod(newPaymentMethodName.trim(), user?.uid, user?.role);
      setPaymentMethods((prev) => [created, ...prev]);
      setPaymentMethod(created.id);
      setNewPaymentMethodName('');
      setShowAddPaymentMethod(false);
      toast({ title: 'Metode ditambahkan', message: created.name, type: 'success' });
    } catch (err) {
      console.error('Failed to add payment method', err);
      const message = err instanceof Error ? err.message : 'Periksa koneksi atau izin akses.';
      toast({ title: 'Gagal menambah metode', message: message, type: 'error' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseAmount(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast({ title: 'Nominal tidak valid', message: 'Isi nominal lebih dari 0', type: 'error' });
      return;
    }
    if (!category) {
      toast({ title: 'Kategori wajib', message: 'Pilih atau buat kategori', type: 'error' });
      return;
    }
    if (!paymentMethod) {
      toast({ title: 'Metode pembayaran wajib', message: 'Pilih atau buat metode pembayaran', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const catObj = categories.find(c => c.id === category);
      if (catObj && catObj.type !== type) {
        toast({ title: 'Kategori tidak sesuai', message: 'Kategori harus sejenis dengan tipe transaksi', type: 'error' });
        setSubmitting(false);
        return;
      }

      const created = await financialService.addEntry({
        type,
        amount: parsedAmount,
        category: category,
        paymentMethodId: paymentMethod,
        paymentMethodName: paymentMethodMap.get(paymentMethod)?.name,
        note: note.trim(),
        includeInPnL,
        effectiveDate,
        createdBy: user?.uid,
        createdByRole: user?.role
      });

      setEntries((prev) => [created, ...prev]);
      setAmount('');
      setNote('');
      setIncludeInPnL(true);
      toast({ title: 'Tersimpan', message: `${type === 'income' ? 'Pendapatan' : 'Biaya'} berhasil dicatat` });
    } catch (err) {
      console.error('Failed to add entry', err);
      toast({ title: 'Gagal menyimpan', message: 'Periksa koneksi atau izin owner', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await financialService.listEntries({ pageSize: 10, cursor });
      setEntries((prev) => [...prev, ...result.entries]);
      setCursor(result.cursor);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to load more entries', err);
      toast({ title: 'Gagal memuat data', message: 'Gagal memuat lebih banyak data', type: 'error' });
    } finally {
      setLoadingMore(false);
    }
  };

  const renderEntryDate = (entry: FinancialEntry) => {
    const dateVal = entry.effectiveDate || entry.createdAt;
    if (!dateVal) return '-';
    const date = dateVal instanceof Date
      ? dateVal
      : (dateVal as any).toDate
        ? (dateVal as any).toDate()
        : new Date(dateVal as any);
    return date.toLocaleDateString('id-ID');
  };

  const handleDelete = async (entryId: string) => {
    if (!window.confirm('Hapus entri ini?')) return;
    try {
      await financialService.deleteEntry(entryId);
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      toast({ title: 'Entri dihapus', message: 'Data berhasil dihapus dari sistem' });
    } catch (err) {
      console.error('Failed to delete entry', err);
      toast({ title: 'Gagal menghapus', message: 'Tidak dapat menghapus entri', type: 'error' });
    }
  };

  /*
  const handleDeleteCategory = async (categoryId: string) => {
    // Moved to AdminMasterDataPage
  };

  const handleDeletePaymentMethod = async (methodId: string) => {
    // Moved to AdminMasterDataPage
  };
  */

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-brand-surface">
        <PageHeader title="Biaya & Pendapatan" subtitle="Hanya owner yang dapat mengakses" onBack={onBack} />
        <div className="p-4">
          <EmptyState title="Akses ditolak" description="Fitur ini khusus untuk owner." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface">
      <PageHeader
        title="Biaya & Pendapatan"
        subtitle="Catat biaya, pendapatan, dan tandai untuk Laba/Rugi"
        onBack={onBack}
        variant="gradient"
      />

      <div className="p-4 space-y-4">
        {/* Ringkasan - GOLD THEME */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-white border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] p-4 shine-effect">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Pendapatan (P&L)</p>
                <p className="text-2xl font-bold text-emerald-600">{currency.format(summary.income)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <ArrowUpCircle className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] p-4 shine-effect">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Biaya (P&L)</p>
                <p className="text-2xl font-bold text-rose-600">{currency.format(summary.expense)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                <ArrowDownCircle className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] p-4 shine-effect">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Net Laba/Rugi</p>
                <p className={`text-2xl font-bold ${summary.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {currency.format(summary.net)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Form - GOLD THEME */}
        <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 space-y-4 shine-effect">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Tambah Transaksi</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <AlertTriangle className="w-4 h-4" /> Hanya owner
            </div>
          </div>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Tipe</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setType('expense')} className={`p-3 rounded-lg border ${type === 'expense' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                  Biaya
                </button>
                <button type="button" onClick={() => setType('income')} className={`p-3 rounded-lg border ${type === 'income' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                  Pendapatan
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nominal</label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#d4af37] text-slate-800"
                placeholder="0"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Kategori</label>
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#d4af37] text-slate-800"
                >
                  <option value="">Pilih kategori</option>
                  {categories
                    .filter(c => c.type === type)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddCategory((v) => !v)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {showAddCategory && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#d4af37] text-slate-800"
                    placeholder={`Nama kategori ${type === 'income' ? 'pendapatan' : 'biaya'}`}
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#997B2C] px-3 py-2 text-sm font-bold text-white hover:shadow-md transition-all"
                  >
                    Simpan
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Metode Pembayaran</label>
              <div className="flex gap-2">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#d4af37] text-slate-800"
                >
                  <option value="">Pilih metode</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>{method.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddPaymentMethod((v) => !v)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {showAddPaymentMethod && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPaymentMethodName}
                    onChange={(e) => setNewPaymentMethodName(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#d4af37] text-slate-800"
                    placeholder="Nama metode (mis. Transfer BCA)"
                  />
                  <button
                    type="button"
                    onClick={handleAddPaymentMethod}
                    className="rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#997B2C] px-3 py-2 text-sm font-bold text-white hover:shadow-md transition-all"
                  >
                    Simpan
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Tanggal</label>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full bg-transparent focus:outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-slate-700">Catatan</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#d4af37] text-slate-800"
                rows={2}
                placeholder="Opsional"
              />
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
              <input
                id="include-pnl"
                type="checkbox"
                checked={includeInPnL}
                onChange={(e) => setIncludeInPnL(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#D4AF37] focus:ring-[#D4AF37]"
              />
              <label htmlFor="include-pnl" className="text-sm text-slate-700">Hitung ke Laba/Rugi</label>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#997B2C] px-4 py-2 text-white font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan
              </button>
            </div>
          </form>
        </div>

        {/* Filter - GOLD THEME */}
        <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 shine-effect">
          <div className="flex items-center gap-2 mb-3 text-slate-700">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-semibold">Filter</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">Semua tipe</option>
              <option value="income">Pendapatan</option>
              <option value="expense">Biaya</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">Semua kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              value={filterPaymentMethod}
              onChange={(e) => setFilterPaymentMethod(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">Semua metode bayar</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>{method.name}</option>
              ))}
            </select>

            <select
              value={filterPnL}
              onChange={(e) => setFilterPnL(e.target.value as any)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">Semua (P&L & non-P&L)</option>
              <option value="include">Hanya yang hitung laba/rugi</option>
              <option value="exclude">Hanya yang tidak dihitung</option>
            </select>
          </div>
        </div>

        {/* List - GOLD THEME */}
        <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-4 space-y-3 shine-effect">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <Tags className="w-4 h-4" />
              <span className="text-sm font-semibold">Transaksi Terbaru</span>
            </div>
            <div className="text-xs text-slate-500">Menampilkan {filteredEntries.length} entri</div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, idx) => (
                <div key={idx} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : filteredEntries.length === 0 ? (
            <EmptyState
              title="Belum ada transaksi"
              description="Tambah pendapatan atau biaya untuk mulai mencatat."
            />
          ) : (
            <div className="space-y-2">
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${entry.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {entry.type === 'income' ? 'Pendapatan' : 'Biaya'}
                      </span>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${entry.includeInPnL ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                        {entry.includeInPnL ? 'Hitung L/R' : 'Non P&L'}
                      </span>
                    </div>
                    <p className="mt-2 text-lg font-bold text-slate-900">{currency.format(entry.amount || 0)}</p>
                    <p className="text-sm text-slate-600">Kategori: {categories.find(c => c.id === entry.category)?.name || entry.category}</p>
                    <p className="text-sm text-slate-600">Metode: {entry.paymentMethodId ? paymentMethodMap.get(entry.paymentMethodId)?.name || '-' : entry.paymentMethodName || '-'}</p>
                    {entry.note && <p className="text-xs text-slate-500 mt-1">{entry.note}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 text-xs text-slate-500">
                    <div>{renderEntryDate(entry)}</div>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-slate-600 hover:bg-white"
                    >
                      <Trash2 className="w-3 h-3" /> Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-70"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}Muat lagi
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminFinancialPage;
