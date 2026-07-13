import React from 'react';
import { RotateCcw } from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const RefundPolicyPage = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
    <Navbar />
    <section className="pt-32 pb-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <RotateCcw className="w-7 h-7" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-2 tracking-tight">Refund &amp; Cancellation Policy</h1>
          <p className="text-sm text-slate-400">Last updated: July 13, 2026</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-12 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">1. Rent Payments</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Rent payments made through the Platform are transactions between tenants and property owners. 
              Happy Renting acts as a facilitator for tracking and processing these payments. 
              Refund of rent payments is at the sole discretion of the property owner.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">2. Incorrect Payments</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              If a payment was made in error (wrong amount, duplicate payment, or wrong account), 
              please contact your property owner directly. Happy Renting can provide transaction 
              records to assist in resolution but cannot initiate refunds from the owner's wallet.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">3. Platform Fees</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Currently, Happy Renting does not charge platform fees for its services. 
              Any future fee structure will be communicated in advance. Online payment 
              gateway charges (applicable for UPI/card/net banking transactions) are 
              non-refundable as they are levied by the payment processor (Cashfree).
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">4. Advance Balance</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Overpayments are credited as advance balance in the tenant's account and 
              automatically applied to future bills. If you are vacating and have an 
              advance balance, please coordinate with your property owner for adjustment 
              or refund.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">5. Dispute Resolution</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              In case of payment disputes, Happy Renting provides transaction logs and 
              proof records to both parties. We recommend resolving disputes directly 
              with your property owner. If unresolved, you may contact us at 
              support@happyrenting.in for assistance.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">6. Cancellation</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Account cancellation requests can be sent to support@happyrenting.in. 
              Upon cancellation, your personal data will be deleted within 30 days, 
              subject to legal retention requirements for financial records.
            </p>
          </div>
        </div>
      </div>
    </section>
    <Footer />
  </div>
);

export default RefundPolicyPage;
