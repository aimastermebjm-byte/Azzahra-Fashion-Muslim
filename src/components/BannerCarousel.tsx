import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Tag } from 'lucide-react';

interface Banner {
  id: string;
  title: string;
  image: string;
  link?: string;
  type: 'flashsale' | 'promo' | 'normal';
}

interface BannerCarouselProps {
  onBannerClick?: (banner: Banner) => void;
}

const BannerCarousel: React.FC<BannerCarouselProps> = ({ onBannerClick }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);

  // Default banners + dynamic banners from admin (flash sale banner removed as requested)
  const defaultBanners: Banner[] = [];

  useEffect(() => {
    // Load banners from localStorage or API
    const savedBanners = localStorage.getItem('azzahra-banners');
    if (savedBanners) {
      try {
        const parsedBanners = JSON.parse(savedBanners);
        setBanners([...defaultBanners, ...parsedBanners]);
      } catch (e) {
        setBanners(defaultBanners);
      }
    } else {
      setBanners(defaultBanners);
    }
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;

    // Auto-slide every 3 seconds
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [banners.length]);

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % banners.length);
  };

  const handleBannerClick = (banner: Banner) => {
    if (onBannerClick) {
      onBannerClick(banner);
    }
  };

  if (banners.length === 0) return null;

  return (
    <div className="relative w-full h-48 md:h-56 lg:h-64 overflow-hidden rounded-lg">
      {/* Banner Images */}
      <div className="relative h-full">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div
              className={`w-full h-full cursor-pointer ${
                banner.type === 'flashsale'
                  ? 'bg-gradient-to-r from-red-500 to-pink-500'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500'
              }`}
              onClick={() => handleBannerClick(banner)}
            >
              <div className="flex items-center justify-center h-full p-8 text-white">
                <div className="text-center">
                  {banner.type === 'flashsale' && (
                    <Tag className="w-8 h-8 mx-auto mb-2" />
                  )}
                  <h2 className="text-2xl md:text-3xl font-bold mb-2">
                    {banner.title}
                  </h2>
                  {banner.type === 'flashsale' && (
                    <p className="text-red-100">Diskon terbatas! Buruan sebelum kehabisan!</p>
                  )}
                  {banner.type === 'promo' && (
                    <p className="text-purple-100">Promo spesial untuk Anda!</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={handlePrevSlide}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={handleNextSlide}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </>
      )}

      {/* Slide Indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentSlide ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BannerCarousel;