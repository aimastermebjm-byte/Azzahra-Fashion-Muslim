import React from 'react';
import { Home, Zap, Package, User } from 'lucide-react';

type Page = 'home' | 'flash-sale' | 'orders' | 'account';

interface BottomNavigationProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ currentPage, onPageChange }) => {
  const navItems = [
    { id: 'home' as Page, label: 'Beranda', icon: Home },
    { id: 'flash-sale' as Page, label: 'Flash Sale', icon: Zap },
    { id: 'orders' as Page, label: 'Pesanan', icon: Package },
    { id: 'account' as Page, label: 'Pengaturan', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-brand-primary shadow-2xl">
      <div className="flex">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`flex-1 flex flex-col items-center py-2.5 px-2 transition-all duration-300 ${isActive
                  ? 'text-brand-accent'
                  : 'text-brand-accent/30 hover:text-brand-accent/60'
                }`}
            >
              <div className={`relative ${isActive ? 'drop-shadow-[0_0_8px_rgba(212,175,55,0.8)]' : ''}`}>
                <Icon className={`w-5 h-5 mb-0.5 transition-all ${isActive ? 'text-brand-accent scale-110' : 'text-brand-accent/30'}`} />
              </div>
              <span className={`text-[10px] font-medium transition-all ${isActive ? 'text-brand-accent' : 'text-brand-accent/30'}`}>
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