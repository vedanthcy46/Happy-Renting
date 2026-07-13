import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  BarChart3, 
  CreditCard, 
  MessageSquare, 
  ArrowRight, 
  Lock, 
  Zap, 
  Sparkles, 
  Building2, 
  CheckCircle2
} from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* --- Navigation --- */}
      <nav className="fixed top-0 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img 
                src="/web-landscape-logo.png" 
                alt="Happy Renting Logo" 
                className="h-12 w-auto object-contain"
                onError={(e) => {
                  // Fallback if logo fails to load
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white hidden">
                Happy Renting
              </span>
            </div>

            {/* Nav Actions */}
            <div className="flex items-center gap-6">
              <Link 
                to="/login" 
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Login
              </Link>
              <Link
                to="/request-access"
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95"
              >
                Request Owner Access
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* --- Hero Section --- */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto text-center relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/30 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-6 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Gen Rental Management System</span>
          </div>

          {/* Heading */}
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.15]">
            Modern Rental Operations <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Built for SaaS Trust
            </span>
          </h1>

          {/* Description */}
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Happy Renting automates billing, simplifies tenant management, and secures rent collection. 
            Enjoy seamless settlements, digital receipts, and real-time maintenance tracking.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-16">
            <Link
              to="/request-access"
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/10 hover:translate-y-[-2px] active:translate-y-0"
            >
              Get Started as Owner
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 px-8 py-4 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all hover:translate-y-[-2px] active:translate-y-0"
            >
              Member Login
            </Link>
          </div>

          {/* App Screen Mockup */}
          <div className="max-w-5xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xl shadow-slate-500/10 dark:shadow-black/50">
            <div className="rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 md:p-10 flex flex-col md:flex-row items-center gap-8 text-left">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-blue-600 mb-4 font-bold text-sm tracking-wide uppercase">
                  <Building2 className="w-4 h-4" />
                  <span>SaaS Management Dashboard</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight">
                  Track occupancy, due dates, and wallet payouts instantly
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                  Ditch spreadsheets. Our automated system calculates balances, generates PDFs, 
                  handles cashfree payments, and distributes notifications to tenants via WhatsApp and email.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                    <span className="text-2xl font-bold text-blue-600">₹0</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pending Dues</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                    <span className="text-2xl font-bold text-emerald-500">100%</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Rent Verified</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 w-full flex justify-center">
                <img 
                  src="/web-landscape-logo.png" 
                  alt="SaaS Platform Branding" 
                  className="max-w-[280px] w-full object-contain opacity-90 filter drop-shadow-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Trust Indicators (SaaS Trust badges) --- */}
      <section className="py-12 bg-white dark:bg-slate-900 border-y border-slate-200/50 dark:border-slate-800/50 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-center items-center gap-10 md:gap-20 text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <span className="text-sm uppercase tracking-wider text-slate-600 dark:text-slate-400">SSL Encrypted Payments</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-500" />
            <span className="text-sm uppercase tracking-wider text-slate-600 dark:text-slate-400">JWT Authenticated API</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <span className="text-sm uppercase tracking-wider text-slate-600 dark:text-slate-400">Instant Settlements</span>
          </div>
        </div>
      </section>

      {/* --- Features Grid Section --- */}
      <section className="py-24 bg-slate-50 dark:bg-slate-950 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
              Powerful Features for Seamless Management
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Designed from the ground up to support modern property owners, superadmins, and tenants.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6 text-blue-600" />}
              title="Rent Tracking & Analytics"
              description="Automatically generate monthly bills on the 1st, calculate partial dues, apply waivers, and view financial graphs."
            />
            <FeatureCard
              icon={<CreditCard className="w-6 h-6 text-emerald-500" />}
              title="Verification & Wallet"
              description="Tenants upload payment proof images. Owners verify with one click. Automatic wallet logs track every single transaction."
            />
            <FeatureCard
              icon={<MessageSquare className="w-6 h-6 text-indigo-500" />}
              title="Ticket-Based Complaints"
              description="Tenants raise maintenance tickets. Owners update progress on a clean status timeline with automated alerts."
            />
          </div>
        </div>
      </section>

      {/* --- Value Proposition Section --- */}
      <section className="py-24 bg-white dark:bg-slate-900 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold mb-4 border border-blue-100 dark:border-blue-800/30">
              Reliable Solutions
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight">
              A Complete Central Repository of Rental Truth
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
              Happy Renting simplifies daily property admin work. With built-in database validations,
              custom role permissions, and full transaction history audit trails, we deliver commercial-grade safety.
            </p>
            <div className="space-y-4">
              <CheckItem text="Automated Overdue Cadence Alerts" />
              <CheckItem text="Multi-Property & Multi-Room Support" />
              <CheckItem text="PDF Receipt Generation & Sharing" />
            </div>
          </div>
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-3xl p-10 text-white relative overflow-hidden shadow-xl shadow-blue-500/20">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <Shield className="w-14 h-14 mb-6 opacity-90" />
              <p className="text-xl md:text-2xl font-bold mb-6 italic leading-relaxed">
                "Happy Renting brings transparency and convenience to landlords and tenants across the region."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">HR</div>
                <div>
                  <p className="font-semibold">Happy Renting Platform</p>
                  <p className="text-xs opacity-75">Trust & Compliance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="bg-slate-900 text-slate-400 py-16 px-4 border-t border-slate-850">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <img 
                src="/web-landscape-logo.png" 
                alt="Happy Renting" 
                className="h-9 w-auto object-contain brightness-0 invert"
              />
            </div>
            <p className="text-sm leading-relaxed max-w-sm">
              Modernizing the rental management lifecycle. Simple, secure, and completely automated.
            </p>
          </div>
          <div>
            <h3 className="text-white font-bold mb-5 text-sm uppercase tracking-widest">Platform Links</h3>
            <ul className="space-y-3 text-sm">
              <li><Link to="/login" className="hover:text-white transition-colors">Login to Portal</Link></li>
              <li><Link to="/request-access" className="hover:text-white transition-colors">Apply for Owner Access</Link></li>
              <li><Link to="/request-access" className="hover:text-white transition-colors">Platform FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold mb-5 text-sm uppercase tracking-widest">Support Contact</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="mailto:support@happyrenting.co.in" className="hover:text-white transition-colors flex items-center gap-2">
                  <span>support@happyrenting.co.in</span>
                </a>
              </li>
              <li>
                <a href="tel:+917204778319" className="hover:text-white transition-colors">
                  +91 7204778319
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Happy Renting. All rights reserved. Made with ❤️ in India.
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }) => (
  <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 hover:shadow-lg hover:shadow-slate-500/5 dark:hover:shadow-black/30 hover:-translate-y-1 transition-all duration-300">
    <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-850 flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-800">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">{title}</h3>
    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">{description}</p>
  </div>
);

const CheckItem = ({ text }) => (
  <div className="flex items-center gap-3">
    <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
    <span className="text-slate-700 dark:text-slate-350 font-medium text-sm">{text}</span>
  </div>
);

export default LandingPage;
