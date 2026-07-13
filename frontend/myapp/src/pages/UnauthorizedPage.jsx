import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

const UnauthorizedPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface">
    <div className="text-center animate-fade-in max-w-md p-8">
      <div className="w-20 h-20 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-6">
        <ShieldAlert className="w-10 h-10 text-danger" />
      </div>
      <h1 className="text-6xl font-bold text-white mb-2">403</h1>
      <h2 className="text-xl font-semibold text-danger mb-4">Access Denied</h2>
      <p className="text-slate-400 mb-8">
        You don\u2019t have permission to view this page. Please contact your administrator if you believe this is a mistake.
      </p>
      <Link to="/" className="btn-primary btn-lg">
        Return to Dashboard
      </Link>
    </div>
  </div>
);

export default UnauthorizedPage;
