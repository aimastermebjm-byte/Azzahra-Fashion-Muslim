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
    { id: 'account' as Page, label: '⚙️ Pengaturan', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`flex-1 flex flex-col items-center py-3 px-2 transition-colors ${
                isActive
                  ? 'text-pink-600 bg-pink-50'
                  : 'text-gray-600 hover:text-pink-600 hover:bg-gray-50'
              }`}
            >
              <Icon className={`w-6 h-6 mb-1 ${isActive ? 'text-pink-600' : 'text-gray-600'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-pink-600' : 'text-gray-600'}`}>
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