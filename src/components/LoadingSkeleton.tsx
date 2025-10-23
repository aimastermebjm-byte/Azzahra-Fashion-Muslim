import React from 'react';

export const ProductTableSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm p-4">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
      <div className="flex space-x-2">
        <div className="h-10 bg-gray-200 rounded w-64 animate-pulse"></div>
        <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
        <div className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
      </div>
    </div>

    {/* Table Header */}
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
      <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200">
        <div className="col-span-1 h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="col-span-4 h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="col-span-2 h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="col-span-2 h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="col-span-1 h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="col-span-1 h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="col-span-1 h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>

      {/* Skeleton Rows */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 hover:bg-gray-50">
          <div className="col-span-1 h-4 bg-gray-100 rounded animate-pulse"></div>
          <div className="col-span-4">
            <div className="h-4 bg-gray-100 rounded w-3/4 mb-2 animate-pulse"></div>
            <div className="h-3 bg-gray-50 rounded w-1/2 animate-pulse"></div>
          </div>
          <div className="col-span-2 h-4 bg-gray-100 rounded animate-pulse"></div>
          <div className="col-span-2 h-4 bg-gray-100 rounded animate-pulse"></div>
          <div className="col-span-1 h-4 bg-gray-100 rounded animate-pulse"></div>
          <div className="col-span-1 h-4 bg-gray-100 rounded animate-pulse"></div>
          <div className="col-span-1 h-8 bg-gray-100 rounded animate-pulse"></div>
        </div>
      ))}
    </div>

    {/* Pagination Skeleton */}
    <div className="flex items-center justify-between">
      <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
      <div className="flex space-x-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
        ))}
      </div>
    </div>
  </div>
);

export const FlashSaleStatusSkeleton = () => (
  <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg p-4 mb-4">
    <div className="flex items-center justify-between mb-2">
      <div className="h-6 bg-red-200 rounded w-32 animate-pulse"></div>
      <div className="h-4 bg-red-200 rounded w-24 animate-pulse"></div>
    </div>
    <div className="flex items-center space-x-4">
      <div className="h-6 bg-red-200 rounded w-48 animate-pulse"></div>
      <div className="h-8 bg-red-300 rounded w-24 animate-pulse"></div>
    </div>
  </div>
);

export const MenuSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
    <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-gray-100 rounded-lg p-4 flex items-center space-x-3">
          <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-24 mb-1 animate-pulse"></div>
            <div className="h-3 bg-gray-100 rounded w-32 animate-pulse"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);