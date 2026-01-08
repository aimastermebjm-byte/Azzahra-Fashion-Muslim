import React from 'react';
import { Home, Tag, ShoppingBag, User } from 'lucide-react';

type Page = 'home' | 'flash-sale' | 'orders' | 'account';

interface BottomNavigationProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ currentPage, onPageChange }) => {
  const navItems = [
    { id: 'home' as Page, label: 'Beranda', icon: Home },
    { id: 'flash-sale' as Page, label: 'Flash Sale', icon: Tag },
    { id: 'orders' as Page, label: 'Pesanan', icon: ShoppingBag },
    { id: 'account' as Page, label: 'Pengaturan', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-50 pb-safe">
      {/* Define Gold Gradient for Icons */}
      <svg width="0" height="0" className="absolute">
        <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#997B2C" />
          <stop offset="50%" stopColor="#EDD686" />
          <stop offset="100%" stopColor="#997B2C" />
        </linearGradient>
      </svg>

      <div className="flex justify-around items-center h-16 w-full max-w-md mx-auto relative">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className="relative flex-1 flex flex-col items-center justify-center h-full transition-all duration-300 group active:scale-95"
            >
              {/* Active Indicator - Subtle Top Border or Glow */}
              {isActive && (
                <div className="absolute top-0 w-8 h-0.5 bg-[#997B2C] shadow-[0_2px_8px_rgba(153,123,44,0.5)] rounded-b-lg"></div>
              )}

              <div className={`relative z-10 flex flex-col items-center transition-transform duration-300 ${isActive ? '-translate-y-0.5' : ''}`}>
                <Icon
                  className={`w-7 h-7 mb-0.5 transition-all duration-300 ${isActive
                    ? 'drop-shadow-sm scale-110'
                    : 'text-black group-hover:text-[#997B2C]' // Inactive: Pitch Black
                    }`}
                  stroke={isActive ? "url(#gold-gradient)" : "currentColor"}
                  fill={isActive ? "url(#gold-gradient)" : "none"}
                  fillOpacity={isActive ? 0.2 : 0}
                  strokeWidth={isActive ? 2.5 : 2} // Less bold when inactive to distinguish form
                />
                <span
                  className={`text-[10px] tracking-wide transition-all duration-300 ${isActive
                    ? 'text-[#997B2C] font-bold'
                    : 'text-slate-900 font-medium group-hover:text-[#997B2C]' // Inactive: Dark Slate & Medium Weight
                    }`}
                >
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavigation;