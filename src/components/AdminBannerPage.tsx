import React, { useState, useEffect } from 'react';
import {
    Plus, Image as ImageIcon, Trash2,
    Move, Power, Calendar, Link as LinkIcon,
    ShoppingBag, Zap, Loader2, ArrowUp, ArrowDown, Sparkles, Download
} from 'lucide-react';
import PageHeader from './PageHeader';
import { Banner, CreateBannerInput } from '../types/banner';
import { bannerService } from '../services/bannerService';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../utils/firebaseClient';
import { useToast } from './ToastProvider';
import ProductSelectorModal from './ProductSelectorModal';
import AIBannerModal from './AIBannerModal';

interface AdminBannerPageProps {
    onBack: () => void;
    user: any;
}

const AdminBannerPage: React.FC<AdminBannerPageProps> = ({ onBack, user }) => {
    const { showToast } = useToast();

    // State
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showProductSelector, setShowProductSelector] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState<CreateBannerInput>({
        title: '',
        imageUrl: '',
        actionType: 'none',
        actionData: {},
        startDate: null,
        endDate: null
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Load Banners
    useEffect(() => {
        loadBanners();
    }, []);

    const loadBanners = async () => {
        setLoading(true);
        try {
            const data = await bannerService.getAllBanners();
            setBanners(data);
        } catch (error) {
            console.error('Error loading banners:', error);
            showToast({ message: 'Gagal memuat banner', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Handle Image Upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, imageUrl: reader.result as string });
            };
            reader.readAsDataURL(file);

            setImageFile(file);
        }
    };

    // Crop image to fit carousel aspect ratio (2.5:1) for perfect display
    // Updated based on feedback: Crop from CENTER to capture the subject
    const cropToAspectRatio = async (file: File, targetRatio: number = 2.5): Promise<File> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const { width: imgWidth, height: imgHeight } = img;
                const imgRatio = imgWidth / imgHeight;

                let cropWidth = imgWidth;
                let cropHeight = imgHeight;
                let offsetX = 0;
                let offsetY = 0;

                if (imgRatio > targetRatio) {
                    // Image is wider than target - crop width
                    cropWidth = imgHeight * targetRatio;
                    offsetX = (imgWidth - cropWidth) / 2;
                } else {
                    // Image is taller than target - crop height (from center)
                    cropHeight = imgWidth / targetRatio;
                    // Take middle part (vertical center)
                    offsetY = (imgHeight - cropHeight) / 2;
                }

                // Output dimensions (max 1600px wide)
                const outputWidth = Math.min(cropWidth, 1600);
                const outputHeight = outputWidth / targetRatio;

                canvas.width = outputWidth;
                canvas.height = outputHeight;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas context not available'));
                    return;
                }

                // Draw cropped region
                ctx.drawImage(
                    img,
                    offsetX, offsetY, cropWidth, cropHeight,  // Source crop
                    0, 0, outputWidth, outputHeight           // Destination
                );

                console.log(`🖼️ Cropped to ${targetRatio}:1 ratio - ${outputWidth}x${outputHeight}`);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to crop image'));
                            return;
                        }
                        const croppedFile = new File([blob], file.name, { type: 'image/jpeg' });
                        resolve(croppedFile);
                    },
                    'image/jpeg',
                    0.92
                );
            };
            img.onerror = () => reject(new Error('Failed to load image for cropping'));
            img.src = URL.createObjectURL(file);
        });
    };

    // Compress image using canvas - max 2MB, scale down proportionally (NO CROP)
    const compressImage = async (file: File, maxSizeMB: number = 2): Promise<File> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                // Only limit max width for file size - NO HEIGHT LIMIT to avoid cropping
                const maxWidth = 1600;

                // Scale down proportionally if width exceeds max (keeps aspect ratio intact)
                if (width > maxWidth) {
                    const scale = maxWidth / width;
                    width = maxWidth;
                    height = height * scale;
                }

                console.log(`📐 Resize to: ${Math.round(width)}x${Math.round(height)} (original: ${img.width}x${img.height})`);

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas context not available'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Start with quality 0.9, reduce until under maxSizeMB
                let quality = 0.9;
                const tryCompress = () => {
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error('Failed to compress image'));
                                return;
                            }

                            console.log(`📸 Compressed: ${(blob.size / 1024 / 1024).toFixed(2)}MB at quality ${quality}`);

                            if (blob.size > maxSizeMB * 1024 * 1024 && quality > 0.3) {
                                quality -= 0.1;
                                tryCompress();
                            } else {
                                const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
                                resolve(compressedFile);
                            }
                        },
                        'image/jpeg',
                        quality
                    );
                };
                tryCompress();
            };
            img.onerror = () => reject(new Error('Failed to load image for compression'));
            img.src = URL.createObjectURL(file);
        });
    };

    // Handle Form Submit
    const handleSubmit = async () => {
        if (!formData.title) {
            showToast({ message: 'Judul banner wajib diisi', type: 'error' });
            return;
        }

        if (!formData.imageUrl && !imageFile) {
            showToast({ message: 'Gambar banner wajib diupload', type: 'error' });
            return;
        }

        setIsSubmitting(true);
        try {
            let finalImageUrl = '';  // Start empty, only use Storage URL
            let fileToUpload = imageFile;

            // Handle AI-generated blob URLs - convert to File first
            console.log('🔍 DEBUG - imageFile:', imageFile ? 'exists' : 'null');
            console.log('🔍 DEBUG - formData.imageUrl:', formData.imageUrl?.substring(0, 50) + '...');

            // Handle BLOB URLs
            if (!imageFile && formData.imageUrl && formData.imageUrl.startsWith('blob:')) {
                try {
                    console.log('🔄 Converting blob URL to File...');
                    const response = await fetch(formData.imageUrl);
                    if (!response.ok) throw new Error(`Blob fetch failed: ${response.status}`);

                    const blob = await response.blob();
                    if (blob.size === 0) throw new Error('Blob is empty (0 bytes)');

                    fileToUpload = new File([blob], `ai_banner_${Date.now()}.png`, { type: blob.type || 'image/png' });
                    console.log('✅ Blob converted to File:', fileToUpload.name, `(${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB)`);
                } catch (blobError: any) {
                    console.error('❌ Failed to convert blob:', blobError);
                    throw new Error(`Gagal memproses gambar: ${blobError.message}`);
                }
            }

            // Handle DATA URLs (base64 from AI generation)
            if (!imageFile && !fileToUpload && formData.imageUrl && formData.imageUrl.startsWith('data:')) {
                try {
                    console.log('🔄 Converting base64 data URL to File...');

                    // Extract base64 data and mime type
                    const [header, base64Data] = formData.imageUrl.split(',');
                    const mimeMatch = header.match(/data:([^;]+);/);
                    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

                    // Decode base64 to binary
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }

                    const blob = new Blob([bytes], { type: mimeType });
                    console.log('🔍 Created blob from base64:', blob.size, 'bytes, type:', mimeType);

                    if (blob.size === 0) throw new Error('Decoded blob is empty');

                    fileToUpload = new File([blob], `ai_banner_${Date.now()}.png`, { type: mimeType });
                    console.log('✅ Base64 converted to File:', fileToUpload.name, `(${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB)`);
                } catch (dataError: any) {
                    console.error('❌ Failed to convert data URL:', dataError);
                    throw new Error(`Gagal memproses gambar base64: ${dataError.message}`);
                }
            }

            // Crop to 2.5:1 aspect ratio to fit carousel frame perfectly
            if (fileToUpload) {
                console.log('🖼️ Cropping to 2.5:1 aspect ratio for carousel...');
                fileToUpload = await cropToAspectRatio(fileToUpload, 2.5);
            }

            // Compress image if file exists and is larger than 2MB
            if (fileToUpload) {
                if (fileToUpload.size > 2 * 1024 * 1024) {
                    console.log('🔄 Compressing large image...');
                    fileToUpload = await compressImage(fileToUpload, 2);
                    console.log('✅ Compression complete:', `${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`);
                }

                // Upload to Firebase Storage with detailed error handling
                try {
                    const timestamp = Date.now();
                    const fileName = `banners/${timestamp}_${fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                    console.log('📤 Uploading to Storage:', fileName, `(${(fileToUpload.size / 1024).toFixed(1)}KB)`);

                    const storageRef = ref(storage, fileName);
                    const uploadResult = await uploadBytes(storageRef, fileToUpload);
                    console.log('✅ Upload complete:', uploadResult.metadata.fullPath);

                    finalImageUrl = await getDownloadURL(storageRef);
                    console.log('✅ Download URL obtained:', finalImageUrl);
                } catch (storageError: any) {
                    console.error('❌ Storage upload failed:', storageError);
                    throw new Error(`Gagal upload ke Storage: ${storageError.message || storageError.code || 'Unknown error'}`);
                }
            } else if (formData.imageUrl && !formData.imageUrl.startsWith('blob:') && !formData.imageUrl.startsWith('data:')) {
                // Existing URL (for editing) - use as is
                finalImageUrl = formData.imageUrl;
            }

            // CRITICAL: Validate that we have a valid image URL before saving
            if (!finalImageUrl || finalImageUrl.startsWith('blob:') || finalImageUrl.startsWith('data:')) {
                throw new Error('Gagal upload gambar ke Storage. ImageUrl tidak valid.');
            }

            if (editingId) {
                // Update
                await bannerService.updateBanner(editingId, {
                    ...formData,
                    imageUrl: finalImageUrl
                });
                showToast({ message: 'Banner berhasil diupdate', type: 'success' });
            } else {
                // Create
                await bannerService.createBanner({
                    ...formData,
                    imageUrl: finalImageUrl
                }, user.uid);
                showToast({ message: 'Banner berhasil dibuat', type: 'success' });
            }

            // Auto-download to local as backup
            try {
                if (fileToUpload) {
                    // Method 1: Download from local Blob (Fastest, no CORS)
                    console.log('💾 Auto-downloading from local blob...');
                    const url = URL.createObjectURL(fileToUpload);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `banner_${Date.now()}.jpg`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url); // Clean up
                    console.log('✅ Banner auto-downloaded (Blob method)');
                } else if (finalImageUrl) {
                    // Method 2: Download from URL (Fallback)
                    const link = document.createElement('a');
                    link.href = finalImageUrl;
                    link.download = `banner_${Date.now()}.jpg`;
                    link.target = '_blank'; // Open in new tab if download blocked
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    console.log('✅ Banner download triggered (URL method)');
                }
            } catch (downloadErr) {
                console.warn('⚠️ Auto-download failed:', downloadErr);
            }

            setShowCreateModal(false);
            resetForm();
            loadBanners();
        } catch (error) {
            console.error('Error saving banner:', error);
            showToast({ message: 'Gagal menyimpan banner', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete Banner
    const handleDelete = async (id: string) => {
        if (!confirm('Yakin ingin menghapus banner ini?')) return;

        try {
            await bannerService.deleteBanner(id);
            showToast({ message: 'Banner dihapus', type: 'success' });
            // Optimistic update
            setBanners(banners.filter(b => b.id !== id));
            // Reload to ensure order is correct
            loadBanners();
        } catch (error) {
            showToast({ message: 'Gagal menghapus banner', type: 'error' });
        }
    };

    // Toggle Active Status
    const handleToggleStatus = async (banner: Banner) => {
        try {
            const newStatus = !banner.isActive;
            // Optimistic update
            setBanners(banners.map(b => b.id === banner.id ? { ...b, isActive: newStatus } : b));

            await bannerService.toggleStatus(banner.id, newStatus);
            showToast({ message: `Banner ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`, type: 'success' });
        } catch (error) {
            showToast({ message: 'Gagal update status', type: 'error' });
            loadBanners(); // Revert on error
        }
    };

    // Reorder Banner
    const handleMove = async (index: number, direction: 'up' | 'down') => {
        if (
            (direction === 'up' && index === 0) ||
            (direction === 'down' && index === banners.length - 1)
        ) return;

        const newBanners = [...banners];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        // Swap
        [newBanners[index], newBanners[targetIndex]] = [newBanners[targetIndex], newBanners[index]];

        // Update local state
        setBanners(newBanners);

        try {
            // Update order in backend
            await bannerService.reorderBanners(newBanners.map(b => b.id));
        } catch (error) {
            console.error('Failed to reorder:', error);
            showToast({ message: 'Gagal update urutan', type: 'error' });
            loadBanners(); // Revert
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            imageUrl: '',
            actionType: 'none',
            actionData: {},
            startDate: null,
            endDate: null
        });
        setImageFile(null);
        setEditingId(null);
    };

    const handleEdit = (banner: Banner) => {
        setEditingId(banner.id);
        setFormData({
            title: banner.title,
            imageUrl: banner.imageUrl,
            actionType: banner.actionType,
            actionData: banner.actionData,
            startDate: banner.startDate,
            endDate: banner.endDate
        });
        setShowCreateModal(true);
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <PageHeader
                title="Manajemen Banner"
                subtitle="Kelola banner promosi di halaman utama"
                onBack={onBack}
                actions={(
                    <button
                        onClick={() => { resetForm(); setShowCreateModal(true); }}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#997B2C] hover:bg-gray-50 border transition shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Tambah Banner
                    </button>
                )}
            />

            {/* Banner List */}
            <div className="max-w-4xl mx-auto p-4 space-y-4">
                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[#997B2C]" />
                    </div>
                ) : banners.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
                        <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-800">Belum Ada Banner</h3>
                        <p className="text-gray-500 mb-6">Tambahkan banner promosi untuk menarik pelanggan</p>
                        <button
                            onClick={() => { resetForm(); setShowCreateModal(true); }}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4AF37] text-white rounded-lg hover:bg-[#B5952F] transition font-bold"
                        >
                            <Plus className="w-5 h-5" />
                            Buat Banner Baru
                        </button>
                    </div>
                ) : (
                    banners.map((banner, index) => (
                        <div
                            key={banner.id}
                            className={`bg-white rounded-xl p-4 border transition-all hover:shadow-md ${!banner.isActive ? 'opacity-75 bg-gray-50' : 'border-[#D4AF37]/30'}`}
                        >
                            <div className="flex items-start gap-4">
                                {/* Drag Handle & Order */}
                                <div className="flex flex-col items-center gap-1 pt-2">
                                    <button
                                        onClick={() => handleMove(index, 'up')}
                                        disabled={index === 0}
                                        className="p-1 hover:bg-gray-100 rounded text-gray-400 disabled:opacity-30"
                                    >
                                        <ArrowUp className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs font-bold text-gray-400">{index + 1}</span>
                                    <button
                                        onClick={() => handleMove(index, 'down')}
                                        disabled={index === banners.length - 1}
                                        className="p-1 hover:bg-gray-100 rounded text-gray-400 disabled:opacity-30"
                                    >
                                        <ArrowDown className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Image Preview */}
                                <div className="w-32 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                                    <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-base">{banner.title}</h3>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                                {banner.actionType === 'products' && (
                                                    <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                                        <ShoppingBag className="w-3 h-3" />
                                                        {banner.actionData.productIds?.length || 0} Produk
                                                    </span>
                                                )}
                                                {banner.actionType === 'flash_sale' && (
                                                    <span className="flex items-center gap-1 bg-red-50 text-red-700 px-2 py-0.5 rounded">
                                                        <Zap className="w-3 h-3" />
                                                        Flash Sale
                                                    </span>
                                                )}
                                                {banner.actionType === 'url' && (
                                                    <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                                                        <LinkIcon className="w-3 h-3" />
                                                        Custom URL
                                                    </span>
                                                )}
                                                {banner.startDate && (
                                                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
                                                        <Calendar className="w-3 h-3" />
                                                        Terjadwal
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Active Toggle */}
                                            <button
                                                onClick={() => handleToggleStatus(banner)}
                                                className={`p-2 rounded-lg transition-colors ${banner.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                                title={banner.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                            >
                                                <Power className="w-4 h-4" />
                                            </button>

                                            {/* Delete */}
                                            <button
                                                onClick={() => handleDelete(banner.id)}
                                                className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                                title="Hapus"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Footer Info */}
                                    <div className="mt-2 flex items-center justify-between">
                                        <button
                                            onClick={() => handleEdit(banner)}
                                            className="text-sm text-[#997B2C] hover:underline font-medium"
                                        >
                                            Edit Detail
                                        </button>
                                        <span className="text-xs text-gray-400">
                                            Dibuat: {banner.createdAt?.toLocaleDateString ? banner.createdAt.toLocaleDateString('id-ID') : 'Baru saja'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                            <h2 className="font-bold text-lg">{editingId ? 'Edit Banner' : 'Buat Banner Baru'}</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Image Upload */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-gray-700">
                                        Gambar Banner <span className="text-red-500">*</span>
                                    </label>
                                    <button
                                        onClick={() => setShowAIModal(true)}
                                        className="flex items-center gap-1 text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg hover:bg-purple-100 transition border border-purple-200"
                                    >
                                        <Sparkles className="w-3 h-3" />
                                        Buat dengan AI
                                    </button>
                                </div>
                                <div
                                    className={`relative aspect-[3/1] rounded-xl overflow-hidden border-2 border-dashed transition-all group ${formData.imageUrl ? 'border-[#D4AF37]' : 'border-gray-300 hover:border-[#D4AF37]'
                                        }`}
                                >
                                    {formData.imageUrl ? (
                                        <>
                                            <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                <label className="cursor-pointer bg-white text-gray-800 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-100 text-xs shadow-lg">
                                                    Upload Manual
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                                </label>
                                                <button
                                                    onClick={() => setShowAIModal(true)}
                                                    className="bg-purple-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-purple-700 text-xs flex items-center gap-1 shadow-lg"
                                                >
                                                    <Sparkles className="w-3 h-3" />
                                                    Ganti via AI
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        // Download current image
                                                        const link = document.createElement('a');
                                                        link.href = formData.imageUrl;
                                                        link.download = `banner_${Date.now()}.png`;
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                        showToast({ message: 'Gambar didownload!', type: 'success' });
                                                    }}
                                                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-700 text-xs flex items-center gap-1 shadow-lg"
                                                >
                                                    <Download className="w-3 h-3" />
                                                    Download
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition group-hover:bg-gray-100">
                                            <ImageIcon className="w-10 h-10 text-gray-400 mb-2" />
                                            <span className="text-sm font-medium text-gray-600">Klik untuk upload manual</span>
                                            <span className="text-xs text-gray-400 mt-1">Rekomendasi: 1200 x 400 px</span>

                                            <label className="cursor-pointer absolute inset-0 w-full h-full">
                                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                            </label>

                                            <div className="flex items-center gap-2 mt-4 z-10 pointer-events-none">
                                                <span className="text-xs text-gray-400">atau</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowAIModal(true);
                                                    }}
                                                    className="pointer-events-auto flex items-center gap-1 text-xs font-bold text-purple-600 bg-white border border-purple-200 px-3 py-1.5 rounded-full hover:bg-purple-50 shadow-sm transition"
                                                >
                                                    <Sparkles className="w-3 h-3" />
                                                    Generate AI
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Judul Banner <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Contoh: Promo Ramadhan Big Sale"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
                                />
                            </div>

                            {/* Action Type */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Aksi Saat Diklik (Opsional)
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'none', label: 'Tidak Ada', icon: Move },
                                        { id: 'products', label: 'Buka Produk', icon: ShoppingBag },
                                        { id: 'flash_sale', label: 'Flash Sale', icon: Zap },
                                        { id: 'url', label: 'Link URL', icon: LinkIcon },
                                    ].map((type) => (
                                        <button
                                            key={type.id}
                                            onClick={() => setFormData({ ...formData, actionType: type.id as any })}
                                            className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${formData.actionType === type.id
                                                ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#997B2C]'
                                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            <type.icon className="w-4 h-4" />
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Action Config */}
                            {formData.actionType === 'products' && (
                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-gray-700">Produk Terpilih</label>
                                        <button
                                            onClick={() => setShowProductSelector(true)}
                                            className="text-xs font-bold text-[#997B2C] hover:underline"
                                        >
                                            {formData.actionData.productIds?.length ? 'Ubah Pilihan' : 'Pilih Produk'}
                                        </button>
                                    </div>
                                    {formData.actionData.productIds?.length ? (
                                        <div className="text-sm text-gray-600">
                                            {formData.actionData.productIds.length} produk dipilih
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 italic">Belum ada produk dipilih</p>
                                    )}
                                </div>
                            )}

                            {formData.actionType === 'url' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Target URL</label>
                                    <input
                                        type="url"
                                        value={formData.actionData.url || ''}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            actionData: { ...formData.actionData, url: e.target.value }
                                        })}
                                        placeholder="https://..."
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37]"
                                    />
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="w-full py-3 bg-[#D4AF37] text-white rounded-xl font-bold hover:bg-[#B5952F] transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    'Simpan Banner'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Selector */}
            <ProductSelectorModal
                isOpen={showProductSelector}
                onClose={() => setShowProductSelector(false)}
                initialSelectedIds={formData.actionData.productIds}
                onSelect={(ids) => {
                    setFormData({
                        ...formData,
                        actionData: { ...formData.actionData, productIds: ids }
                    });
                }}
            />

            {/* AI Generator Modal */}
            <AIBannerModal
                isOpen={showAIModal}
                onClose={() => setShowAIModal(false)}
                onUseImage={(imageUrl) => {
                    setFormData({ ...formData, imageUrl });
                    // Clear file input if any
                    setImageFile(null);
                }}
            />
        </div>
    );
};

export default AdminBannerPage;
