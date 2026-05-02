import React from 'react';

const Skeleton = ({ className }) => {
  return (
    <div 
      className={`animate-pulse bg-slate-200/50 rounded ${className}`} 
      aria-hidden="true"
    />
  );
};

export default Skeleton;
