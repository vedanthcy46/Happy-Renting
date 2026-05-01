import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface">
    <div className="text-center animate-fade-in max-w-md p-8">
      <div className="text-8xl mb-6">🗺️</div>
      <h1 className="text-6xl font-bold text-white mb-3">404</h1>
      <h2 className="text-xl font-semibold text-slate-300 mb-4">Page Not Found</h2>
      <p className="text-slate-400 mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="btn-primary btn-lg">
        Return to Dashboard
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
