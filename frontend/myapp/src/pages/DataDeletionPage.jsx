import React from 'react';
import { Shield, AlertTriangle, ArrowRight } from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const DataDeletionPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Data Deletion Request</h1>
          <p className="text-slate-500 mt-2">How account deletion works on Happy Renting</p>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 mb-3">What happens when you request deletion?</h2>
            <ol className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                <span><strong className="text-slate-800">Submit request</strong> &mdash; Your deletion request is sent to your property owner for review.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                <span><strong className="text-slate-800">Owner reviews</strong> &mdash; The owner verifies your rent account is settled and there are no pending complaints.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                <span><strong className="text-slate-800">30-day grace period</strong> &mdash; After owner approval, you have 30 days to cancel if you change your mind.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</span>
                <span><strong className="text-slate-800">Account anonymized</strong> &mdash; Personal data is removed. Payment records are retained as required by law.</span>
              </li>
            </ol>
          </div>

          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">Important</p>
                <ul className="space-y-1 list-disc list-inside text-amber-700">
                  <li>You must be logged in to request deletion</li>
                  <li>Your owner must approve the request before processing</li>
                  <li>Pending rent or complaints may block deletion</li>
                  <li>Payment history is retained for legal compliance</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="text-center pt-4">
            {user ? (
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-colors"
              >
                Go to Account Settings
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-colors"
              >
                Login to Request Deletion
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default DataDeletionPage;
