import React, { useState, useEffect } from 'react';
import { ShoppingCart, Flame, ArrowLeft, Sparkles } from 'lucide-react';
import FlashSaleCard from './FlashSaleCard';
import { useRealTimeCartOptimized } from '../hooks/useRealTimeCartOptimized';
import { useUnifiedFlashSale } from '../hooks/useUnifiedFlashSale';

interface FlashSalePageProps {
    user: any;
    onProductClick: (product: any) => void;
    onCartClick: () => void;
    onAddToCart: (product: any) => void;
    flashSaleProducts: any[];
    onBack?: () => void;
}

const FlashSalePage: React.FC<FlashSalePageProps> = ({
    user,
    onProductClick,
    onCartClick,
    onAddToCart,
    flashSaleProducts,
    onBack
}) => {
    const { cartItems } = useRealTimeCartOptimized();
    const { timeLeft, loading } = useUnifiedFlashSale();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleAddToCart = (product: any) => {
        onAddToCart(product);
    };

    // -------------------------------------------------------------------------
    // LOADING STATE
    // -------------------------------------------------------------------------
    if (!mounted || loading) {
        return (
            <div className="min-h-screen bg-brand-surface flex items-center justify-center relative overflow-hidden">
                {/* Background Texture */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-surfaceAlt via-brand-surface to-white opacity-80"></div>
                <div className="relative flex flex-col items-center gap-6">
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full blur-xl bg-brand-accent/20 animate-pulse"></div>
                        <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin relative z-10"></div>
                    </div>
                    <p className="text-brand-accent font-serif tracking-[0.2em] uppercase text-sm animate-pulse">Memuat Flash Sale...</p>
                </div>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // REUSABLE HEADER (Transparent / Sticky)
    // -------------------------------------------------------------------------
    const Header = () => (
        <div className="sticky top-0 z-50 transition-all duration-300 bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] shadow-md border-b border-white/20">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors group"
                        >
                            <ArrowLeft className="w-7 h-7 text-slate-900 group-hover:scale-110 transition-transform" />
                        </button>
                    )}

                </div>
                {/* Center Brand Title for Header - Black Typography */}
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <h1
                        className="font-['Berkshire_Swash'] text-4xl text-[#0F172A] drop-shadow-sm pb-1 leading-relaxed tracking-wide"
                        style={{ textShadow: '2px 2px 4px rgba(212, 175, 55, 0.5)' }}
                    >
                        Azzahra
                    </h1>
                    <span className="text-[10px] text-black tracking-[0.3em] -mt-3 font-bold uppercase font-serif">Fashion Muslim</span>
                </div>

                <button
                    onClick={onCartClick}
                    className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 transition-all group"
                >
                    <ShoppingCart className="w-7 h-7 text-slate-900 transition-transform group-hover:scale-110" />
                    {cartItems.length > 0 && (
                        <span className="absolute top-0 right-0 bg-[#0F172A] text-[#EDD686] text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-[#EDD686] shadow-sm">
                            {cartItems.length}
                        </span>
                    )}
                </button>
            </div>
        </div>
    );

    // -------------------------------------------------------------------------
    // EMPTY STATE (WAITING FLASHSALE) - "The Golden Hour" Mockup Match
    // -------------------------------------------------------------------------
    // Design: Deep Pure Black BG + Glassmorphism Center Card with Gold Ring + 3D Icon
    if (!flashSaleProducts || flashSaleProducts.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#FDF8F5] via-[#FFF5EE] to-[#FAE8DE] text-brand-primary selection:bg-brand-accent selection:text-white font-sans relative overflow-hidden">
                {/* Background Ambient Rose-Gold Glows */}
                <div className="fixed top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#E8C4A8] rounded-full mix-blend-multiply filter blur-[100px] opacity-20 pointer-events-none"></div>
                <div className="fixed top-[20%] right-[-15%] w-[350px] h-[350px] bg-[#D4AF37] rounded-full mix-blend-multiply filter blur-[120px] opacity-15 pointer-events-none"></div>
                <div className="fixed bottom-[-10%] left-[20%] w-[300px] h-[300px] bg-[#F5D0C5] rounded-full mix-blend-multiply filter blur-[100px] opacity-20 pointer-events-none"></div>

                <Header />

                <div className="container mx-auto px-6 py-8 flex flex-col items-center justify-center min-h-[85vh]">

                    {/* THE CARD - EXACT MOCKUP REPLICA */}
                    <div className="relative w-full max-w-[340px] mx-auto group">

                        {/* Card Shadow/Glow Behind */}
                        <div className="absolute inset-0 bg-[#D4AF37] rounded-[40px] blur-[30px] opacity-20 transform translate-y-4"></div>

                        {/* Main Card Surface - Rose Gold Gradient (Vertical Portrait) */}
                        <div className="relative bg-gradient-to-b from-[#F3E5D8] to-[#E6CDB2] rounded-[40px] p-8 pb-10 flex flex-col items-center text-center overflow-hidden border-[3px] border-white/40 shadow-[0_30px_60px_-10px_rgba(139,69,19,0.15)]">

                            {/* Inner Highlight/Sheen */}
                            <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none"></div>

                            {/* Clock Image Container */}
                            <div className="relative w-64 h-64 -mt-4 mb-2 flex items-center justify-center">
                                {/* Back Glow for Clock */}
                                <div className="absolute inset-0 bg-[#FFF8DC] rounded-full blur-[40px] opacity-60 scale-75"></div>

                                {/* Clock Image - with Soft Gradient Mask for Perfect Blend */}
                                <div
                                    className="relative z-10 w-full h-full"
                                    style={{
                                        maskImage: 'radial-gradient(closest-side, black 60%, transparent 95%)',
                                        WebkitMaskImage: 'radial-gradient(closest-side, black 60%, transparent 95%)'
                                    }}
                                >
                                    <img
                                        src="/gold-pocket-watch.png"
                                        alt="Gold Pocket Watch"
                                        className="w-full h-full object-contain drop-shadow-[0_15px_30px_rgba(184,134,11,0.3)]"
                                    />
                                </div>

                                {/* Sparkles Overlay */}
                                <div className="absolute top-10 right-10 w-3 h-3 bg-white rounded-full blur-[1px] animate-pulse"></div>
                                <div className="absolute bottom-16 left-8 w-2 h-2 bg-[#FFD700] rounded-full blur-[0.5px] animate-pulse delay-75"></div>
                                <div className="absolute top-6 left-12 w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-150"></div>
                            </div>

                            {/* Typography - Stacked Dark Serif */}
                            <div className="flex flex-col gap-0 items-center mb-10 w-full relative z-10">
                                <h2 className="font-serif text-[#0F172A] text-4xl leading-none tracking-tight font-medium drop-shadow-sm">
                                    Flash Sale
                                </h2>
                                <h2 className="font-serif text-[#0F172A] text-4xl leading-tight tracking-tight font-medium drop-shadow-sm">
                                    Sedang
                                </h2>
                                <h2 className="font-serif text-[#0F172A] text-4xl leading-none tracking-tight font-medium drop-shadow-sm">
                                    Disiapkan
                                </h2>
                            </div>

                            {/* Button - Metallic Gold & Rounded */}
                            {/* 5. Button - Metallic Gold (Match Checkout 'Buat Pesanan') */}
                            <button
                                onClick={() => window.location.href = '/'}
                                className="w-full bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-white py-4 rounded-full font-bold text-base shadow-[0_4px_14px_0_rgba(153,123,44,0.39)] hover:shadow-[0_6px_20px_rgba(153,123,44,0.23)] hover:bg-[100%_0] transition-all transform hover:-translate-y-0.5 active:scale-95 relative overflow-hidden group border border-[#D4AF37]/20"
                            >
                                <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-sm text-[#5d4008] font-serif tracking-wider">
                                    Lihat Koleksi Lain
                                </span>
                                {/* Shine Effect */}
                                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/60 to-transparent skew-x-12 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out" />
                            </button>

                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#FDF8F5] via-[#FFF5EE] to-[#FAE8DE] text-brand-primary font-sans pb-24">

            <Header />

            {/* HERO SECTION: Active Flash Sale - Sticky Hero */}
            <div className="sticky top-16 z-40 bg-gradient-to-b from-[#FDF8F5] via-[#FDF8F5] to-[#FDF8F5]/95 backdrop-blur-sm pt-6 pb-6 px-4 text-center shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
                {/* Background Atmosphere */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>

                {/* HEADER: FLASH SALE with Flames */}
                <div className="relative z-10 flex items-center justify-center gap-3 mb-8">
                    <span className="text-3xl sm:text-4xl text-brand-accent animate-pulse filter drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]">🔥</span>
                    <h1 className="font-serif text-4xl sm:text-5xl font-bold bg-gradient-to-b from-[#D4AF37] via-[#FDB931] to-[#B8860B] bg-clip-text text-transparent drop-shadow-sm tracking-wide transform scale-y-110">
                        FLASH SALE
                    </h1>
                    <span className="text-3xl sm:text-4xl text-brand-accent animate-pulse filter drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]">🔥</span>
                </div>

                {/* TIMER: Navy Blue Tiles with Gold Borders (Mockup Style) */}
                {timeLeft && (
                    <div className="flex justify-center items-center gap-2 sm:gap-4 mb-10 relative z-10">
                        {/* HOURS */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#0F172A] rounded-2xl border-[3px] border-[#D4AF37] shadow-[0_6px_15px_rgba(0,0,0,0.3)] flex items-center justify-center relative overflow-hidden group">
                                {/* Glossy Effect */}
                                <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent opacity-60"></div>
                                {/* Inner stroke */}
                                <div className="absolute inset-[2px] border border-[#D4AF37]/30 rounded-[13px]"></div>

                                <span className="font-serif text-3xl sm:text-4xl font-bold text-[#FDB931] drop-shadow-md z-10">
                                    {timeLeft.hours.toString().padStart(2, '0')}
                                </span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold tracking-widest text-[#B8860B] uppercase">JAM</span>
                        </div>

                        {/* Separator */}
                        <div className="flex flex-col gap-1.5 pt-1">
                            <div className="w-1.5 h-1.5 bg-[#B8860B] rounded-full"></div>
                            <div className="w-1.5 h-1.5 bg-[#B8860B] rounded-full"></div>
                        </div>

                        {/* MINUTES */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#0F172A] rounded-2xl border-[3px] border-[#D4AF37] shadow-[0_6px_15px_rgba(0,0,0,0.3)] flex items-center justify-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent opacity-60"></div>
                                <div className="absolute inset-[2px] border border-[#D4AF37]/30 rounded-[13px]"></div>

                                <span className="font-serif text-3xl sm:text-4xl font-bold text-[#FDB931] drop-shadow-md z-10">
                                    {timeLeft.minutes.toString().padStart(2, '0')}
                                </span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold tracking-widest text-[#B8860B] uppercase">MENIT</span>
                        </div>

                        {/* Separator */}
                        <div className="flex flex-col gap-1.5 pt-1">
                            <div className="w-1.5 h-1.5 bg-[#B8860B] rounded-full"></div>
                            <div className="w-1.5 h-1.5 bg-[#B8860B] rounded-full"></div>
                        </div>

                        {/* SECONDS */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#0F172A] rounded-2xl border-[3px] border-[#D4AF37] shadow-[0_6px_15px_rgba(0,0,0,0.3)] flex items-center justify-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent opacity-60"></div>
                                <div className="absolute inset-[2px] border border-[#D4AF37]/30 rounded-[13px]"></div>

                                <span className="font-serif text-3xl sm:text-4xl font-bold text-[#FDB931] drop-shadow-md z-10 animate-pulse">
                                    {timeLeft.seconds.toString().padStart(2, '0')}
                                </span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold tracking-widest text-[#B8860B] uppercase">DETIK</span>
                        </div>
                    </div>
                )}

                {/* PRODUK TERBATAS with Sparkles */}
                <div className="flex items-center justify-center gap-4 mb-4">
                    <span className="h-[1px] w-8 sm:w-16 bg-gradient-to-r from-transparent to-[#D4AF37]"></span>
                    <p className="font-serif text-lg sm:text-xl text-[#8B4513] tracking-wider flex items-center gap-2 uppercase">
                        PRODUK TERBATAS <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                    </p>
                    <span className="h-[1px] w-8 sm:w-16 bg-gradient-to-l from-transparent to-[#D4AF37]"></span>
                </div>
            </div>

            {/* PRODUCTS GRID */}
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {flashSaleProducts.map((flashProduct) => {
                        // Adapt flash product to standard Product interface for Card
                        const product = {
                            id: flashProduct.id,
                            name: flashProduct.name,
                            price: flashProduct.price,
                            retailPrice: flashProduct.retailPrice || flashProduct.price,
                            resellerPrice: flashProduct.resellerPrice || flashProduct.price * 0.8,
                            costPrice: flashProduct.price * 0.6,
                            description: flashProduct.name,
                            stock: flashProduct.stock,
                            images: flashProduct.images,
                            image: flashProduct.image,
                            category: flashProduct.category,
                            status: flashProduct.status as "ready" | "po",
                            createdAt: flashProduct.createdAt,
                            featuredOrder: flashProduct.featuredOrder,
                            variants: flashProduct.variants,
                            isFlashSale: flashProduct.isFlashSale,
                            flashSalePrice: flashProduct.flashSalePrice || flashProduct.price * 0.8,
                        };

                        return (
                            <FlashSaleCard
                                key={`flash-grid-${product.id}`}
                                product={product}
                                onProductClick={onProductClick}
                                onAddToCart={handleAddToCart}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default FlashSalePage;
