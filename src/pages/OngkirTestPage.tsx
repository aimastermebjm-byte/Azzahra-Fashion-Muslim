import React, { useState } from 'react';
import { ArrowLeft, Calculator, Package } from 'lucide-react';
import OngkirChecker from '../components/OngkirChecker';

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 mr-3"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center">
              <Calculator className="w-6 h-6 text-blue-500 mr-3" />
              <h1 className="text-xl font-bold text-gray-800">Cek Ongkos Kirim</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ongkir Checker */}
          <div className="lg:col-span-2">
            <OngkirChecker
              originCityId="152" // Jakarta Pusat
              weight={1000} // 1kg
              onCostSelected={handleCostSelected}
            />
          </div>

          {/* Selected Shipping Info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Info Pengiriman
              </h2>

              {selectedShipping ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800 mb-2">
                      ✅ Pengiriman Terpilih
                    </p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-gray-600">Kurir</p>
                        <p className="font-medium text-gray-800">
                          {formatCourierName(selectedShipping.courier)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Layanan</p>
                        <p className="font-medium text-gray-800">
                          {selectedShipping.service}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Estimasi</p>
                        <p className="font-medium text-gray-800">
                          {selectedShipping.etd}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Biaya</p>
                        <p className="font-bold text-lg text-green-600">
                          Rp {selectedShipping.cost.toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200">
                    Lanjut ke Pembayaran
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm mb-4">
                    Belum ada metode pengiriman yang dipilih
                  </p>
                  <p className="text-gray-400 text-xs">
                    Pilih kurir dan layanan di form sebelah kiri
                  </p>
                </div>
              )}

              {/* Informasi Tambahan */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Informasi Tambahan
                </h3>
                <div className="space-y-2 text-xs text-gray-500">
                  <div className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Estimasi waktu pengiriman dapat berubah tergantung kondisi</span>
                  </div>
                  <div className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Biaya yang tertera adalah estimasi dan belum termasuk asuransi</span>
                  </div>
                  <div className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Proses pengiriman akan dilakukan pada hari kerja</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contoh Penggunaan */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">
            Cara Penggunaan
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                1
              </div>
              <p className="text-sm text-blue-700">
                Pilih provinsi tujuan
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                2
              </div>
              <p className="text-sm text-blue-700">
                Pilih kota/kabupaten
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                3
              </div>
              <p className="text-sm text-blue-700">
                Pilih kurir
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                4
              </div>
              <p className="text-sm text-blue-700">
                Klik "Cek Ongkir"
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OngkirTestPage;