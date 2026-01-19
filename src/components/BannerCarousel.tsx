import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Banner } from '../types/banner';
import { bannerService } from '../services/bannerService';

interface BannerCarouselProps {
  onBannerClick?: (banner: Banner) => void;
}

const BannerCarousel: React.FC<BannerCarouselProps> = ({ onBannerClick }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBanners = async () => {
      try {
        const data = await bannerService.getActiveBanners();
        setBanners(data);
      } catch (error) {
        console.error('Failed to load banners:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBanners();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 5000); // 5 seconds per slide (slower for better viewing)

    return () => clearInterval(timer);
  }, [banners.length]);

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlide((prev) => (prev + 1) % banners.length);
  };

  if (loading || banners.length === 0) return null;

  return (
    <div className="relative w-full aspect-[3/1] md:aspect-[3.5/1] overflow-hidden rounded-2xl shadow-md group">
      {/* Slides */}
      <div className="relative w-full h-full">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            onClick={() => onBannerClick && onBannerClick(banner)}
          >
            <img
              src={banner.imageUrl}
              alt={banner.title}
              className="w-full h-full object-contain bg-[#F5EFE0] cursor-pointer hover:scale-105 transition-transform duration-[2000ms]"
            />

            {/* Optional Overlay for Text visibility (if needed in future) */}
            {/* <div className="absolute inset-0 bg-black/10"></div> */}
          </div>
        ))}
      </div>

      {/* Navigation Arrows - Show on hover */}
      {banners.length > 1 && (
        <>
          <button
            onClick={handlePrevSlide}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 backdrop-blur-sm text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all z-20"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNextSlide}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 backdrop-blur-sm text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all z-20"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentSlide(index);
              }}
              className={`w-2 h-2 rounded-full transition-all ${index === currentSlide
                ? 'bg-white w-6'
                : 'bg-white/50 hover:bg-white/80'
                }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BannerCarousel;