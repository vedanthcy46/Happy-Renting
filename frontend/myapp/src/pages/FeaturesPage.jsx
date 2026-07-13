import React from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Users, CreditCard, FileText, Bell, Wrench, BarChart3,
  Smartphone, Wallet, Shield, CheckCircle, ArrowRight
} from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const features = [
  {
    icon: <Building2 className="w-6 h-6 text-emerald-600" />,
    title: 'Property Management',
    desc: 'Add unlimited properties, buildings, and rooms. Each property maintains its own address, city details, and rent structure.',
    details: ['Add multiple properties under one account', 'Organize rooms by floor and building', 'Set individual rent amounts and deposits'],
  },
  {
    icon: <Users className="w-6 h-6 text-blue-600" />,
    title: 'Tenant Management',
    desc: 'Maintain complete digital records for every tenant. Track move-in dates, documents, and communication history.',
    details: ['Digital tenant profiles with ID proofs', 'Co-occupant management', 'Full tenancy history from move-in to exit'],
  },
  {
    icon: <CreditCard className="w-6 h-6 text-emerald-600" />,
    title: 'Rent Collection',
    desc: 'Automated monthly billing with a clear payment ledger. Tenants can pay via online gateway or upload proof for manual verification.',
    details: ['Auto-generated rent on the 1st of each month', 'Online payment via UPI, cards, and net banking', 'Manual payment proof upload with owner verification'],
  },
  {
    icon: <FileText className="w-6 h-6 text-blue-600" />,
    title: 'Digital Receipts',
    desc: 'Generate professional PDF receipts instantly after payment confirmation. Each receipt includes a QR code for verification.',
    details: ['One-click PDF generation', 'QR code verification on receipts', 'Download or share anytime'],
  },
  {
    icon: <Bell className="w-6 h-6 text-emerald-600" />,
    title: 'Notifications',
    desc: 'Automatic push notifications and email alerts for rent due dates, payment confirmations, complaint updates, and overdue reminders.',
    details: ['Push notifications on Android app', 'Email alerts for owners and tenants', 'Customizable notification preferences'],
  },
  {
    icon: <Wrench className="w-6 h-6 text-blue-600" />,
    title: 'Maintenance & Complaints',
    desc: 'Tenants can raise maintenance tickets with images. Owners track progress with priority levels and status updates.',
    details: ['Ticket-based complaint system', 'Image uploads for issues', 'Priority levels and status tracking'],
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-emerald-600" />,
    title: 'Reports & Insights',
    desc: 'Monthly income reports, occupancy insights, and payment trend analysis to help you understand your rental business.',
    details: ['Monthly collection summaries', 'Occupancy rate tracking', 'Payment status overview'],
  },
  {
    icon: <Smartphone className="w-6 h-6 text-blue-600" />,
    title: 'Tenant Android App',
    desc: 'A dedicated app for tenants to view bills, make payments, raise complaints, and track their rental history.',
    details: ['View rent bills and payment history', 'Raise and track complaints', 'Download receipts'],
  },
  {
    icon: <Wallet className="w-6 h-6 text-emerald-600" />,
    title: 'Owner Wallet & Payouts',
    desc: 'Track collected rent in your wallet and request payouts. Full settlement history with transaction records.',
    details: ['Real-time wallet balance', 'Request payouts to bank or UPI', 'Complete settlement audit trail'],
  },
  {
    icon: <Shield className="w-6 h-6 text-blue-600" />,
    title: 'Role-Based Access',
    desc: 'Three-tier access control: Super Admin, Owner, and Tenant. Each role sees only what they need.',
    details: ['Super Admin: system-wide oversight', 'Owner: own properties and tenants', 'Tenant: personal dashboard and payments'],
  },
];

const FeaturesPage = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
    <Navbar />
    <section className="pt-32 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">All Features</h1>
          <p className="text-lg text-slate-500">Everything you need to manage your rental properties efficiently.</p>
        </div>
        <div className="space-y-12">
          {features.map((f, i) => (
            <div key={f.title} className="bg-white rounded-3xl border border-slate-200 p-8 md:p-10 hover:shadow-lg transition-all">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">{f.icon}</div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">{f.title}</h2>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
                <div className="md:col-span-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Key Capabilities</h3>
                  <ul className="space-y-3">
                    {f.details.map((d) => (
                      <li key={d} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <span className="text-sm text-slate-700">{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <Link to="/request-access" className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-xl hover:-translate-y-0.5 active:translate-y-0">
            Get Started
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
    <Footer />
  </div>
);

export default FeaturesPage;
