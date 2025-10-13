import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, CreditCard as Edit, Trash2, Calendar, Clock, Tag, Filter, Search, Check, X } from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';
import { useProducts } from '../hooks/useProducts';
import { FlashSale, Product } from '../types';

interface FlashSaleManagementProps {
  onBack: () => void;
}

const FlashSaleManagement: React.FC<FlashSaleManagementProps> = ({ onBack }) => {
  const { flashSales, createFlashSale, updateFlashSale, deleteFlashSale } = useAdmin();
  const { products, applyFlashSaleToProducts, removeFlashSaleFromProducts } = useProducts();
  
  const [activeTab, setActiveTab] = useState('list');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFlashSale, setEditingFlashSale] = useState<FlashSale | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    discountType: 'fixed' as 'percentage' | 'fixed',
    discountValue: 0
  });

  // Auto-check and update flash sale status
  useEffect(() => {
    const checkFlashSaleStatus = () => {
      const now = new Date();
      flashSales.forEach(flashSale => {
        const isCurrentlyActive = flashSale.startDate <= now && flashSale.endDate >= now;
        
        if (flashSale.isActive && now > flashSale.endDate) {
          // Flash sale ended, deactivate and remove from products
          updateFlashSale(flashSale.id, { isActive: false });
          removeFlashSaleFromProducts(flashSale.productIds);
        } else if (!flashSale.isActive && isCurrentlyActive) {
          // Flash sale should start, activate and apply to products
          updateFlashSale(flashSale.id, { isActive: true });
          applyFlashSaleToProducts(flashSale);
        }
      });
    };

    const interval = setInterval(checkFlashSaleStatus, 60000); // Check every minute
    checkFlashSaleStatus(); // Check immediately

    return () => clearInterval(interval);
  }, [flashSales, updateFlashSale, applyFlashSaleToProducts, removeFlashSaleFromProducts]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'discountValue' ? parseFloat(value) || 0 : value
    }));
  };

  const handleProductSelect = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    const filteredProductIds = getFilteredProducts().map(p => p.id);
    setSelectedProducts(prev => 
      prev.length === filteredProductIds.length ? [] : filteredProductIds
    );
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.startDate || !formData.endDate || selectedProducts.length === 0) {
      alert('Mohon lengkapi semua data');
      return;
    }

    const startDateTime = new Date(`${formData.startDate}T${formData.startTime || '00:00'}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime || '23:59'}`);

    if (startDateTime >= endDateTime) {
      alert('Tanggal mulai harus lebih awal dari tanggal selesai');
      return;
    }

    const now = new Date();
    const flashSaleData = {
      name: formData.name,
      startDate: startDateTime,
      endDate: endDateTime,
      isActive: startDateTime <= now && endDateTime >= now,
      productIds: selectedProducts,
      discountType: formData.discountType,
      discountValue: formData.discountValue
    };

    console.log('Submitting flash sale:', flashSaleData);
    console.log('Selected products for flash sale:', selectedProducts);

    try {
      if (editingFlashSale) {
        updateFlashSale(editingFlashSale.id, flashSaleData);
        console.log('Flash sale updated successfully');
        alert('Flash sale berhasil diupdate!');
      } else {
        createFlashSale(flashSaleData);
        console.log('Flash sale created successfully');
        alert('Flash sale berhasil dibuat! Cek halaman produk untuk melihat perubahan harga.');
      }

      // Don't reset form immediately, wait a bit
      setTimeout(() => {
        resetForm();
      }, 1000);
      
    } catch (error) {
      console.error('Error creating/updating flash sale:', error);
      alert('Terjadi kesalahan saat membuat flash sale');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      discountType: 'fixed',
      discountValue: 0
    });
    setSelectedProducts([]);
    setShowCreateModal(false);
    setEditingFlashSale(null);
  };

  const handleEdit = (flashSale: FlashSale) => {
    setEditingFlashSale(flashSale);
    setFormData({
      name: flashSale.name,
      startDate: flashSale.startDate.toISOString().split('T')[0],
      startTime: flashSale.startDate.toTimeString().slice(0, 5),
      endDate: flashSale.endDate.toISOString().split('T')[0],
      endTime: flashSale.endDate.toTimeString().slice(0, 5),
      discountType: flashSale.discountType,
      discountValue: flashSale.discountValue
    });
    setSelectedProducts(flashSale.productIds);
    setShowCreateModal(true);
  };

  const handleDelete = (flashSale: FlashSale) => {
    if (confirm('Yakin ingin menghapus flash sale ini?')) {
      removeFlashSaleFromProducts(flashSale.productIds);
      deleteFlashSale(flashSale.id);
    }
  };

  const handleToggleActive = (flashSale: FlashSale) => {
    const newActiveStatus = !flashSale.isActive;
    updateFlashSale(flashSale.id, { isActive: newActiveStatus });
    alert(`Flash sale ${newActiveStatus ? 'diaktifkan' : 'dinonaktifkan'}!`);
  };

  const getFilteredProducts = () => {
    let filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'oldest':
          return a.createdAt.getTime() - b.createdAt.getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price':
          return a.retailPrice - b.retailPrice;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const getFlashSaleStatus = (flashSale: FlashSale) => {
    const now = new Date();
    if (now < flashSale.startDate) {
      return { status: 'scheduled', label: 'Terjadwal', color: 'bg-blue-100 text-blue-600' };
    } else if (now >= flashSale.startDate && now <= flashSale.endDate && flashSale.isActive) {
      return { status: 'active', label: 'Aktif', color: 'bg-green-100 text-green-600' };
    } else if (now > flashSale.endDate) {
      return { status: 'ended', label: 'Selesai', color: 'bg-gray-100 text-gray-600' };
    } else {
      return { status: 'inactive', label: 'Nonaktif', color: 'bg-red-100 text-red-600' };
    }
  };

  const categories = ['all', 'hijab', 'gamis', 'khimar', 'tunik', 'abaya'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Kelola Flash Sale</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-white/20 p-2 rounded-full hover:bg-white/30"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-sm opacity-90">Total Flash Sale</p>
            <p className="text-lg font-bold">{flashSales.length}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-sm opacity-90">Aktif</p>
            <p className="text-lg font-bold">
              {flashSales.filter(fs => fs.isActive).length}
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-sm opacity-90">Produk</p>
            <p className="text-lg font-bold">
              {flashSales.reduce((sum, fs) => sum + fs.productIds.length, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow-sm">
        <div className="flex overflow-x-auto px-4">
          {[
            { id: 'list', label: 'Daftar Flash Sale' },
            { id: 'products', label: 'Pilih Produk' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'list' && (
          <div className="space-y-4">
            {flashSales.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">Belum Ada Flash Sale</h3>
                <p className="text-gray-500 mb-4">Buat flash sale pertama Anda</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600"
                >
                  Buat Flash Sale
                </button>
              </div>
            ) : (
              flashSales.map((flashSale) => {
                const statusInfo = getFlashSaleStatus(flashSale);
                return (
                  <div key={flashSale.id} className="bg-white rounded-lg shadow-sm p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{flashSale.name}</h3>
                        <p className="text-sm text-gray-600">
                          {flashSale.startDate.toLocaleDateString('id-ID')} {flashSale.startDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - 
                          {flashSale.endDate.toLocaleDateString('id-ID')} {flashSale.endDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-sm text-gray-600">
                          {flashSale.productIds.length} produk • 
                          {flashSale.discountType === 'percentage' 
                            ? ` ${flashSale.discountValue}% off`
                            : ` Rp ${flashSale.discountValue.toLocaleString('id-ID')} off`
                          }
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(flashSale)}
                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleToggleActive(flashSale)}
                        className={`flex items-center space-x-1 text-sm ${
                          flashSale.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'
                        }`}
                      >
                        {flashSale.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        <span>{flashSale.isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                      </button>
                      <button
                        onClick={() => handleDelete(flashSale)}
                        className="flex items-center space-x-1 text-red-600 hover:text-red-700 text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Cari produk..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="all">Semua Kategori</option>
                  {categories.slice(1).map(cat => (
                    <option key={cat} value={cat} className="capitalize">{cat}</option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="newest">Terbaru</option>
                  <option value="oldest">Terlama</option>
                  <option value="name">Nama A-Z</option>
                  <option value="price">Harga Terendah</option>
                </select>
                <button
                  onClick={handleSelectAll}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
                >
                  {selectedProducts.length === getFilteredProducts().length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </button>
              </div>
            </div>

            {/* Selected Products Info */}
            {selectedProducts.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">
                  {selectedProducts.length} produk dipilih untuk flash sale
                </p>
              </div>
            )}

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getFilteredProducts().map((product) => (
                <div
                  key={product.id}
                  className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all ${
                    selectedProducts.includes(product.id)
                      ? 'ring-2 ring-red-500 bg-red-50'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handleProductSelect(product.id)}
                >
                  <div className="relative">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-32 object-cover rounded-lg mb-3"
                    />
                    {selectedProducts.includes(product.id) && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                    {product.isFlashSale && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        FLASH SALE
                      </div>
                    )}
                  </div>
                  
                  <h3 className="font-semibold mb-2 line-clamp-2">{product.name}</h3>
                  
                  <div className="space-y-1">
                    {product.isFlashSale && product.originalRetailPrice ? (
                      <>
                        <div className="text-lg font-bold text-red-600">
                          Rp {product.retailPrice.toLocaleString('id-ID')}
                        </div>
                        <div className="text-sm text-gray-500 line-through">
                          Rp {product.originalRetailPrice.toLocaleString('id-ID')}
                        </div>
                      </>
                    ) : (
                      <div className="text-lg font-bold text-gray-800">
                        Rp {product.retailPrice.toLocaleString('id-ID')}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-600">Stok: {product.stock}</span>
                    <span className="capitalize text-gray-600">{product.category}</span>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500">
                    Dibuat: {product.createdAt.toLocaleDateString('id-ID')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingFlashSale ? 'Edit Flash Sale' : 'Buat Flash Sale Baru'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Flash Sale
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Contoh: Flash Sale Ramadan"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jenis Diskon
                  </label>
                  <select
                    name="discountType"
                    value={formData.discountType}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="fixed">Nominal (Rp)</option>
                    <option value="percentage">Persentase (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nilai Diskon
                  </label>
                  <input
                    type="number"
                    name="discountValue"
                    value={formData.discountValue}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder={formData.discountType === 'percentage' ? '10' : '100000'}
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600 mb-2">
                  Produk Dipilih: <span className="font-semibold">{selectedProducts.length}</span>
                </p>
                {selectedProducts.length === 0 && (
                  <p className="text-sm text-red-600">
                    Pilih produk di tab "Pilih Produk" terlebih dahulu
                  </p>
                )}
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={resetForm}
                className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-lg hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 bg-red-500 text-white py-3 rounded-lg hover:bg-red-600"
              >
                {editingFlashSale ? 'Update' : 'Buat'} Flash Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashSaleManagement;