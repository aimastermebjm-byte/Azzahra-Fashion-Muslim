import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, Search, Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { AppStorage } from '../utils/appStorage';

interface FeaturedProductsManagementProps {
  onBack: () => void;
}

const FeaturedProductsManagement: React.FC<FeaturedProductsManagementProps> = ({ onBack }) => {
  const { products, loading } = useProducts();
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Get featured products directly from AppStorage
  const featuredProducts = AppStorage.getFeaturedProducts();

  const handleToggleFeatured = async (productId: string) => {
    setSaving(true);
    try {
      // Use AppStorage for reliable updates
      const updatedProducts = AppStorage.toggleFeatured(productId);

      // Show success message
      const product = updatedProducts.find(p => p.id === productId);
      const action = product?.isFeatured ? 'ditambahkan ke' : 'dihapus dari';
      alert(`Produk berhasil ${action} produk unggulan!`);

      // Trigger custom event to notify other components
      const featuredProducts = AppStorage.getFeaturedProducts();
      window.dispatchEvent(new CustomEvent('featuredProductsUpdated', {
        detail: featuredProducts
      }));

    } catch (error) {
      console.error('Error updating featured status:', error);
      alert('Gagal memperbarui status unggulan');
    } finally {
      setSaving(false);
    }
  };

  const handleReorder = async (productId: string, direction: 'up' | 'down') => {
    setSaving(true);
    try {
      // Use AppStorage for reliable reordering
      const updatedProducts = AppStorage.reorderFeatured(productId, direction);

      // Trigger custom event to notify other components
      const featuredProducts = AppStorage.getFeaturedProducts();
      window.dispatchEvent(new CustomEvent('featuredProductsUpdated', {
        detail: featuredProducts
      }));

    } catch (error) {
      console.error('Error reordering products:', error);
      alert('Gagal mengurutkan ulang produk');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading produk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white p-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Kelola Produk Unggulan</h1>
          <div className="w-10"></div>
        </div>
        <p className="text-center mt-2 text-yellow-100">
          Pilih hingga 4 produk untuk ditampilkan di halaman utama
        </p>
      </div>

      {/* Featured Products Section */}
      <div className="p-4">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center">
            <Star className="w-5 h-5 text-yellow-500 mr-2" />
            Produk Unggulan ({featuredProducts.length}/4)
          </h2>

          {featuredProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Star className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Belum ada produk unggulan</p>
              <p className="text-sm">Pilih produk dari daftar di bawah</p>
            </div>
          ) : (
            <div className="space-y-3">
              {featuredProducts.map((product, index) => (
                <div key={product.id} className="flex items-center space-x-3 p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
                  <img
                    src={product.images[0] || 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=400'}
                    alt={product.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-sm text-gray-600">{product.category}</p>
                    <p className="text-sm font-semibold text-pink-600">
                      Rp {product.retailPrice.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleReorder(product.id, 'up')}
                      disabled={index === 0 || saving}
                      className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium w-4 text-center">{index + 1}</span>
                    <button
                      onClick={() => handleReorder(product.id, 'down')}
                      disabled={index === featuredProducts.length - 1 || saving}
                      className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleFeatured(product.id)}
                      disabled={saving}
                      className="p-1 rounded hover:bg-red-100 text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* All Products */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-3">Semua Produk</h2>
          <div className="space-y-3">
            {filteredProducts
              .filter(p => !p.isFeatured)
              .slice(0, 20)
              .map((product) => (
              <div key={product.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <img
                  src={product.images[0] || 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=400'}
                  alt={product.name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="font-semibold">{product.name}</h3>
                  <p className="text-sm text-gray-600">{product.category}</p>
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="font-semibold text-pink-600">
                      Rp {product.retailPrice.toLocaleString('id-ID')}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      product.status === 'ready'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {product.status}
                    </span>
                    <span className="text-gray-500">
                      Stok: {product.stock}
                    </span>
                    {product.salesCount && product.salesCount > 0 && (
                      <span className="text-gray-500">
                        Terjual: {product.salesCount}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleToggleFeatured(product.id)}
                  disabled={saving || featuredProducts.length >= 4}
                  className={`p-2 rounded-lg transition-colors ${
                    featuredProducts.length >= 4
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  }`}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturedProductsManagement;