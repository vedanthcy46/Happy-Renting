import React from 'react';
import { useAuth } from '../../context/AuthContext';

/**
 * Banner shown to Free-plan owners when they reach a plan limit on the web.
 * Upgrades are only available in the mobile app, so we direct them there.
 */
const PlanLimitBanner = ({ used, limit, resource, show }) => {
  const { isOwner } = useAuth();
  if (!isOwner || !show) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/15 text-amber-400 text-xl shrink-0">
          ⭐
        </div>
        <div>
          <p className="font-semibold text-white">
            You've reached the Free plan limit for {resource}.
          </p>
          <p className="text-sm text-slate-400 mt-0.5">
            {used} of {limit} {resource} used. Upgrade to Premium from the{' '}
            <span className="font-semibold text-brand-400">Happy Renting mobile app</span>{' '}
            to add unlimited {resource}.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlanLimitBanner;
