import React from 'react';

const variants = {
  active  : 'bg-success/20 text-success border-success/30',
  vacated : 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  full    : 'bg-danger/20 text-danger border-danger/30',
  available:'bg-success/20 text-success border-success/30',
  paid    : 'bg-success/20 text-success border-success/30',
  pending : 'bg-warning/20 text-warning border-warning/30',
  partial : 'bg-brand-500/20 text-brand-400 border-brand-500/30',
  owner   : 'bg-brand-500/20 text-brand-400 border-brand-500/30',
  tenant  : 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  superadmin:'bg-purple-500/20 text-purple-400 border-purple-500/30',
  overdue   : 'bg-danger/20 text-danger border-danger/40 animate-pulse',
  verification_pending: 'bg-brand-500/20 text-brand-400 border-brand-500/30',
};

const dots = {
  active  : 'bg-success',
  vacated : 'bg-slate-400',
  full    : 'bg-danger',
  available:'bg-success',
  paid    : 'bg-success',
  pending : 'bg-warning',
  partial : 'bg-brand-400',
  owner   : 'bg-brand-400',
  tenant  : 'bg-slate-300',
  superadmin:'bg-purple-400',
  overdue   : 'bg-danger',
  verification_pending: 'bg-brand-400',
};

const labels = {
  active    : 'Active',
  vacated   : 'Vacated',
  full      : 'Full',
  available : 'Available',
  paid      : 'Paid',
  pending   : 'Pending',
  partial   : 'Partial',
  owner     : 'Owner',
  tenant    : 'Tenant',
  superadmin: 'Super Admin',
  overdue   : 'Overdue',
  verification_pending: 'Verifying',
};

const StatusBadge = ({ status, className = '' }) => {
  const key = (status || '').toLowerCase();
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
        ${variants[key] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dots[key] || 'bg-slate-400'}`} />
      {labels[key] || status}
    </span>
  );
};

export default StatusBadge;
