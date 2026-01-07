import React, { useState, useEffect } from 'react';
import { ShoppingCart, Flame, ArrowLeft, ChevronRight } from 'lucide-react';
import ProductCard from './ProductCard';
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
    const { timeLeft, isFlashSaleActive, loading } = useUnifiedFlashSale();
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
        <div className="sticky top-0 z-50 transition-all duration-300 bg-brand-surface/95 backdrop-blur-md border-b border-brand-accent/20 shadow-sm">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-brand-accent/10 transition-colors group"
                        >
                            <ArrowLeft className="w-6 h-6 text-brand-accent group-hover:-translate-x-1 transition-transform" />
                        </button>
                    )}

                </div>
                {/* Center Brand Title for Header */}
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <h1 className="font-serif text-xl font-bold tracking-widest text-brand-primary">
                        Azzahra
                    </h1>
                    <span className="text-[10px] text-brand-accent tracking-[0.15em] -mt-1">Fashion Muslim</span>
                </div>

                <button
                    onClick={onCartClick}
                    className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-brand-accent/10 transition-all group"
                >
                    <ShoppingCart className="w-6 h-6 text-brand-accent transition-transform group-hover:scale-110" />
                    {cartItems.length > 0 && (
                        <span className="absolute top-0 right-0 bg-brand-accent text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-brand-surface shadow-lg">
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

                    {/* THE CARD */}
                    <div className="relative w-full max-w-sm mx-auto group perspective-1000">

                        {/* 1. Outer Glow Ring (Rose-Gold Animated) */}
                        <div className="absolute -inset-[4px] bg-gradient-to-tr from-[#D4AF37]/60 via-[#F5D0C5]/40 to-[#D4AF37]/60 rounded-[32px] opacity-80 blur-[12px] group-hover:opacity-100 group-hover:blur-[18px] transition-all duration-700"></div>

                        {/* 2. The Glass Card Surface - Rose Gold Tint */}
                        <div className="relative bg-gradient-to-br from-[#FFF9F5] via-[#FFFAF8] to-[#FDF0E8] rounded-[30px] p-8 flex flex-col items-center text-center overflow-hidden border border-[#E8C4A8]/50 shadow-[0_20px_60px_-15px_rgba(212,175,55,0.25),0_10px_30px_-10px_rgba(232,196,168,0.3)] backdrop-blur-xl">

                            {/* Glossy Overlay Reflection */}
                            <div className="absolute top-0 inset-x-0 h-[120px] bg-gradient-to-b from-white/70 to-transparent pointer-events-none"></div>

                            {/* Rose-Gold Sparkle Particles Effect */}
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 pointer-events-none"></div>

                            {/* 3D Gold Pocket Watch Image - Seamlessly Blended */}
                            <div className="relative w-48 h-48 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-700 ease-out mb-4 mt-2">
                                {/* Ambient Glow Behind Watch */}
                                <div className="absolute inset-0 bg-gradient-radial from-[#D4AF37]/30 via-[#E8C4A8]/20 to-transparent rounded-full blur-[50px] scale-150"></div>

                                {/* The 3D Watch Image with Gradient Mask for Seamless Blending */}
                                <div
                                    className="relative z-10 w-44 h-44"
                                    style={{
                                        maskImage: 'radial-gradient(circle, white 50%, transparent 75%)',
                                        WebkitMaskImage: 'radial-gradient(circle, white 50%, transparent 75%)'
                                    }}
                                >
                                    <img
                                        src="/gold-pocket-watch.png"
                                        alt="Gold Pocket Watch"
                                        className="w-full h-full object-contain drop-shadow-[0_10px_30px_rgba(212,175,55,0.5)] animate-float"
                                    />
                                </div>

                                {/* Sparkle Effects */}
                                <div className="absolute top-4 right-4 w-2 h-2 bg-white rounded-full animate-pulse opacity-90 z-20"></div>
                                <div className="absolute top-8 left-6 w-1.5 h-1.5 bg-[#FFF8DC] rounded-full animate-pulse opacity-70 z-20" style={{ animationDelay: '0.3s' }}></div>
                                <div className="absolute bottom-6 right-8 w-1 h-1 bg-[#D4AF37] rounded-full animate-pulse opacity-60 z-20" style={{ animationDelay: '0.6s' }}></div>
                            </div>


                            {/* 4. Typography */}
                            <h2 className="font-serif text-3xl leading-tight mb-4">
                                <span className="block text-brand-primary/70 text-xl mb-1">Flash Sale</span>
                                <span className="bg-gradient-to-r from-brand-accent via-[#E8C96B] to-brand-accent bg-clip-text text-transparent font-bold tracking-wide">
                                    Sedang Disiapkan
                                </span>
                            </h2>

                            <p className="text-brand-primary/50 text-sm mb-8 font-light leading-relaxed px-4">
                                Koleksi eksklusif dengan harga istimewa akan segera hadir. Waktu terus berjalan.
                            </p>

                            {/* 5. Button */}
                            <button
                                onClick={() => window.location.href = '/'}
                                className="w-full py-4 rounded-full bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-brand-primary font-bold tracking-wide text-sm uppercase transition-all transform hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] active:scale-95 border border-brand-accent/30 relative overflow-hidden group/btn"
                            >
                                <div className="absolute inset-0 bg-white/40 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 pointer-events-none skew-x-12"></div>
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    Lihat Koleksi Lain <ChevronRight className="w-4 h-4" />
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#FDF8F5] via-[#FFF5EE] to-[#FAE8DE] text-brand-primary font-sans overflow-x-hidden pb-24">

            <Header />

            {/* HERO SECTION: Rose-Gold Dust & Timer */}
            <div className="relative pt-8 pb-12 px-4 text-center">
                {/* Rose-Gold Dust Background */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-15"></div>
                <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[#E8C4A8]/20 via-[#D4AF37]/10 to-transparent blur-[30px] pointer-events-none"></div>

                {/* FLAMES & TITLE */}
                <div className="relative z-10 flex items-center justify-center gap-3 mb-8">
                    <Flame className="w-8 h-8 text-orange-500 fill-orange-400 drop-shadow-lg animate-pulse" />
                    <h1 className="font-serif italic font-black text-4xl sm:text-5xl tracking-tighter">
                        <span className="bg-gradient-to-b from-brand-accent via-[#E8C96B] to-[#A8894F] bg-clip-text text-transparent">
                            FLASH SALE
                        </span>
                    </h1>
                    <Flame className="w-8 h-8 text-orange-500 fill-orange-400 drop-shadow-lg animate-pulse" />
                </div>

                {/* COUNTDOWN TIMER TILES */}
                {timeLeft && (
                    <div className="relative z-10 flex justify-center gap-3 sm:gap-4 mb-10">
                        {/* Tile: HOURS - NAVY with GOLD */}
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-24 sm:w-24 sm:h-28 bg-brand-primary rounded-[10px] sm:rounded-2xl border-2 border-brand-accent shadow-[0_8px_20px_rgba(0,0,0,0.2)] flex items-center justify-center relative overflow-hidden">
                                {/* Glass Reflection Top Half */}
                                <div className="absolute top-0 inset-x-0 h-[50%] bg-gradient-to-b from-white/10 to-transparent border-b border-white/5"></div>
                                {/* Inner Glow */}
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-accent/10 to-transparent"></div>

                                <span className="text-5xl sm:text-6xl font-bold bg-gradient-to-b from-[#FFF8DC] via-brand-accent to-[#B8860B] bg-clip-text text-transparent font-mono tracking-wider relative z-10">
                                    {timeLeft.hours.toString().padStart(2, '0')}
                                </span>
                            </div>
                            <span className="text-brand-accent text-[10px] font-bold tracking-[0.2em] mt-3 uppercase">Jam</span>
                        </div>

                        {/* Separator - Glowing Dots */}
                        <div className="h-24 flex flex-col justify-center gap-4">
                            <div className="w-2 h-2 bg-brand-accent rounded-full shadow-[0_0_8px_rgba(212,175,55,0.5)] animate-pulse"></div>
                            <div className="w-2 h-2 bg-brand-accent rounded-full shadow-[0_0_8px_rgba(212,175,55,0.5)] animate-pulse"></div>
                        </div>

                        {/* Tile: MINUTES */}
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-24 sm:w-24 sm:h-28 bg-brand-primary rounded-[10px] sm:rounded-2xl border-2 border-brand-accent shadow-[0_8px_20px_rgba(0,0,0,0.2)] flex items-center justify-center relative overflow-hidden">
                                {/* Glass Reflection Top Half */}
                                <div className="absolute top-0 inset-x-0 h-[50%] bg-gradient-to-b from-white/10 to-transparent border-b border-white/5"></div>
                                {/* Inner Glow */}
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-accent/10 to-transparent"></div>

                                <span className="text-5xl sm:text-6xl font-bold bg-gradient-to-b from-[#FFF8DC] via-brand-accent to-[#B8860B] bg-clip-text text-transparent font-mono tracking-wider relative z-10">
                                    {timeLeft.minutes.toString().padStart(2, '0')}
                                </span>
                            </div>
                            <span className="text-brand-accent text-[10px] font-bold tracking-[0.2em] mt-3 uppercase">Menit</span>
                        </div>

                        {/* Separator - Glowing Dots */}
                        <div className="h-24 flex flex-col justify-center gap-4">
                            <div className="w-2 h-2 bg-brand-accent rounded-full shadow-[0_0_8px_rgba(212,175,55,0.5)] animate-pulse"></div>
                            <div className="w-2 h-2 bg-brand-accent rounded-full shadow-[0_0_8px_rgba(212,175,55,0.5)] animate-pulse"></div>
                        </div>

                        {/* Tile: SECONDS */}
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-24 sm:w-24 sm:h-28 bg-brand-primary rounded-[10px] sm:rounded-2xl border-2 border-brand-accent shadow-[0_8px_20px_rgba(0,0,0,0.2)] flex items-center justify-center relative overflow-hidden group">
                                {/* Glass Reflection Top Half */}
                                <div className="absolute top-0 inset-x-0 h-[50%] bg-gradient-to-b from-white/10 to-transparent border-b border-white/5"></div>
                                {/* Inner Glow */}
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-accent/10 to-transparent"></div>

                                <span className="text-5xl sm:text-6xl font-bold bg-gradient-to-b from-[#FFF8DC] via-brand-accent to-[#B8860B] bg-clip-text text-transparent font-mono tracking-wider relative z-10 animate-pulse">
                                    {timeLeft.seconds.toString().padStart(2, '0')}
                                </span>
                            </div>
                            <span className="text-brand-accent text-[10px] font-bold tracking-[0.2em] mt-3 uppercase">Detik</span>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-center gap-2">
                    <span className="h-[1px] w-12 bg-gradient-to-r from-transparent to-brand-accent/50"></span>
                    <p className="text-brand-primary font-serif uppercase tracking-widest text-xs relative">
                        <span className="absolute -top-1 -right-3">✨</span>
                        Produk Terbatas
                    </p>
                    <span className="h-[1px] w-12 bg-gradient-to-l from-transparent to-brand-accent/50"></span>
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
                            <div
                                key={`flash-grid-${product.id}`}
                                className="transform hover:scale-[1.02] transition-all duration-300"
                            >
                                {/* 
                   Using ProductCard with "isFlashSale" prop to trigger the Gold Badge styles
                   that we implemented in ProductCard.tsx previously.
                   We might need to check if ProductCard supports the dark theme properly. 
                   If not, it will just be a white card on black BG, which is also luxury contrast style.
                */}
                                <ProductCard
                                    product={product}
                                    onProductClick={onProductClick}
                                    onAddToCart={handleAddToCart}
                                    isFlashSale={true}
                                    user={user}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default FlashSalePage;
