import React, { useState, useRef } from 'react';
import { Share2, Check, Loader2 } from 'lucide-react';

interface FlashSaleShareButtonProps {
    flashSaleProducts: any[];
    user: any;
    shopUrl?: string;
}

const FlashSaleShareButton: React.FC<FlashSaleShareButtonProps> = ({
    flashSaleProducts,
    user,
    shopUrl = 'https://azzahra-fashion-muslim.vercel.app/flash-sale'
}) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Only visible for owner/admin
    const userRole = user?.role || 'customer';
    if (!['owner', 'admin'].includes(userRole)) return null;
    if (!flashSaleProducts || flashSaleProducts.length === 0) return null;

    // Generate promo text for WhatsApp
    const generatePromoText = (): string => {
        let text = `🔥 *FLASH SALE AZZAHRA FASHION MUSLIM!*\n`;
        text += `🛒 *Belanja langsung:*\n${shopUrl}\n\n`;

        flashSaleProducts.forEach((product, index) => {
            const originalPrice = product.retailPrice || product.price || 0;
            const salePrice = product.flashSalePrice || originalPrice * 0.7;
            const discountPercent = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

            const name = (product.name || '').trim().replace(/\n/g, ' ');
            text += `${index + 1}. *${name}*\n`;
            text += `   ~Rp ${originalPrice.toLocaleString('id-ID')}~ → *Rp ${salePrice.toLocaleString('id-ID')}* (HEMAT ${discountPercent}%)\n\n`;
        });

        text += `⏰ _Stok terbatas, buruan sebelum habis!_`;

        return text;
    };

    // Load image as promise
    const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            setTimeout(() => reject(new Error('Image load timeout')), 5000);
            img.src = src;
        });
    };

    // Generate poster image using Canvas
    const generatePoster = async (): Promise<Blob | null> => {
        try {
            const products = flashSaleProducts.slice(0, 6); // Max 6 products on poster
            const CARD_HEIGHT = 200;
            const PADDING = 30;
            const HEADER_HEIGHT = 120;
            const FOOTER_HEIGHT = 80;
            const WIDTH = 800;
            const HEIGHT = HEADER_HEIGHT + (products.length * CARD_HEIGHT) + FOOTER_HEIGHT + PADDING * 2;

            const canvas = document.createElement('canvas');
            canvas.width = WIDTH;
            canvas.height = HEIGHT;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            // Background gradient (dark)
            const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
            bgGrad.addColorStop(0, '#0F172A');
            bgGrad.addColorStop(0.5, '#1E293B');
            bgGrad.addColorStop(1, '#0F172A');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);

            // Decorative gold line top
            const goldGrad = ctx.createLinearGradient(0, 0, WIDTH, 0);
            goldGrad.addColorStop(0, '#997B2C');
            goldGrad.addColorStop(0.5, '#EDD686');
            goldGrad.addColorStop(1, '#997B2C');
            ctx.fillStyle = goldGrad;
            ctx.fillRect(0, 0, WIDTH, 4);

            // Header
            ctx.fillStyle = '#EDD686';
            ctx.font = 'bold 20px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🔥 FLASH SALE 🔥', WIDTH / 2, 45);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 36px "Inter", sans-serif';
            ctx.fillText('AZZAHRA FASHION MUSLIM', WIDTH / 2, 85);

            ctx.fillStyle = '#94A3B8';
            ctx.font = '16px "Inter", sans-serif';
            ctx.fillText(`${products.length} Produk Spesial — Stok Terbatas!`, WIDTH / 2, 110);

            // Draw each product
            for (let i = 0; i < products.length; i++) {
                const product = products[i];
                const y = HEADER_HEIGHT + PADDING + (i * CARD_HEIGHT);

                // Card background
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.beginPath();
                ctx.roundRect(PADDING, y, WIDTH - PADDING * 2, CARD_HEIGHT - 15, 16);
                ctx.fill();

                // Card border
                ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(PADDING, y, WIDTH - PADDING * 2, CARD_HEIGHT - 15, 16);
                ctx.stroke();

                // Product image
                const imgX = PADDING + 15;
                const imgY = y + 15;
                const imgSize = CARD_HEIGHT - 45;

                try {
                    const imgSrc = product.images?.[0] || product.image || '';
                    if (imgSrc) {
                        const img = await loadImage(imgSrc);
                        // Clip rounded rectangle for image
                        ctx.save();
                        ctx.beginPath();
                        ctx.roundRect(imgX, imgY, imgSize, imgSize, 12);
                        ctx.clip();
                        // Cover fit
                        const scale = Math.max(imgSize / img.width, imgSize / img.height);
                        const sw = imgSize / scale;
                        const sh = imgSize / scale;
                        const sx = (img.width - sw) / 2;
                        const sy = (img.height - sh) / 2;
                        ctx.drawImage(img, sx, sy, sw, sh, imgX, imgY, imgSize, imgSize);
                        ctx.restore();
                    } else {
                        // Placeholder
                        ctx.fillStyle = '#334155';
                        ctx.beginPath();
                        ctx.roundRect(imgX, imgY, imgSize, imgSize, 12);
                        ctx.fill();
                        ctx.fillStyle = '#64748B';
                        ctx.font = '14px "Inter", sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText('No Image', imgX + imgSize / 2, imgY + imgSize / 2 + 5);
                    }
                } catch {
                    // Fallback placeholder
                    ctx.fillStyle = '#334155';
                    ctx.beginPath();
                    ctx.roundRect(imgX, imgY, imgSize, imgSize, 12);
                    ctx.fill();
                }

                // Product info (right side)
                const textX = imgX + imgSize + 25;
                const textMaxWidth = WIDTH - textX - PADDING - 15;

                // Product name
                const name = (product.name || '').trim().replace(/\n/g, ' ');
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 20px "Inter", sans-serif';
                ctx.textAlign = 'left';
                // Truncate name
                let displayName = name;
                while (ctx.measureText(displayName).width > textMaxWidth && displayName.length > 5) {
                    displayName = displayName.slice(0, -1);
                }
                if (displayName !== name) displayName += '...';
                ctx.fillText(displayName, textX, y + 45);

                // Status badge
                const status = product.status === 'ready' ? 'READY' : 'PO';
                ctx.fillStyle = product.status === 'ready' ? '#22C55E' : '#F59E0B';
                ctx.font = 'bold 12px "Inter", sans-serif';
                const statusWidth = ctx.measureText(status).width + 16;
                ctx.beginPath();
                ctx.roundRect(textX, y + 55, statusWidth, 22, 6);
                ctx.fill();
                ctx.fillStyle = '#0F172A';
                ctx.fillText(status, textX + 8, y + 70);

                // Stock
                ctx.fillStyle = '#94A3B8';
                ctx.font = '12px "Inter", sans-serif';
                ctx.fillText(`Stok: ${product.stock || 0}`, textX + statusWidth + 10, y + 70);

                // Original price (strikethrough)
                const originalPrice = product.retailPrice || product.price || 0;
                const salePrice = product.flashSalePrice || originalPrice * 0.7;
                const discountPercent = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

                ctx.fillStyle = '#64748B';
                ctx.font = '16px "Inter", sans-serif';
                const originalPriceText = `Rp ${originalPrice.toLocaleString('id-ID')}`;
                ctx.fillText(originalPriceText, textX, y + 105);
                // Strikethrough line
                const priceWidth = ctx.measureText(originalPriceText).width;
                ctx.strokeStyle = '#64748B';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(textX, y + 100);
                ctx.lineTo(textX + priceWidth, y + 100);
                ctx.stroke();

                // Sale price
                ctx.fillStyle = '#EDD686';
                ctx.font = 'bold 28px "Inter", sans-serif';
                ctx.fillText(`Rp ${salePrice.toLocaleString('id-ID')}`, textX, y + 140);

                // Discount badge
                ctx.fillStyle = '#DC2626';
                const discountText = `-${discountPercent}%`;
                const discountWidth = ctx.measureText(discountText).width + 16;
                const discountX = textX + ctx.measureText(`Rp ${salePrice.toLocaleString('id-ID')}`).width + 15;
                ctx.beginPath();
                ctx.roundRect(discountX, y + 118, discountWidth, 28, 6);
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 14px "Inter", sans-serif';
                ctx.fillText(discountText, discountX + 8, y + 137);
            }

            // Footer
            const footerY = HEIGHT - FOOTER_HEIGHT;

            // Gold line
            ctx.fillStyle = goldGrad;
            ctx.fillRect(PADDING, footerY, WIDTH - PADDING * 2, 2);

            // Shop link
            ctx.fillStyle = '#EDD686';
            ctx.font = 'bold 20px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🛒 Belanja sekarang di azzahrafashion.com', WIDTH / 2, footerY + 35);

            ctx.fillStyle = '#94A3B8';
            ctx.font = '14px "Inter", sans-serif';
            ctx.fillText('⏰ Stok terbatas — Buruan sebelum habis!', WIDTH / 2, footerY + 60);

            // Gold line bottom
            ctx.fillStyle = goldGrad;
            ctx.fillRect(0, HEIGHT - 4, WIDTH, 4);

            // Convert to blob
            return new Promise((resolve) => {
                canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
            });

        } catch (error) {
            console.error('❌ Error generating poster:', error);
            return null;
        }
    };

    // Handle share action
    const handleShare = async () => {
        setIsGenerating(true);

        try {
            const promoText = generatePromoText();
            const posterBlob = await generatePoster();

            // Try Web Share API first (mobile - can share image + text)
            if (navigator.share && posterBlob) {
                const posterFile = new File([posterBlob], 'flash-sale-azzahra.png', { type: 'image/png' });

                if (navigator.canShare && navigator.canShare({ files: [posterFile] })) {
                    await navigator.share({
                        text: promoText,
                        files: [posterFile]
                    });
                    setShowSuccess(true);
                    setTimeout(() => setShowSuccess(false), 2000);
                    return;
                }
            }

            // Fallback: Download poster + open WhatsApp with text
            if (posterBlob) {
                const url = URL.createObjectURL(posterBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'flash-sale-azzahra.png';
                a.click();
                URL.revokeObjectURL(url);
            }

            // Open WhatsApp with promo text
            const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(promoText)}`;
            window.open(waUrl, '_blank');

            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);

        } catch (error) {
            console.error('❌ Share error:', error);
            // Final fallback: copy text to clipboard
            try {
                await navigator.clipboard.writeText(generatePromoText());
                alert('Teks promo disalin ke clipboard! Paste di WhatsApp.');
            } catch {
                alert('Gagal share. Coba lagi.');
            }
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <>
            <button
                onClick={handleShare}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-full text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Share Flash Sale ke WhatsApp"
            >
                {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : showSuccess ? (
                    <Check className="w-4 h-4" />
                ) : (
                    <Share2 className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                    {isGenerating ? 'Generating...' : showSuccess ? 'Berhasil!' : 'Share WA'}
                </span>
            </button>
            <canvas ref={canvasRef} className="hidden" />
        </>
    );
};

export default FlashSaleShareButton;
