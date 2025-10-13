import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, Search, Plus, X, ChevronUp, ChevronDown, Save, Package } from 'lucide-react';
// import { supabase } from '../lib/supabase'; // Disabled for local testing

interface Product {
  id: string;
  name: string;
  category: string;
  images: string[];
  retailPrice: number;
  resellerPrice: number;
  stock: number;
  status: 'ready' | 'po';
  salesCount?: number;
  isFeatured?: boolean;
  featuredOrder?: number;
}

interface FeaturedProductsManagementProps {
  onBack: () => void;
}

const FeaturedProductsManagement: React.FC<FeaturedProductsManagementProps> = ({ onBack }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      // Use mock data for local testing
      const mockProducts: Product[] = [
        {
          id: '1',
          name: 'Hijab Segi Empat Premium',
          category: 'hijab',
          images: ['https://images.pexels.com/photos/8839887/pexels-photo-8839887.jpeg?auto=compress&cs=tinysrgb&w=400'],
          retailPrice: 85000,
          resellerPrice: 65000,
          stock: 25,
          status: 'ready',
          salesCount: 15,
          isFeatured: true,
          featuredOrder: 1
        },
        {
          id: '2',
          name: 'Gamis Syari Elegant',
          category: 'gamis',
          images: ['https://images.pexels.com/photos/9594673/pexels-photo-9594673.jpeg?auto=compress&cs=tinysrgb&w=400'],
          retailPrice: 250000,
          resellerPrice: 200000,
          stock: 15,
          status: 'ready',
          salesCount: 28,
          isFeatured: true,
          featuredOrder: 2
        },
        {
          id: '3',
          name: 'Khimar Instant Premium',
          category: 'khimar',
          images: ['https://images.pexels.com/photos/8839889/pexels-photo-8839889.jpeg?auto=compress&cs=tinysrgb&w=400'],
          retailPrice: 120000,
          resellerPrice: 95000,
          stock: 8,
          status: 'po',
          salesCount: 8,
          isFeatured: false,
          featuredOrder: 0
        },
        {
          id: '4',
          name: 'Tunik Casual Modern',
          category: 'tunik',
          images: ['https://images.pexels.com/photos/9594675/pexels-photo-9594675.jpeg?auto=compress&cs=tinysrgb&w=400'],
          retailPrice: 180000,
          resellerPrice: 145000,
          stock: 20,
          status: 'ready',
          salesCount: 22,
          isFeatured: true,
          featuredOrder: 3
        },
        {
          id: '5',
          name: 'Abaya Dubai Premium',
          category: 'abaya',
          images: ['https://images.pexels.com/photos/8839890/pexels-photo-8839890.jpeg?auto=compress&cs=tinysrgb&w=400'],
          retailPrice: 350000,
          resellerPrice: 280000,
          stock: 12,
          status: 'ready',
          salesCount: 18,
          isFeatured: true,
          featuredOrder: 4
        },
        {
          id: '6',
          name: 'Hijab Pashmina Silk',
          category: 'hijab',
          images: ['https://images.pexels.com/photos/8839891/pexels-photo-8839891.jpeg?auto=compress&cs=tinysrgb&w=400'],
          retailPrice: 95000,
          resellerPrice: 75000,
          stock: 30,
          status: 'ready',
          salesCount: 35,
          isFeatured: false,
          featuredOrder: 0
        }
      ];

      const featured = mockProducts
        .filter(p => p.isFeatured)
        .sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0));

      setProducts(mockProducts);
      setFeaturedProducts(featured);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFeatured = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setSaving(true);
    try {
      if (product.isFeatured) {
        // Remove from featured
        setProducts(products.map(p =>
          p.id === productId
            ? { ...p, isFeatured: false, featuredOrder: 0 }
            : p
        ));
        setFeaturedProducts(featuredProducts.filter(p => p.id !== productId));

        // Update order for remaining featured products
        const updatedFeatured = featuredProducts
          .filter(p => p.id !== productId)
          .map((p, index) => ({ ...p, featuredOrder: index + 1 }));
        setFeaturedProducts(updatedFeatured);
      } else {
        // Add to featured (max 4 products)
        if (featuredProducts.length >= 4) {
          alert('Maksimal 4 produk unggulan!');
          return;
        }

        const updatedProduct = {
          ...product,
          isFeatured: true,
          featuredOrder: featuredProducts.length + 1
        };

        setProducts(products.map(p =>
          p.id === productId ? updatedProduct : p
        ));
        setFeaturedProducts([...featuredProducts, updatedProduct]);
      }

      // Simulate saving success
      console.log('Featured products updated:', featuredProducts);
    } catch (error) {
      console.error('Error updating featured status:', error);
      alert('Gagal memperbarui status unggulan');
    } finally {
      setSaving(false);
    }
  };

  const handleReorder = async (productId: string, direction: 'up' | 'down') => {
    const currentIndex = featuredProducts.findIndex(p => p.id === productId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= featuredProducts.length) return;

    setSaving(true);
    try {
      // Update local state
      const reordered = [...featuredProducts];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(newIndex, 0, moved);

      // Update featuredOrder values
      const updated = reordered.map((product, index) => ({
        ...product,
        featuredOrder: index + 1
      }));

      setFeaturedProducts(updated);
      setProducts(products.map(p => {
        const featured = updated.find(f => f.id === p.id);
        return featured ? featured : p;
      }));

      // Simulate saving success
      console.log('Products reordered:', updated);
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