import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => (
  <footer className="bg-slate-900 text-slate-400 py-16 px-4">
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-1">
          <Link to="/" className="flex items-center gap-2.5 group mb-4" aria-label="Happy Renting Home">
            <img src="/main-app-icon.png" alt="" className="h-8 w-auto object-contain" />
            <span className="text-lg font-bold tracking-tight text-white">Happy<span className="text-emerald-400">Renting</span></span>
          </Link>
          <p className="text-sm leading-relaxed text-slate-500 max-w-xs">Complete rental management platform for property owners and tenants.</p>
          <p className="text-xs text-slate-600 mt-4">support@happyrenting.co.in</p>
        </div>
        <div>
          <h3 className="text-white font-bold mb-4 text-xs uppercase tracking-widest">Product</h3>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/features" className="hover:text-white transition-colors">Features</Link></li>
            <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
            <li><span className="text-slate-500">Pricing (Coming Soon)</span></li>
            <li><a href="https://play.google.com/store/apps/details?id=co.in.happyrenting.tenant" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Download</a></li>
          </ul>
        </div>
        <div>
          <h3 className="text-white font-bold mb-4 text-xs uppercase tracking-widest">Support</h3>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            <li><Link to="/support" className="hover:text-white transition-colors">Support</Link></li>
            <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-white font-bold mb-4 text-xs uppercase tracking-widest">Legal</h3>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-white transition-colors">Terms &amp; Conditions</Link></li>
            <li><Link to="/refund" className="hover:text-white transition-colors">Refund Policy</Link></li>
            <li><Link to="/data-deletion" className="hover:text-white transition-colors">Data Deletion</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-white font-bold mb-4 text-xs uppercase tracking-widest">Contact</h3>
          <ul className="space-y-2.5 text-sm">
            <li><a href="mailto:support@happyrenting.co.in" className="hover:text-white transition-colors">support@happyrenting.co.in</a></li>
            <li><a href="https://happyrenting.netlify.app" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">happyrenting.netlify.app</a></li>
          </ul>
        </div>
      </div>
      <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-600">
        <p>&copy; {new Date().getFullYear()} Happy Renting. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link to="/data-deletion" className="hover:text-white transition-colors">Data Deletion</Link>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
