import React, { useState, useEffect } from 'react';
import { ArrowLeft, Package, Plus, Edit, Search, Filter, X, Trash2, Clock, Flame, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../types';
import { useFirebaseProducts } from '../hooks/useFirebaseProducts';
import { useFirebaseFlashSale } from '../hooks/useFirebaseFlashSale';

interface AdminProductsPageProps {
  onBack: () => void;
  user: any;
}

interface FlashSaleConfig {
  isActive: boolean;
  startTime: string;
  endTime: string;
  flashSaleDiscount: number;
  productIds: string[];
}

const AdminProductsPage: React.FC<AdminProductsPageProps> = ({ onBack, user }) => {
  const { products, loading, updateProduct, addProduct, deleteProduct } = useFirebaseProducts();
  const { flashSaleConfig, timeLeft, isFlashSaleActive, startFlashSale, stopFlashSale } = useFirebaseFlashSale();

  // State management
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showFlashSaleModal, setShowFlashSaleModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Hijab',
    retailPrice: 0,
    resellerPrice: 0,
    costPrice: 0,
    stock: 0,
    images: [] as string[],
    variants: [{ sizes: [], colors: [] }]
  });

  // Batch form data
  const [batchFormData, setBatchFormData] = useState({
    category: '',
    retailPrice: 0,
    discount: 0,
    stock: 0,
    status: 'ready',
    isFeatured: false
  });

  // Flash sale form data
  const [flashSaleFormData, setFlashSaleFormData] = useState<FlashSaleConfig>({
    isActive: false,
    startTime: '',
    endTime: '',
    flashSaleDiscount: 0,
    productIds: []
  });

  // Categories
  const categories = ['Hijab', 'Gamis', 'Khimar', 'Tunik', 'Jaket', 'Bawahan', 'Aksesoris', 'Lainnya'];

  // Filter and sort products
  const filteredAndSortedProducts = React.useMemo(() => {
    let filtered = [...products];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.retailPrice - b.retailPrice;
        case 'price-desc':
          return b.retailPrice - a.retailPrice;
        case 'date-newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'date-oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [products, searchQuery, selectedCategory, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredAndSortedProducts.slice(startIndex, endIndex);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, sortBy, itemsPerPage]);

  // Handle form submissions
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newProduct = {
        ...formData,
        createdAt: new Date(),
        salesCount: 0,
        isFeatured: false,
        isFlashSale: false,
        flashSalePrice: formData.retailPrice
      };

      await addProduct(newProduct);

      // Reset form
      setFormData({
        name: '',
        description: '',
        category: 'Hijab',
        retailPrice: 0,
        resellerPrice: 0,
        costPrice: 0,
        stock: 0,
        images: [],
        variants: [{ sizes: [], colors: [] }]
      });
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Gagal menambahkan produk');
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      await updateProduct(editingProduct.id, formData);
      setShowEditModal(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Gagal memperbarui produk');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;

    try {
      await deleteProduct(productId);
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Gagal menghapus produk');
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      category: product.category,
      retailPrice: product.retailPrice,
      resellerPrice: product.resellerPrice,
      costPrice: product.costPrice,
      stock: product.stock,
      images: product.images,
      variants: product.variants || [{ sizes: [], colors: [] }]
    });
    setShowEditModal(true);
  };

  // Batch operations
  const handleBatchUpdate = async () => {
    if (selectedProducts.length === 0) {
      alert('Pilih setidaknya satu produk');
      return;
    }

    try {
      const updates: Partial<Product> = {};

      if (batchFormData.category) updates.category = batchFormData.category;
      if (batchFormData.retailPrice > 0) {
        updates.retailPrice = batchFormData.retailPrice;
        updates.resellerPrice = Math.round(batchFormData.retailPrice * 0.8);
      }
      if (batchFormData.stock >= 0) updates.stock = batchFormData.stock;
      if (batchFormData.status) updates.status = batchFormData.status;
      if (batchFormData.isFeatured !== undefined) updates.isFeatured = batchFormData.isFeatured;

      // Update all selected products
      for (const productId of selectedProducts) {
        await updateProduct(productId, updates);
      }

      // Reset selection
      setSelectedProducts([]);
      setShowBatchModal(false);
      setBatchFormData({
        category: '',
        retailPrice: 0,
        discount: 0,
        stock: 0,
        status: 'ready',
        isFeatured: false
      });
    } catch (error) {
      console.error('Error updating products:', error);
      alert('Gagal memperbarui produk');
    }
  };

  // Flash sale operations
  const handleFlashSaleStart = async () => {
    if (flashSaleFormData.productIds.length === 0) {
      alert('Pilih setidaknya satu produk untuk flash sale');
      return;
    }

    try {
      // Update selected products with flash sale
      for (const productId of flashSaleFormData.productIds) {
        const product = products.find(p => p.id === productId);
        if (product) {
          const flashSalePrice = Math.round(product.retailPrice - flashSaleFormData.flashSaleDiscount);
          await updateProduct(productId, {
            isFlashSale: true,
            flashSalePrice: Math.max(flashSalePrice, 1000)
          });
        }
      }

      // Start flash sale
      await startFlashSale(flashSaleFormData);
      setShowFlashSaleModal(false);

      // Reset form
      setFlashSaleFormData({
        isActive: false,
        startTime: '',
        endTime: '',
        flashSaleDiscount: 0,
        productIds: []
      });
    } catch (error) {
      console.error('Error starting flash sale:', error);
      alert('Gagal memulai flash sale');
    }
  };

  const handleFlashSaleEnd = async () => {
    try {
      // Remove flash sale from all products
      const flashSaleProducts = products.filter(p => p.isFlashSale);
      for (const product of flashSaleProducts) {
        await updateProduct(product.id, {
          isFlashSale: false,
          flashSalePrice: null
        });
      }

      await stopFlashSale();
    } catch (error) {
      console.error('Error ending flash sale:', error);
      alert('Gagal menghentikan flash sale');
    }
  };

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
          <h1 className="text-xl font-bold">Kelola Produk</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Product Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-1">Total Produk</h4>
            <p className="text-2xl font-bold text-blue-600">{products.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-800 mb-1">Stok Tersedia</h4>
            <p className="text-2xl font-bold text-green-600">
              {products.reduce((total, product) => total + product.stock, 0)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-purple-800 mb-1">Kategori</h4>
            <p className="text-2xl font-bold text-purple-600">{categories.length}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-orange-800 mb-1">Produk Unggulan</h4>
            <p className="text-2xl font-bold text-orange-600">
              {products.filter(p => p.isFeatured).length}
            </p>
          </div>
        </div>

        {/* Flash Sale Status */}
        {isFlashSaleActive && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg shadow-sm p-4 border border-red-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Flame className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-red-800">Flash Sale Aktif</span>
              </div>
              <div className="flex items-center space-x-3">
                {timeLeft && (
                  <div className="flex items-center space-x-1 bg-red-600 text-white px-3 py-1 rounded-full text-sm">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">{timeLeft}</span>
                  </div>
                )}
                <button
                  onClick={handleFlashSaleEnd}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  Stop Flash Sale
                </button>
              </div>
            </div>
            <p className="text-sm text-red-700 mt-2">
              {products.filter(p => p.isFlashSale).length} produk dengan diskon Rp {flashSaleConfig?.flashSaleDiscount?.toLocaleString('id-ID') || 0}
            </p>
          </div>
        )}

        {/* Main Actions */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Menu Utama</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tambah Produk */}
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-3"
            >
              <Plus className="w-6 h-6" />
              <div className="text-left">
                <p className="font-semibold">Tambah Produk</p>
                <p className="text-sm opacity-90">Tambah produk baru</p>
              </div>
            </button>

            {/* Produk Unggulan */}
            <button
              onClick={() => {
                const featuredProducts = products.filter(p => p.isFeatured);
                if (featuredProducts.length > 0) {
                  setSelectedProducts(featuredProducts.map(p => p.id));
                  setBatchFormData({ ...batchFormData, isFeatured: true });
                  setShowBatchModal(true);
                } else {
                  alert('Belum ada produk unggulan. Pilih produk terlebih dahulu dari daftar produk.');
                }
              }}
              className="bg-yellow-500 text-white p-4 rounded-lg hover:bg-yellow-600 transition-colors flex items-center space-x-3"
            >
              <Star className="w-6 h-6" />
              <div className="text-left">
                <p className="font-semibold">Produk Unggulan</p>
                <p className="text-sm opacity-90">Kelola produk unggulan ({products.filter(p => p.isFeatured).length})</p>
              </div>
            </button>

            {/* Flash Sale */}
            <button
              onClick={() => setShowFlashSaleModal(true)}
              className="bg-red-600 text-white p-4 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-3"
            >
              <Flame className="w-6 h-6" />
              <div className="text-left">
                <p className="font-semibold">Flash Sale</p>
                <p className="text-sm opacity-90">Atur diskon flash sale ({products.filter(p => p.isFlashSale).length})</p>
              </div>
            </button>
          </div>
        </div>

        {/* Product List */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 space-y-4 md:space-y-0">
            <h2 className="text-lg font-semibold">
              Daftar Produk {selectedProducts.length > 0 && `(${selectedProducts.length} dipilih)`}
            </h2>

            <div className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cari produk..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full md:w-64"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Semua Kategori</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="name">Nama</option>
                <option value="price-asc">Harga (Rendah ke Tinggi)</option>
                <option value="price-desc">Harga (Tinggi ke Rendah)</option>
                <option value="date-newest">Terbaru</option>
                <option value="date-oldest">Terlama</option>
              </select>

              {/* Batch Edit Button */}
              {selectedProducts.length > 0 && (
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit {selectedProducts.length} Produk</span>
                </button>
              )}
            </div>
          </div>

          {/* Product Table */}
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Memuat produk...</p>
            </div>
          ) : currentProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">
                {searchQuery || selectedCategory
                  ? 'Tidak ada produk yang ditemukan'
                  : 'Belum ada produk'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">
                        <input
                          type="checkbox"
                          checked={selectedProducts.length === currentProducts.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProducts(currentProducts.map(p => p.id));
                            } else {
                              setSelectedProducts([]);
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="text-left p-3">Produk</th>
                      <th className="text-left p-3">Kategori</th>
                      <th className="text-left p-3">Harga</th>
                      <th className="text-left p-3">Stok</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentProducts.map((product) => (
                      <tr key={product.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(product.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProducts([...selectedProducts, product.id]);
                              } else {
                                setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center space-x-3">
                            {product.images.length > 0 ? (
                              <img
                                src={product.image || product.images[0] || '/placeholder-product.jpg'}
                                alt={product.name}
                                className="w-10 h-10 object-cover rounded-lg"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                <Package className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900">{product.name}</p>
                              {product.isFeatured && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  ⭐ Unggulan
                                </span>
                              )}
                              {product.isFlashSale && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 ml-2">
                                  🔥 Flash Sale
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {product.category}
                          </span>
                        </td>
                        <td className="p-3">
                          <div>
                            {product.isFlashSale ? (
                              <>
                                <p className="font-semibold text-red-600">
                                  Rp {product.flashSalePrice?.toLocaleString('id-ID')}
                                </p>
                                <p className="text-sm text-gray-400 line-through">
                                  Rp {product.retailPrice.toLocaleString('id-ID')}
                                </p>
                              </>
                            ) : (
                              <p className="font-semibold">
                                Rp {product.retailPrice.toLocaleString('id-ID')}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            product.stock > 10
                              ? 'bg-green-100 text-green-800'
                              : product.stock > 0
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {product.stock} pcs
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            product.stock > 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {product.stock > 0 ? 'Ready' : 'Habis'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditProduct(product)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-700">
                    Menampilkan {startIndex + 1} hingga {Math.min(endIndex, filteredAndSortedProducts.length)} dari {filteredAndSortedProducts.length} produk
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 border rounded-lg ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Tambah Produk Baru</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <form onSubmit={handleAddProduct} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Produk *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kategori *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deskripsi
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Harga Jual (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.retailPrice}
                    onChange={(e) => {
                      const price = parseInt(e.target.value) || 0;
                      setFormData({
                        ...formData,
                        retailPrice: price,
                        resellerPrice: Math.round(price * 0.8),
                        costPrice: Math.round(price * 0.6)
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Harga Reseller (Rp)
                  </label>
                  <input
                    type="number"
                    value={formData.resellerPrice}
                    onChange={(e) => setFormData({ ...formData, resellerPrice: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Harga Modal (Rp)
                  </label>
                  <input
                    type="number"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    readOnly
                  />
                </div>
              </div>

              {/* Stock */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stok *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Tambah Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Edit Produk</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProduct(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <form onSubmit={handleUpdateProduct} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Produk *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kategori *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deskripsi
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Harga Jual (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.retailPrice}
                    onChange={(e) => {
                      const price = parseInt(e.target.value) || 0;
                      setFormData({
                        ...formData,
                        retailPrice: price,
                        resellerPrice: Math.round(price * 0.8),
                        costPrice: Math.round(price * 0.6)
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Harga Reseller (Rp)
                  </label>
                  <input
                    type="number"
                    value={formData.resellerPrice}
                    onChange={(e) => setFormData({ ...formData, resellerPrice: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Harga Modal (Rp)
                  </label>
                  <input
                    type="number"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    readOnly
                  />
                </div>
              </div>

              {/* Stock */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stok *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Edit Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">
                  Edit {selectedProducts.length} Produk Terpilih
                </h2>
                <button
                  onClick={() => {
                    setShowBatchModal(false);
                    setSelectedProducts([]);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Selected Products List */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-3">Produk yang akan diedit:</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedProducts.map(productId => {
                    const product = products.find(p => p.id === productId);
                    return product ? (
                      <div key={product.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{product.name}</span>
                        <span className="text-gray-500">{product.category}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Batch Edit Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ubah Kategori (kosongkan jika tidak ingin mengubah)
                  </label>
                  <select
                    value={batchFormData.category}
                    onChange={(e) => setBatchFormData({ ...batchFormData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">-- Tidak Diubah --</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ubah Harga Jual (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={batchFormData.retailPrice || ''}
                    onChange={(e) => setBatchFormData({ ...batchFormData, retailPrice: parseInt(e.target.value) || 0 })}
                    placeholder="Kosongkan jika tidak ingin mengubah"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ubah Stok
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={batchFormData.stock || ''}
                    onChange={(e) => setBatchFormData({ ...batchFormData, stock: parseInt(e.target.value) || 0 })}
                    placeholder="Kosongkan jika tidak ingin mengubah"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status Produk Unggulan
                  </label>
                  <select
                    value={batchFormData.isFeatured ? 'true' : 'false'}
                    onChange={(e) => setBatchFormData({ ...batchFormData, isFeatured: e.target.value === 'true' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="false">Tidak Unggulan</option>
                    <option value="true">Jadikan Unggulan</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowBatchModal(false);
                    setSelectedProducts([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleBatchUpdate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flash Sale Modal */}
      {showFlashSaleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
                  <Flame className="w-6 h-6 text-red-600" />
                  <span>Konfigurasi Flash Sale</span>
                </h2>
                <button
                  onClick={() => setShowFlashSaleModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Pilih Produk untuk Flash Sale
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {products.filter(p => !p.isFlashSale).map((product) => (
                    <label key={product.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={flashSaleFormData.productIds.includes(product.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFlashSaleFormData({
                              ...flashSaleFormData,
                              productIds: [...flashSaleFormData.productIds, product.id]
                            });
                          } else {
                            setFlashSaleFormData({
                              ...flashSaleFormData,
                              productIds: flashSaleFormData.productIds.filter(id => id !== product.id)
                            });
                          }
                        }}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <div className="flex items-center space-x-3 flex-1">
                        {product.images.length > 0 ? (
                          <img
                            src={product.image || product.images[0] || '/placeholder-product.jpg'}
                            alt={product.name}
                            className="w-8 h-8 object-cover rounded"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                            <Package className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-gray-500">Rp {product.retailPrice.toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {flashSaleFormData.productIds.length} produk dipilih
                </p>
              </div>

              {/* Flash Sale Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Waktu Mulai
                  </label>
                  <input
                    type="datetime-local"
                    value={flashSaleFormData.startTime}
                    onChange={(e) => setFlashSaleFormData({ ...flashSaleFormData, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Waktu Berakhir
                  </label>
                  <input
                    type="datetime-local"
                    value={flashSaleFormData.endTime}
                    onChange={(e) => setFlashSaleFormData({ ...flashSaleFormData, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Diskon Flash Sale (Rp)
                </label>
                <input
                  type="number"
                  value={flashSaleFormData.flashSaleDiscount || ''}
                  onChange={(e) => setFlashSaleFormData({ ...flashSaleFormData, flashSaleDiscount: parseInt(e.target.value) || 0 })}
                  placeholder="Masukkan jumlah diskon"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowFlashSaleModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <div className="flex items-center space-x-2">
                  {isFlashSaleActive && (
                    <button
                      onClick={handleFlashSaleEnd}
                      className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
                    >
                      <Flame className="w-4 h-4" />
                      <span>Stop Flash Sale</span>
                    </button>
                  )}
                  {flashSaleFormData.productIds.length > 0 && (
                    <button
                      onClick={handleFlashSaleStart}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                    >
                      <Flame className="w-4 h-4" />
                      <span>Mulai Flash Sale</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductsPage;