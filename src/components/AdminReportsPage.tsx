import React, { useState } from 'react';
import { ArrowLeft, Download, Calendar, BarChart3, PieChart, TrendingUp, Package, Users } from 'lucide-react';

interface AdminReportsPageProps {
  onBack: () => void;
  user: any;
}

const AdminReportsPage: React.FC<AdminReportsPageProps> = ({ onBack, user }) => {
  const [reportType, setReportType] = useState('sales');
  const [reportPeriod, setReportPeriod] = useState('today');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const reportData = {
    sales: {
      totalSales: 2500000,
      totalOrders: 45,
      avgOrderValue: 55555,
      topProduct: 'Hijab Segi Empat Premium',
      topCategory: 'Hijab',
      growth: 15.5
    },
    products: {
      totalProducts: 12,
      lowStock: 3,
      outOfStock: 0,
      topSelling: 'Gamis Syari Elegant',
      worstSelling: 'Khimar Basic',
      avgPrice: 125000
    },
    customers: {
      totalCustomers: 234,
      newCustomers: 28,
      activeCustomers: 189,
      topCustomer: 'Siti Nurhaliza',
      avgOrdersPerCustomer: 2.3
    }
  };

  const currentData = reportData[reportType as keyof typeof reportData] || reportData.sales;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Laporan</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Report Type Selector */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-4">Jenis Laporan</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => setReportType('sales')}
              className={`p-3 rounded-lg border-2 transition-colors ${
                reportType === 'sales'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <BarChart3 className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm font-medium">Penjualan</p>
            </button>
            <button
              onClick={() => setReportType('products')}
              className={`p-3 rounded-lg border-2 transition-colors ${
                reportType === 'products'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Package className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm font-medium">Produk</p>
            </button>
            <button
              onClick={() => setReportType('customers')}
              className={`p-3 rounded-lg border-2 transition-colors ${
                reportType === 'customers'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Users className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm font-medium">Pelanggan</p>
            </button>
            <button
              onClick={() => setReportType('financial')}
              className={`p-3 rounded-lg border-2 transition-colors ${
                reportType === 'financial'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm font-medium">Keuangan</p>
            </button>
          </div>
        </div>

        {/* Period Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-3 md:space-y-0">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Periode</label>
              <select
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="today">Hari Ini</option>
                <option value="week">Minggu Ini</option>
                <option value="month">Bulan Ini</option>
                <option value="year">Tahun Ini</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {(reportPeriod === 'custom') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dari</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sampai</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}
            <button className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Generate</span>
            </button>
            <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total {reportType === 'sales' ? 'Penjualan' : reportType === 'products' ? 'Produk' : 'Pelanggan'}</h3>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {reportType === 'sales' && `Rp ${(currentData as any).totalSales.toLocaleString('id-ID')}`}
              {reportType === 'products' && (currentData as any).totalProducts}
              {reportType === 'customers' && (currentData as any).totalCustomers}
              {reportType === 'financial' && 'Rp 5.2M'}
            </p>
            <p className="text-xs text-green-600">+15.5% dari periode lalu</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Transaksi</h3>
              <Package className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {reportType === 'sales' && (currentData as any).totalOrders}
              {reportType === 'products' && (currentData as any).lowStock}
              {reportType === 'customers' && (currentData as any).newCustomers}
              {reportType === 'financial' && '142'}
            </p>
            <p className="text-xs text-gray-500">
              {reportType === 'sales' && 'Total pesanan'}
              {reportType === 'products' && 'Stok rendah'}
              {reportType === 'customers' && 'Pelanggan baru'}
              {reportType === 'financial' && 'Total transaksi'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Rata-rata</h3>
              <PieChart className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {reportType === 'sales' && `Rp ${(currentData as any).avgOrderValue.toLocaleString('id-ID')}`}
              {reportType === 'products' && `Rp ${(currentData as any).avgPrice.toLocaleString('id-ID')}`}
              {reportType === 'customers' && (currentData as any).avgOrdersPerCustomer}
              {reportType === 'financial' && 'Rp 36K'}
            </p>
            <p className="text-xs text-gray-500">
              {reportType === 'sales' && 'Nilai per order'}
              {reportType === 'products' && 'Harga rata-rata'}
              {reportType === 'customers' && 'Order per pelanggan'}
              {reportType === 'financial' && 'Transaksi rata-rata'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Terbaik</h3>
              <BarChart3 className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-lg font-bold text-gray-800 truncate">
              {(currentData as any).topProduct || (currentData as any).topCustomer || 'Hijab'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {reportType === 'sales' && 'Produk terlaris'}
              {reportType === 'products' && 'Produk terlaris'}
              {reportType === 'customers' && 'Pelanggan terbaik'}
              {reportType === 'financial' && 'Kategori terlaris'}
            </p>
          </div>
        </div>

        {/* Charts Placeholder */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Grafik {reportType === 'sales' ? 'Penjualan' : reportType === 'products' ? 'Produk' : 'Pelanggan'}</h3>
          <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Grafik akan ditampilkan di sini</p>
              <p className="text-sm text-gray-400">Integrasi chart library diperlukan</p>
            </div>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Detail {reportType === 'sales' ? 'Penjualan' : 'Data'}</h3>
            <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Tanggal</th>
                  <th className="text-left py-2">Deskripsi</th>
                  <th className="text-right py-2">Jumlah</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">15 Jan 2024</td>
                  <td className="py-2">Penjualan Hijab Premium</td>
                  <td className="text-right">5</td>
                  <td className="text-right font-medium">Rp 425.000</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">14 Jan 2024</td>
                  <td className="py-2">Penjualan Gamis Syari</td>
                  <td className="text-right">3</td>
                  <td className="text-right font-medium">Rp 495.000</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReportsPage;