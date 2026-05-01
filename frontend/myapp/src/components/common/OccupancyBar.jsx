import React from 'react';

/**
 * OccupancyBar
 * Visual bar showing current / capacity (e.g. 2/3)
 */
const OccupancyBar = ({ current, capacity, showLabel = true, className = '' }) => {
  const pct = capacity > 0 ? Math.min((current / capacity) * 100, 100) : 0;
  const isFull = current >= capacity;

  const barColor = isFull
    ? 'bg-danger'
    : pct >= 75
    ? 'bg-warning'
    : 'bg-success';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-semibold tabular-nums ${isFull ? 'text-danger' : 'text-slate-300'}`}>
          {current}/{capacity}
        </span>
      )}
    </div>
  );
};

export default OccupancyBar;
