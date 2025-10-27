import React from 'react';
import { Package } from 'lucide-react';

interface OngkirCheckerProps {
  originCityId?: string;
  weight?: number;
  onCostSelected?: (courier: string, service: string, cost: number, etd: string) => void;
  className?: string;
}

const OngkirChecker: React.FC<OngkirCheckerProps> = ({
  className = ''
}) => {
  return (
    <div className={`bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center ${className}`}>
      <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-600 mb-2">Kalkulator Ongkir</h3>
      <p className="text-gray-500 text-sm">
        Fitur kalkulator ongkir sedang dalam perbaikan. Silakan gunakan fitur checkout untuk menghitung ongkir otomatis.
      </p>
    </div>
  );
};

export default OngkirChecker;