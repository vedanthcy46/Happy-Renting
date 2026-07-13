import React, { useState } from 'react';
import { Trash2, CheckCircle, Mail, AlertTriangle } from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const DataDeletionPage = () => {
  const [requested, setRequested] = useState(false);

  const handleRequest = (e) => {
    e.preventDefault();
    setRequested(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar />
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-2 tracking-tight">Data Deletion Instructions</h1>
            <p className="text-sm text-slate-400">For Google Play compliance</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-12 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">How to delete your account and data</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              You can request deletion of your account and associated personal data by following any of the methods below.
            </p>

            <div className="space-y-6 mb-8">
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm mb-1">Method 1: Email Request</h3>
                    <p className="text-sm text-slate-500 mb-2">Send an email to <strong>support@happyrenting.in</strong> with the subject line "Account Deletion Request" from your registered email address. Include your full name and registered email in the body.</p>
                    <a href="mailto:support@happyrenting.in?subject=Account%20Deletion%20Request" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                      Open in Email →
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <form onSubmit={handleRequest} className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-sm mb-1">Method 2: Request via Web</h3>
                      <p className="text-sm text-slate-500 mb-3">Fill in the form below and we will process your request.</p>
                      {requested ? (
                        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 text-center">
                          <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                          <div className="text-sm font-semibold text-emerald-800">Request Submitted</div>
                          <div className="text-xs text-emerald-600 mt-1">We will process your request within 30 days. You will receive a confirmation email.</div>
                        </div>
                      ) : (
                        <>
                          <input type="email" placeholder="Your registered email" required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                          <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">
                            Request Data Deletion
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>

            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-amber-800 text-sm mb-1">Important Notes</h3>
                  <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                    <li>Deletion is irreversible. You will lose access to your account and all associated data.</li>
                    <li>Payment records are retained for 7 years as required by Indian financial regulations.</li>
                    <li>Processing time: up to 30 days from request confirmation.</li>
                    <li>You will receive a confirmation email once the deletion is complete.</li>
                    <li>If you are a tenant, your owner will be notified of the deletion.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-12">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What data is deleted</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h3 className="font-bold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Deleted
                </h3>
                <ul className="space-y-1 text-slate-500 list-disc list-inside text-xs">
                  <li>Personal profile information</li>
                  <li>Authentication credentials</li>
                  <li>Tenancy records</li>
                  <li>Complaint history</li>
                  <li>Notification preferences</li>
                  <li>Push notification tokens</li>
                  <li>Session data and tokens</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Retained (7 years)
                </h3>
                <ul className="space-y-1 text-slate-500 list-disc list-inside text-xs">
                  <li>Payment transaction records</li>
                  <li>Financial audit logs</li>
                  <li>Withdrawal history</li>
                  <li>Invoice and receipt records</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default DataDeletionPage;
