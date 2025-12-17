import React, { useState, useMemo } from 'react';
import { X, Upload, Image as ImageIcon, Settings, Check } from 'lucide-react';
import { collageService } from '../services/collageService';

interface ManualUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (productData: any) => void;
    categories: string[];
}

interface UploadSettings {
    stockPerVariant: number;
    costPrice: number;
    retailMarkupPercent: number;
    resellerMarkupPercent: number;
}

const ManualUploadModal: React.FC<ManualUploadModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    categories
}) => {
    // Step management
    const [step, setStep] = useState<'upload' | 'details' | 'preview'>('upload');

    // Images state
    const [images, setImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);

    // Collage state
    const [collageBlob, setCollageBlob] = useState<Blob | null>(null);
    const [collagePreview, setCollagePreview] = useState<string>('');
    const [isGeneratingCollage, setIsGeneratingCollage] = useState(false);

    // Variant labels (A, B, C, ...)
    const variantLabels = useMemo(() => {
        return collageService.generateVariantLabels(images.length);
    }, [images.length]);

    // Product form data
    const [productFormData, setProductFormData] = useState({
        name: '',
        description: '',
        category: categories[0] || 'gamis',
        stockPerVariant: {} as Record<string, string>
    });

    // Settings (Parameter)
    const [uploadSettings, setUploadSettings] = useState<UploadSettings>({
        stockPerVariant: 5,
        costPrice: 100000,
        retailMarkupPercent: 50,
        resellerMarkupPercent: 35
    });

    // Calculated prices
    const retailPrice = useMemo(() => {
        return Math.round(uploadSettings.costPrice * (1 + uploadSettings.retailMarkupPercent / 100));
    }, [uploadSettings.costPrice, uploadSettings.retailMarkupPercent]);

    const resellerPrice = useMemo(() => {
        return Math.round(uploadSettings.costPrice * (1 + uploadSettings.resellerMarkupPercent / 100));
    }, [uploadSettings.costPrice, uploadSettings.resellerMarkupPercent]);

    // Handle image upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newFiles = Array.from(files);
        const validFiles = newFiles.filter(file => {
            const isValid = file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024;
            return isValid;
        });

        if (validFiles.length + images.length > 10) {
            alert('Maksimal 10 gambar');
            return;
        }

        // Create previews
        const newPreviews = validFiles.map(file => URL.createObjectURL(file));

        setImages(prev => [...prev, ...validFiles]);
        setImagePreviews(prev => [...prev, ...newPreviews]);

        // Initialize stock for new variants
        const newStockPerVariant = { ...productFormData.stockPerVariant };
        const startIndex = images.length;
        validFiles.forEach((_, index) => {
            const label = String.fromCharCode(65 + startIndex + index);
            newStockPerVariant[label] = String(uploadSettings.stockPerVariant);
        });
        setProductFormData(prev => ({ ...prev, stockPerVariant: newStockPerVariant }));
    };

    // Remove image
    const handleRemoveImage = (index: number) => {
        URL.revokeObjectURL(imagePreviews[index]);
        setImages(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));

        // Re-index stock
        const newStockPerVariant: Record<string, string> = {};
        const remainingCount = images.length - 1;
        for (let i = 0; i < remainingCount; i++) {
            const label = String.fromCharCode(65 + i);
            newStockPerVariant[label] = productFormData.stockPerVariant[label] || String(uploadSettings.stockPerVariant);
        }
        setProductFormData(prev => ({ ...prev, stockPerVariant: newStockPerVariant }));
    };

    // Generate collage
    const handleGenerateCollage = async () => {
        if (images.length === 0) {
            alert('Pilih minimal 1 gambar');
            return;
        }

        setIsGeneratingCollage(true);
        try {
            const blob = await collageService.generateCollage(images, variantLabels);
            setCollageBlob(blob);

            const previewUrl = URL.createObjectURL(blob);
            setCollagePreview(previewUrl);

            setStep('details');
        } catch (error) {
            console.error('Error generating collage:', error);
            alert('Gagal membuat collage');
        } finally {
            setIsGeneratingCollage(false);
        }
    };

    // Handle submit
    const handleSubmit = () => {
        if (!productFormData.name) {
            alert('Nama produk wajib diisi');
            return;
        }

        if (!collageBlob) {
            alert('Collage belum dibuat');
            return;
        }

        // Calculate total stock
        const totalStock = Object.values(productFormData.stockPerVariant).reduce(
            (sum, stock) => sum + parseInt(stock || '0'), 0
        );

        if (totalStock === 0) {
            alert('Stok minimal 1 untuk salah satu varian');
            return;
        }

        const productData = {
            name: productFormData.name,
            description: productFormData.description,
            category: productFormData.category,
            retailPrice: String(retailPrice),
            resellerPrice: String(resellerPrice),
            costPrice: String(uploadSettings.costPrice),
            stockPerVariant: productFormData.stockPerVariant,
            totalStock,
            variantLabels,
            variantCount: images.length,
            collageBlob,
            collageFile: new File([collageBlob], `collage-${Date.now()}.jpg`, { type: 'image/jpeg' }),
            uploadMode: 'direct'
        };

        onSuccess(productData);
        handleReset();
        onClose();
    };

    // Reset form
    const handleReset = () => {
        imagePreviews.forEach(url => URL.revokeObjectURL(url));
        if (collagePreview) URL.revokeObjectURL(collagePreview);

        setImages([]);
        setImagePreviews([]);
        setCollageBlob(null);
        setCollagePreview('');
        setStep('upload');
        setProductFormData({
            name: '',
            description: '',
            category: categories[0] || 'gamis',
            stockPerVariant: {}
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">
                            Tambah Produk Manual (Collage)
                        </h2>
                        <p className="text-sm text-gray-500">
                            Step: {step === 'upload' ? '1. Upload Gambar' : step === 'details' ? '2. Detail Produk' : '3. Preview'}
                        </p>
                    </div>
                    <button
                        onClick={() => { handleReset(); onClose(); }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Step 1: Upload Images */}
                    {step === 'upload' && (
                        <div className="space-y-6">
                            {/* Settings Panel */}
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <Settings className="w-5 h-5 text-purple-600" />
                                    <h3 className="font-semibold text-purple-800">Parameter Produk</h3>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Stok per Varian</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={uploadSettings.stockPerVariant}
                                            onChange={(e) => setUploadSettings(prev => ({ ...prev, stockPerVariant: parseInt(e.target.value) || 1 }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Harga Modal (Rp)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1000"
                                            value={uploadSettings.costPrice}
                                            onChange={(e) => setUploadSettings(prev => ({ ...prev, costPrice: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Markup Retail (%)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={uploadSettings.retailMarkupPercent}
                                            onChange={(e) => setUploadSettings(prev => ({ ...prev, retailMarkupPercent: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Markup Reseller (%)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={uploadSettings.resellerMarkupPercent}
                                            onChange={(e) => setUploadSettings(prev => ({ ...prev, resellerMarkupPercent: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="mt-3 flex gap-4 text-sm">
                                    <span className="text-gray-600">Harga Retail: <strong className="text-green-600">Rp {retailPrice.toLocaleString('id-ID')}</strong></span>
                                    <span className="text-gray-600">Harga Reseller: <strong className="text-blue-600">Rp {resellerPrice.toLocaleString('id-ID')}</strong></span>
                                </div>
                            </div>

                            {/* Upload Area */}
                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-400 transition-colors">
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    id="manual-image-upload"
                                />
                                <label htmlFor="manual-image-upload" className="cursor-pointer">
                                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-600 font-medium mb-2">Klik untuk upload gambar</p>
                                    <p className="text-sm text-gray-400">Maksimal 10 gambar, 5MB per gambar</p>
                                </label>
                            </div>

                            {/* Image Previews */}
                            {images.length > 0 && (
                                <div>
                                    <h3 className="font-medium text-gray-700 mb-3">Gambar ({images.length})</h3>
                                    <div className="grid grid-cols-5 gap-3">
                                        {imagePreviews.map((preview, index) => (
                                            <div key={index} className="relative group">
                                                <img
                                                    src={preview}
                                                    alt={`Preview ${index + 1}`}
                                                    className="w-full aspect-[3/4] object-cover rounded-lg border border-gray-200"
                                                />
                                                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded font-bold">
                                                    {variantLabels[index]}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveImage(index)}
                                                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Generate Collage Button */}
                            {images.length > 0 && (
                                <button
                                    onClick={handleGenerateCollage}
                                    disabled={isGeneratingCollage}
                                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
                                >
                                    {isGeneratingCollage ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Membuat Collage...
                                        </span>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            <ImageIcon className="w-5 h-5" />
                                            Buat Collage & Lanjut
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Step 2: Details */}
                    {step === 'details' && (
                        <div className="space-y-6">
                            {/* Collage Preview */}
                            <div className="flex gap-6">
                                <div className="w-1/3">
                                    <h3 className="font-medium text-gray-700 mb-2">Preview Collage</h3>
                                    <img
                                        src={collagePreview}
                                        alt="Collage Preview"
                                        className="w-full rounded-xl border border-gray-200"
                                    />
                                </div>

                                <div className="flex-1 space-y-4">
                                    {/* Product Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Nama Produk *
                                        </label>
                                        <input
                                            type="text"
                                            value={productFormData.name}
                                            onChange={(e) => setProductFormData(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="Contoh: Gamis Syari Premium"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Kategori
                                        </label>
                                        <select
                                            value={productFormData.category}
                                            onChange={(e) => setProductFormData(prev => ({ ...prev, category: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                        >
                                            {categories.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Deskripsi (Opsional)
                                        </label>
                                        <textarea
                                            value={productFormData.description}
                                            onChange={(e) => setProductFormData(prev => ({ ...prev, description: e.target.value }))}
                                            placeholder="Deskripsi produk..."
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>

                                    {/* Price Summary */}
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h4 className="font-medium text-gray-700 mb-2">Ringkasan Harga</h4>
                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                            <div>
                                                <span className="text-gray-500">Modal:</span>
                                                <p className="font-semibold">Rp {uploadSettings.costPrice.toLocaleString('id-ID')}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Retail:</span>
                                                <p className="font-semibold text-green-600">Rp {retailPrice.toLocaleString('id-ID')}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Reseller:</span>
                                                <p className="font-semibold text-blue-600">Rp {resellerPrice.toLocaleString('id-ID')}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stock per Variant */}
                            <div>
                                <h3 className="font-medium text-gray-700 mb-3">Stok per Varian</h3>
                                <div className="grid grid-cols-5 gap-3">
                                    {variantLabels.map((label) => (
                                        <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                                            <div className="text-lg font-bold text-purple-600 mb-2">{label}</div>
                                            <input
                                                type="number"
                                                min="0"
                                                value={productFormData.stockPerVariant[label] || ''}
                                                onChange={(e) => setProductFormData(prev => ({
                                                    ...prev,
                                                    stockPerVariant: { ...prev.stockPerVariant, [label]: e.target.value }
                                                }))}
                                                className="w-full px-2 py-1 border border-gray-300 rounded text-center text-sm"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-sm text-gray-500 mt-2">
                                    Total Stok: <strong>{Object.values(productFormData.stockPerVariant).reduce((sum, s) => sum + parseInt(s || '0'), 0)} pcs</strong>
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('upload')}
                                    className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                                >
                                    Kembali
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <Check className="w-5 h-5" />
                                    Upload Produk
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManualUploadModal;
