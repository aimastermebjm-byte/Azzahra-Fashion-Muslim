import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit, Search, X, Trash2, Clock, Flame, Star, MessageCircle } from 'lucide-react';
import { collection, addDoc, updateDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebaseClient';
import PageHeader from './PageHeader';
import { Product } from '../types';
import { useProductCRUD } from '../hooks/useProductCRUD';
import { useUnifiedFlashSale } from '../hooks/useUnifiedFlashSale';
import { ProductTableSkeleton, FlashSaleStatusSkeleton, MenuSkeleton } from './LoadingSkeleton';
import { useGlobalProducts } from '../hooks/useGlobalProducts';
import { uploadMultipleImages, validateImageFile, generateImageName } from '../utils/imageUpload';
import { forceSyncAllProducts } from '../services/globalIndexSync';
import { productCategoryService, ProductCategory } from '../services/productCategoryService';
import { collageService } from '../services/collageService';
import { geminiService } from '../services/geminiVisionService';
import { hasAPIKeyWithFallback, loadAPIKeyWithFallback } from '../utils/encryption';
import AIAutoUploadModal from './AIAutoUploadModal';
import ManualUploadModal from './ManualUploadModal';
import WhatsAppInboxModal from './WhatsAppInboxModal';
import StockHistoryModal from './StockHistoryModal';
import { collectionService } from '../services/collectionService';
import CollectionManager from './CollectionManager';

interface AdminProductsPageProps {
  onBack: () => void;
  user: any;
  onNavigateToStockApproval?: () => void;
}

interface FlashSaleConfig {
  isActive: boolean;
  startTime: string;
  endTime: string;
  flashSaleDiscount: number;
  productIds: string[];
}

const AdminProductsPage: React.FC<AdminProductsPageProps> = ({ onBack, user, onNavigateToStockApproval }) => {
  // Use global products context instead of local CRUD
  const { allProducts, loading, error } = useGlobalProducts();

  // Use product CRUD functions for product management
  const { addProduct, updateProduct, deleteProduct } = useProductCRUD();

  // Log current state for debugging
  React.useEffect(() => {
    console.log('🔍 AdminProductsPage: Current products count:', allProducts?.length || 0);
    console.log('🔍 AdminProductsPage: Current loading state:', loading);
    console.log('🔍 AdminProductsPage: Current error state:', error);
  }, [allProducts, loading, error]);

  const products = allProducts || [];

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
  const [showAIUploadModal, setShowAIUploadModal] = useState(false);
  const [showManualUploadModal, setShowManualUploadModal] = useState(false);
  const [manualUploadInitialState, setManualUploadInitialState] = useState<any>(null);
  const [showWhatsAppInbox, setShowWhatsAppInbox] = useState(false);
  const [processingDraftId, setProcessingDraftId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [tappedProductId, setTappedProductId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  // NEW: Discount and Collection Modal States

  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');

  // Stock History Modal
  const [historyModalData, setHistoryModalData] = useState<any>(null);

  // Ref for infinite scroll
  const loaderRef = React.useRef<HTMLDivElement>(null);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 20);
        }
      },
      { threshold: 1.0 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, []);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery, selectedCategory, sortBy]);

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
    status: 'ready' as 'ready' | 'po',
    // NEW: Per-variant pricing and names
    pricesPerVariant: {} as Record<string, { retail: number; reseller: number }>,
    variantNames: {} as Record<string, string>
  });

  // Toggle for showing price per variant section in edit modal
  const [showPricePerVariant, setShowPricePerVariant] = useState(false);

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

  // Collection Manager State
  const [showCollectionManager, setShowCollectionManager] = useState(false);
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [forceSyncMessage, setForceSyncMessage] = useState<string | null>(null);

  // Categories - Load from master
  const [categories, setCategories] = useState<string[]>(['Hijab', 'Gamis', 'Khimar', 'Tunik', 'Aksesoris']);

  // Load categories from master on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const masterCategories = await productCategoryService.listCategories();
        const categoryNames = masterCategories.map(cat => cat.name);
        setCategories(categoryNames);
        console.log('✅ Loaded categories for AdminProductsPage:', categoryNames);
      } catch (error) {
        console.error('❌ Failed to load categories:', error);
        // Fallback tetap pakai default
      }
    };
    loadCategories();
  }, []);

  // Initialize Gemini AI Service on mount
  useEffect(() => {
    const initGemini = async () => {
      try {
        const apiKey = await loadAPIKeyWithFallback('gemini');
        const glmApiKey = await loadAPIKeyWithFallback('glm');

        if (apiKey || glmApiKey) {
          geminiService.initialize(apiKey || '', glmApiKey || '');
          console.log('✅ Gemini Service initialized in AdminProductsPage');
        } else {
          console.warn('⚠️ No AI API keys found. AI features may not work.');
        }
      } catch (error) {
        console.error('❌ Failed to initialize Gemini Service:', error);
      }
    };
    initGemini();
  }, []);

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

  // Infinite Scroll Slice
  const currentProducts = filteredAndSortedProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredAndSortedProducts.length;

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

      console.log('🚀 About to call addProduct with data:', newProduct);
      await addProduct(newProduct);
      console.log('✅ addProduct completed successfully');

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
        status: 'ready',
        pricesPerVariant: {},
        variantNames: {}
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
        variants: formData.variants.sizes.length > 0 ? {
          ...formData.variants,
          names: formData.variantNames // Include variant names in variants object
        } : undefined,
        stock: formData.variants.sizes.length > 0 ? calculateTotalStock() : undefined,
        status: formData.status,
        // NEW: Save per-variant pricing
        pricesPerVariant: Object.keys(formData.pricesPerVariant).length > 0 ? formData.pricesPerVariant : null
      };

      console.log('💾 Updating product in Firestore:', {
        id: editingProduct.id,
        name: updateData.name,
        newImages: imageUrls.length,
        totalImages: allImageUrls.length,
        // 🔥 DEBUG: Log pricesPerVariant being saved
        pricesPerVariant: updateData.pricesPerVariant,
        pricesPerVariantCount: updateData.pricesPerVariant ? Object.keys(updateData.pricesPerVariant).length : 0
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
      await deleteProduct(productId);
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Gagal menghapus produk');
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    const productAny = product as any;
    setFormData({
      name: product.name,
      description: product.description,
      category: product.category,
      retailPrice: String(product.retailPrice || ''),
      resellerPrice: String(product.resellerPrice || ''),
      costPrice: String(product.costPrice || ''),
      weight: String(product.weight || ''),
      images: product.images || [],
      variants: (product.variants as any) || { sizes: [], colors: [], stock: {} },
      status: product.status || 'ready',
      // Load existing per-variant pricing and names
      pricesPerVariant: productAny.pricesPerVariant || {},
      variantNames: productAny.variants?.names || productAny.variantNames || {}
    });
    // Show price per variant section if data exists
    setShowPricePerVariant(Object.keys(productAny.pricesPerVariant || {}).length > 0);
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

      // 🔒 PROTECTION: Harga hanya boleh diubah dengan konfirmasi eksplisit
      if (batchFormData.retailPrice > 0) {
        const confirmation = confirm(
          `⚠️ PERINGATAN PENTING!\n\n` +
          `Anda akan mengubah HARGA RETAIL ${selectedProducts.length} produk secara PERMANENT!\n\n` +
          `Harga baru: Rp ${batchFormData.retailPrice.toLocaleString('id-ID')}\n\n` +
          `Tindakan ini TIDAK DAPAT DIBATALKAN!\n\n` +
          `Apakah Anda YAKIN ingin melanjutkan?`
        );

        if (!confirmation) {
          alert('Batch update dibatalkan. Harga produk tidak diubah.');
          return;
        }

        updates.retailPrice = batchFormData.retailPrice;
        updates.resellerPrice = Math.round(batchFormData.retailPrice * 0.8);
        // 🔒 Update originalRetailPrice juga untuk konsistensi
        updates.originalRetailPrice = batchFormData.retailPrice;
        updates.originalResellerPrice = Math.round(batchFormData.retailPrice * 0.8);
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

  const handleAddToActiveFlashSale = async () => {
    if (!isFlashSaleActive || !flashSaleConfig) {
      alert('Tidak ada sesi Flash Sale aktif.');
      return;
    }

    if (selectedProducts.length === 0) {
      alert('Pilih produk terlebih dahulu.');
      return;
    }

    if (!confirm(`Tambahkan ${selectedProducts.length} produk terpilih ke Flash Sale yang sedang berjalan?`)) {
      return;
    }

    try {
      // Kita menggunakan durasi SISA waktu agar sesuai dengan timer yang berjalan
      // Atau menggunakan timer endTime asli dari config
      const endTime = new Date(flashSaleConfig.endTime);
      const now = new Date();
      const remainingMinutes = Math.max(1, Math.floor((endTime.getTime() - now.getTime()) / (60 * 1000)));

      // Gabungkan produk yang sudah ada di flash sale + produk baru
      const existingFlashSaleIds = products.filter(p => p.isFlashSale).map(p => p.id);
      // Gunakan Set untuk hindari duplikat
      const allProductIds = Array.from(new Set([...existingFlashSaleIds, ...selectedProducts]));

      console.log('🔥 Menambahkan produk ke sesi aktif:');
      console.log('- Existing:', existingFlashSaleIds.length);
      console.log('- Adding:', selectedProducts.length);
      console.log('- Total:', allProductIds.length);

      // Panggil startUnifiedFlashSale dengan ID gabungan
      // Ini akan mengupdate produk yang baru dipilih menjadi flash sale
      // dan memperpanjang/mempertahankan status produk lama
      await startUnifiedFlashSale(
        remainingMinutes,
        '⚡ Flash Sale',
        'Diskon spesial terbatas!',
        flashSaleConfig.discountPercentage,
        allProductIds
      );

      setSelectedProducts([]);
      alert(`✅ Berhasil menambahkan ${selectedProducts.length} produk ke Flash Sale aktif!`);
    } catch (error) {
      console.error('Error adding to active flash sale:', error);
      alert('Gagal menambahkan produk: ' + (error as Error).message);
    }
  };

  // Flash sale operations
  const handleFlashSaleStart = async () => {
    // 🔥 NEW: If flash sale is active, add to existing with custom discount
    if (isFlashSaleActive) {
      // Simplified validation for adding to existing
      if (flashSaleFormData.productIds.length === 0) {
        alert('Pilih setidaknya satu produk untuk ditambahkan ke flash sale');
        return;
      }

      if (!flashSaleFormData.flashSaleDiscount || flashSaleFormData.flashSaleDiscount <= 0) {
        alert('Mohon isi jumlah diskon yang valid untuk grup produk ini');
        return;
      }

      try {
        console.log('➕ ADDING products to existing flash sale with custom discount');
        console.log('- Products to add:', flashSaleFormData.productIds.length);
        console.log('- Custom discount for this group:', flashSaleFormData.flashSaleDiscount);

        // Call with duration=0 to signal ADD mode (not replace)
        await startUnifiedFlashSale(
          0, // duration = 0 means keep existing timer
          flashSaleConfig?.title || '⚡ Flash Sale',
          flashSaleConfig?.description || 'Diskon spesial terbatas!',
          flashSaleFormData.flashSaleDiscount, // Custom discount for this group
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

        alert(`✅ ${flashSaleFormData.productIds.length} produk berhasil ditambahkan ke flash sale dengan diskon Rp ${flashSaleFormData.flashSaleDiscount.toLocaleString('id-ID')}!`);
        return; // Exit early
      } catch (error) {
        console.error('Error adding to flash sale:', error);
        alert('Gagal menambahkan produk ke flash sale: ' + (error as Error).message);
        return;
      }
    }

    // Original validation for NEW flash sale
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
      // STOP session first (more responsive)
      await stopUnifiedFlashSale();

      // Then remove flash sale from all products
      const flashSaleProducts = products.filter(p => p.isFlashSale);
      for (const product of flashSaleProducts) {
        await updateProduct(product.id, {
          isFlashSale: false,
          flashSalePrice: 0
        });
      }

      alert('✅ Flash Sale berhasil dihentikan!');
    } catch (error) {
      console.error('Error ending flash sale:', error);
      alert('Gagal menghentikan flash sale');
    }
  };

  // WhatsApp Process Handler
  const handleWhatsAppProcess = async (data: any, originalImageFile: File) => {
    try {
      // DRAFT QUEUE FLOW: productData already structured
      if (data.productData) {
        console.log('📦 Draft Queue Flow - Using pre-structured data');

        // Store Draft ID for deletion after upload
        if (data.draftId) {
          console.log('📝 Processing Draft ID:', data.draftId);
          setProcessingDraftId(data.draftId);
        } else {
          setProcessingDraftId(null);
        }

        // Set initial state directly from draft
        // Use images and collageBlob if available (from WhatsAppInboxModal regenerate)
        setManualUploadInitialState({
          step: data.step || 'details',
          images: data.images || [],
          collageBlob: data.collageBlob || null,
          collageUrl: data.collageUrl,
          productData: data.productData,
          uploadSettings: data.uploadSettings || { stockPerVariant: 10 }
        });

        setShowManualUploadModal(true);
        return;
      }

      // RAW WHATSAPP FLOW: Need to process images
      console.log('📱 Raw WhatsApp Flow - Processing images');

      let collageBlob: Blob | null = null;

      // Handle Multiple Images -> Collage
      if (data.collageUrl) {
        console.log('✅ Using existing Collage URL:', data.collageUrl);
      } else if (data.images && Array.isArray(data.images) && data.images.length > 1) {
        console.log(`🖼️ Generating Collage from ${data.images.length} images...`);
        const variantLabels = collageService.generateVariantLabels(data.images.length);
        collageBlob = await collageService.generateCollage(data.images, variantLabels);
      } else if (data.images && data.images.length === 1) {
        collageBlob = data.images[0];
      }

      // Store Draft ID if present
      if (data.draftId) {
        setProcessingDraftId(data.draftId);
      } else {
        setProcessingDraftId(null);
      }

      // Generate variants based on image count
      const imageCount = data.images?.length || 1;
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const variantColors = Array.from({ length: imageCount }, (_, i) => alphabet[i]);
      const defaultStock = data.defaultStock || 10;

      const variantStock: Record<string, Record<string, number>> = { 'All Size': {} };
      variantColors.forEach((color: string) => {
        variantStock['All Size'][color] = defaultStock;
      });

      // Prepare Initial State for ManualUploadModal
      setManualUploadInitialState({
        step: 'upload',
        images: data.images || [],
        collageBlob: collageBlob,
        collageUrl: data.collageUrl,
        productData: {
          name: data.name || '',
          description: data.description || '',
          category: data.category || 'Gamis',
          retailPrice: parseInt(data.retailPrice || 0),
          resellerPrice: parseInt(data.resellerPrice || 0),
          costPrice: parseInt(data.costPrice || 0),
          status: data.status || 'ready',
          weight: 1000,
          variants: {
            sizes: ['All Size'],
            colors: variantColors,
            stock: variantStock
          }
        },
        uploadSettings: {
          stockPerVariant: defaultStock,
        },
        whatsappIds: data.whatsappIds || []
      });

      setShowManualUploadModal(true);
      // setShowAddModal(true); // Disable old modal
    } catch (error) {
      console.error('Error processing WhatsApp data:', error);
      alert('Gagal memproses data WhatsApp: ' + (error as any).message);
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

    const confirmMessage = `Apakah Anda yakin ingin menghapus ${selectedProducts.length} produk berikut ?\n\n${productNames.join('\n')} \n\n⚠️ Tindakan ini tidak dapat dibatalkan!`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      console.log(`🗑️ Menghapus ${selectedProducts.length} produk...`);

      for (const productId of selectedProducts) {
        await deleteProduct(productId);
      }

      setSelectedProducts([]);
      alert(`✅ Berhasil menghapus ${selectedProducts.length} produk`);
    } catch (error) {
      console.error('Error bulk deleting products:', error);
      alert('Gagal menghapus beberapa produk. Silakan coba lagi.');
    }
  };

  // NEW: Handler for CollectionManager to update products (e.g. apply discount)
  const handleCollectionUpdateProduct = async (productId: string, data: Partial<Product>) => {
    try {
      // Use the proper updateProduct from useProductCRUD which handles batch array
      const success = await updateProduct(productId, data);
      if (!success) {
        throw new Error('Failed to update product');
      }
    } catch (error) {
      console.error('Error updating product from collection manager:', error);
      throw error;
    }
  };

  // NEW: Create collection handler
  const handleCreateCollection = async () => {
    if (selectedProducts.length === 0) {
      alert('Pilih setidaknya satu produk');
      return;
    }

    if (!collectionName.trim()) {
      alert('Masukkan nama koleksi');
      return;
    }

    try {
      console.log(`📁 Membuat koleksi "${collectionName}" dengan ${selectedProducts.length} produk...`);

      await collectionService.createCollection({
        name: collectionName.trim(),
        description: collectionDescription.trim(),
        productIds: selectedProducts
      });

      setSelectedProducts([]);
      setShowCollectionModal(false);
      setCollectionName('');
      setCollectionDescription('');
      alert(`✅ Koleksi "${collectionName}" berhasil dibuat dengan ${selectedProducts.length} produk!`);
    } catch (error) {
      console.error('Error creating collection:', error);
      alert('Gagal membuat koleksi. Silakan coba lagi.');
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

  const handleForceSyncGlobalIndex = async () => {
    if (isForceSyncing) {
      return;
    }

    setIsForceSyncing(true);
    try {
      const syncedCount = await forceSyncAllProducts();
      const message = `Force sync selesai: ${syncedCount} produk tersinkron ke globalindex.`;
      setForceSyncMessage(message);
      console.log('✅ FORCE SYNC GLOBALINDEX:', message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan tidak diketahui';
      setForceSyncMessage(`Force sync gagal: ${errorMessage} `);
      console.error('❌ Force sync globalindex gagal:', error);
    } finally {
      setIsForceSyncing(false);
    }
  };

  // ✨ NEW: Featured Products Management
  const handleRemoveFeatured = async (productId: string) => {
    await updateProduct(productId, { isFeatured: false });
  };

  const handleRemoveAllFeatured = async () => {
    if (!confirm('Hapus semua produk dari Unggulan?')) return;
    const featuredProducts = products.filter(p => p.isFeatured);
    for (const product of featuredProducts) {
      await updateProduct(product.id, { isFeatured: false });
    }
    alert('✅ Semua produk unggulan berhasil dihapus!');
  };

  // ✨ NEW: Remove single product from Flash Sale
  const handleRemoveFromFlashSale = async (productId: string) => {
    await updateProduct(productId, { isFlashSale: false, flashSalePrice: 0 });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader
        title="Kelola Produk"
        subtitle="Monitor dan kelola katalog produk"
        onBack={onBack}
        variant="surface"
        actions={
          <div className="flex gap-2">
            {user?.role === 'owner' && onNavigateToStockApproval && (
              <button
                onClick={onNavigateToStockApproval}
                className="bg-gradient-to-r from-[#997B2C] to-[#D4AF37] text-white px-3 py-1.5 rounded-full text-xs font-bold hover:shadow-lg transition-all flex items-center gap-1 shadow-[0_2px_0_0_#7A6223]"
              >
                <Clock className="w-3.5 h-3.5" />
                Approval
              </button>
            )}
            {user?.role === 'admin' && (
              <button
                onClick={handleForceSyncGlobalIndex}
                disabled={isForceSyncing}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${isForceSyncing ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                {isForceSyncing ? 'Syncing…' : 'Sync'}
              </button>
            )}
          </div>
        }
      />

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Stats Cards - Compact 4 columns for mobile */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-xl p-2 text-center border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] shine-effect">
            <p className="text-lg font-bold text-[#997B2C]">{products.length}</p>
            <p className="text-[10px] text-gray-500">Produk</p>
          </div>
          <div className="bg-white rounded-xl p-2 text-center border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] shine-effect">
            <p className="text-lg font-bold text-[#997B2C]">
              {products.reduce((total, product) => total + product.stock, 0)}
            </p>
            <p className="text-[10px] text-gray-500">Stok</p>
          </div>
          <div className="bg-white rounded-xl p-2 text-center border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] shine-effect">
            <p className="text-lg font-bold text-[#997B2C]">{categories.length}</p>
            <p className="text-[10px] text-gray-500">Kategori</p>
          </div>
          <div className="bg-white rounded-xl p-2 text-center border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C,0_4px_10px_rgba(153,123,44,0.15)] shine-effect">
            <p className="text-lg font-bold text-[#997B2C]">{products.filter(p => p.isFeatured).length}</p>
            <p className="text-[10px] text-gray-500">Unggulan</p>
          </div>
        </div>

        {/* ✨ NEW: Dashboard Produk Unggulan */}
        {products.filter(p => p.isFeatured).length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-[#D4AF37] rounded-xl p-4 shadow-[0_3px_0_0_#997B2C] shine-effect">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[#997B2C] flex items-center gap-2">
                <Star className="w-5 h-5 text-[#D4AF37]" />
                Produk Unggulan ({products.filter(p => p.isFeatured).length})
              </h3>
              <button
                onClick={handleRemoveAllFeatured}
                className="text-red-600 text-xs font-medium hover:text-red-700 transition-colors"
              >
                Hapus Semua
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {products.filter(p => p.isFeatured).map(product => (
                <div key={product.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-[#E2DED5]">
                  <img
                    src={product.images?.[0] || '/placeholder.png'}
                    alt={product.name}
                    className="w-10 h-10 rounded object-cover"
                  />
                  <span className="flex-1 text-sm truncate text-gray-700">{product.name}</span>
                  <button
                    onClick={() => handleRemoveFeatured(product.id)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ✨ NEW: Dashboard Flash Sale Products */}
        {isFlashSaleActive && products.filter(p => p.isFlashSale).length > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-400 rounded-xl p-4 shadow-[0_3px_0_0_#DC2626]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-red-700 flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-500" />
                Produk Flash Sale ({products.filter(p => p.isFlashSale).length})
              </h3>
              <button
                onClick={handleFlashSaleEnd}
                className="text-red-600 text-xs font-medium hover:text-red-700 transition-colors"
              >
                Stop Flash Sale
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {products.filter(p => p.isFlashSale).map(product => (
                <div key={product.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-red-200">
                  <img
                    src={product.images?.[0] || '/placeholder.png'}
                    alt={product.name}
                    className="w-10 h-10 rounded object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate text-gray-700">{product.name}</p>
                    <p className="text-xs text-red-600 font-medium">
                      Rp{product.flashSalePrice?.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveFromFlashSale(product.id)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {user?.role === 'admin' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-800">🔧 Debug Sync GlobalIndex</h3>
            <p className="mt-1 text-xs text-yellow-700">
              Gunakan tombol "Force Sync GlobalIndex" di header untuk memastikan katalog publik tetap sinkron.
            </p>
            {forceSyncMessage && (
              <p
                className={`text - xs mt - 2 ${forceSyncMessage.includes('gagal') ? 'text-red-600' : 'text-green-700'
                  } `}
              >
                {forceSyncMessage}
              </p>
            )}
          </div>
        )}

        {/* Flash Sale Widget - Replaces hidden menu */}
        {isFlashSaleActive ? (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg shadow-sm p-4 border border-red-200 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <Flame className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-red-800 text-lg">Flash Sale Sedang Berlangsung</h3>
                  <p className="text-sm text-red-600">
                    Diskon {flashSaleConfig?.discountPercentage}% untuk {products.filter(p => p.isFlashSale).length} produk
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {timeLeft && (
                  <div className="text-center px-4 py-2 bg-white rounded-lg shadow-sm border border-red-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Sisa Waktu</p>
                    <div className="flex items-center space-x-1 text-xl font-mono font-bold text-red-600">
                      <Clock className="w-5 h-5 mr-1" />
                      <span>
                        {`${timeLeft.hours.toString().padStart(2, '0')}:${timeLeft.minutes.toString().padStart(2, '0')}:${timeLeft.seconds.toString().padStart(2, '0')} `}
                      </span>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleFlashSaleEnd}
                  className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium shadow-sm"
                >
                  Stop Sesi Ini
                </button>
              </div>
            </div>
          </div>
        ) : (
          // ⚠️ OWNER ONLY: Flash Sale Banner
          user?.role === 'owner' && (
            <div className="bg-gradient-to-r from-[#FDF6E3] to-[#FEF9ED] rounded-xl shadow-sm p-4 border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C] mb-4 shine-effect">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-[#997B2C] to-[#D4AF37] rounded-full">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#997B2C] text-lg">Siap Mulai Flash Sale?</h3>
                    <p className="text-sm text-[#B8860B]">
                      Pilih produk di tabel bawah, lalu klik "Set Flash Sale" untuk memulai.
                    </p>
                  </div>
                </div>
                {/* No button here, guided action via table selection */}
              </div>
            </div>
          )
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
                  alert(`Stuck products: ${stuckProducts.map(p => p.name).join(', ')} `);
                }}
                className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 transition-colors text-xs"
              >
                📋 Show Details
              </button>
            </div>
          </div>
        )}

        {/* Main Actions - 3 Columns - GOLD THEME */}
        <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-3 shine-effect">
          <div className="grid grid-cols-3 gap-3">
            {/* Tambah Produk */}
            <button
              onClick={() => {
                setManualUploadInitialState(null);
                setShowManualUploadModal(true);
              }}
              className="bg-white p-4 rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C] hover:shadow-[0_6px_0_0_#997B2C] active:shadow-[0_2px_0_0_#997B2C] active:translate-y-0.5 transition-all flex items-center justify-center gap-3 group"
            >
              <div className="w-10 h-10 rounded-full bg-[radial-gradient(ellipse_at_center,_#EDD686_0%,_#D4AF37_50%,_#997B2C_100%)] flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-white drop-shadow-sm" />
              </div>
              <span className="text-base font-extrabold text-slate-900 group-hover:text-[#D4AF37] transition-colors">Tambah Produk</span>
            </button>

            {/* Draft Siap Upload */}
            <button
              onClick={() => setShowWhatsAppInbox(true)}
              className="bg-white p-4 rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C] hover:shadow-[0_6px_0_0_#997B2C] active:shadow-[0_2px_0_0_#997B2C] active:translate-y-0.5 transition-all flex items-center justify-center gap-3 group"
            >
              <div className="w-10 h-10 rounded-full bg-[radial-gradient(ellipse_at_center,_#EDD686_0%,_#D4AF37_50%,_#997B2C_100%)] flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <MessageCircle className="w-6 h-6 text-white drop-shadow-sm" />
              </div>
              <span className="text-base font-extrabold text-slate-900 group-hover:text-[#D4AF37] transition-colors">Draft Upload</span>
            </button>

            {/* Kelola Koleksi - OWNER ONLY */}
            {user?.role === 'owner' && (
              <button
                onClick={() => setShowCollectionManager(true)}
                className="bg-white p-4 rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C] hover:shadow-[0_6px_0_0_#997B2C] active:shadow-[0_2px_0_0_#997B2C] active:translate-y-0.5 transition-all flex items-center justify-center gap-3 group"
              >
                <div className="w-10 h-10 rounded-full bg-[radial-gradient(ellipse_at_center,_#EDD686_0%,_#D4AF37_50%,_#997B2C_100%)] flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <span className="text-2xl">📁</span>
                </div>
                <span className="text-base font-extrabold text-slate-900 group-hover:text-[#D4AF37] transition-colors">Koleksi</span>
              </button>
            )}
          </div>
        </div>

        {/* Product List - GOLD THEME */}
        <div className="bg-white rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_0_0_#997B2C,0_10px_20px_rgba(153,123,44,0.2)] p-3 shine-effect">
          {/* Header & Search/Filter - Compact */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#997B2C]">
                Produk {selectedProducts.length > 0 && <span className="text-[#D4AF37]">({selectedProducts.length})</span>}
              </h2>
            </div>

            {/* Search & Filter Row */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-[#997B2C] w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Cari..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs border-2 border-[#D4AF37] rounded-lg focus:ring-1 focus:ring-[#D4AF37] focus:border-[#997B2C] shadow-[0_2px_0_0_#997B2C]"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2 py-1.5 text-xs border-2 border-[#D4AF37] rounded-lg focus:ring-1 focus:ring-[#D4AF37] focus:border-[#997B2C] bg-white text-[#997B2C] font-semibold shadow-[0_2px_0_0_#997B2C]"
              >
                <option value="">Semua</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2 py-1.5 text-xs border-2 border-[#D4AF37] rounded-lg focus:ring-1 focus:ring-[#D4AF37] focus:border-[#997B2C] bg-white text-[#997B2C] font-semibold shadow-[0_2px_0_0_#997B2C]"
              >
                <option value="name">Nama</option>
                <option value="price-asc">Harga ↑</option>
                <option value="price-desc">Harga ↓</option>
                <option value="date-newest">Terbaru</option>
                <option value="date-oldest">Terlama</option>
              </select>
            </div>

            {/* Batch Actions - 2 Columns Like Main Menu */}
            {selectedProducts.length > 0 && (
              <div className="pt-3 border-t space-y-2">
                <div className="flex items-center justify-between bg-gradient-to-r from-[#FDF6E3] to-[#FEF9ED] p-3 rounded-xl border-2 border-[#D4AF37] shadow-[0_2px_0_0_#997B2C] shine-effect">
                  <div className="flex items-center gap-2">
                    <span className="bg-gradient-to-r from-[#997B2C] to-[#D4AF37] text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                      {selectedProducts.length}
                    </span>
                    <span className="text-sm font-bold bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] bg-clip-text text-transparent animate-shine">Produk Terpilih</span>
                  </div>
                  <button
                    onClick={() => setSelectedProducts([])}
                    className="bg-gradient-to-r from-[#997B2C] to-[#D4AF37] text-slate-900 px-3 py-1.5 rounded-lg border-2 border-[#7A6223] shadow-[0_2px_0_0_#7A6223] text-xs font-bold hover:shadow-lg flex items-center gap-1 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reset Pilihan
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* ✅ Unggulan - ALWAYS SHOW for Admin & Owner */}
                  <button
                    onClick={() => {
                      if (confirm(`Tandai ${selectedProducts.length} produk sebagai Unggulan?`)) {
                        const updateFeatured = async () => {
                          for (const pid of selectedProducts) {
                            await updateProduct(pid, { isFeatured: true });
                          }
                          alert('✅ Berhasil!');
                          setSelectedProducts([]);
                        };
                        updateFeatured();
                      }
                    }}
                    className="bg-white text-[#997B2C] p-3 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 font-bold border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C] shine-effect"
                  >
                    <Star className="w-5 h-5 text-[#997B2C]" />
                    <span className="text-sm">Unggulan</span>
                  </button>

                  {/* ⚠️ OWNER ONLY: Flash Sale, Edit Massal, Varian, Diskon */}
                  {user?.role === 'owner' && (
                    <>
                      <button
                        onClick={() => {
                          // \ud83d\udd25 FIXED: Always open modal, modal handles both new/add modes
                          setFlashSaleFormData({ ...flashSaleFormData, productIds: selectedProducts });
                          setShowFlashSaleModal(true);
                        }}
                        className="bg-white text-[#997B2C] p-3 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 font-bold border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C] shine-effect"
                      >
                        <Flame className="w-5 h-5 text-[#997B2C]" />
                        <span className="text-sm">Flash Sale</span>
                      </button>
                      <button
                        onClick={() => setShowBatchModal(true)}
                        className="bg-white text-[#997B2C] p-3 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 font-bold border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C] shine-effect"
                      >
                        <Edit className="w-5 h-5 text-[#997B2C]" />
                        <span className="text-sm">Edit Massal</span>
                      </button>
                      <button
                        onClick={() => setShowVariantBatchModal(true)}
                        className="bg-white text-[#997B2C] p-3 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 font-bold border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C] shine-effect"
                      >
                        <Package className="w-5 h-5 text-[#997B2C]" />
                        <span className="text-sm">Varian</span>
                      </button>

                    </>
                  )}

                  {/* Collection button moved to main toolbar */}
                  {user?.role === 'owner' && (
                    <button
                      onClick={handleBulkDelete}
                      className="bg-white text-[#997B2C] p-3 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 font-bold border-2 border-[#D4AF37] shadow-[0_3px_0_0_#997B2C] shine-effect"
                    >
                      <Trash2 className="w-5 h-5 text-[#997B2C]" />
                      <span className="text-sm">Hapus {selectedProducts.length} Produk</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Product Cards Grid - 2 Columns */}
          {loading ? (
            /* Loading Skeleton */
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
                  <div className="aspect-square bg-gray-200" />
                  <div className="p-1.5 space-y-1">
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                    <div className="h-2 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : currentProducts.length === 0 ? (
            /* Empty State */
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                {searchQuery || selectedCategory
                  ? 'Tidak ada produk yang ditemukan'
                  : 'Belum ada produk'}
              </p>
            </div>
          ) : (
            <>
              {/* Select All Checkbox */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={currentProducts.length > 0 && currentProducts.every(p => selectedProducts.includes(p.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        // Tambahkan produk halaman ini ke selection yang sudah ada (hindari duplikat)
                        const newIds = currentProducts.map(p => p.id);
                        setSelectedProducts(prev => [...new Set([...prev, ...newIds])]);
                      } else {
                        // Hapus hanya produk halaman ini dari selection
                        const currentPageIds = currentProducts.map(p => p.id);
                        setSelectedProducts(prev => prev.filter(id => !currentPageIds.includes(id)));
                      }
                    }}
                    className="w-4 h-4 rounded border-[#D4AF37] text-[#D4AF37] focus:ring-[#D4AF37] accent-[#D4AF37]"
                  />
                  <span className="text-[#997B2C] font-semibold">Pilih Halaman Ini</span>
                </label>
                <div className="text-right">
                  <span className="text-xs text-gray-500 block">
                    {filteredAndSortedProducts.length} produk total
                  </span>
                  {selectedProducts.length > 0 && (
                    <span className="text-xs font-semibold text-[#997B2C] block">
                      {selectedProducts.length} terpilih (Total)
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">{currentProducts.map((product) => {
                const isTapped = tappedProductId === product.id;
                const isSelected = selectedProducts.includes(product.id);

                return (
                  <div
                    key={product.id}
                    className={`relative bg-white rounded-xl border-2 overflow-hidden transition-all shadow-[0_2px_8px_rgba(153,123,44,0.15)] ${isSelected ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30' : 'border-gray-200'
                      }`}
                    onClick={() => setTappedProductId(isTapped ? null : product.id)}
                  >
                    {/* Checkbox - Top Left */}
                    <div
                      className="absolute top-1 left-1 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts([...selectedProducts, product.id]);
                          } else {
                            setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                          }
                        }}
                        className="w-4 h-4 rounded border-[#D4AF37] text-[#D4AF37] focus:ring-[#D4AF37] bg-white shadow-sm accent-[#D4AF37]"
                      />
                    </div>

                    {/* Badges - Top Right */}
                    <div className="absolute top-1 right-1 z-10 flex flex-col gap-0.5">
                      {product.isFeatured && (
                        <span className="bg-yellow-400 text-white text-[8px] px-1 py-0.5 rounded shadow">
                          ⭐
                        </span>
                      )}
                      {product.isFlashSale && (
                        <span className="bg-red-500 text-white text-[8px] px-1 py-0.5 rounded shadow">
                          🔥
                        </span>
                      )}
                    </div>

                    {/* Product Image */}
                    <div className="aspect-square bg-gray-100">
                      {product.images?.length > 0 || product.image ? (
                        <img
                          src={product.image || product.images[0] || '/placeholder-product.jpg'}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/placeholder-product.jpg';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-1.5">
                      <h4 className="text-[10px] font-medium text-gray-800 line-clamp-2 leading-tight mb-1">
                        {product.name}
                      </h4>
                      <p className="text-[10px] font-bold text-pink-600">
                        Rp {product.retailPrice.toLocaleString('id-ID')}
                      </p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className={`text-[8px] px-1 py-0.5 rounded ${product.stock > 10
                          ? 'bg-green-100 text-green-700'
                          : product.stock > 0
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                          Stok: {product.stock}
                        </span>
                        <span className={`text-[8px] px-1 py-0.5 rounded ${product.status === 'ready'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-orange-100 text-orange-700'
                          }`}>
                          {product.status === 'ready' ? 'Ready' : 'PO'}
                        </span>
                      </div>
                    </div>

                    {/* Overlay with Edit/Delete - Shows on Tap */}
                    {isTapped && (
                      <div
                        className="absolute inset-0 bg-black/60 flex flex-col animate-fade-in"
                        onClick={() => setTappedProductId(null)}
                      >
                        {/* Close Button - Top Right */}
                        <div className="flex justify-end p-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTappedProductId(null);
                            }}
                            className="bg-white/20 text-white p-1.5 rounded-full"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Action Buttons - Centered Vertical */}
                        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditProduct(product);
                              setTappedProductId(null);
                            }}
                            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 px-3 rounded-xl shadow-lg flex items-center justify-center gap-2 border-2 border-blue-700 shadow-[0_3px_0_0_#1d4ed8]"
                          >
                            <Edit className="w-4 h-4" />
                            <span className="text-xs font-bold">Edit</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryModalData(product);
                              setTappedProductId(null);
                            }}
                            className="w-full bg-gradient-to-r from-[#997B2C] to-[#D4AF37] text-slate-900 py-2 px-3 rounded-xl shadow-lg flex items-center justify-center gap-2 border-2 border-[#7A6223] shadow-[0_3px_0_0_#7A6223]"
                          >
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-bold">Kartu Stok</span>
                          </button>

                          {user?.role === 'owner' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProduct(product.id);
                                setTappedProductId(null);
                              }}
                              className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-2 px-3 rounded-xl shadow-lg flex items-center justify-center gap-2 border-2 border-red-800 shadow-[0_3px_0_0_#7f1d1d]"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="text-xs font-bold">Hapus</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>

              {/* Infinite Scroll Loader */}
              {hasMore && (
                <div ref={loaderRef} className="py-6 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
                  <p className="text-gray-400 text-xs mt-1">Memuat produk...</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      {
        showAddModal && (
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
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
                                  alt={`Preview ${index + 1} `}
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
                                <th key={index} className="text-center py-2 px-2 font-bold text-[#997B2C]">
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
        )
      }

      {/* Edit Product Modal */}
      {
        showEditModal && editingProduct && (
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#d4af37]"
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
                                  alt={`Preview ${index + 1} `}
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
                      Harga Jual (Rp) * {editingProduct && user?.role !== 'owner' && <span className="text-xs text-red-500">(🔒 Owner only)</span>}
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="0"
                      value={formData.retailPrice}
                      onChange={(e) => setFormData({ ...formData, retailPrice: e.target.value })}
                      disabled={editingProduct && user?.role !== 'owner'}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${editingProduct && user?.role !== 'owner' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Harga Reseller (Rp) {editingProduct && user?.role !== 'owner' && <span className="text-xs text-red-500">(🔒 Owner only)</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.resellerPrice}
                      onChange={(e) => setFormData({ ...formData, resellerPrice: e.target.value })}
                      disabled={editingProduct && user?.role !== 'owner'}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${editingProduct && user?.role !== 'owner' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Harga Modal (Rp) {editingProduct && user?.role !== 'owner' && <span className="text-xs text-red-500">(🔒 Owner only)</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.costPrice}
                      onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                      disabled={editingProduct && user?.role !== 'owner'}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${editingProduct && user?.role !== 'owner' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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

                {/* Per-Variant Pricing Section - Only show if variants exist */}
                {formData.variants.sizes.length > 0 && formData.variants.colors.length > 0 && (
                  <div className="border border-orange-200 rounded-xl overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setShowPricePerVariant(!showPricePerVariant)}
                      className="w-full px-4 py-3 bg-orange-50 text-left flex justify-between items-center"
                    >
                      <span className="text-sm font-medium text-orange-800">
                        💰 Harga Beda per Size / Varian
                      </span>
                      <span className="text-orange-600 text-xs">
                        {showPricePerVariant ? '▲ Tutup' : '▼ Expand'}
                      </span>
                    </button>

                    {showPricePerVariant && (
                      <div className="p-4 space-y-6">
                        {/* Variant Names Section */}
                        <div className="bg-purple-50 p-3 rounded-lg">
                          <h4 className="text-xs font-bold text-purple-700 mb-2">🏷️ Nama Varian (untuk Checkout)</h4>
                          <p className="text-xs text-gray-500 mb-3">Beri nama pada varian (A, B, C...) supaya pelanggan tahu isi produk saat checkout.</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {formData.variants.colors.map((color) => (
                              <div key={color} className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-purple-600 w-6">{color}</span>
                                <input
                                  type="text"
                                  value={formData.variantNames[color] || ''}
                                  onChange={(e) => {
                                    setFormData({
                                      ...formData,
                                      variantNames: {
                                        ...formData.variantNames,
                                        [color]: e.target.value
                                      }
                                    });
                                  }}
                                  placeholder={`Nama ${color}`}
                                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Retail Price Matrix */}
                        <div>
                          <h4 className="text-xs font-bold text-green-700 mb-2">Matrix Harga Retail</h4>
                          <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-2 px-1 font-medium text-gray-700">Size \ Varian</th>
                                  {formData.variants.colors.map((color) => (
                                    <th key={color} className="text-center py-2 px-1 font-medium text-gray-700">
                                      {color}{formData.variantNames[color] ? ` (${formData.variantNames[color]})` : ''}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {formData.variants.sizes.map((size) => (
                                  <tr key={size} className="border-b border-gray-100">
                                    <td className="py-2 px-1 font-medium text-gray-600">{size}</td>
                                    {formData.variants.colors.map((color) => {
                                      const key = `${size}-${color}`;
                                      return (
                                        <td key={color} className="py-2 px-1 text-center">
                                          <input
                                            type="text"
                                            value={formData.pricesPerVariant[key]?.retail?.toLocaleString('id-ID') || formData.retailPrice}
                                            onChange={(e) => {
                                              const numValue = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                                              setFormData({
                                                ...formData,
                                                pricesPerVariant: {
                                                  ...formData.pricesPerVariant,
                                                  [key]: {
                                                    retail: numValue,
                                                    reseller: formData.pricesPerVariant[key]?.reseller || parseInt(formData.resellerPrice) || 0
                                                  }
                                                }
                                              });
                                            }}
                                            disabled={user?.role === 'admin'}
                                            className={`w-20 px-1 py-1 border border-gray-300 rounded text-center text-xs focus:ring-2 focus:ring-[#D4AF37] ${user?.role === 'admin' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                          />
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Reseller Price Matrix */}
                        <div>
                          <h4 className="text-xs font-bold text-[#997B2C] mb-2">Matrix Harga Reseller</h4>
                          <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-2 px-1 font-medium text-gray-700">Size \ Varian</th>
                                  {formData.variants.colors.map((color) => (
                                    <th key={color} className="text-center py-2 px-1 font-medium text-gray-700">
                                      {color}{formData.variantNames[color] ? ` (${formData.variantNames[color]})` : ''}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {formData.variants.sizes.map((size) => (
                                  <tr key={size} className="border-b border-gray-100">
                                    <td className="py-2 px-1 font-medium text-gray-600">{size}</td>
                                    {formData.variants.colors.map((color) => {
                                      const key = `${size}-${color}`;
                                      return (
                                        <td key={color} className="py-2 px-1 text-center">
                                          <input
                                            type="text"
                                            value={formData.pricesPerVariant[key]?.reseller?.toLocaleString('id-ID') || formData.resellerPrice}
                                            onChange={(e) => {
                                              const numValue = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                                              setFormData({
                                                ...formData,
                                                pricesPerVariant: {
                                                  ...formData.pricesPerVariant,
                                                  [key]: {
                                                    retail: formData.pricesPerVariant[key]?.retail || parseInt(formData.retailPrice) || 0,
                                                    reseller: numValue
                                                  }
                                                }
                                              });
                                            }}
                                            disabled={user?.role === 'admin'}
                                            className={`w-20 px-1 py-1 border border-gray-300 rounded text-center text-xs focus:ring-2 focus:ring-[#D4AF37] ${user?.role === 'admin' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                          />
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Stock Matrix - OWNER ONLY */}
                        {user?.role === 'owner' && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <h4 className="text-xs font-bold text-blue-700 mb-2">Matrix Stok (Khusus Owner)</h4>
                            <div className="bg-blue-50 rounded-lg p-3 overflow-x-auto border border-blue-100">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-blue-200">
                                    <th className="text-left py-2 px-1 font-medium text-blue-800">Size \ Varian</th>
                                    {formData.variants.colors.map((color) => (
                                      <th key={color} className="text-center py-2 px-1 font-medium text-blue-800">
                                        {color}{formData.variantNames[color] ? ` (${formData.variantNames[color]})` : ''}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {formData.variants.sizes.map((size) => (
                                    <tr key={size} className="border-b border-blue-100">
                                      <td className="py-2 px-1 font-medium text-blue-800">{size}</td>
                                      {formData.variants.colors.map((color) => {
                                        // Safely access current stock
                                        const currentStock = formData.variants.stock?.[size]?.[color] ?? 0;

                                        return (
                                          <td key={color} className="py-2 px-1 text-center">
                                            <input
                                              type="number"
                                              min="0"
                                              value={currentStock}
                                              onFocus={(e) => e.target.select()}
                                              onChange={(e) => updateVariantStock(size, color, e.target.value)}
                                              className="w-20 px-1 py-1 border border-blue-300 rounded text-center text-xs focus:ring-2 focus:ring-blue-500 text-blue-900 font-medium"
                                            />
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <p className="text-xs text-blue-600 mt-2">
                              💡 Stok total produk akan dihitung ulang secara otomatis berdasarkan matrix ini saat disimpan.
                            </p>
                          </div>
                        )}


                        <p className="text-xs text-gray-500">
                          💡 Kosongkan jika harga sama untuk semua varian. Harga yang diisi akan mengganti harga global.
                        </p>
                      </div>
                    )}
                  </div>
                )}

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
                    className="px-4 py-2 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Batch Edit Modal */}
      {
        showBatchModal && (
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#d4af37]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ubah Kondisi Produk
                    </label>
                    <select
                      value={batchFormData.status || ''}
                      onChange={(e) => setBatchFormData({ ...batchFormData, status: e.target.value as 'ready' | 'po' | '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#d4af37]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#d4af37]"
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
                    className="px-4 py-2 bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white rounded-lg hover:shadow-lg transition-all font-bold shadow-[0_2px_0_0_#7a6223]"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Variant Batch Modal */}
      {
        showVariantBatchModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
                    <Package className="w-5 h-5 text-[#997B2C]" />
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
                      const newSize = `Ukuran ${variantBatchFormData.sizes.length + 1} `;
                      setVariantBatchFormData({
                        ...variantBatchFormData,
                        sizes: [...variantBatchFormData.sizes, newSize]
                      });
                    }}
                    className="px-3 py-1 bg-[#D4AF37]/10 text-[#997B2C] rounded-lg hover:bg-[#D4AF37]/20 transition-colors text-sm"
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
                    className="px-3 py-1 bg-[#D4AF37]/10 text-[#997B2C] rounded-lg hover:bg-[#D4AF37]/20 transition-colors text-sm"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#d4af37]"
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
                          <tr className="bg-[#D4AF37]/10 border-b border-[#D4AF37]/20">
                            <th className="text-left py-2 px-2 font-bold text-[#997B2C]">Ukuran \ Warna</th>
                            {variantBatchFormData.colors.map((color, index) => (
                              <th key={index} className="text-center py-2 px-2 font-bold text-[#997B2C]">
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
                                  <span className="inline-block bg-[#D4AF37]/10 text-[#997B2C] px-2 py-1 rounded text-xs font-medium">
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
                    className="bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all flex items-center space-x-2 font-bold shadow-[0_2px_0_0_#7a6223]"
                  >
                    <Package className="w-4 h-4" />
                    <span>Update Varian</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Flash Sale Modal */}
      {
        showFlashSaleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
                    <Flame className="w-6 h-6 text-[#D4AF37]" />
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
                {/* 🔥 NEW: Info Banner when Flash Sale Active */}
                {isFlashSaleActive && (
                  <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="w-5 h-5 text-orange-600" />
                      <h3 className="font-bold text-orange-800">Flash Sale Sedang Berlangsung</h3>
                    </div>
                    <p className="text-sm text-orange-700 mb-1">
                      Produk yang Anda pilih akan <strong>ditambahkan</strong> ke flash sale aktif dengan diskon <strong>berbeda</strong>.
                    </p>
                    <div className="text-xs text-orange-600 bg-orange-100 px-3 py-2 rounded mt-2">
                      ⏰ Waktu berakhir: Ikut flash sale aktif (otomatis)
                    </div>
                  </div>
                )}

                {/* Product Selection Info (Replacing selector) */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-800">
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-200 pb-2">
                    <Star className="w-4 h-4 text-[#D4AF37]" />
                    <span className="font-semibold">Konfirmasi Produk Terpilih: {flashSaleFormData.productIds.length} item</span>
                  </div>

                  {/* List of selected products ONLY */}
                  <div className="max-h-40 overflow-y-auto pr-2 space-y-2">
                    {products
                      .filter(p => flashSaleFormData.productIds.includes(p.id))
                      .map(p => (
                        <div key={p.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-gray-200 shadow-sm">
                          <div className="flex items-center gap-2 overflow-hidden">
                            {p.images.length > 0 && (
                              <img src={p.image || p.images[0]} alt="" className="w-6 h-6 object-cover rounded" />
                            )}
                            <span className="truncate font-medium">{p.name}</span>
                          </div>
                          <span className="font-mono text-[#997B2C] whitespace-nowrap ml-2">
                            Rp {p.retailPrice.toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))
                    }
                  </div>
                  <p className="text-xs opacity-70 mt-2 italic">
                    * Produk ini akan {isFlashSaleActive ? 'ditambahkan ke' : 'didaftarkan ke'} Flash Sale {isFlashSaleActive ? 'yang sedang aktif' : 'baru'}.
                  </p>
                </div>

                {/* Flash Sale Settings - HIDE time picker if flash sale active */}
                {!isFlashSaleActive && (
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Diskon Flash Sale {isFlashSaleActive && '(untuk Grup Produk Ini)'} (Rp)
                  </label>
                  <input
                    type="number"
                    value={flashSaleFormData.flashSaleDiscount || ''}
                    onChange={(e) => setFlashSaleFormData({ ...flashSaleFormData, flashSaleDiscount: parseInt(e.target.value) || 0 })}
                    placeholder="Masukkan jumlah diskon (contoh: 100000)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
                  />
                  {isFlashSaleActive && (
                    <p className="text-xs text-orange-600 mt-1">
                      💡 Diskon ini hanya untuk produk yang Anda pilih, berbeda dengan flash sale yang sedang berjalan.
                    </p>
                  )}
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
                        className="bg-[radial-gradient(ellipse_at_top,_#EDD686_0%,_#D4AF37_40%,_#997B2C_100%)] text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all flex items-center space-x-2 font-bold shadow-[0_2px_0_0_#7a6223]"
                      >
                        <Flame className="w-4 h-4" />
                        <span>{isFlashSaleActive ? 'Tambah ke Flash Sale' : 'Mulai Flash Sale'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* AI Auto Upload Modal */}
      {
        showAIUploadModal && (
          <AIAutoUploadModal
            isOpen={showAIUploadModal}
            onClose={() => setShowAIUploadModal(false)}
            existingProducts={products}
            onSuccess={async (productData) => {
              try {
                console.log('AI Upload product data:', productData);

                // Auto-generate caption if direct upload mode
                if (productData.uploadMode === 'direct') {
                  const aiCaption = productData.description || `${productData.variantCount} varian premium dengan motif unik`;
                  const enhancedProductData = {
                    ...productData,
                    name: productData.name || `Gamis Premium ${productData.variantLabels.join('-')} `,
                    description: aiCaption,
                    retailPrice: productData.retailPrice || '150000',
                    resellerPrice: productData.resellerPrice || '135000',
                    costPrice: productData.costPrice || '100000'
                  };
                  console.log('🚀 Direct Upload Mode - Auto-enhancing with AI data');
                  productData = enhancedProductData;
                }

                // Upload collage image to Firebase Storage
                // CRITICAL FIX: Generate unique productId BEFORE upload to prevent file overwriting
                const tempProductId = `product_${Date.now()}_${Math.random().toString(36).substring(2, 11)} `;
                const collageFile = productData.collageFile;
                const uploadedImages = await uploadMultipleImages([collageFile], tempProductId);

                if (uploadedImages.length === 0) {
                  throw new Error('Failed to upload collage image');
                }

                const collageUrl = uploadedImages[0];

                // Calculate total stock from variants
                const totalStock = productData.totalStock || Object.values(productData.stockPerVariant).reduce((sum: number, stock: any) => {
                  const val = typeof stock === 'object' ? 0 : (parseInt(String(stock)) || 0);
                  return sum + val;
                }, 0);

                // Create product with all new fields
                const newProduct = {
                  name: productData.name,
                  description: productData.description,
                  category: productData.category,
                  retailPrice: parseInt(productData.retailPrice),
                  resellerPrice: parseInt(productData.resellerPrice),
                  costPrice: parseInt(productData.costPrice) || 0,
                  purchasePrice: parseInt(productData.costPrice) || 0, // Required field
                  price: parseInt(productData.retailPrice), // Required field (same as retailPrice)
                  originalRetailPrice: parseInt(productData.retailPrice), // Required field
                  originalResellerPrice: parseInt(productData.resellerPrice), // Required field
                  weight: 1000,
                  stock: totalStock,
                  unit: 'pcs', // Required field - default to pcs
                  images: [collageUrl],
                  image: collageUrl, // Required field - main image
                  variants: {
                    sizes: ['Ukuran 1'],
                    colors: productData.variantLabels,
                    stock: {
                      'Ukuran 1': productData.stockPerVariant || {} as any
                    }
                  },
                  status: 'po' as 'ready' | 'po', // Default to Pre Order for AI uploads
                  createdAt: new Date(),
                  salesCount: 0,
                  isFeatured: false,
                  isFlashSale: false,
                  flashSalePrice: parseInt(productData.retailPrice) || 0,
                  // Optional fields with defaults
                  condition: 'baru',
                  featured: false,
                  discount: 0,
                  reviews: 0,
                  rating: 0,
                  // Save AI analysis for future comparisons
                  aiAnalysis: productData.analysisResults?.[0]?.analysis ? {
                    ...productData.analysisResults[0].analysis,
                    analyzedAt: new Date().toISOString()
                  } : null,
                  // Save profit margin data
                  profitMargin: productData.profitMargin || 0,
                  // Save upload mode info
                  uploadMode: productData.uploadMode || 'review'
                };

                console.log('💾 Saving AI-generated product:', {
                  name: newProduct.name,
                  description: newProduct.description,
                  totalStock: newProduct.stock,
                  costPrice: newProduct.costPrice,
                  retailPrice: newProduct.retailPrice,
                  profitMargin: newProduct.profitMargin,
                  variants: newProduct.variants,
                  uploadMode: newProduct.uploadMode
                });

                await addProduct(newProduct);

                setShowAIUploadModal(false);
                alert(`✅ Produk berhasil di - upload dengan AI! Mode: ${productData.uploadMode === 'direct' ? 'Langsung Upload' : 'Review Upload'} `);
              } catch (error: any) {
                console.error('Failed to create AI product:', error);
                alert(`❌ Gagal upload produk: ${error.message} `);
              }
            }}
          />
        )
      }

      {/* Manual Upload Modal (Collage + Parameter) */}
      {
        showManualUploadModal && (
          <ManualUploadModal
            isOpen={showManualUploadModal}
            onClose={() => {
              setShowManualUploadModal(false);
              setManualUploadInitialState(null); // Reset state to prevent leaks to normal manual upload
            }}
            categories={categories}
            initialState={manualUploadInitialState}
            onSuccess={async (productData) => {
              try {
                console.log('Manual Upload product data:', productData);

                // Generate unique productId for storage path
                const tempProductId = `product_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

                let collageUrl = '';

                // If collage already exists (from draft), use it. DO NOT RE-UPLOAD if it's already a URL string from firebase storage
                if (manualUploadInitialState?.collageUrl) { // Check initial state for URL
                  collageUrl = manualUploadInitialState.collageUrl;
                  console.log('Using existing collage URL:', collageUrl);
                } else if (productData.collageFile) {
                  // Upload collage image to Firebase Storage
                  const collageFile = productData.collageFile;
                  const uploadedImages = await uploadMultipleImages([collageFile], tempProductId);

                  if (uploadedImages.length === 0) {
                    throw new Error('Failed to upload collage image');
                  }
                  collageUrl = uploadedImages[0];
                } else {
                  throw new Error('No collage image provided');
                }



                // Create product with all fields
                const newProduct = {
                  name: productData.name,
                  brand: productData.brand, // Add brand field
                  description: productData.description || '',
                  category: productData.category,
                  retailPrice: parseInt(productData.retailPrice),
                  resellerPrice: parseInt(productData.resellerPrice),
                  costPrice: parseInt(productData.costPrice) || 0,
                  purchasePrice: parseInt(productData.costPrice) || 0,
                  price: parseInt(productData.retailPrice),
                  originalRetailPrice: parseInt(productData.retailPrice),
                  originalResellerPrice: parseInt(productData.resellerPrice),
                  weight: 1000,
                  stock: productData.totalStock,
                  unit: 'pcs',
                  images: [collageUrl],
                  image: collageUrl,
                  variants: productData.variants || {
                    sizes: [productData.sizeName || 'Ukuran 1'],
                    colors: productData.variantLabels,
                    stock: {
                      [productData.sizeName || 'Ukuran 1']: productData.stockPerVariant
                    }
                  },
                  // Variant-specific pricing for checkout
                  pricesPerVariant: productData.pricesPerVariant || null,
                  costPricePerSize: productData.costPricePerSize || null,
                  variantNames: productData.variantNames || null,
                  status: 'po' as 'ready' | 'po',
                  createdAt: new Date(),
                  salesCount: 0,
                  isFeatured: false,
                  isFlashSale: false,
                  flashSalePrice: parseInt(productData.retailPrice) || 0,
                  condition: 'baru',
                  featured: false,
                  discount: 0,
                  reviews: 0,
                  rating: 0,
                  uploadMode: 'manual'
                };

                console.log('💾 Saving Manual Upload product:', newProduct);
                const result = await addProduct(newProduct);

                // ---------------------------------------------------------
                // AUTO POSTING LOGIC (IG + WA)
                // ---------------------------------------------------------
                try {
                  console.log('🚀 Triggering Auto-Post Queues...');

                  // 1. Instagram Queue (Retail Price Only)
                  const igCaption = `✨ NEW ARRIVAL ✨\n\n${newProduct.name}\n\n${newProduct.description}\n\nHarga: Rp ${newProduct.retailPrice.toLocaleString('id-ID')}\n\nOrder sekarang sebelum kehabisan! #gamis #azzahra`;
                  await addDoc(collection(db, 'pending_instagram_posts'), {
                    productName: newProduct.name,
                    caption: igCaption,
                    imageUrl: collageUrl,
                    status: 'pending',
                    timestamp: serverTimestamp()
                  });
                  console.log('✅ Queued for Instagram');

                  // 2. WhatsApp Group Queue (Complete Info)
                  /* DISABLED BY USER REQUEST - DO NOT QUEUE GROUP POSTS
                  const waCaption = `*NEW CATALOG UPDATE* 📢\n\n*${newProduct.name}*\n${newProduct.description}\n\n💰 *Harga Retail:* Rp ${newProduct.retailPrice.toLocaleString('id-ID')}\n🤝 *Harga Reseller:* Rp ${newProduct.resellerPrice.toLocaleString('id-ID')}\n\n✨ *Varian:* ${newProduct.variants.colors.join(', ')}\n📦 *Stok:* ${newProduct.stock} pcs\n\nSilakan di keep sebelum kehabisan ya kak!`;
                  await addDoc(collection(db, 'pending_whatsapp_group_posts'), {
                    productName: newProduct.name,
                    caption: waCaption,
                    imageUrl: collageUrl,
                    status: 'pending',
                    timestamp: serverTimestamp()
                  });
                  console.log('✅ Queued for WhatsApp Group');
                  */

                } catch (queueError) {
                  console.error('⚠️ Failed to queue auto-posts:', queueError);
                  // Don't fail the upload if posting fails
                }

                // ---------------------------------------------------------

                // DELETE DRAFT FROM QUEUE IF EXISTS
                if (processingDraftId) {
                  console.log(`🧹 Deleting processed draft: ${processingDraftId}`);
                  await deleteDoc(doc(db, 'product_drafts', processingDraftId));
                  setProcessingDraftId(null);
                }

                setShowManualUploadModal(false);
                alert('✅ Produk berhasil di-upload!');
              } catch (error: any) {
                console.error('Failed to create manual product:', error);
                alert(`❌ Gagal upload produk: ${error.message} `);
              }
            }}
          />
        )
      }
      <WhatsAppInboxModal
        isOpen={showWhatsAppInbox}
        onClose={() => setShowWhatsAppInbox(false)}
        onProcess={handleWhatsAppProcess}
      />

      {/* Stock History Modal */}
      <StockHistoryModal
        isOpen={!!historyModalData}
        onClose={() => setHistoryModalData(null)}
        product={historyModalData}
        user={user}
      />



      {/* Collection Manager (Replaces old Collection Modal) */}
      <CollectionManager
        isOpen={showCollectionManager}
        onClose={() => setShowCollectionManager(false)}
        products={allProducts}
        onUpdateProduct={handleCollectionUpdateProduct}
      />


    </div >
  );
};

export default AdminProductsPage;