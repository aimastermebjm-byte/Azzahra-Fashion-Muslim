import React, { useState, useEffect } from 'react';
import { ArrowLeft, Package, Plus, Edit, Search, Filter, X, Trash2, Clock, Flame, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../types';
import { useUnifiedFlashSale } from '../hooks/useUnifiedFlashSale';
import { ProductTableSkeleton, FlashSaleStatusSkeleton, MenuSkeleton } from './LoadingSkeleton';
import { uploadMultipleImages, validateImageFile, generateImageName } from '../utils/imageUpload';

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
  // Fallback untuk error import
  const [importError, setImportError] = useState<string | null>(null);

  // Load useProductCRUD dynamically with error handling
  const [crudResult, setCrudResult] = React.useState<any>(null);

  React.useEffect(() => {
    const loadCRUD = async () => {
      try {
        const { useProductCRUD } = await import('../hooks/useProductCRUD');
        if (useProductCRUD) {
          setCrudResult(useProductCRUD());
        }
      } catch (err) {
        console.error('🚨 Failed to import useProductCRUD:', err);
        setImportError('Gagal memuat CRUD produk. Menggunakan mode terbatas.');
        // Set fallback
        setCrudResult({
          products: [],
          loading: false,
          error: null,
          addProduct: async () => {
            throw new Error('CRUD operations tidak tersedia. Silakan refresh halaman.');
          },
          updateProduct: async () => {
            throw new Error('Update produk tidak tersedia. Silakan refresh halaman.');
          },
          deleteProduct: async () => {
            throw new Error('Hapus produk tidak tersedia. Silakan refresh halaman.');
          }
        });
      }
    };

    loadCRUD();
  }, []); // Only run once on mount

  const { products = [], loading = false, updateProduct, addProduct, deleteProduct } = crudResult || {};

  // 🔥 UNIFIED FLASH SALE: Single source of truth
  const {
    timeLeft,
    isFlashSaleActive,
    flashSaleConfig,
    startFlashSale: startUnifiedFlashSale,
    endFlashSale: stopUnifiedFlashSale,
    loading: flashSaleLoading
  } = useUnifiedFlashSale();

  // Flash sale products from current products list
  const flashSaleProducts = products.filter(product => product.isFlashSale);

  // Flash sale config untuk UI
  const currentFlashSaleConfig = {
    isActive: isFlashSaleActive,
    startTime: flashSaleConfig?.startTime || '',
    endTime: flashSaleConfig?.endTime || '',
    flashSaleDiscount: flashSaleConfig?.discountPercentage || 20,
    productIds: flashSaleProducts.map(p => p.id)
  };

  
  // State management
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showVariantBatchModal, setShowVariantBatchModal] = useState(false);
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
    retailPrice: '', // Changed from 0 to empty string
    resellerPrice: '', // Changed from 0 to empty string
    costPrice: '', // Changed from 0 to empty string
    weight: '', // Changed from 1000 to empty string
    images: [] as (string | { file: File; preview: string; isUploading: boolean })[],
    variants: { sizes: [] as string[], colors: [] as string[], stock: {} as any },
    status: 'ready' as 'ready' | 'po'
  });

  // Batch form data
  const [batchFormData, setBatchFormData] = useState({
    category: '',
    retailPrice: 0,
    discount: 0,
    stock: -1, // Default -1 means no stock change
    status: '' as 'ready' | 'po' | '', // Empty means no change
    isFeatured: false as boolean | undefined
  });

  // Variant batch form data
  const [variantBatchFormData, setVariantBatchFormData] = useState({
    sizes: ['Ukuran 1', 'Ukuran 2'],
    colors: ['A', 'B', 'C', 'D'],
    stockPerVariant: 5
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

  // Variant management helpers
  const addSize = () => {
    const newSize = `Ukuran ${formData.variants.sizes.length + 1}`;
    setFormData({
      ...formData,
      variants: {
        ...formData.variants,
        sizes: [...formData.variants.sizes, newSize],
        stock: {
          ...formData.variants.stock,
          [newSize]: formData.variants.colors.reduce((acc, color) => ({
            ...acc,
            [color]: 0 // Stock must be number, not string
          }), {} as any)
        }
      }
    });
  };

  const removeSize = (sizeToRemove: string) => {
    const newSizes = formData.variants.sizes.filter(size => size !== sizeToRemove);
    const newStock = { ...formData.variants.stock };
    delete newStock[sizeToRemove];

    setFormData({
      ...formData,
      variants: {
        ...formData.variants,
        sizes: newSizes,
        stock: newStock
      }
    });
  };

  const addColor = () => {
    // Generate alphabet letters A, B, C, ... for colors
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letterIndex = formData.variants.colors.length % 26;
    const newColor = alphabet[letterIndex];
    setFormData({
      ...formData,
      variants: {
        ...formData.variants,
        colors: [...formData.variants.colors, newColor],
        stock: Object.keys(formData.variants.stock).reduce((acc, size) => {
          const existingStock = formData.variants.stock[size] || {};
          return {
            ...acc,
            [size]: {
              ...existingStock,
              [newColor]: 0 // Stock must be number,not string
            }
          };
        }, {} as Record<string, Record<string, string>>)
      }
    });
  };

  const removeColor = (colorToRemove: string) => {
    const newColors = formData.variants.colors.filter(color => color !== colorToRemove);
    const newStock = Object.keys(formData.variants.stock).reduce((acc, size) => {
      const sizeStock = { ...formData.variants.stock[size] };
      delete sizeStock[colorToRemove];
      acc[size] = sizeStock;
      return acc;
    }, {} as any);

    setFormData({
      ...formData,
      variants: {
        ...formData.variants,
        colors: newColors,
        stock: newStock
      }
    });
  };

  const updateVariantStock = (size: string, color: string, stock: string | number) => {
    // Convert to number, default to 0 if empty
    const stockValue = typeof stock === 'string' ? (parseInt(stock) || 0) : stock;
    setFormData({
      ...formData,
      variants: {
        ...formData.variants,
        stock: {
          ...formData.variants.stock,
          [size]: {
            ...formData.variants.stock[size],
            [color]: stockValue
          }
        }
      }
    });
  };

  const calculateTotalStock = () => {
    let total = 0;
    Object.values(formData.variants.stock).forEach((sizeStock: any) => {
      Object.values(sizeStock).forEach((colorStock: any) => {
        const stockValue = typeof colorStock === 'string' ? parseInt(colorStock) || 0 : colorStock || 0;
        total += stockValue;
      });
    });
    return total;
  };

  // Handle image upload and upload to Firebase Storage
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const validFiles: File[] = [];

    // Validate files
    Array.from(files).forEach((file) => {
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }
      validFiles.push(file);
    });

    if (validFiles.length === 0) {
      // Clear the input value to allow selecting the same file again
      e.target.value = '';
      return;
    }

    try {
      // Show loading state
      console.log(`🔄 Uploading ${validFiles.length} images to Firebase Storage...`);

      // For adding new product, we'll use a temporary ID or upload immediately after getting the product ID
      // For now, we'll store the files and upload after product is created
      const previewUrls = validFiles.map(file => URL.createObjectURL(file));

      setFormData(prev => ({
        ...prev,
        // Store both file objects and preview URLs
        images: [...prev.images, ...validFiles.map((file, index) => ({
          file,
          preview: previewUrls[index],
          isUploading: false
        }))]
      }));

      console.log(`✅ ${validFiles.length} files ready for upload to Firebase Storage`);
    } catch (error) {
      console.error('❌ Error preparing images for upload:', error);
      alert('Gagal mempersiapkan gambar untuk diupload. Silakan coba lagi.');
    }

    // Clear the input value to allow selecting the same file again
    e.target.value = '';
  };

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
      const totalStock = calculateTotalStock();

      // Upload images to Firebase Storage first if there are any
      let imageUrls: string[] = [];
      const filesToUpload = formData.images.filter(img => typeof img === 'object' && img.file) as { file: File; preview: string; isUploading: boolean }[];

      if (filesToUpload.length > 0) {
        console.log(`🔄 Uploading ${filesToUpload.length} images to Firebase Storage...`);

        // Create a temporary product ID for storage path
        const tempProductId = `temp_${Date.now()}`;

        try {
          imageUrls = await uploadMultipleImages(
            filesToUpload.map(img => img.file),
            tempProductId
          );
          console.log(`✅ Successfully uploaded ${imageUrls.length} images to Firebase Storage`);
        } catch (uploadError) {
          console.error('❌ Failed to upload images:', uploadError);
          alert('Gagal mengupload gambar ke Firebase Storage. Silakan coba lagi.');
          return;
        }
      }

      // Also keep existing URLs (for edited products)
      const existingImageUrls = formData.images.filter(img => typeof img === 'string') as string[];
      const allImageUrls = [...existingImageUrls, ...imageUrls];

      const newProduct = {
        ...formData,
        images: allImageUrls,
        image: allImageUrls[0] || '/placeholder-product.jpg', // Add required image field
        // Convert string fields to numbers, preserving original values
        retailPrice: parseInt(formData.retailPrice || '0') || 0,
        resellerPrice: parseInt(formData.resellerPrice || '0') || 0,
        costPrice: parseInt(formData.costPrice || '0') || 0,
        purchasePrice: parseInt(formData.costPrice || '0') || 0, // Required field
        price: parseInt(formData.retailPrice || '0') || 0, // Required field (same as retailPrice)
        originalRetailPrice: parseInt(formData.retailPrice || '0') || 0, // Required field
        originalResellerPrice: parseInt(formData.resellerPrice || '0') || 0, // Required field
        weight: parseInt(formData.weight || '0') || 0,
        stock: totalStock, // Use calculated total stock from variants
        unit: 'pcs', // Required field - default to pcs
        // IMPORTANT: Preserve all variants data exactly as entered
        variants: {
          sizes: Array.isArray(formData.variants?.sizes) ? formData.variants.sizes : [],
          colors: Array.isArray(formData.variants?.colors) ? formData.variants.colors : [],
          stock: (typeof formData.variants?.stock === 'object' && formData.variants.stock !== null) ? formData.variants.stock : {}
        },
        // Preserve status exactly as selected in form
        status: formData.status,
        createdAt: new Date(),
        salesCount: 0,
        isFeatured: false,
        isFlashSale: false,
        flashSalePrice: parseInt(formData.retailPrice) || 0,
        // Optional fields with defaults
        condition: 'baru',
        featured: false,
        discount: 0,
        reviews: 0,
        rating: 0
      };

      // Important: Log to verify data being saved to Firestore
      console.log('💾 Saving to Firestore:', {
        name: newProduct.name,
        sizes: newProduct.variants.sizes,
        colors: newProduct.variants.colors,
        status: newProduct.status,
        weight: newProduct.weight,
        unit: newProduct.unit,
        images: allImageUrls,
        imagesCount: allImageUrls.length,
        price: newProduct.price,
        retailPrice: newProduct.retailPrice,
        resellerPrice: newProduct.resellerPrice,
        costPrice: newProduct.costPrice,
        purchasePrice: newProduct.purchasePrice,
        originalRetailPrice: newProduct.originalRetailPrice,
        originalResellerPrice: newProduct.originalResellerPrice
      });

      await addProductToBatch(newProduct);

      // Reset form
      setFormData({
        name: '',
        description: '',
        category: 'Hijab',
        retailPrice: '',
        resellerPrice: '',
        costPrice: '',
        weight: '',
        images: [],
        variants: { sizes: [], colors: [], stock: {} },
        status: 'ready'
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
      // Upload new images to Firebase Storage first if there are any
      let imageUrls: string[] = [];
      const filesToUpload = formData.images.filter(img => typeof img === 'object' && img.file) as { file: File; preview: string; isUploading: boolean }[];

      if (filesToUpload.length > 0) {
        console.log(`🔄 Uploading ${filesToUpload.length} new images to Firebase Storage...`);

        try {
          imageUrls = await uploadMultipleImages(
            filesToUpload.map(img => img.file),
            editingProduct.id
          );
          console.log(`✅ Successfully uploaded ${imageUrls.length} new images to Firebase Storage`);
        } catch (uploadError) {
          console.error('❌ Failed to upload images:', uploadError);
          alert('Gagal mengupload gambar ke Firebase Storage. Silakan coba lagi.');
          return;
        }
      }

      // Also keep existing URLs
      const existingImageUrls = formData.images.filter(img => typeof img === 'string') as string[];
      const allImageUrls = [...existingImageUrls, ...imageUrls];

      // Prepare update data
      const updateData = {
        ...formData,
        images: allImageUrls,
        // Convert string fields to numbers
        retailPrice: parseInt(formData.retailPrice) || 0,
        resellerPrice: parseInt(formData.resellerPrice) || 0,
        costPrice: parseInt(formData.costPrice) || 0,
        weight: parseInt(formData.weight) || 0,
        // Only update variants if they exist
        variants: formData.variants.sizes.length > 0 ? formData.variants : undefined,
        stock: formData.variants.sizes.length > 0 ? calculateTotalStock() : undefined,
        status: formData.status
      };

      console.log('💾 Updating product in Firestore:', {
        id: editingProduct.id,
        name: updateData.name,
        newImages: imageUrls.length,
        totalImages: allImageUrls.length
      });

      await updateProduct(editingProduct.id, updateData);
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
      await deleteProductFromBatch(productId);
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
      retailPrice: String(product.retailPrice || ''),
      resellerPrice: String(product.resellerPrice || ''),
      costPrice: String(product.costPrice || ''),
      weight: String(product.weight || ''),
      images: product.images || [],
      variants: product.variants || { sizes: [], colors: [], stock: {} as any },
      status: product.status || 'ready'
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
      // FIXED: Don't update stock unless explicitly changed by user (prevent stock reset to 0)
      if (batchFormData.stock >= 0) { // Only update if stock is explicitly set (not -1)
        updates.stock = batchFormData.stock;
      }
      if (batchFormData.status) updates.status = batchFormData.status;
      // Fix: Always include isFeatured if explicitly set (true or false)
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
        stock: -1, // Use -1 to indicate no stock change (prevent accidental stock reset)
        status: '', // Empty means no change
        isFeatured: false as boolean | undefined
      });
    } catch (error) {
      console.error('Error updating products:', error);
      alert('Gagal memperbarui produk');
    }
  };

  // Flash sale operations
  const handleFlashSaleStart = async () => {
    // Validasi: Pastikan semua field yang diperlukan terisi
    if (!flashSaleFormData.startTime) {
      alert('Mohon isi waktu mulai flash sale');
      return;
    }

    if (!flashSaleFormData.endTime) {
      alert('Mohon isi waktu selesai flash sale');
      return;
    }

    if (flashSaleFormData.productIds.length === 0) {
      alert('Pilih setidaknya satu produk untuk flash sale');
      return;
    }

    if (!flashSaleFormData.flashSaleDiscount || flashSaleFormData.flashSaleDiscount <= 0) {
      alert('Mohon isi jumlah diskon yang valid');
      return;
    }

    try {
      // Parse waktu dari form tanpa default
      const startTime = new Date(flashSaleFormData.startTime);
      const endTime = new Date(flashSaleFormData.endTime);

      // Validasi: Pastikan waktu selesai lebih besar dari waktu mulai
      if (endTime <= startTime) {
        alert('Waktu selesai harus lebih besar dari waktu mulai');
        return;
      }

      // Calculate duration dari start dan end time yang user set
      const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (60 * 1000));

      if (durationMinutes <= 0) {
        alert('Durasi flash sale harus lebih dari 0 menit');
        return;
      }

      console.log('🔥 Memulai flash sale dengan parameter user:');
      console.log('- Start Time:', startTime.toISOString());
      console.log('- End Time:', endTime.toISOString());
      console.log('- Duration:', durationMinutes, 'menit');
      console.log('- Discount:', flashSaleFormData.flashSaleDiscount);
      console.log('- Products:', flashSaleFormData.productIds.length, 'produk');

      // Start flash sale dengan unified hook menggunakan parameter EXACT dari user
      await startUnifiedFlashSale(
        durationMinutes,
        '⚡ Flash Sale',
        'Diskon spesial terbatas!',
        flashSaleFormData.flashSaleDiscount,
        flashSaleFormData.productIds
      );

      setShowFlashSaleModal(false);

      // Reset form
      setFlashSaleFormData({
        isActive: false,
        startTime: '',
        endTime: '',
        flashSaleDiscount: 0,
        productIds: []
      });

      alert('✅ Flash sale berhasil dimulai dengan parameter yang Anda setting!');
    } catch (error) {
      console.error('Error starting flash sale:', error);
      alert('Gagal memulai flash sale: ' + (error as Error).message);
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

      await stopUnifiedFlashSale();
    } catch (error) {
      console.error('Error ending flash sale:', error);
      alert('Gagal menghentikan flash sale');
    }
  };

  // Bulk delete function
  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) {
      alert('Pilih setidaknya satu produk');
      return;
    }

    const productNames = selectedProducts.map(id => {
      const product = products.find(p => p.id === id);
      return product ? product.name : 'Unknown Product';
    });

    const confirmMessage = `Apakah Anda yakin ingin menghapus ${selectedProducts.length} produk berikut?\n\n${productNames.join('\n')}\n\n⚠️ Tindakan ini tidak dapat dibatalkan!`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      console.log(`🗑️ Menghapus ${selectedProducts.length} produk...`);

      for (const productId of selectedProducts) {
        await deleteProductFromBatch(productId);
      }

      setSelectedProducts([]);
      alert(`✅ Berhasil menghapus ${selectedProducts.length} produk`);
    } catch (error) {
      console.error('Error bulk deleting products:', error);
      alert('Gagal menghapus beberapa produk. Silakan coba lagi.');
    }
  };

  // Bulk variant update function
  const handleVariantBatchUpdate = async () => {
    if (selectedProducts.length === 0) {
      alert('Pilih setidaknya satu produk');
      return;
    }

    try {
      console.log(`🔄 Mengupdate varian untuk ${selectedProducts.length} produk...`);

      // Create variant stock structure
      const variantStock: any = {};
      variantBatchFormData.sizes.forEach((size: string) => {
        variantStock[size] = {};
        variantBatchFormData.colors.forEach((color: string) => {
          variantStock[size][color] = variantBatchFormData.stockPerVariant;
        });
      });

      // Calculate total stock
      const totalStock = variantBatchFormData.sizes.length *
                       variantBatchFormData.colors.length *
                       variantBatchFormData.stockPerVariant;

      // Update each product
      for (const productId of selectedProducts) {
        await updateProduct(productId, {
          variants: {
            sizes: variantBatchFormData.sizes,
            colors: variantBatchFormData.colors,
            stock: variantStock
          },
          stock: totalStock
        });
      }

      setShowVariantBatchModal(false);
      setSelectedProducts([]);
      alert(`✅ Berhasil mengupdate varian untuk ${selectedProducts.length} produk`);
    } catch (error) {
      console.error('Error bulk updating variants:', error);
      alert('Gagal mengupdate varian beberapa produk. Silakan coba lagi.');
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
                    <span className="font-medium">
                      {`${timeLeft.hours.toString().padStart(2, '0')}:${timeLeft.minutes.toString().padStart(2, '0')}:${timeLeft.seconds.toString().padStart(2, '0')}`}
                    </span>
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
              {products.filter(p => p.isFlashSale).length} produk dengan diskon Rp {flashSaleConfig?.discountPercentage?.toLocaleString('id-ID') || 0}
            </p>
          </div>
        )}

        {/* Emergency Flash Sale Cleanup - Debug Mode */}
        {products.filter(p => p.isFlashSale).length > 0 && !isFlashSaleActive && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-yellow-800">⚠️ Flash Sale Cleanup Needed</h3>
              <span className="text-xs text-yellow-600">
                {products.filter(p => p.isFlashSale).length} products stuck
              </span>
            </div>
            <p className="text-xs text-yellow-700 mb-3">
              Flash sale is not active but {products.filter(p => p.isFlashSale).length} products still have flash sale status.
              This may cause display issues.
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleFlashSaleEnd}
                className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 transition-colors text-xs"
              >
                🧹 Force Clean Up
              </button>
              <button
                onClick={() => {
                  const stuckProducts = products.filter(p => p.isFlashSale);
                  alert(`Stuck products: ${stuckProducts.map(p => p.name).join(', ')}`);
                }}
                className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 transition-colors text-xs"
              >
                📋 Show Details
              </button>
            </div>
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
                  setBatchFormData({ ...batchFormData, isFeatured: undefined }); // undefined untuk biarkan admin pilih
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

              {/* Batch Actions */}
              {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowBatchModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit {selectedProducts.length} Produk</span>
                  </button>

                  <button
                    onClick={() => setShowVariantBatchModal(true)}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                  >
                    <Package className="w-4 h-4" />
                    <span>Varian {selectedProducts.length} Produk</span>
                  </button>

                  <button
                    onClick={handleBulkDelete}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus {selectedProducts.length} Produk</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Product Table */}
          {loading ? (
            <ProductTableSkeleton />
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
                    {currentProducts.map((product, index) => (
                      <tr key={`${product.id}_${index}`} className="border-b hover:bg-gray-50">
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
                            product.status === 'ready'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {product.status === 'ready' ? '✅ Ready Stock' : '⏳ Pre-Order'}
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

              {/* Product Images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📷 Gambar Produk
                </label>
                <div className="space-y-4">
                  {/* File Upload Input */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Upload Gambar dari Device (opsional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Bisa pilih multiple gambar (JPG, PNG, WebP). Maksimal 5MB per gambar.
                    </p>
                  </div>

                  {/* Image Preview */}
                  {formData.images.length > 0 && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">
                        Gambar yang Ditambahkan ({formData.images.length})
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {formData.images.map((image, index) => {
                          const isFileObject = typeof image === 'object';
                          const imageSrc = isFileObject ? (image as any).preview : (image as string);

                          return (
                            <div key={index} className="relative group">
                              <img
                                src={imageSrc}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg border border-gray-200"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = '/placeholder-product.jpg';
                                }}
                              />
                              {isFileObject && (image as any).isUploading && (
                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                                  <div className="text-white text-xs">⏳ Uploading...</div>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    images: formData.images.filter((_, i) => i !== index)
                                  });
                                }}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
                                {index + 1}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        💡 Gambar pertama akan menjadi gambar utama produk
                      </p>
                    </div>
                  )}

                  {/* Placeholder Info */}
                  {formData.images.length === 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                      <div className="text-gray-400 mb-2">
                        <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">Belum ada gambar produk</p>
                      <p className="text-xs text-gray-500">
                        Upload gambar dari device atau lanjutkan tanpa gambar (gambar placeholder akan digunakan)
                      </p>
                    </div>
                  )}
                </div>
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
                    placeholder="0"
                    value={formData.retailPrice}
                    onChange={(e) => setFormData({ ...formData, retailPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Harga Reseller (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.resellerPrice}
                    onChange={(e) => setFormData({ ...formData, resellerPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Harga Modal (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Berat Produk (gram) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  placeholder="1000"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Berat produk dalam gram (contoh: 1000 = 1kg)</p>
              </div>

              {/* Product Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kondisi Produk *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ready' | 'po' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ready">Ready Stock</option>
                  <option value="po">Pre-Order (PO)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.status === 'ready' ? '✅ Produk siap dikirim' : '⏳ Produk butuh waktu pengerjaan'}
                </p>
              </div>

              {/* Variant Management */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      📏 Ukuran Produk
                    </label>
                    <button
                      type="button"
                      onClick={addSize}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                    >
                      + Tambah Ukuran
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.variants.sizes.map((size, index) => (
                      <div key={index} className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-lg">
                        <input
                          type="text"
                          value={size}
                          onChange={(e) => {
                            const newSizes = [...formData.variants.sizes];
                            newSizes[index] = e.target.value;
                            const oldSize = formData.variants.sizes[index];
                            const newStock = { ...formData.variants.stock };
                            if (oldSize !== e.target.value && newStock[oldSize]) {
                              newStock[e.target.value] = newStock[oldSize];
                              delete newStock[oldSize];
                            }
                            setFormData({
                              ...formData,
                              variants: {
                                ...formData.variants,
                                sizes: newSizes,
                                stock: newStock
                              }
                            });
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="contoh: S, M, L"
                        />
                        <button
                          type="button"
                          onClick={() => removeSize(size)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {formData.variants.sizes.length === 0 && (
                    <p className="text-sm text-gray-500">Tambahkan ukuran untuk mulai mengelola varian</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      🎨 Warna Produk
                    </label>
                    <button
                      type="button"
                      onClick={addColor}
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                    >
                      + Tambah Warna
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.variants.colors.map((color, index) => (
                      <div key={index} className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-lg">
                        <input
                          type="text"
                          value={color}
                          onChange={(e) => {
                            const newColors = [...formData.variants.colors];
                            const oldColor = formData.variants.colors[index];
                            newColors[index] = e.target.value;

                            const newStock = Object.keys(formData.variants.stock).reduce((acc, size) => {
                              acc[size] = { ...formData.variants.stock[size] };
                              if (oldColor !== e.target.value && acc[size][oldColor] !== undefined) {
                                acc[size][e.target.value] = acc[size][oldColor];
                                delete acc[size][oldColor];
                              }
                              return acc;
                            }, {} as any);

                            setFormData({
                              ...formData,
                              variants: {
                                ...formData.variants,
                                colors: newColors,
                                stock: newStock
                              }
                            });
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="contoh: Merah, Biru"
                        />
                        <button
                          type="button"
                          onClick={() => removeColor(color)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {formData.variants.colors.length === 0 && (
                    <p className="text-sm text-gray-500">Tambahkan warna untuk mulai mengelola varian</p>
                  )}
                </div>

                {/* Stock Matrix */}
                {formData.variants.sizes.length > 0 && formData.variants.colors.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      📦 Stok per Varian
                    </label>
                    <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-2 font-medium text-gray-700">Ukuran \ Warna</th>
                            {formData.variants.colors.map((color, index) => (
                              <th key={index} className="text-center py-2 px-2 font-medium text-gray-700">
                                {color}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {formData.variants.sizes.map((size, sizeIndex) => (
                            <tr key={sizeIndex} className="border-b border-gray-100">
                              <td className="py-2 px-2 font-medium text-gray-600">{size}</td>
                              {formData.variants.colors.map((color, colorIndex) => (
                                <td key={colorIndex} className="py-2 px-2 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={formData.variants.stock[size]?.[color] || ''}
                                    onChange={(e) => updateVariantStock(size, color, e.target.value)}
                                    className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Total Stok: <span className="font-semibold text-blue-600">{calculateTotalStock()} pcs</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        💡 Total stok akan dihitung otomatis dari semua varian
                      </p>
                    </div>
                  </div>
                )}
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

              {/* Product Images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📷 Gambar Produk
                </label>
                <div className="space-y-4">
                  {/* File Upload Input */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Upload Gambar dari Device (opsional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Bisa pilih multiple gambar (JPG, PNG, WebP). Maksimal 5MB per gambar.
                    </p>
                  </div>

                  {/* Image Preview */}
                  {formData.images.length > 0 && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">
                        Gambar yang Ditambahkan ({formData.images.length})
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {formData.images.map((image, index) => {
                          const isFileObject = typeof image === 'object';
                          const imageSrc = isFileObject ? (image as any).preview : (image as string);

                          return (
                            <div key={index} className="relative group">
                              <img
                                src={imageSrc}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg border border-gray-200"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = '/placeholder-product.jpg';
                                }}
                              />
                              {isFileObject && (image as any).isUploading && (
                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                                  <div className="text-white text-xs">⏳ Uploading...</div>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    images: formData.images.filter((_, i) => i !== index)
                                  });
                                }}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
                                {index + 1}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        💡 Gambar pertama akan menjadi gambar utama produk
                      </p>
                    </div>
                  )}

                  {/* Placeholder Info */}
                  {formData.images.length === 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                      <div className="text-gray-400 mb-2">
                        <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">Belum ada gambar produk</p>
                      <p className="text-xs text-gray-500">
                        Upload gambar dari device atau lanjutkan tanpa gambar (gambar placeholder akan digunakan)
                      </p>
                    </div>
                  )}
                </div>
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
                    placeholder="0"
                    value={formData.retailPrice}
                    onChange={(e) => setFormData({ ...formData, retailPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Harga Reseller (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.resellerPrice}
                    onChange={(e) => setFormData({ ...formData, resellerPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Harga Modal (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Berat Produk (gram) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  placeholder="1000"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Berat produk dalam gram (contoh: 1000 = 1kg)</p>
              </div>

              {/* Product Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kondisi Produk *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ready' | 'po' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ready">Ready Stock</option>
                  <option value="po">Pre-Order (PO)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.status === 'ready' ? '✅ Produk siap dikirim' : '⏳ Produk butuh waktu pengerjaan'}
                </p>
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

              {/* Info untuk admin */}
              {selectedProducts.length > 0 && selectedProducts.every(id => products.find(p => p.id === id)?.isFeatured) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    💡 <strong>Info:</strong> Saat ini semua produk yang dipilih adalah produk unggulan.
                    Pilih "Hapus dari Unggulan" untuk menghapus status unggulan dari produk ini.
                  </p>
                </div>
              )}

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
                    Ubah Kondisi Produk
                  </label>
                  <select
                    value={batchFormData.status || ''}
                    onChange={(e) => setBatchFormData({ ...batchFormData, status: e.target.value as 'ready' | 'po' | '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">-- Tidak Diubah --</option>
                    <option value="ready">Ready Stock</option>
                    <option value="po">Pre-Order (PO)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status Produk Unggulan
                  </label>
                  <select
                    value={batchFormData.isFeatured === undefined ? '' : batchFormData.isFeatured ? 'true' : 'false'}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setBatchFormData({ ...batchFormData, isFeatured: undefined });
                      } else {
                        setBatchFormData({ ...batchFormData, isFeatured: value === 'true' });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">-- Pilih Aksi --</option>
                    <option value="false">Hapus dari Unggulan</option>
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

      {/* Variant Batch Modal */}
      {showVariantBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  <span>Edit Varian Massal ({selectedProducts.length} Produk)</span>
                </h2>
                <button
                  onClick={() => setShowVariantBatchModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
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

              {/* Sizes Configuration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  📏 Ukuran Produk
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {variantBatchFormData.sizes.map((size, index) => (
                    <div key={index} className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-lg">
                      <input
                        type="text"
                        value={size}
                        onChange={(e) => {
                          const newSizes = [...variantBatchFormData.sizes];
                          newSizes[index] = e.target.value;
                          setVariantBatchFormData({
                            ...variantBatchFormData,
                            sizes: newSizes
                          });
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="contoh: S, M, L"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newSizes = variantBatchFormData.sizes.filter((_, i) => i !== index);
                          setVariantBatchFormData({
                            ...variantBatchFormData,
                            sizes: newSizes
                          });
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newSize = `Ukuran ${variantBatchFormData.sizes.length + 1}`;
                    setVariantBatchFormData({
                      ...variantBatchFormData,
                      sizes: [...variantBatchFormData.sizes, newSize]
                    });
                  }}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                >
                  + Tambah Ukuran
                </button>
              </div>

              {/* Colors Configuration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  🎨 Warna Produk
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {variantBatchFormData.colors.map((color, index) => (
                    <div key={index} className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-lg">
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => {
                          const newColors = [...variantBatchFormData.colors];
                          newColors[index] = e.target.value;
                          setVariantBatchFormData({
                            ...variantBatchFormData,
                            colors: newColors
                          });
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="contoh: Merah, Biru"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newColors = variantBatchFormData.colors.filter((_, i) => i !== index);
                          setVariantBatchFormData({
                            ...variantBatchFormData,
                            colors: newColors
                          });
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                    const letterIndex = variantBatchFormData.colors.length % 26;
                    const newColor = alphabet[letterIndex];
                    setVariantBatchFormData({
                      ...variantBatchFormData,
                      colors: [...variantBatchFormData.colors, newColor]
                    });
                  }}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                >
                  + Tambah Warna
                </button>
              </div>

              {/* Stock per Variant */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📦 Stok per Varian
                </label>
                <input
                  type="number"
                  min="0"
                  value={variantBatchFormData.stockPerVariant}
                  onChange={(e) => setVariantBatchFormData({
                    ...variantBatchFormData,
                    stockPerVariant: parseInt(e.target.value) || 0
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Masukkan stok per varian"
                />
                <p className="text-sm text-gray-600 mt-1">
                  Total stok per produk: {variantBatchFormData.sizes.length} × {variantBatchFormData.colors.length} × {variantBatchFormData.stockPerVariant} = {variantBatchFormData.sizes.length * variantBatchFormData.colors.length * variantBatchFormData.stockPerVariant} pcs
                </p>
              </div>

              {/* Preview Matrix */}
              {(variantBatchFormData.sizes.length > 0 && variantBatchFormData.colors.length > 0) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    👀 Preview Stok Matrix
                  </label>
                  <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 font-medium text-gray-700">Ukuran \ Warna</th>
                          {variantBatchFormData.colors.map((color, index) => (
                            <th key={index} className="text-center py-2 px-2 font-medium text-gray-700">
                              {color}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {variantBatchFormData.sizes.map((size, sizeIndex) => (
                          <tr key={sizeIndex} className="border-b border-gray-100">
                            <td className="py-2 px-2 font-medium text-gray-600">{size}</td>
                            {variantBatchFormData.colors.map((color, colorIndex) => (
                              <td key={colorIndex} className="py-2 px-2 text-center">
                                <span className="inline-block bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-medium">
                                  {variantBatchFormData.stockPerVariant}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Perhatian:</strong> Ini akan mengganti semua varian yang ada untuk produk yang dipilih. Semua ukuran, warna, dan stok akan disesuaikan dengan konfigurasi di atas.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowVariantBatchModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleVariantBatchUpdate}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                >
                  <Package className="w-4 h-4" />
                  <span>Update Varian</span>
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