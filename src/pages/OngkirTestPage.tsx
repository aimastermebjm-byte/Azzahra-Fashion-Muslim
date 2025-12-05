import React, { useState } from 'react';
import { Calculator, Package } from 'lucide-react';
import OngkirChecker from '../components/OngkirChecker';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/ui/EmptyState';

interface OngkirTestPageProps {
  onBack?: () => void;
}

export const OngkirTestPage: React.FC<OngkirTestPageProps> = ({ onBack }) => {
  const [selectedShipping, setSelectedShipping] = useState<{
    courier: string;
    service: string;
    cost: number;
    etd: string;
  } | null>(null);

  const handleCostSelected = (courier: string, service: string, cost: number, etd: string) => {
    setSelectedShipping({
      courier,
      service,
      cost,
      etd
    });
  };

  const formatCourierName = (courier: string) => {
    const courierNames: { [key: string]: string } = {
      'jne': 'JNE',
      'tiki': 'TIKI',
      'pos': 'POS Indonesia',
      'jnt': 'J&T Express',
      'sicepat': 'SiCepat',
      'wahana': 'Wahana',
      'anteraja': 'AnterAja'
    };
    return courierNames[courier] || courier.toUpperCase();
  };

  return (
    <div className="min-h-screen bg-brand-surface pb-16">
      <PageHeader
        title="Cek Ongkos Kirim"
        subtitle="Simulasikan biaya pengiriman dan bandingkan layanan kurir secara real-time"
        onBack={onBack}
        variant="card"
        actions={selectedShipping ? (
          <div className="text-right">
            <p className="text-xs text-slate-500">Estimasi Terpilih</p>
            <p className="text-lg font-semibold text-brand-primary">Rp {selectedShipping.cost.toLocaleString('id-ID')}</p>
          </div>
        ) : undefined}
      />

      <div className="mx-auto max-w-5xl px-4 pb-12">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="rounded-2xl border border-white/40 bg-white/95 p-5 shadow-sm">
            <OngkirChecker
              originCityId="152"
              weight={1000}
              onCostSelected={handleCostSelected}
            />
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/40 bg-white/95 p-5 shadow-sm lg:sticky lg:top-4">
              <h2 className="flex items-center text-lg font-semibold text-slate-900">
                <Package className="mr-2 h-5 w-5 text-brand-primary" />
                Info Pengiriman
              </h2>

              {selectedShipping ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-700">✅ Pengiriman Terpilih</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>Kurir</span>
                        <span className="font-semibold text-slate-900">{formatCourierName(selectedShipping.courier)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Layanan</span>
                        <span className="font-semibold text-slate-900">{selectedShipping.service}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Estimasi</span>
                        <span className="font-semibold text-slate-900">{selectedShipping.etd}</span>
                      </div>
                      <div className="flex items-center justify-between text-base font-bold text-emerald-700">
                        <span>Biaya</span>
                        <span>Rp {selectedShipping.cost.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>

                  <button className="btn-brand w-full">Lanjut ke Pembayaran</button>
                </div>
              ) : (
                <EmptyState
                  className="mt-6"
                  icon={<Package className="h-10 w-10 text-brand-primary" />}
                  title="Belum ada kurir dipilih"
                  description="Isi formulir di sebelah kiri untuk melihat estimasi ongkir dari berbagai kurir."
                />
              )}

              <div className="mt-6 border-t border-dashed border-slate-200 pt-4 text-xs text-slate-500">
                <p className="font-semibold text-slate-700">Informasi Tambahan</p>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  <li>Estimasi waktu dapat berubah sesuai kondisi operasional.</li>
                  <li>Biaya belum termasuk asuransi dan penjemputan.</li>
                  <li>Pengiriman diproses pada hari kerja operasional toko.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-6">
          <h3 className="text-lg font-semibold text-brand-primary">Cara Penggunaan</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary text-white font-bold">
                  {step}
                </div>
                <p className="text-sm text-slate-600">
                  {step === 1 && 'Pilih provinsi tujuan'}
                  {step === 2 && 'Pilih kota/kabupaten'}
                  {step === 3 && 'Pilih kurir favorit'}
                  {step === 4 && 'Klik “Cek Ongkir”'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OngkirTestPage;