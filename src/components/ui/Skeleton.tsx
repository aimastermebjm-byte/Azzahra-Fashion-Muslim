import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-700/60 ${className}`} />
);

interface CardSkeletonProps {
  lines?: number;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ lines = 3 }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
    <Skeleton className="mb-4 h-5 w-2/3" />
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className="h-3 w-full" />
      ))}
    </div>
  </div>
);

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 4 }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-4 px-4 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((__, colIndex) => (
            <Skeleton key={colIndex} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

interface ListSkeletonProps {
  items?: number;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({ items = 4 }) => (
  <div className="space-y-3">
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="rounded-2xl border border-slate-100 bg-white p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-2 h-3 w-1/2" />
      </div>
    ))}
  </div>
);

export default Skeleton;
