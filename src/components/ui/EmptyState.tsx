import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

const DefaultIcon = () => (
  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 7h18" strokeLinecap="round" />
      <path d="M5 11h14v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7Z" />
      <path d="M9 11v-4a3 3 0 0 1 6 0v4" />
    </svg>
  </div>
);

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
  compact = false
}) => {
  return (
    <div className={`flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white/80 p-8 text-center shadow-sm ${className}`}>
      <div className="mb-4">{icon || <DefaultIcon />}</div>
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      )}
      {action && (
        <div className={`mt-4 ${compact ? 'w-full' : ''}`}>
          {action}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
