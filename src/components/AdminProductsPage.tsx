import React, { useState, useEffect } from 'react';
import { ArrowLeft, Package, Plus, Edit, BarChart3, Download, Search, Filter, X, Upload, Save, Trash2, Clock, Zap, Flame, Percent, Calendar } from 'lucide-react';
import { Product, ProductVariant } from '../types';
import { AppStorage } from '../utils/appStorage';

interface FlashSaleConfig {
  isActive: boolean;
  startTime: string;
  endTime: string;
  flashSaleDiscount: number; // Discount in Rupiah (not percentage)
  productIds: string[];
}

interface AdminProductFormData {
  name: string;
  category: string;
  variants: ProductVariant[];
  purchasePrice: number;
  sellingPrice: number;
  discount: number;
  unit: string;
  description: string;
  condition: 'PO' | 'Ready Stock';
  images: string[];
  stock: number;
}

interface AdminProductsPageProps {
  onBack: () => void;
  user: any;
}

const AdminProductsPage: React.FC<AdminProductsPageProps> = ({ onBack, user }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [flashSaleConfig, setFlashSaleConfig] = useState<FlashSaleConfig>({
    isActive: false,
    startTime: '',
    endTime: '',
    flashSaleDiscount: 0,
    productIds: []
  });
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [batchFormData, setBatchFormData] = useState<{
    category: string;
    retailPrice: number;
    discount: number;
    stock: number;
    status: 'ready' | 'po';
    isFeatured: boolean;
    isFlashSale: boolean;
  }>({
    category: '',
    retailPrice: 0,
    discount: 0,
    stock: 0,
    status: 'ready',
    isFeatured: false,
    isFlashSale: false
  });

  // Filter, Sort, and Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc' | 'date-newest' | 'date-oldest'>('name');
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [products, setProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState<AdminProductFormData>({
    name: '',
    category: '',
    variants: [{ sizes: [], colors: [] }],
    purchasePrice: 0,
    sellingPrice: 0,
    discount: 0,
    unit: '',
    description: '',
    condition: 'Ready Stock' as 'PO' | 'Ready Stock',
    images: [] as string[],
    stock: 0
  });

  // Load products and flash sale config from localStorage on mount
  useEffect(() => {
    const savedProducts = AppStorage.getProducts();
    setProducts(savedProducts);

    // Load flash sale config from localStorage
    const savedFlashSaleConfig = localStorage.getItem('azzahra-flashsale');
    if (savedFlashSaleConfig) {
      try {
        const config = JSON.parse(savedFlashSaleConfig);
        setFlashSaleConfig(config);
        console.log('🔥 Flash sale config loaded:', config);
      } catch (e) {
        console.error('⚠️ Error loading flash sale config:', e);
      }
    }
  }, []);

  // Save products to AppStorage whenever they change
  useEffect(() => {
    if (products.length > 0) {
      AppStorage.saveProducts(products);
    }
  }, [products]);

  // Enhanced Global flash sale checker with auto refresh
  useEffect(() => {
    const checkFlashSaleStatus = () => {
      try {
        const savedConfig = localStorage.getItem('azzahra-flashsale');
        if (savedConfig) {
          const config = JSON.parse(savedConfig);

          if (config.isActive && config.endTime) {
            const now = new Date().getTime();
            const endTime = new Date(config.endTime).getTime();
            const timeLeft = endTime - now;

            console.log('⏰ Flash sale check - Time left:', timeLeft, 'ms');

            if (timeLeft <= 0) {
              console.log('🔥 FLASH SALE ENDED - Starting cleanup and refresh');

              // Clean up expired flash sale
              localStorage.removeItem('azzahra-flashsale');

              // Clean up products in storage
              const savedProducts = AppStorage.getProducts();
              const cleanedProducts = savedProducts.map(product => ({
                ...product,
                isFlashSale: false,
                flashSalePrice: product.retailPrice
              }));
              AppStorage.saveProducts(cleanedProducts);

              // Trigger global events
              window.dispatchEvent(new CustomEvent('flashSaleEnded'));
              window.dispatchEvent(new CustomEvent('productsUpdated', { detail: cleanedProducts }));

              // Force refresh after short delay to ensure cleanup is visible
              setTimeout(() => {
                console.log('🔄 FORCING PAGE REFRESH AFTER FLASH SALE END');
                window.location.reload();
              }, 500);

              return true; // Indicate flash sale ended
            }
          }
        }
      } catch (e) {
        console.error('Error in global flash sale checker:', e);
      }
      return false;
    };

    // Check immediately
    const ended = checkFlashSaleStatus();

    // Set up interval only if flash sale is still active
    let intervalId: NodeJS.Timeout;
    if (!ended) {
      intervalId = setInterval(checkFlashSaleStatus, 1000); // Check every 1 second instead of 5
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // Countdown timer for flash sale
  useEffect(() => {
    const updateCountdown = () => {
      if (!flashSaleConfig.isActive || !flashSaleConfig.endTime) {
        setTimeLeft('');
        return;
      }

      const now = new Date().getTime();
      const endTime = new Date(flashSaleConfig.endTime).getTime();
      const distance = endTime - now;

      if (distance < 0) {
        // Flash sale ended - trigger cleanup
        handleFlashSaleEnd();
        setTimeLeft('');
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days} hari ${hours} jam ${minutes} menit`);
      } else {
        setTimeLeft(`${hours} jam ${minutes} menit ${seconds} detik`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [flashSaleConfig]);

  const categories = ['Hijab', 'Gamis', 'Khimar', 'Tunik', 'Jaket', 'Bawahan', 'Aksesoris', 'Lainnya'];
  const units = ['pcs', 'pasang', 'box', 'lusin', 'rim', 'gross'];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'number') {
      // Remove leading zeros from number inputs
      const cleanValue = value.replace(/^0+/, '') || '0';
      setFormData(prev => ({
        ...prev,
        [name]: parseFloat(cleanValue) || 0
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleVariantChange = (index: number, field: string, value: string) => {
    const newVariants = [...formData.variants];
    if (field === 'sizes') {
      // Handle sizes as comma-separated values
      const sizes = value.split(',').map(s => s.trim()).filter(s => s);
      newVariants[index] = {
        ...newVariants[index],
        sizes: sizes
      };
    } else if (field === 'colors') {
      // Handle colors as comma-separated values
      const colors = value.split(',').map(c => c.trim()).filter(c => c);
      newVariants[index] = {
        ...newVariants[index],
        colors: colors
      };
    }
    setFormData(prev => ({ ...prev, variants: newVariants }));
  };

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { sizes: [], colors: [] }]
    }));
  };

  const removeVariant = (index: number) => {
    if (formData.variants.length > 1) {
      const newVariants = formData.variants.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, variants: newVariants }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const imageUrls = Array.from(files).map(file => URL.createObjectURL(file));
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...imageUrls]
      }));
    }
  };

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, images: newImages }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Calculate final price after discount (in Rupiah)
    const finalPrice = formData.sellingPrice - formData.discount;

    // Merge all variants into single sizes and colors arrays
    const allSizes = formData.variants.flatMap(v => v.sizes);
    const allColors = formData.variants.flatMap(v => v.colors);
    // Remove duplicates
    const uniqueSizes = [...new Set(allSizes)];
    const uniqueColors = [...new Set(allColors)];

    const newProduct: Product = {
      id: Date.now().toString(),
      name: formData.name,
      description: formData.description,
      category: formData.category,
      images: formData.images,
      variants: {
        sizes: uniqueSizes,
        colors: uniqueColors
      },
      retailPrice: Math.round(finalPrice),
      resellerPrice: Math.round(finalPrice * 0.8), // 80% of retail price for resellers
      costPrice: formData.purchasePrice,
      stock: formData.stock,
      status: formData.condition === 'Ready Stock' ? 'ready' : 'po',
      isFlashSale: false,
      flashSalePrice: Math.round(finalPrice),
      createdAt: new Date(),
      salesCount: 0,
      isFeatured: false
    };

    const updatedProducts = [...products, newProduct];
    setProducts(updatedProducts);
    AppStorage.saveProducts(updatedProducts);

    // Trigger event to update product lists across all pages
    window.dispatchEvent(new CustomEvent('productsUpdated', { detail: updatedProducts }));

    // Reset form
    setFormData({
      name: '',
      category: '',
      variants: [{ sizes: [], colors: [] }],
      purchasePrice: 0,
      sellingPrice: 0,
      discount: 0,
      unit: '',
      description: '',
      condition: 'Ready Stock',
      images: [],
      stock: 0
    });

    setShowAddModal(false);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      variants: [{ sizes: product.variants.sizes, colors: product.variants.colors }],
      purchasePrice: product.costPrice || 0,
      sellingPrice: product.retailPrice,
      discount: 0,
      unit: 'pcs',
      description: product.description,
      condition: product.status === 'ready' ? 'Ready Stock' : 'PO',
      images: product.images,
      stock: product.stock
    });
    setShowEditModal(true);
  };

  const handleUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingProduct) return;

    // Calculate final price after discount (in Rupiah)
    const finalPrice = formData.sellingPrice - formData.discount;

    // Merge all variants into single sizes and colors arrays
    const allSizes = formData.variants.flatMap(v => v.sizes);
    const allColors = formData.variants.flatMap(v => v.colors);
    // Remove duplicates
    const uniqueSizes = [...new Set(allSizes)];
    const uniqueColors = [...new Set(allColors)];

    const updatedProduct: Product = {
      ...editingProduct,
      name: formData.name,
      description: formData.description,
      category: formData.category,
      images: formData.images,
      variants: {
        sizes: uniqueSizes,
        colors: uniqueColors
      },
      retailPrice: Math.round(finalPrice),
      resellerPrice: Math.round(finalPrice * 0.8),
      costPrice: formData.purchasePrice,
      stock: formData.stock,
      status: formData.condition === 'Ready Stock' ? 'ready' : 'po',
      flashSalePrice: Math.round(finalPrice)
    };

    const updatedProducts = products.map(p => p.id === editingProduct.id ? updatedProduct : p);
    setProducts(updatedProducts);
    AppStorage.saveProducts(updatedProducts);

    // Trigger event to update product lists across all pages
    window.dispatchEvent(new CustomEvent('productsUpdated', { detail: updatedProducts }));

    // Reset form and close modal
    setFormData({
      name: '',
      category: '',
      variants: [{ sizes: [], colors: [] }],
      purchasePrice: 0,
      sellingPrice: 0,
      discount: 0,
      unit: '',
      description: '',
      condition: 'Ready Stock',
      images: [],
      stock: 0
    });
    setEditingProduct(null);
    setShowEditModal(false);
  };

  const handleDeleteProduct = (productId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus produk ini?')) {
      const updatedProducts = products.filter(p => p.id !== productId);
      setProducts(updatedProducts);
      AppStorage.saveProducts(updatedProducts);

      // Trigger event to update product lists across all pages
      window.dispatchEvent(new CustomEvent('productsUpdated', { detail: updatedProducts }));
    }
  };

  const handleSelectProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.id));
    }
  };

  const handleBatchDelete = () => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus ${selectedProducts.length} produk?`)) {
      const updatedProducts = products.filter(p => !selectedProducts.includes(p.id));
      setProducts(updatedProducts);
      AppStorage.saveProducts(updatedProducts);
      setSelectedProducts([]);

      // Trigger event to update product lists across all pages
      window.dispatchEvent(new CustomEvent('productsUpdated', { detail: updatedProducts }));
      setShowBatchModal(false);
    }
  };

  const handleBatchInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'number') {
      // Remove leading zeros from number inputs
      const cleanValue = value.replace(/^0+/, '') || '0';
      setBatchFormData(prev => ({
        ...prev,
        [name]: parseFloat(cleanValue) || 0
      }));
    } else if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setBatchFormData(prev => ({
        ...prev,
        [name]: target.checked
      }));
    } else {
      setBatchFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleBatchUpdate = () => {
    if (selectedProducts.length === 0) {
      alert('Pilih setidaknya satu produk untuk diedit');
      return;
    }

    // Create object with only fields that should be updated
    const updates: Partial<Product> = {};

    if (batchFormData.category) updates.category = batchFormData.category;
    if (batchFormData.retailPrice > 0) {
      updates.retailPrice = batchFormData.retailPrice;
      updates.resellerPrice = Math.round(batchFormData.retailPrice * 0.8);
    }
    if (batchFormData.discount > 0) {
      const updatedProducts = products.map(product => {
        if (selectedProducts.includes(product.id) && batchFormData.discount > 0) {
          const discountedPrice = product.retailPrice - batchFormData.discount;
          return {
            ...product,
            retailPrice: Math.round(discountedPrice),
            resellerPrice: Math.round(discountedPrice * 0.8),
            flashSalePrice: Math.round(discountedPrice)
          };
        }
        return product;
      });
      setProducts(updatedProducts);
      AppStorage.saveProducts(updatedProducts);
    }
    if (batchFormData.stock >= 0) updates.stock = batchFormData.stock;
    if (batchFormData.status) updates.status = batchFormData.status;
    if (batchFormData.isFeatured !== undefined) updates.isFeatured = batchFormData.isFeatured;
    if (batchFormData.isFlashSale !== undefined) updates.isFlashSale = batchFormData.isFlashSale;

    // Apply updates to selected products
    const updatedProducts = products.map(product => {
      if (selectedProducts.includes(product.id)) {
        const updatedProduct = { ...product, ...updates };
        return updatedProduct;
      }
      return product;
    });

    setProducts(updatedProducts);
    AppStorage.saveProducts(updatedProducts);

    // Trigger event to update product lists across all pages
    window.dispatchEvent(new CustomEvent('productsUpdated', { detail: updatedProducts }));

    // Reset form and close modal
    setBatchFormData({
      category: '',
      retailPrice: 0,
      discount: 0,
      stock: 0,
      status: 'ready',
      isFeatured: false,
      isFlashSale: false
    });
    setShowBatchModal(false);
    setSelectedProducts([]);
  };

  // Flash Sale Management Functions
  const handleFlashSaleStart = (config: FlashSaleConfig) => {
    // Save flash sale config to localStorage
    localStorage.setItem('azzahra-flashsale', JSON.stringify(config));
    setFlashSaleConfig(config);

    // Apply flash sale prices to products (discount in Rupiah)
    const updatedProducts = products.map(product => {
      if (config.productIds.includes(product.id)) {
        const flashSalePrice = Math.round(product.retailPrice - config.flashSaleDiscount);
        return {
          ...product,
          isFlashSale: true,
          flashSalePrice: Math.max(flashSalePrice, 1000) // Minimum price is 1000
        };
      }
      return product;
    });

    setProducts(updatedProducts);
    AppStorage.saveProducts(updatedProducts);

    // Trigger event to update other pages
    window.dispatchEvent(new CustomEvent('flashSaleStarted', { detail: config }));
    window.dispatchEvent(new CustomEvent('productsUpdated', { detail: updatedProducts }));

    console.log('🔥 Flash sale started with config:', config);
  };

  const handleFlashSaleEnd = () => {
    console.log('⏰ Flash sale ended, restoring prices...');

    // Restore all products to original prices
    const updatedProducts = products.map(product => {
      if (product.isFlashSale) {
        return {
          ...product,
          isFlashSale: false,
          flashSalePrice: product.retailPrice // Restore to original price
        };
      }
      return product;
    });

    setProducts(updatedProducts);
    AppStorage.saveProducts(updatedProducts);

    // Clear flash sale config from localStorage
    localStorage.removeItem('azzahra-flashsale');
    setFlashSaleConfig({
      isActive: false,
      startTime: '',
      endTime: '',
      flashSaleDiscount: 0,
      productIds: []
    });

    // Trigger events and auto refresh all pages
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('flashSaleEnded'));
      window.dispatchEvent(new CustomEvent('productsUpdated', { detail: updatedProducts }));

      // Auto refresh all tabs after flash sale ends
      console.log('🔄 Auto refreshing page after flash sale ended');
      window.location.reload();
    }, 1000); // 1 second delay to show cleanup message

    console.log('✅ Flash sale ended and prices restored');
  };

  const handleFlashSaleConfigChange = (field: keyof FlashSaleConfig, value: any) => {
    setFlashSaleConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateTotalStock = () => {
    return formData.stock;
  };

  // Filter, Sort, and Pagination Logic
  const filteredAndSortedProducts = React.useMemo(() => {
    let filtered = [...products];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase())
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

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredAndSortedProducts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, sortBy, itemsPerPage]);

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
            <p className="text-2xl font-bold text-green-600">{products.reduce((total, product) => total + product.stock, 0)}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-purple-800 mb-1">Kategori</h4>
            <p className="text-2xl font-bold text-purple-600">{categories.length}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-orange-800 mb-1">Harga Rata-rata</h4>
            <p className="text-2xl font-bold text-orange-600">
              {products.length > 0 ? Math.round(products.reduce((total, product) => total + product.retailPrice, 0) / products.length / 1000) + 'K' : '0K'}
            </p>
          </div>
        </div>

      {/* Flash Sale Status */}
        {flashSaleConfig.isActive && (
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
                <button
                  onClick={() => {
                    console.log('🔥 DEBUG: Manual flash sale end trigger');
                    handleFlashSaleEnd();
                  }}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-xs"
                >
                  DEBUG: Force End
                </button>
              </div>
            </div>
            <p className="text-sm text-red-700 mt-2">
              {products.filter(p => p.isFlashSale).length} produk dengan diskon Rp {flashSaleConfig.flashSaleDiscount.toLocaleString('id-ID')}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Aksi Produk</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Produk</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex flex-col items-center space-y-2">
              <Package className="w-6 h-6 text-blue-600" />
              <span className="text-sm font-medium">Lihat Semua</span>
            </button>
            <button className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex flex-col items-center space-y-2">
              <BarChart3 className="w-6 h-6 text-green-600" />
              <span className="text-sm font-medium">Statistik</span>
            </button>
            <button
              onClick={() => setShowBatchModal(true)}
              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex flex-col items-center space-y-2"
            >
              <Edit className="w-6 h-6 text-purple-600" />
              <span className="text-sm font-medium">Batch Edit</span>
            </button>
            <button className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex flex-col items-center space-y-2">
              <Download className="w-6 h-6 text-orange-600" />
              <span className="text-sm font-medium">Export</span>
            </button>
          </div>
        </div>

        {/* Featured Products */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Produk Unggulan</h2>
            <button
              onClick={() => {
                setSelectedProducts(products.filter(p => p.isFeatured).map(p => p.id));
                setShowBatchModal(true);
                setBatchFormData(prev => ({ ...prev, isFeatured: true }));
              }}
              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              Edit Massal
            </button>
          </div>
          <div className="space-y-2">
            {products.filter(p => p.isFeatured).length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500">Belum ada produk unggulan</p>
                <p className="text-sm text-gray-400">Pilih produk dan centang "Jadikan Produk Unggulan"</p>
              </div>
            ) : (
              products.filter(p => p.isFeatured).map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center space-x-3">
                    {product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-10 h-10 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-purple-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-purple-800">{product.name}</p>
                      <p className="text-sm text-purple-600">{product.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-purple-800">Rp {product.retailPrice.toLocaleString('id-ID')}</p>
                    <p className="text-sm text-purple-600">Stok: {product.stock}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Flash Sale Products */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Produk Flash Sale</h2>
            <button
              onClick={() => {
                setSelectedProducts(products.filter(p => p.isFlashSale).map(p => p.id));
                setShowBatchModal(true);
                setBatchFormData(prev => ({ ...prev, isFlashSale: true }));
              }}
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Edit Massal
            </button>
          </div>
          <div className="space-y-2">
            {products.filter(p => p.isFlashSale).length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500">Belum ada produk flash sale</p>
                <p className="text-sm text-gray-400">Pilih produk dan centang "Jadikan Flash Sale"</p>
              </div>
            ) : (
              products.filter(p => p.isFlashSale).map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center space-x-3">
                    {product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-10 h-10 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-red-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-red-800">{product.name}</p>
                      <p className="text-sm text-red-600">{product.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-800">
                      {product.flashSalePrice < product.retailPrice ? (
                        <>
                          <span className="line-through text-gray-400 text-sm">Rp {product.retailPrice.toLocaleString('id-ID')}</span>
                          <br />
                          Rp {product.flashSalePrice.toLocaleString('id-ID')}
                        </>
                      ) : (
                        `Rp ${product.retailPrice.toLocaleString('id-ID')}`
                      )}
                    </p>
                    <p className="text-sm text-red-600">Stok: {product.stock}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-4">Kategori Produk</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg border border-pink-200">
              <p className="font-medium text-pink-800">Hijab</p>
              <p className="text-sm text-pink-600">4 produk • 45 stok</p>
            </div>
            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <p className="font-medium text-blue-800">Gamis</p>
              <p className="text-sm text-blue-600">3 produk • 28 stok</p>
            </div>
            <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <p className="font-medium text-green-800">Khimar</p>
              <p className="text-sm text-green-600">3 produk • 38 stok</p>
            </div>
            <div className="p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
              <p className="font-medium text-orange-800">Lainnya</p>
              <p className="text-sm text-orange-600">2 produk • 45 stok</p>
            </div>
          </div>
        </div>

        {/* Recent Products */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 space-y-4 md:space-y-0">
            <h2 className="text-lg font-semibold">Daftar Produk</h2>
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
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="name">Urutkan: Nama</option>
                <option value="price-asc">Harga: Terendah</option>
                <option value="price-desc">Harga: Tertinggi</option>
                <option value="date-newest">Terbaru</option>
                <option value="date-oldest">Terlama</option>
              </select>

              {/* Items per page */}
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="25">25 / halaman</option>
                <option value="50">50 / halaman</option>
                <option value="100">100 / halaman</option>
                <option value={products.length}>Semua</option>
              </select>
            </div>
          </div>

          {/* Results info */}
          <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
            <span>
              Menampilkan {startIndex + 1}-{Math.min(endIndex, filteredAndSortedProducts.length)} dari {filteredAndSortedProducts.length} produk
              {searchQuery && ` untuk "${searchQuery}"`}
              {selectedCategory && ` di kategori ${selectedCategory}`}
            </span>
            {searchQuery || selectedCategory ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('');
                }}
                className="text-blue-600 hover:text-blue-700"
              >
                Reset Filter
              </button>
            ) : null}
          </div>

          <div className="space-y-3">
            {currentProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {filteredAndSortedProducts.length === 0
                    ? 'Tidak ada produk yang cocok dengan filter'
                    : 'Tidak ada produk'
                  }
                </p>
                {filteredAndSortedProducts.length === 0 && (searchQuery || selectedCategory) ? (
                  <p className="text-sm text-gray-400">Coba ubah filter atau kata kunci pencarian</p>
                ) : (
                  <p className="text-sm text-gray-400">Klik "Tambah Produk" untuk memulai</p>
                )}
              </div>
            ) : (
              <>
                {/* Batch Actions Header */}
                {selectedProducts.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-800 font-medium">
                        {selectedProducts.length} produk dipilih
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setShowBatchModal(true)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Edit Massal
                        </button>
                        <button
                          onClick={handleBatchDelete}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                        >
                          Hapus Massal
                        </button>
                        <button
                          onClick={() => setSelectedProducts([])}
                          className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Select All Checkbox */}
                <div className="flex items-center space-x-2 mb-3">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === currentProducts.length && currentProducts.length > 0}
                    onChange={() => {
                      if (selectedProducts.length === currentProducts.length) {
                        setSelectedProducts([]);
                      } else {
                        setSelectedProducts(currentProducts.map(p => p.id));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">Pilih Semua ({currentProducts.length} produk)</span>
                </div>

                {/* Product List */}
                {currentProducts.map((product) => (
                  <div key={product.id} className={`flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 ${
                    selectedProducts.includes(product.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-100'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      {product.images.length > 0 ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                          <Package className="w-6 h-6 text-blue-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-gray-500">{product.category} • {product.status === 'ready' ? 'Ready Stock' : 'PO'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-semibold text-gray-800">Rp {product.retailPrice.toLocaleString('id-ID')}</p>
                        <p className="text-sm text-gray-500">Stok: {product.stock}</p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleEditProduct(product)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Edit Produk"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Hapus Produk"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center space-x-2 mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &laquo;
                    </button>

                    {/* Page numbers */}
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
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &raquo;
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
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

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Upload Gambar Produk */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Upload Gambar Produk
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Klik untuk upload gambar</p>
                    <p className="text-xs text-gray-400">Mendukung multiple files</p>
                  </label>
                </div>
                {formData.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {formData.images.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={image}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Informasi Dasar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Produk *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Contoh: Hijab Segi Empat Premium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kategori Produk *
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Pilih Kategori</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Varian Produk */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Varian Produk
                </label>
                {formData.variants.map((variant, index) => (
                  <div key={index} className="space-y-2 mb-4 p-4 border border-gray-200 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Ukuran (pisahkan dengan koma)</label>
                        <input
                          type="text"
                          value={variant.sizes.join(', ')}
                          onChange={(e) => handleVariantChange(index, 'sizes', e.target.value)}
                          placeholder="contoh: S, M, L, XL"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Warna (pisahkan dengan koma)</label>
                        <input
                          type="text"
                          value={variant.colors.join(', ')}
                          onChange={(e) => handleVariantChange(index, 'colors', e.target.value)}
                          placeholder="contoh: Hitam, Putih, Biru, Merah"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    {formData.variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
                        className="text-red-500 hover:text-red-700 text-sm flex items-center space-x-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Hapus Varian</span>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addVariant}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Varian</span>
                </button>
              </div>

              {/* Harga */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Harga Beli
                  </label>
                  <input
                    type="number"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Harga Jual *
                  </label>
                  <input
                    type="number"
                    name="sellingPrice"
                    value={formData.sellingPrice}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Diskon (Rp)
                  </label>
                  <input
                    type="number"
                    name="discount"
                    value={formData.discount}
                    onChange={handleInputChange}
                    min="0"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Satuan, Stok, dan Kondisi */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Satuan
                  </label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Pilih Satuan</option>
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stok *
                  </label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleInputChange}
                    required
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kondisi Produk *
                  </label>
                  <select
                    name="condition"
                    value={formData.condition}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Ready Stock">Ready Stock</option>
                    <option value="PO">PO (Pre Order)</option>
                  </select>
                </div>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keterangan
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Deskripsi produk, bahan, ukuran, dll..."
                />
              </div>

              {/* Summary */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">Ringkasan Produk</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-blue-700">
                    Total Stok: <span className="font-medium">{formData.stock} {formData.unit || 'pcs'}</span>
                  </p>
                  <p className="text-blue-700">
                    Total Variants: <span className="font-medium">{formData.variants.length}</span>
                  </p>
                  {formData.sellingPrice > 0 && formData.discount > 0 && (
                    <p className="text-blue-700">
                      Harga Setelah Diskon: <span className="font-medium">
                        Rp {Math.round(formData.sellingPrice - formData.discount).toLocaleString('id-ID')}
                      </span>
                    </p>
                  )}
                  <p className="text-blue-700">
                    Harga Reseller: <span className="font-medium">
                      Rp {Math.round(formData.sellingPrice * 0.8).toLocaleString('id-ID')}
                    </span>
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Produk</span>
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
            {/* Modal Header */}
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

            {/* Modal Body */}
            <form onSubmit={handleUpdateProduct} className="p-6 space-y-6">
              {/* Upload Gambar Produk */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Upload Gambar Produk
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="edit-image-upload"
                  />
                  <label htmlFor="edit-image-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Klik untuk upload gambar</p>
                    <p className="text-xs text-gray-400">Mendukung multiple files</p>
                  </label>
                </div>
                {formData.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {formData.images.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={image}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Informasi Dasar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Produk *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Contoh: Hijab Segi Empat Premium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kategori Produk *
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Pilih Kategori</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Varian Produk */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Varian Produk
                </label>
                {formData.variants.map((variant, index) => (
                  <div key={index} className="space-y-2 mb-4 p-4 border border-gray-200 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Ukuran (pisahkan dengan koma)</label>
                        <input
                          type="text"
                          value={variant.sizes.join(', ')}
                          onChange={(e) => handleVariantChange(index, 'sizes', e.target.value)}
                          placeholder="contoh: S, M, L, XL"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Warna (pisahkan dengan koma)</label>
                        <input
                          type="text"
                          value={variant.colors.join(', ')}
                          onChange={(e) => handleVariantChange(index, 'colors', e.target.value)}
                          placeholder="contoh: Hitam, Putih, Biru, Merah"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Harga */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Harga Beli
                  </label>
                  <input
                    type="number"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Harga Jual *
                  </label>
                  <input
                    type="number"
                    name="sellingPrice"
                    value={formData.sellingPrice}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Diskon (Rp)
                  </label>
                  <input
                    type="number"
                    name="discount"
                    value={formData.discount}
                    onChange={handleInputChange}
                    min="0"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Stok dan Kondisi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stok *
                  </label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleInputChange}
                    required
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kondisi Produk *
                  </label>
                  <select
                    name="condition"
                    value={formData.condition}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Ready Stock">Ready Stock</option>
                    <option value="PO">PO (Pre Order)</option>
                  </select>
                </div>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keterangan
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Deskripsi produk, bahan, ukuran, dll..."
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Update Produk</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Edit Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Edit Massal ({selectedProducts.length} produk)</h2>
                <button
                  onClick={() => setShowBatchModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="text-center">
                <Edit className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                <h3 className="font-medium text-gray-800 mb-2">Edit Massal Produk</h3>
                <p className="text-sm text-gray-600">
                  {selectedProducts.length} produk akan diedit secara bersamaan. Isi field yang ingin diubah.
                </p>
              </div>

              {/* Flash Sale Section */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-4 border border-red-200">
                <h4 className="font-semibold text-red-800 mb-3 flex items-center space-x-2">
                  <Flame className="w-5 h-5" />
                  <span>🔥 Konfigurasi Flash Sale</span>
                  {flashSaleConfig.isActive && (
                    <span className="ml-2 px-2 py-1 bg-red-600 text-white text-xs rounded-full">AKTIF</span>
                  )}
                </h4>

                {flashSaleConfig.isActive && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                    <p className="text-sm text-red-800">
                      <strong>Flash Sale Sedang Aktif!</strong> Berlaku hingga: {new Date(flashSaleConfig.endTime).toLocaleString('id-ID')}
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      {flashSaleConfig.productIds.length} produk terdaftar dengan diskon Rp {flashSaleConfig.flashSaleDiscount.toLocaleString('id-ID')}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Waktu Mulai
                    </label>
                    <input
                      type="datetime-local"
                      value={flashSaleConfig.startTime}
                      onChange={(e) => handleFlashSaleConfigChange('startTime', e.target.value)}
                      disabled={flashSaleConfig.isActive}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Waktu Berakhir
                    </label>
                    <input
                      type="datetime-local"
                      value={flashSaleConfig.endTime}
                      onChange={(e) => handleFlashSaleConfigChange('endTime', e.target.value)}
                      disabled={flashSaleConfig.isActive}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Percent className="w-4 h-4 inline mr-1" />
                      Diskon Flash Sale (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={flashSaleConfig.flashSaleDiscount}
                      onChange={(e) => handleFlashSaleConfigChange('flashSaleDiscount', parseInt(e.target.value) || 0)}
                      disabled={flashSaleConfig.isActive}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Contoh: 5000"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm text-red-700">
                    {!flashSaleConfig.isActive
                      ? "Centang 'Jadikan Flash Sale' di bawah untuk memilih produk yang ikut flash sale"
                      : "Flash sale sedang aktif. Anda dapat menambahkan produk atau menghentikan flash sale."
                    }
                  </p>
                  <div className="flex items-center space-x-2">
                    {flashSaleConfig.isActive && (
                      <button
                        onClick={handleFlashSaleEnd}
                        className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
                      >
                        <Flame className="w-4 h-4" />
                        <span>Stop Flash Sale</span>
                      </button>
                    )}
                    {!flashSaleConfig.isActive && (
                      <button
                        onClick={() => {
                          if (!flashSaleConfig.startTime || !flashSaleConfig.endTime || flashSaleConfig.flashSaleDiscount <= 0) {
                            alert('Mohon lengkapi pengaturan flash sale terlebih dahulu');
                            return;
                          }

                          const selectedFlashSaleProducts = selectedProducts;
                          if (selectedFlashSaleProducts.length === 0) {
                            alert('Pilih setidaknya satu produk untuk flash sale');
                            return;
                          }

                          const config: FlashSaleConfig = {
                            ...flashSaleConfig,
                            isActive: true,
                            productIds: selectedFlashSaleProducts
                          };
                          handleFlashSaleStart(config);
                          setShowBatchModal(false);
                        }}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                      >
                        <Zap className="w-4 h-4" />
                        <span>Mulai Flash Sale</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategori Produk
                </label>
                <select
                  name="category"
                  value={batchFormData.category}
                  onChange={handleBatchInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Tidak ubah</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Harga Jual
                </label>
                <input
                  type="number"
                  name="retailPrice"
                  value={batchFormData.retailPrice}
                  onChange={handleBatchInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Kosongkan jika tidak ingin diubah"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Diskon (Rp)
                </label>
                <input
                  type="number"
                  name="discount"
                  value={batchFormData.discount}
                  onChange={handleBatchInputChange}
                  min="0"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="0 = tidak ada diskon"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stok
                </label>
                <input
                  type="number"
                  name="stock"
                  value={batchFormData.stock}
                  onChange={handleBatchInputChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Kosongkan jika tidak ingin diubah"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kondisi Produk
                </label>
                <select
                  name="status"
                  value={batchFormData.status}
                  onChange={handleBatchInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Tidak ubah</option>
                  <option value="ready">Ready Stock</option>
                  <option value="po">PO (Pre Order)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jadikan Produk Unggulan
                </label>
                <div className="flex items-center space-x-3 mt-2">
                  <input
                    type="checkbox"
                    name="isFeatured"
                    checked={batchFormData.isFeatured}
                    onChange={handleBatchInputChange}
                    className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-600">Tandai sebagai produk unggulan</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jadikan Flash Sale
                </label>
                <div className="flex items-center space-x-3 mt-2">
                  <input
                    type="checkbox"
                    name="isFlashSale"
                    checked={batchFormData.isFlashSale}
                    onChange={handleBatchInputChange}
                    className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-600">Tandai sebagai produk flash sale</span>
                </div>
              </div>
            </div>

              {/* Preview of selected products */}
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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Informasi:</strong> Hanya field yang diisi akan diperbarui. Field yang kosong akan dibiarkan tetap.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowBatchModal(false);
                    setBatchFormData({
                      category: '',
                      retailPrice: 0,
                      discount: 0,
                      stock: 0,
                      status: 'ready',
                      isFeatured: false,
                      isFlashSale: false
                    });
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleBatchUpdate}
                  className="px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Update {selectedProducts.length} Produk</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductsPage;