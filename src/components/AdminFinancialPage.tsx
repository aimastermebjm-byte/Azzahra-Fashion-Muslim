import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Plus, Filter, Calendar, Tags, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import PageHeader from './PageHeader';
import EmptyState from './ui/EmptyState';
import { useToast } from './ToastProvider';
import { financialService, FinancialCategory, FinancialEntry, FinancialType } from '../services/financialService';

interface AdminFinancialPageProps {
  onBack: () => void;
  user: any;
}

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

const AdminFinancialPage: React.FC<AdminFinancialPageProps> = ({ onBack, user }) => {
  const { toast } = useToast();

  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<FinancialType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [effectiveDate, setEffectiveDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [includeInPnL, setIncludeInPnL] = useState(true);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);

  const [filterType, setFilterType] = useState<'all' | FinancialType>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPnL, setFilterPnL] = useState<'all' | 'include' | 'exclude'>('all');

  const isOwner = user?.role === 'owner';

  useEffect(() => {
    if (!isOwner) return;

    const loadInitial = async () => {
      setLoading(true);
      try {
        const [cats, initialEntries] = await Promise.all([
          financialService.listCategories(),
          financialService.listEntries({ pageSize: 10 })
        ]);
        setCategories(cats);
        setEntries(initialEntries.entries);
        setCursor(initialEntries.cursor);
        setHasMore(initialEntries.hasMore);
      } catch (err) {
        console.error('Failed to load financial data', err);
        toast({ title: 'Gagal memuat data', description: 'Periksa koneksi atau izin akses owner.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    void loadInitial();
  }, [isOwner, toast]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (filterType !== 'all' && entry.type !== filterType) return false;
      if (filterCategory !== 'all' && entry.category !== filterCategory) return false;
      if (filterPnL === 'include' && !entry.includeInPnL) return false;
      if (filterPnL === 'exclude' && entry.includeInPnL) return false;
      return true;
    });
  }, [entries, filterType, filterCategory, filterPnL]);

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
      toast({ title: 'Kategori ditambahkan', description: created.name, variant: 'success' });
    } catch (err) {
      console.error('Failed to add category', err);
      toast({ title: 'Gagal menambah kategori', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast({ title: 'Nominal tidak valid', description: 'Isi nominal lebih dari 0', variant: 'destructive' });
      return;
    }
    if (!category) {
      toast({ title: 'Kategori wajib', description: 'Pilih atau buat kategori', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const catObj = categories.find(c => c.id === category);
      if (catObj && catObj.type !== type) {
        toast({ title: 'Kategori tidak sesuai', description: 'Kategori harus sejenis dengan tipe transaksi', variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      const created = await financialService.addEntry({
        type,
        amount: Number(amount),
        category: category,
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
      toast({ title: 'Tersimpan', description: `${type === 'income' ? 'Pendapatan' : 'Biaya'} berhasil dicatat` });
    } catch (err) {
      console.error('Failed to add entry', err);
      toast({ title: 'Gagal menyimpan', description: 'Periksa koneksi atau izin owner', variant: 'destructive' });
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
      toast({ title: 'Gagal memuat data', variant: 'destructive' });
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
        {/* Ringkasan */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 p-4">
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
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 p-4">
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
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 p-4">
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

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-4">
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
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
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
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
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
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
                    placeholder={`Nama kategori ${type === 'income' ? 'pendapatan' : 'biaya'}`}
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90"
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
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
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
                className="h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
              />
              <label htmlFor="include-pnl" className="text-sm text-slate-700">Hitung ke Laba/Rugi</label>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-white font-semibold hover:bg-brand-primary/90 disabled:opacity-70"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan
              </button>
            </div>
          </form>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
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

        {/* List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
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
                <div key={entry.id} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 flex items-start justify-between">
                  <div>
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
                    {entry.note && <p className="text-xs text-slate-500 mt-1">{entry.note}</p>}
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>{renderEntryDate(entry)}</div>
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
