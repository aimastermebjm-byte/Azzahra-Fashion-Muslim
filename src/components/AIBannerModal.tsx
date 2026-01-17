import React, { useState } from 'react';
import { Sparkles, Wand2, X, AlertCircle } from 'lucide-react';
import { geminiImageService } from '../services/geminiImageService';

interface AIBannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUseImage: (imageUrl: string) => void;
}

const AIBannerModal: React.FC<AIBannerModalProps> = ({ isOpen, onClose, onUseImage }) => {
    const [prompt, setPrompt] = useState('');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setLoading(true);
        setError(null);
        setGeneratedImage(null);

        try {
            const imageUrl = await geminiImageService.generateBannerImage(prompt);
            setGeneratedImage(imageUrl);
        } catch (err: any) {
            setError(err.message || 'Gagal generate gambar');
        } finally {
            setLoading(false);
        }
    };

    const handleUseImage = async () => {
        if (generatedImage) {
            // Convert URL to Blob/File to avoid CORS issues if possible, 
            // but for now we pass the URL. 
            // Ideally we should fetch and convert to base64 or blob here if we want to save it to Firebase Storage later.

            try {
                setLoading(true);
                // Fetch the image to convert to blob/base64 so it can be saved properly
                const response = await fetch(generatedImage);
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    onUseImage(reader.result as string);
                    onClose();
                };
                reader.readAsDataURL(blob);
            } catch (e) {
                console.error('Error processing image:', e);
                // Fallback: just use URL
                onUseImage(generatedImage);
                onClose();
            } finally {
                setLoading(false);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-5 h-5 text-yellow-300" />
                            <h2 className="text-xl font-bold">AI Banner Generator</h2>
                        </div>
                        <p className="text-white/80 text-sm">Buat banner unik dalam hitungan detik dengan Gemini AI</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Jelaskan banner yang Anda inginkan
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Contoh: Banner promo lebaran dengan latar masjid megah, nuansa hijau dan emas, elegan, photorealistic..."
                            className="w-full h-32 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-2 text-right">
                            Semakin detail deskripsi, semakin bagus hasilnya.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {generatedImage && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <p className="text-sm font-bold text-gray-700">Hasil Generate:</p>
                            <div className="relative rounded-xl overflow-hidden border-2 border-purple-100 shadow-sm group">
                                <img
                                    src={generatedImage}
                                    alt="Generated"
                                    className="w-full h-auto object-cover"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition"
                    >
                        Batal
                    </button>

                    {generatedImage ? (
                        <button
                            onClick={handleUseImage}
                            disabled={loading}
                            className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition shadow-lg flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? (
                                'Memproses...'
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    Pakai Gambar Ini
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !prompt.trim()}
                            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Wand2 className="w-4 h-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Wand2 className="w-4 h-4" />
                                    Generate Image
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIBannerModal;
