import React from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Building2,
  Users,
  CreditCard,
  ArrowRight,
  BarChart3,
  Bell,
  FileText,
  Lock,
  Zap,
  CheckCircle,
  ChevronRight,
  Star,
  Globe,
  MessageSquare,
  Wallet,
} from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <nav className="fixed top-0 w-full bg-white dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/" className="flex items-center gap-2.5" aria-label="Happy Renting Home">
                <img src="/main-app-icon.png" alt="" className="h-12 w-auto object-contain" />
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white hidden sm:inline">
                Happy<span className="text-brand-600 dark:text-brand-400">Renting</span>
              </span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                to="/login"
                className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg px-3 py-2"
              >
                Login
              </Link>
              <Link
                to="/request-access"
                className="bg-slate-900 hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-slate-900/10 dark:shadow-brand-500/20 hover:shadow-xl active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
              >
                Request Owner Access
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-500/5 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800/30 text-brand-700 dark:text-brand-300 text-xs font-semibold mb-8">
              <Zap className="w-3.5 h-3.5" />
              <span>Trusted by 500+ property owners across India</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.1] text-balance">
              Rental Management,{' '}
              <span className="bg-gradient-to-r from-brand-600 to-indigo-600 bg-clip-text text-transparent">
                Simplified
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              Happy Renting automates billing, rent collection, tenant communication, and financial reporting — so you can focus on growing your property business.
            </p>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link
                to="/request-access"
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-900/20 dark:shadow-white/10 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                Get Started as Owner
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-200 dark:border-slate-700 px-8 py-4 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                Tenant Portal Login
              </Link>
            </div>
          </div>

          {/* Role-based path selection — Enterprise Gateway pattern */}
          <div className="max-w-5xl mx-auto mb-20">
            <p className="text-center text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-6">
              I am a…
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <RoleCard
                icon={<Building2 className="w-6 h-6" />}
                title="Property Owner"
                description="Manage properties, track rent, verify payments, and communicate with tenants."
                link="/request-access"
                cta="Request Access"
              />
              <RoleCard
                icon={<Users className="w-6 h-6" />}
                title="Tenant"
                description="Pay rent, raise maintenance tickets, download receipts, and track your payment history."
                link="/login"
                cta="Login to Portal"
                highlighted
              />
              <RoleCard
                icon={<Shield className="w-6 h-6" />}
                title="Super Admin"
                description="Oversee all owners, manage users, audit logs, and configure system-wide settings."
                link="/login"
                cta="Admin Login"
              />
            </div>
          </div>

          {/* Trust metrics */}
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
            {[
              { value: '500+', label: 'Property Owners' },
              { value: '₹2Cr+', label: 'Rent Collected' },
              { value: '98.5%', label: 'On-Time Payments' },
              { value: '4.8/5', label: 'User Rating' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-1">{stat.value}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="py-12 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200/50 dark:border-slate-800/50 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-center items-center gap-10 md:gap-16 text-slate-500 dark:text-slate-400 font-medium">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
              <Lock className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <span className="text-sm font-semibold">SSL Encrypted</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-sm font-semibold">JWT Secured API</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-sm font-semibold">Instant Settlements</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-sm font-semibold">PAN India Support</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 text-xs font-bold mb-4 border border-brand-200 dark:border-brand-800/30">
              <Star className="w-3.5 h-3.5" />
              <span>Platform Capabilities</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
              Everything you need to run your rental business
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              A complete SaaS platform built for Indian property management.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6 text-brand-600" />}
              title="Rent Tracking & Analytics"
              description="Auto-generate monthly bills, calculate partial dues, apply waivers, and view real-time financial dashboards."
            />
            <FeatureCard
              icon={<CreditCard className="w-6 h-6 text-emerald-600" />}
              title="Verification & Wallet"
              description="Tenants upload payment proof. Owners verify with one click. Wallet logs track every transaction."
            />
            <FeatureCard
              icon={<MessageSquare className="w-6 h-6 text-indigo-600" />}
              title="Ticket-Based Complaints"
              description="Tenants raise maintenance tickets. Owners track progress with status timelines and automated alerts."
            />
            <FeatureCard
              icon={<Bell className="w-6 h-6 text-amber-600" />}
              title="Automated Notifications"
              description="WhatsApp and email reminders for due dates, payment confirmations, and complaint updates."
            />
            <FeatureCard
              icon={<FileText className="w-6 h-6 text-rose-600" />}
              title="PDF Receipts & Reports"
              description="Generate professional rent receipts and financial reports with a single click."
            />
            <FeatureCard
              icon={<Wallet className="w-6 h-6 text-cyan-600" />}
              title="Owner Wallet & Payouts"
              description="Track collected rent, request payouts, and view settlement history in real time."
            />
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-24 bg-slate-50 dark:bg-slate-900/50 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 text-xs font-bold mb-4 border border-brand-200 dark:border-brand-800/30">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Why Happy Renting</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight">
              A central source of truth for your properties
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              Ditch spreadsheets and manual follow-ups. Happy Renting gives every stakeholder — owner, tenant, and admin — a unified view of the rental lifecycle.
            </p>
            <div className="space-y-4">
              {[
                'Automated monthly billing on the 1st of every month',
                'Multi-property and multi-room support',
                'Role-based access control (Owner / Tenant / Super Admin)',
                'Full audit trail with transaction history',
                'Digital receipts with QR verification',
                'Overdue payment alerts and milestone emails',
              ].map((text) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300 font-medium text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-brand-700 dark:to-brand-900 rounded-3xl p-10 text-white relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                <Star className="w-7 h-7 text-amber-400" />
              </div>
              <p className="text-xl md:text-2xl font-bold mb-6 italic leading-relaxed">
                &ldquo;Happy Renting brings transparency and convenience to landlords and tenants across the region.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center font-bold text-sm">
                  HR
                </div>
                <div>
                  <p className="font-semibold">Happy Renting Platform</p>
                  <p className="text-xs text-white/60">Trust & Compliance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-brand-700 dark:to-brand-900 rounded-3xl p-12 md:p-16 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-full">
              <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
              <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-brand-400/10 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
                Ready to simplify your rental management?
              </h2>
              <p className="text-slate-300 text-lg mb-10 max-w-2xl mx-auto">
                Join 500+ property owners managing their rentals with Happy Renting. Get started free.
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <Link
                  to="/request-access"
                  className="w-full sm:w-auto bg-white text-slate-900 px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:bg-slate-100 hover:-translate-y-0.5 active:translate-y-0 shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-700"
                >
                  Get Started as Owner
                  <ChevronRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto bg-white/10 text-white border-2 border-white/20 px-8 py-4 rounded-xl font-bold hover:bg-white/20 transition-all hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Tenant Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-400 py-16 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 group" aria-label="Happy Renting Home">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 dark:bg-white/10 flex items-center justify-center">
                <img src="/main-app-icon.png" alt="" className="h-6 w-auto object-contain" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                Happy<span className="text-brand-400">Renting</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed max-w-xs text-slate-500">
              Modernizing the rental management lifecycle. Simple, secure, and completely automated.
            </p>
          </div>
          <div>
            <h3 className="text-white font-bold mb-5 text-sm uppercase tracking-widest">Platform</h3>
            <ul className="space-y-3 text-sm">
              <li><Link to="/login" className="hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1">Login</Link></li>
              <li><Link to="/request-access" className="hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1">Owner Access</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold mb-5 text-sm uppercase tracking-widest">Roles</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-brand-400" /> Owner</li>
              <li className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-emerald-400" /> Tenant</li>
              <li className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-indigo-400" /> Super Admin</li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold mb-5 text-sm uppercase tracking-widest">Contact</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="mailto:support@happyrenting.co.in" className="hover:text-white transition-colors flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1">
                  <MessageSquare className="w-3.5 h-3.5 text-brand-400" />
                  <span>support@happyrenting.co.in</span>
                </a>
              </li>
              <li>
                <a href="tel:+917204778319" className="hover:text-white transition-colors flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1">
                  <span>+91 7204778319</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-600">
          <p>© {new Date().getFullYear()} Happy Renting. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            <span>Made with care in India</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const RoleCard = ({ icon, title, description, link, cta, highlighted }) => (
  <Link
    to={link}
    className={`group p-6 rounded-2xl border-2 transition-all duration-200 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
      highlighted
        ? 'bg-slate-900 dark:bg-brand-600 border-slate-900 dark:border-brand-500 text-white hover:shadow-xl hover:shadow-slate-900/20 dark:hover:shadow-brand-500/20'
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:border-brand-400 dark:hover:border-brand-500 hover:shadow-lg'
    }`}
  >
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${
      highlighted
        ? 'bg-white/10 text-white'
        : 'bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 group-hover:bg-brand-50 dark:group-hover:bg-brand-950/50'
    }`}>
      {icon}
    </div>
    <h3 className={`text-lg font-bold mb-2 ${highlighted ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{title}</h3>
    <p className={`text-sm mb-4 leading-relaxed ${highlighted ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>{description}</p>
    <div className={`flex items-center gap-1.5 text-sm font-bold ${
      highlighted ? 'text-white' : 'text-brand-600 dark:text-brand-400'
    }`}>
      <span>{cta}</span>
      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
    </div>
  </Link>
);

const FeatureCard = ({ icon, title, description }) => (
  <div className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
      {icon}
    </div>
    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
  </div>
);

export default LandingPage;
