import React from 'react';
import { ArrowLeft } from 'lucide-react';

export type BackButtonVariant = 'light' | 'dark' | 'ghost';

interface BackButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
  variant?: BackButtonVariant;
  icon?: React.ReactNode;
}

const variantClasses: Record<BackButtonVariant, string> = {
  light: 'border-brand-primary/10 bg-white text-brand-primary hover:bg-white/95 focus:ring-brand-primary/30',
  dark: 'border-white/30 bg-white/15 text-white hover:bg-white/25 focus:ring-white/40',
  ghost: 'border-transparent bg-transparent text-brand-primary hover:bg-brand-primary/10 focus:ring-brand-primary/20'
};

const BackButton: React.FC<BackButtonProps> = ({
  onClick,
  label = 'Kembali',
  className = '',
  variant = 'light',
  icon
}) => {
  const variantClass = variantClasses[variant] ?? variantClasses.light;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${variantClass} ${className}`}
    >
      {icon ?? <ArrowLeft className="w-4 h-4" />}
      <span>{label}</span>
    </button>
  );
};

export default BackButton;
