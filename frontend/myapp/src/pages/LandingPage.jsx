import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Building2, Users, CreditCard, ArrowRight, BarChart3, Bell,
  FileText, Lock, CheckCircle, ChevronDown, Globe,
  Wallet, Home, Smartphone, Cloud, UserCheck, Eye, Fingerprint,
  Download, HelpCircle, Layers, Wrench, TrendingUp, X
} from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const LandingPage = () => {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar />

      {/* ── 1. HERO ── */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-400/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-blue-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-emerald-300/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-8">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Available on Android &bull; Secure Cloud Platform</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 leading-[1.1] text-balance">
              Complete Rental Management Platform for{' '}
              <span className="bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                Property Owners &amp; Tenants
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-500 max-w-3xl mx-auto mb-10 leading-relaxed">
              Manage rent collection, digital receipts, maintenance requests, payment reminders, tenant records, and property operations from anywhere.
            </p>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link to="/request-access" className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-900/20 hover:-translate-y-0.5 active:translate-y-0 text-base">
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="https://play.google.com/store/apps/details?id=com.happyrenting.app" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto bg-white text-slate-900 border-2 border-slate-200 px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all hover:-translate-y-0.5 active:translate-y-0 text-base">
                <Download className="w-5 h-5" />
                Download Android App
              </a>
            </div>

            <p className="text-sm text-slate-400 mt-4">Available on Android &bull; Secure Cloud Platform</p>
          </div>

          {/* Hero mockup */}
          <div className="max-w-5xl mx-auto mt-8">
            <div className="relative bg-gradient-to-b from-slate-900 to-slate-800 rounded-3xl p-2 shadow-2xl border border-slate-700/50">
              <div className="bg-slate-800/50 rounded-2xl p-4 flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <div className="text-xs text-slate-500 ml-2">Owner Dashboard &mdash; Happy Renting</div>
              </div>
              <div className="bg-white rounded-2xl p-6 md:p-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                    <div className="text-xs text-emerald-600 font-semibold mb-1">Total Properties</div>
                    <div className="text-2xl font-bold text-slate-900">12</div>
                  </div>
                  <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                    <div className="text-xs text-blue-600 font-semibold mb-1">Active Tenants</div>
                    <div className="text-2xl font-bold text-slate-900">48</div>
                  </div>
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                    <div className="text-xs text-amber-600 font-semibold mb-1">This Month</div>
                    <div className="text-2xl font-bold text-slate-900">₹1,85,000</div>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Recent Payments</span>
                    <span className="text-xs text-emerald-600 font-semibold">View All →</span>
                  </div>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">Room #{101 + i}</div>
                          <div className="text-xs text-slate-400">Tenant {String.fromCharCode(65 + i)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">₹{12000 + i * 500}</div>
                        <div className="text-xs text-emerald-600">Paid</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. TRUST BAR ── */}
      <section className="py-10 bg-white border-y border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10 text-slate-500">
            {[
              { icon: <Lock className="w-4 h-4 text-emerald-600" />, label: 'Secure Payments' },
              { icon: <Cloud className="w-4 h-4 text-emerald-600" />, label: 'Cloud Backup' },
              { icon: <FileText className="w-4 h-4 text-emerald-600" />, label: 'Digital Receipts' },
              { icon: <Bell className="w-4 h-4 text-emerald-600" />, label: 'Real-time Notifications' },
              { icon: <Building2 className="w-4 h-4 text-emerald-600" />, label: 'Multi Property Support' },
              { icon: <Smartphone className="w-4 h-4 text-emerald-600" />, label: 'Tenant Mobile App' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">{item.icon}</div>
                <span className="text-sm font-semibold text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. PRODUCT PREVIEW ── */}
      <section id="screenshots" className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-4 border border-emerald-200">
            <Eye className="w-3.5 h-3.5" />
            <span>Product Preview</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Real Screenshots from the App</h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">Every interface shown here is a live view from Happy Renting.</p>
        </div>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: 'Owner Dashboard', desc: 'Overview of properties, payments, and pending tasks', color: 'emerald' },
            { title: 'Tenant Dashboard', desc: 'View bills, make payments, and track history', color: 'blue' },
            { title: 'Payment Ledger', desc: 'Complete rent collection history with filters', color: 'emerald' },
            { title: 'Maintenance Screen', desc: 'Raise and track complaint status', color: 'amber' },
            { title: 'Notifications', desc: 'Real-time alerts for payments and updates', color: 'blue' },
            { title: 'Profile & Settings', desc: 'Manage account and notification preferences', color: 'emerald' },
          ].map((item) => (
            <div key={item.title} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
              <div className={`bg-${item.color}-50 p-6 h-48 flex items-center justify-center border-b border-slate-100`}>
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center">
                  {item.color === 'emerald' && <BarChart3 className="w-8 h-8 text-emerald-600" />}
                  {item.color === 'blue' && <Home className="w-8 h-8 text-blue-600" />}
                  {item.color === 'amber' && <Wrench className="w-8 h-8 text-amber-600" />}
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-slate-900 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. PROBLEM SECTION ── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Rental Management, Reimagined</h2>
            <p className="text-slate-500 text-lg">Stop juggling spreadsheets and WhatsApp. Get a proper system.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-red-50 rounded-3xl p-8 border border-red-100">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><X className="w-4 h-4 text-red-500" /></div>
                <h3 className="text-lg font-bold text-red-800">Without Happy Renting</h3>
              </div>
              <ul className="space-y-4">
                {[
                  'Manual rent tracking in spreadsheets',
                  'Missed payments and late follow-ups',
                  'WhatsApp group confusion and lost messages',
                  'Paper receipts that get lost',
                  'No central tenant record keeping',
                ].map((text) => (
                  <li key={text} className="flex items-center gap-3 text-red-700">
                    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0"><X className="w-3 h-3 text-red-500" /></div>
                    <span className="text-sm font-medium">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-emerald-50 rounded-3xl p-8 border border-emerald-100">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle className="w-4 h-4 text-emerald-600" /></div>
                <h3 className="text-lg font-bold text-emerald-800">With Happy Renting</h3>
              </div>
              <ul className="space-y-4">
                {[
                  'Automatic rent generation on the 1st',
                  'Digital payment history with status tracking',
                  'Online complaint system with updates',
                  'Instant push and email notifications',
                  'Downloadable reports and receipts',
                ].map((text) => (
                  <li key={text} className="flex items-center gap-3 text-emerald-700">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0"><CheckCircle className="w-3 h-3 text-emerald-600" /></div>
                    <span className="text-sm font-medium">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. FEATURE GRID ── */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-4 border border-emerald-200">
              <Layers className="w-3.5 h-3.5" />
              <span>Everything You Need</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Features built for Indian property management</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Building2 className="w-6 h-6 text-emerald-600" />, title: 'Property Management', desc: 'Add unlimited properties, buildings, and rooms with full details.' },
              { icon: <Users className="w-6 h-6 text-blue-600" />, title: 'Tenant Management', desc: 'Maintain complete tenant history with documents and contact info.' },
              { icon: <CreditCard className="w-6 h-6 text-emerald-600" />, title: 'Rent Collection', desc: 'Track rent status with a clear payment ledger and due alerts.' },
              { icon: <FileText className="w-6 h-6 text-blue-600" />, title: 'Digital Receipts', desc: 'Generate professional PDF receipts instantly with QR verification.' },
              { icon: <Bell className="w-6 h-6 text-emerald-600" />, title: 'Notifications', desc: 'Automatic reminders and updates for both owners and tenants.' },
              { icon: <Wrench className="w-6 h-6 text-blue-600" />, title: 'Maintenance', desc: 'Complaint management with priority levels and status tracking.' },
              { icon: <BarChart3 className="w-6 h-6 text-emerald-600" />, title: 'Reports', desc: 'Monthly income, occupancy, and payment insights at a glance.' },
              { icon: <Smartphone className="w-6 h-6 text-blue-600" />, title: 'Tenant App', desc: 'Dedicated Android app for tenants to pay and raise requests.' },
              { icon: <Wallet className="w-6 h-6 text-emerald-600" />, title: 'Owner Wallet', desc: 'Track collected rent and request payouts with full history.' },
            ].map((feat) => (
              <FeatureCard key={feat.title} icon={feat.icon} title={feat.title} desc={feat.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. HOW IT WORKS ── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-4 border border-emerald-200">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>How It Works</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Get started in minutes</h2>
          <p className="text-slate-500 text-lg">Six simple steps to go from zero to fully managed.</p>
        </div>
        <div className="max-w-5xl mx-auto">
          {[
            { step: '01', title: 'Register', desc: 'Create your owner account with your email and phone.' },
            { step: '02', title: 'Create Property', desc: 'Add your property with name, address, and city details.' },
            { step: '03', title: 'Add Rooms', desc: 'Define rooms with rent amount, floor, and security deposit.' },
            { step: '04', title: 'Add Tenants', desc: 'Register tenants with their details and move-in date.' },
            { step: '05', title: 'Generate Monthly Rent', desc: 'Rent is auto-generated on the 1st of every month.' },
            { step: '06', title: 'Receive Payments', desc: 'Track payments via ledger. Tenants pay through the app.' },
          ].map((item, i) => (
            <div key={item.step} className="flex items-start gap-6 mb-8 last:mb-0">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {item.step}
                </div>
                {i < 5 && <div className="w-0.5 h-10 bg-slate-200 mt-2" />}
              </div>
              <div className="pt-2">
                <h3 className="text-lg font-bold text-slate-900 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 7. SCREENSHOTS CAROUSEL (simplified) ── */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">App Screens</h2>
          <p className="text-slate-500 text-lg">Mobile app designed for tenants to manage everything on the go.</p>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { name: 'Dashboard', icon: <Home className="w-6 h-6" /> },
            { name: 'Rent Ledger', icon: <FileText className="w-6 h-6" /> },
            { name: 'Profile', icon: <UserCheck className="w-6 h-6" /> },
            { name: 'Notifications', icon: <Bell className="w-6 h-6" /> },
            { name: 'Complaint', icon: <Wrench className="w-6 h-6" /> },
            { name: 'Login', icon: <Shield className="w-6 h-6" /> },
          ].map((item) => (
            <div key={item.name} className="bg-white rounded-2xl border border-slate-200 p-5 text-center hover:shadow-md hover:-translate-y-1 transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">{item.icon}</div>
              <div className="text-xs font-semibold text-slate-600">{item.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 8. SECURITY SECTION ── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-4 border border-emerald-200">
            <Shield className="w-3.5 h-3.5" />
            <span>Security First</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Your data is protected</h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">Happy Renting uses modern security practices to keep your information safe.</p>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: <Lock className="w-5 h-5" />, title: 'Encrypted Connections', desc: 'All data transmitted over HTTPS with TLS encryption.' },
            { icon: <Shield className="w-5 h-5" />, title: 'Secure Authentication', desc: 'JWT tokens with bcrypt password hashing (12 rounds).' },
            { icon: <Cloud className="w-5 h-5" />, title: 'Cloud Backup', desc: 'Data stored securely on MongoDB Atlas with automated backups.' },
            { icon: <Users className="w-5 h-5" />, title: 'Role-based Access', desc: 'Granular permissions for Owner, Tenant, and Admin roles.' },
            { icon: <Fingerprint className="w-5 h-5" />, title: 'Audit Logs', desc: 'Every action is logged with IP and timestamp for accountability.' },
            { icon: <Eye className="w-5 h-5" />, title: 'Privacy Protection', desc: 'Your data is never sold. Biometric data stays on your device.' },
          ].map((item) => (
            <div key={item.title} className="bg-slate-50 rounded-2xl p-6 border border-slate-200 hover:shadow-md transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">{item.icon}</div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">{item.title}</h3>
              <p className="text-sm text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 9. PLATFORM SUPPORT ── */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-8 tracking-tight">Available On</h2>
          <div className="flex flex-wrap justify-center items-center gap-8">
            {[
              { icon: <Smartphone className="w-6 h-6" />, name: 'Android', status: 'Available Now' },
              { icon: <Globe className="w-6 h-6" />, name: 'Responsive Web', status: 'Available Now' },
              { icon: <Monitor className="w-6 h-6" />, name: 'Tablet', status: 'Available Now' },
              { icon: <Smartphone className="w-6 h-6" />, name: 'iOS', status: 'Coming Soon' },
              { icon: <Monitor className="w-6 h-6" />, name: 'Desktop', status: 'Coming Soon' },
            ].map((item) => (
              <div key={item.name} className="bg-white rounded-2xl px-6 py-5 border border-slate-200 text-center min-w-[130px] hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-2">{item.icon}</div>
                <div className="text-sm font-bold text-slate-900">{item.name}</div>
                <div className={`text-xs font-semibold mt-1 ${item.status === 'Available Now' ? 'text-emerald-600' : 'text-slate-400'}`}>{item.status}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 10. FAQ ── */}
      <section id="faq" className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-4 border border-emerald-200">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>FAQ</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {[
              { q: 'How do I pay rent?', a: 'Tenants can pay rent through the Android app. Payments can be made via online gateway (UPI, cards, net banking) or by uploading a payment proof screenshot for owner verification.' },
              { q: 'Can multiple owners use it?', a: 'Yes. Happy Renting supports multiple property owners with complete data isolation. Each owner sees only their own properties, tenants, and payments.' },
              { q: 'Can I manage multiple properties?', a: 'Absolutely. You can add unlimited properties, buildings, and rooms under a single account. Each property has its own tenant list and payment tracking.' },
              { q: 'Can I download receipts?', a: 'Yes. Digital receipts are generated as professional PDFs with QR verification codes. They can be downloaded or shared anytime from the payment history.' },
              { q: 'Is internet required?', a: 'Yes, an active internet connection is required to use the platform. The mobile app and web portal sync data in real-time from the cloud.' },
              { q: 'How are rent bills generated?', a: 'Rent is auto-generated on the 1st of every month based on each tenant\'s agreed amount. You can also generate bills manually if needed.' },
            ].map((item, i) => (
              <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors">
                  <span className="font-semibold text-slate-900 text-sm">{item.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-4">{item.a}</div>
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/faq" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">View all FAQs →</Link>
          </div>
        </div>
      </section>

      {/* ── 11. CTA ── */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-12 md:p-16 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">Ready to simplify property management?</h2>
              <p className="text-slate-300 text-lg mb-10 max-w-xl mx-auto">Join property owners who have digitized their rental operations with Happy Renting.</p>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <Link to="/request-access" className="w-full sm:w-auto bg-white text-slate-900 px-8 py-4 rounded-2xl font-bold hover:bg-slate-100 transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-xl flex items-center justify-center gap-2">
                  Get Started
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a href="https://play.google.com/store/apps/details?id=com.happyrenting.app" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto bg-white/10 text-white border-2 border-white/20 px-8 py-4 rounded-2xl font-bold hover:bg-white/20 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2">
                  <Download className="w-5 h-5" />
                  Download App
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }) => (
  <div className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-emerald-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
      {icon}
    </div>
    <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
  </div>
);

const Monitor = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

export default LandingPage;
