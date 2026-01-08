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
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] shadow-[0_-5px_20px_rgba(212,175,55,0.3)] border-t border-white/20 backdrop-blur-md z-50">
      <div className="flex justify-around items-center h-16 safe-area-bottom">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className="flex-1 flex flex-col items-center justify-center h-full transition-all duration-300 group active:scale-95"
            >
              <div className={`relative p-1.5 rounded-xl transition-all duration-500 ease-out ${isActive ? '-translate-y-1' : ''}`}>
                {/* Active Indicator Glow Background - White for contrast on Gold */}
                {isActive && (
                  <div className="absolute inset-0 bg-white/20 blur-xl rounded-full" />
                )}

                <Icon
                  className={`w-7 h-7 mb-0.5 transition-all duration-300 ${isActive
                    ? 'text-black drop-shadow-sm scale-110'
                    : 'text-slate-800 group-hover:text-black'
                    }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>

              <span
                className={`text-[10px] font-medium tracking-wide transition-all duration-300 ${isActive
                  ? 'text-black font-bold translate-y-0'
                  : 'text-slate-800 group-hover:text-black'
                  }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavigation;