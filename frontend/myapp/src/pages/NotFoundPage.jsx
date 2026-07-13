import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';

const NotFoundPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface">
    <div className="text-center animate-fade-in max-w-md p-8">
      <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-6">
        <MapPin className="w-10 h-10 text-slate-500" />
      </div>
      <h1 className="text-6xl font-bold text-white mb-2">404</h1>
      <h2 className="text-xl font-semibold text-slate-300 mb-4">Page Not Found</h2>
      <p className="text-slate-400 mb-8">
        The page you\u2019re looking for doesn\u2019t exist or has been moved.
      </p>
      <Link to="/" className="btn-primary btn-lg">
        Return to Dashboard
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
