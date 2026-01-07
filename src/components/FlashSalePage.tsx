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
            <div className="min-h-screen bg-brand-surface text-brand-primary selection:bg-brand-accent selection:text-white font-sans relative overflow-hidden">
                {/* Background Ambient Gold Glows */}
                <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-brand-accent rounded-full mix-blend-multiply filter blur-[150px] opacity-[0.08] pointer-events-none"></div>
                <div className="fixed bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-[#E8D5B5] rounded-full mix-blend-multiply filter blur-[120px] opacity-[0.1] pointer-events-none"></div>

                <Header />

                <div className="container mx-auto px-6 py-8 flex flex-col items-center justify-center min-h-[85vh]">

                    {/* THE CARD */}
                    <div className="relative w-full max-w-sm mx-auto group perspective-1000">

                        {/* 1. Outer Glow Ring (Animated) */}
                        <div className="absolute -inset-[3px] bg-gradient-to-tr from-brand-accent/50 via-[#F2D785]/30 to-brand-accent/50 rounded-[32px] opacity-70 blur-[10px] group-hover:opacity-100 group-hover:blur-[15px] transition-all duration-700"></div>

                        {/* 2. The Glass Card Surface - Rose Gold Tint */}
                        <div className="relative bg-gradient-to-br from-[#FFF9F5] via-white to-[#FDF0E8] rounded-[30px] p-8 flex flex-col items-center text-center overflow-hidden border border-brand-accent/30 shadow-[0_20px_60px_-15px_rgba(212,175,55,0.2)] backdrop-blur-xl">

                            {/* Glossy Overlay Reflection */}
                            <div className="absolute top-0 inset-x-0 h-[100px] bg-gradient-to-b from-white/60 to-transparent pointer-events-none"></div>

                            {/* Custom 3D High-Fidelity Golden Clock SVG */}
                            <div className="relative w-40 h-40 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-700 ease-out mb-8 mt-6">
                                {/* Ambient Glow */}
                                <div className="absolute inset-0 bg-[#D4AF37] rounded-full blur-[60px] opacity-25 animate-pulse"></div>

                                <svg width="160" height="160" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-2xl relative z-10">
                                    <defs>
                                        <linearGradient id="goldBody" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
                                            <stop offset="0%" stopColor="#8B4513" />
                                            <stop offset="20%" stopColor="#D4AF37" />
                                            <stop offset="50%" stopColor="#F9E076" />
                                            <stop offset="80%" stopColor="#D4AF37" />
                                            <stop offset="100%" stopColor="#8B4513" />
                                        </linearGradient>
                                        <linearGradient id="goldRim" x1="200" y1="0" x2="0" y2="200" gradientUnits="userSpaceOnUse">
                                            <stop offset="0%" stopColor="#FFF8DC" />
                                            <stop offset="40%" stopColor="#FDB931" />
                                            <stop offset="60%" stopColor="#B8860B" />
                                            <stop offset="100%" stopColor="#FFF8DC" />
                                        </linearGradient>
                                        <linearGradient id="goldHand" x1="100" y1="50" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                                            <stop offset="0%" stopColor="#FFF8DC" />
                                            <stop offset="50%" stopColor="#FDB931" />
                                            <stop offset="100%" stopColor="#B8860B" />
                                        </linearGradient>
                                        <radialGradient id="faceShine" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(100 100) rotate(90) scale(80)">
                                            <stop offset="0%" stopColor="#333" stopOpacity="0.5" />
                                            <stop offset="70%" stopColor="#000" stopOpacity="0.8" />
                                            <stop offset="100%" stopColor="#000" />
                                        </radialGradient>
                                        <filter id="innerShadow">
                                            <feOffset dx="0" dy="4" />
                                            <feGaussianBlur stdDeviation="4" result="offset-blur" />
                                            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
                                            <feFlood floodColor="black" floodOpacity="0.5" result="color" />
                                            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
                                            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
                                        </filter>
                                    </defs>

                                    {/* --- 1. Top Crown --- */}
                                    {/* Ring */}
                                    <path d="M100 20C92 20 85 13 85 5C85 -3 92 -10 100 -10C108 -10 115 -3 115 5C115 13 108 20 100 20Z" stroke="url(#goldRim)" strokeWidth="6" fill="none" />
                                    {/* Neck */}
                                    <rect x="92" y="16" width="16" height="14" fill="url(#goldBody)" />
                                    {/* Winder */}
                                    <rect x="88" y="6" width="24" height="10" rx="2" fill="url(#goldRim)" />

                                    {/* --- 2. Pushers (Ears) --- */}
                                    {/* Left Pusher with Shadow */}
                                    <g transform="rotate(-40 100 100)">
                                        <rect x="94" y="10" width="12" height="16" fill="url(#goldBody)" />
                                        <rect x="92" y="4" width="16" height="8" rx="2" fill="url(#goldRim)" filter="url(#innerShadow)" />
                                    </g>
                                    {/* Right Pusher with Shadow */}
                                    <g transform="rotate(40 100 100)">
                                        <rect x="94" y="10" width="12" height="16" fill="url(#goldBody)" />
                                        <rect x="92" y="4" width="16" height="8" rx="2" fill="url(#goldRim)" filter="url(#innerShadow)" />
                                    </g>

                                    {/* --- 3. Main Body --- */}
                                    {/* Outer Case (Shadow Support) */}
                                    <circle cx="100" cy="110" r="82" fill="black" opacity="0.6" filter="url(#innerShadow)" />
                                    <circle cx="100" cy="110" r="80" fill="url(#goldBody)" />

                                    {/* The Bezel (Chunky Metallic Ring) - 3D Contour */}
                                    <circle cx="100" cy="110" r="74" stroke="url(#goldRim)" strokeWidth="12" fill="none" filter="url(#innerShadow)" />

                                    {/* Subtle Inset Ring */}
                                    <circle cx="100" cy="110" r="67" stroke="#332211" strokeWidth="1" />

                                    {/* Face Background */}
                                    <circle cx="100" cy="110" r="66" fill="url(#faceShine)" />

                                    {/* --- 4. Dial Details --- */}
                                    {/* Ticks - Applied Gold Markers */}
                                    {[0, 90, 180, 270].map((deg) => (
                                        <g key={deg} transform={`rotate(${deg} 100 110)`}>
                                            <rect x="96" y="55" width="8" height="12" fill="url(#goldRim)" rx="1" />
                                            {/* Tick Shadow */}
                                            <rect x="96" y="58" width="8" height="12" fill="black" opacity="0.3" rx="1" transform="translate(1,1)" />
                                        </g>
                                    ))}

                                    {/* Inner small ticks */}
                                    {[...Array(12)].map((_, i) => (
                                        <rect key={i} x="99" y="50" width="2" height="6" fill="#665" transform={`rotate(${i * 30} 100 110)`} />
                                    ))}

                                    {/* Sub-dials (Simulated) */}
                                    <circle cx="75" cy="110" r="12" stroke="#333" strokeWidth="1" fill="none" opacity="0.5" />
                                    <path d="M75 110 L75 102" stroke="#665" strokeWidth="1" />

                                    <circle cx="125" cy="110" r="12" stroke="#333" strokeWidth="1" fill="none" opacity="0.5" />
                                    <path d="M125 110 L129 114" stroke="#665" strokeWidth="1" />

                                    {/* --- 5. Hands --- */}
                                    {/* Hour Hand */}
                                    <g transform="rotate(45 100 110)">
                                        <path d="M98 110 L100 70 L102 110 Z" fill="url(#goldHand)" />
                                        <circle cx="100" cy="110" r="6" fill="url(#goldRim)" />
                                    </g>
                                    {/* Minute Hand */}
                                    <g className="animate-[spin_60s_linear_infinite]" style={{ transformOrigin: "100px 110px" }}>
                                        <path d="M99 110 L100 50 L101 110 Z" fill="url(#goldRim)" />
                                    </g>
                                    {/* Second Hand (Red/Gold Tip) */}
                                    <g className="animate-[spin_6s_linear_infinite]" style={{ transformOrigin: "100px 110px" }}>
                                        <path d="M100 110 L100 45" stroke="#CD7F32" strokeWidth="1" />
                                        <circle cx="100" cy="110" r="2" fill="#CD7F32" />
                                    </g>

                                    {/* Glossy Overlay (Glass Reflection) */}
                                    <path d="M100 50 C140 50 165 80 165 110 A 65 65 0 0 1 35 110 C35 70 60 50 100 50" fill="white" fillOpacity="0.08" />

                                    {/* Star Sparkle Top Right */}
                                    <path d="M165 30 L168 38 L176 41 L168 44 L165 52 L162 44 L154 41 L162 38 Z" fill="#FFF8DC" className="animate-pulse" />
                                </svg>
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
        <div className="min-h-screen bg-brand-surface text-brand-primary font-sans overflow-x-hidden pb-24">

            <Header />

            {/* HERO SECTION: Gold Dust & Timer */}
            <div className="relative pt-8 pb-12 px-4 text-center">
                {/* Animated Gold Dust Background */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"></div>
                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-brand-accent/10 to-transparent blur-[50px] pointer-events-none"></div>

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
