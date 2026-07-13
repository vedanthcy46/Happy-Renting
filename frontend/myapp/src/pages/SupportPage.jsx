import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, HelpCircle, FileText, ArrowRight, BookOpen, Shield, Smartphone } from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const SupportPage = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
    <Navbar />
    <section className="pt-32 pb-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">Support</h1>
          <p className="text-lg text-slate-500">We are here to help you get the most out of Happy Renting.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Link to="/faq" className="bg-white rounded-3xl border border-slate-200 p-8 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">FAQ / Help Center</h2>
            <p className="text-sm text-slate-500 mb-4">Browse frequently asked questions and guides.</p>
            <span className="text-sm font-semibold text-emerald-600 group-hover:text-emerald-700 flex items-center gap-1">
              View FAQs <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link to="/contact" className="bg-white rounded-3xl border border-slate-200 p-8 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Mail className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Contact Us</h2>
            <p className="text-sm text-slate-500 mb-4">Send us a message and we will get back to you within 24 hours.</p>
            <span className="text-sm font-semibold text-emerald-600 group-hover:text-emerald-700 flex items-center gap-1">
              Contact Support <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link to="/privacy" className="bg-white rounded-3xl border border-slate-200 p-8 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Privacy Policy</h2>
            <p className="text-sm text-slate-500 mb-4">How we handle and protect your data.</p>
            <span className="text-sm font-semibold text-emerald-600 group-hover:text-emerald-700 flex items-center gap-1">
              Read Policy <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link to="/data-deletion" className="bg-white rounded-3xl border border-slate-200 p-8 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Data Deletion</h2>
            <p className="text-sm text-slate-500 mb-4">Request deletion of your account and personal data.</p>
            <span className="text-sm font-semibold text-emerald-600 group-hover:text-emerald-700 flex items-center gap-1">
              Request Deletion <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-10">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Contact Information</h2>
          <p className="text-sm text-slate-500 mb-6">Reach out to us directly:</p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Email</div>
                <a href="mailto:support@happyrenting.co.in" className="text-sm text-emerald-600 hover:text-emerald-700 transition-colors">support@happyrenting.co.in</a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Response Time</div>
                <div className="text-sm text-slate-500">We aim to respond within 24 hours on business days. For urgent issues, please mention "Urgent" in your email subject line.</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Android App</div>
                <div className="text-sm text-slate-500">For app-specific issues, include your device model and app version in your message.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <Footer />
  </div>
);

export default SupportPage;
