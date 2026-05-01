import React from 'react';

const sizes = {
  sm : 'w-4 h-4 border-2',
  md : 'w-8 h-8 border-2',
  lg : 'w-12 h-12 border-4',
  xl : 'w-16 h-16 border-4',
};

const LoadingSpinner = ({ size = 'md', className = '', label = 'Loading…' }) => (
  <div
    role="status"
    aria-label={label}
    className={`inline-flex flex-col items-center justify-center gap-3 ${className}`}
  >
    <div
      className={`${sizes[size]} rounded-full border-brand-500 border-t-transparent animate-spin`}
    />
    {size !== 'sm' && (
      <span className="text-slate-400 text-sm">{label}</span>
    )}
  </div>
);

export default LoadingSpinner;
