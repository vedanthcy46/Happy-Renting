import React from 'react';
import { Link } from 'react-router-dom';

const UnauthorizedPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface">
    <div className="text-center animate-fade-in max-w-md p-8">
      <div className="text-8xl mb-6">🔒</div>
      <h1 className="text-4xl font-bold text-white mb-3">403</h1>
      <h2 className="text-xl font-semibold text-danger mb-4">Access Denied</h2>
      <p className="text-slate-400 mb-8">
        You don't have permission to view this page. Please contact your administrator if you believe this is a mistake.
      </p>
      <Link to="/" className="btn-primary btn-lg">
        Return to Dashboard
      </Link>
    </div>
  </div>
);

export default UnauthorizedPage;
