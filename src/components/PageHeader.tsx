import React from 'react';
import BackButton, { BackButtonVariant } from './BackButton';

type HeaderVariant = 'surface' | 'card' | 'gradient';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  variant?: HeaderVariant;
  backButtonVariant?: BackButtonVariant;
  align?: 'start' | 'center' | 'between';
}

const variantClasses: Record<HeaderVariant, string> = {
  surface: 'bg-brand-surface text-slate-900 border-b border-brand-border/50',
  card: 'bg-white text-slate-900 shadow-sm border-b border-brand-border/50',
  gradient: 'bg-gradient-to-r from-[#997B2C] via-[#EDD686] to-[#997B2C] text-slate-900 shadow-lg border-b border-white/20'
};

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  description,
  onBack,
  actions,
  children,
  className = '',
  variant = 'card',
  backButtonVariant,
  align = 'between'
}) => {
  const baseClass = variantClasses[variant] ?? variantClasses.card;
  const alignmentClass = align === 'center'
    ? 'items-center text-center'
    : align === 'start'
      ? 'items-start'
      : 'lg:flex-row lg:items-center lg:justify-between';

  const buttonVariant: BackButtonVariant = backButtonVariant
    ? backButtonVariant
    : variant === 'gradient'
      ? 'dark'
      : 'light';

  const subtitleClass = variant === 'gradient' ? 'text-slate-800 font-medium' : 'text-slate-500';

  return (
    <header className={`rounded-2xl p-3 sm:p-4 ${baseClass} ${className}`}>
      <div className={`flex flex-col gap-4 ${alignmentClass}`}>
        <div className={`flex flex-col gap-4 ${align === 'between' ? 'lg:flex-row lg:items-center lg:gap-6' : ''}`}>
          <div className={`flex items-start gap-4 ${align === 'center' ? 'justify-center text-center' : ''}`}>
            {onBack && (
              <BackButton onClick={onBack} variant={buttonVariant} />
            )}
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold leading-snug">{title}</h1>
              {(subtitle || description) && (
                <p className={`text-sm sm:text-base ${subtitleClass}`}>
                  {subtitle || description}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className={`flex flex-wrap items-center gap-3 ${align === 'center' ? 'justify-center' : 'justify-start lg:justify-end'}`}>
              {actions}
            </div>
          )}
        </div>
        {children && (
          <div className="pt-2">
            {children}
          </div>
        )}
      </div>
    </header>
  );
};

export default PageHeader;
