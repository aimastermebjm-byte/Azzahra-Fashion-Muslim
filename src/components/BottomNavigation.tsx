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
    <div className="fixed bottom-0 left-0 right-0 bg-brand-primary shadow-[0_-5px_20px_rgba(0,0,0,0.3)] border-t border-white/5 backdrop-blur-md">
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
                {/* Active Indicator Glow Background */}
                {isActive && (
                  <div className="absolute inset-0 bg-brand-accent/20 blur-xl rounded-full" />
                )}

                <Icon
                  className={`w-5 h-5 mb-0.5 transition-all duration-300 ${isActive
                    ? 'text-brand-accent drop-shadow-[0_0_8px_rgba(212,175,55,0.8)] fill-brand-accent/10 scale-110'
                    : 'text-brand-accent/75 group-hover:text-brand-accent'
                    }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>

              <span
                className={`text-[9px] font-medium tracking-wide transition-all duration-300 ${isActive
                  ? 'text-brand-accent drop-shadow-[0_0_5px_rgba(212,175,55,0.5)] translate-y-0'
                  : 'text-brand-accent/75 group-hover:text-brand-accent'
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