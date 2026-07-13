import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Menu } from 'lucide-react';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/50 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Happy Renting Home">
            <img src="/main-app-icon.png" alt="" className="h-10 w-auto object-contain" />
            <span className="text-lg font-bold tracking-tight text-slate-900 hidden sm:inline">
              Happy<span className="text-emerald-600">Renting</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/features" className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">Features</Link>
            <Link to="/faq" className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">FAQ</Link>
            <Link to="/contact" className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">Contact</Link>
            <Link to="/support" className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">Support</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-emerald-600 transition-colors px-3 py-2">Login</Link>
            <Link to="/request-access" className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl active:scale-[0.97]">
              Get Started
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
          <Link to="/features" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-slate-600 py-2">Features</Link>
          <Link to="/faq" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-slate-600 py-2">FAQ</Link>
          <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-slate-600 py-2">Contact</Link>
          <Link to="/support" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-slate-600 py-2">Support</Link>
          <Link to="/request-access" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold">Get Started</Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
