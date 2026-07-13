import React from 'react';
import { Shield, CheckCircle } from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const AboutPage = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
    <Navbar />
    <section className="pt-32 pb-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">About Happy Renting</h1>
          <p className="text-lg text-slate-500">Modernizing rental management in India.</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-12 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Our Mission</h2>
          <p className="text-slate-600 leading-relaxed mb-6">
            Happy Renting was built to solve a simple problem: rental management in India is
            still largely manual, paper-based, and fragmented. Property owners rely on
            spreadsheets and WhatsApp groups. Tenants struggle to track payments and get
            receipts. Maintenance requests get lost in chat messages.
          </p>
          <p className="text-slate-600 leading-relaxed mb-6">
            We set out to build a platform that brings transparency, automation, and
            simplicity to the rental lifecycle. Whether you own one property or a hundred,
            Happy Renting gives you the tools to manage everything from a single dashboard.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Our Android app empowers tenants to view bills, make payments, raise complaints,
            and download receipts &mdash; all from their phone.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-12 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">What We Believe</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { title: 'Transparency', desc: 'Every payment, complaint, and action is logged and visible to the right stakeholders.' },
              { title: 'Automation', desc: 'Rent generation, notifications, and receipts should happen automatically &mdash; no manual work.' },
              { title: 'Security', desc: 'Your data is encrypted, access is controlled, and we never sell your information.' },
              { title: 'Simplicity', desc: 'The platform is designed to be intuitive for both tech-savvy users and first-time users.' },
            ].map((item) => (
              <div key={item.title} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Security &amp; Compliance</h2>
          <div className="space-y-4">
            {[
              'All data transmitted over HTTPS with TLS encryption',
              'Passwords hashed using bcrypt with 12 salt rounds',
              'JWT-based authentication with 7-day token expiry',
              'Role-based access control (Super Admin / Owner / Tenant)',
              'Payment processing via Cashfree (PCI-DSS compliant)',
              'Data stored on MongoDB Atlas with automated backups',
              'Biometric data (Face ID / Fingerprint) never leaves your device',
              'Full audit logging with IP addresses and timestamps',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-slate-600">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
    <Footer />
  </div>
);

export default AboutPage;
