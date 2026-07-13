import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Search } from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const faqs = [
  {
    category: 'Getting Started',
    questions: [
      { q: 'How do I create an account?', a: 'Visit the Get Started page and fill in your details. A super admin will verify your request and activate your account. You will receive an email once your account is ready.' },
      { q: 'Is Happy Renting free to use?', a: 'Pricing details are coming soon. Currently, the platform is available during the initial launch phase. Contact us for more information.' },
      { q: 'Do I need a smartphone to use it?', a: 'No. The web version works on any device with a browser. The Android app is an additional convenience for tenants.' },
    ],
  },
  {
    category: 'For Property Owners',
    questions: [
      { q: 'How do I add a property?', a: 'After logging in, go to Properties from the sidebar. Click "Add Property" and enter the name, address, and city details. You can add multiple properties under one account.' },
      { q: 'How do I add rooms?', a: 'Navigate to Rooms and click "Add Room". Specify the room number, floor, monthly rent, and security deposit. Rooms are linked to a property.' },
      { q: 'How do I add tenants?', a: 'Go to Tenants and click "Add Tenant". Enter their name, phone, email, and move-in date. The tenant will receive login credentials via email.' },
      { q: 'How is rent generated?', a: 'Rent is automatically generated on the 1st of every month for all active tenants. You can also generate bills manually for partial months or adjustments.' },
      { q: 'How do I verify a payment?', a: 'When a tenant uploads a payment proof screenshot, you will receive a notification. Go to Payments, review the proof, and click "Verify" or "Reject".' },
    ],
  },
  {
    category: 'For Tenants',
    questions: [
      { q: 'How do I pay rent?', a: 'Open the Happy Renting app or web portal. Go to Payments, select the current bill, and choose your payment method. You can pay online via UPI/cards or upload a payment proof for manual verification.' },
      { q: 'How do I download a receipt?', a: 'Once your payment is verified, a PDF receipt is generated automatically. Go to Payments, find the verified payment, and click "Download Receipt".' },
      { q: 'How do I raise a complaint?', a: 'Go to Complaints and click "Raise Complaint". Select a category (plumbing, electrical, etc.), describe the issue, and optionally attach images. Your owner will be notified.' },
      { q: 'Why am I not getting notifications?', a: 'Ensure you have granted notification permissions to the app. You can manage your notification preferences in Settings > Notifications.' },
    ],
  },
  {
    category: 'Payments & Billing',
    questions: [
      { q: 'What payment methods are supported?', a: 'Online payments are processed via Cashfree, supporting UPI, credit/debit cards, and net banking. You can also pay by cash or bank transfer and upload proof for owner verification.' },
      { q: 'Is there a fee for online payments?', a: 'Online payment gateway charges may apply. These are typically around 1.95% + GST. Manual payments (cash/bank transfer) have no additional fees.' },
      { q: 'Can I pay for multiple months in advance?', a: 'Yes. If you overpay, the excess amount is credited as advance balance and automatically applied to future bills.' },
      { q: 'How do I get a refund?', a: 'Refunds are handled by your property owner. Please contact them directly. Happy Renting facilitates the payment tracking but does not hold funds.' },
    ],
  },
  {
    category: 'Account & Security',
    questions: [
      { q: 'How do I reset my password?', a: 'On the login screen, tap "Forgot Password?" and enter your registered email. A reset link will be sent to your inbox. The link is valid for 1 hour.' },
      { q: 'How do I delete my account?', a: 'Contact us at support@happyrenting.in with your account details. We will process your request within 30 days. Note that financial records are retained for 7 years as required by law.' },
      { q: 'Is my data secure?', a: 'Yes. All data is encrypted in transit (HTTPS/TLS) and at rest. Passwords are hashed with bcrypt. We use role-based access control and maintain full audit logs.' },
      { q: 'Can I use biometric login?', a: 'Yes, the Android app supports Face ID and fingerprint authentication. Your biometric data is stored locally on your device and never sent to our servers.' },
    ],
  },
];

const FAQPage = () => {
  const [openIndex, setOpenIndex] = useState(null);
  const [search, setSearch] = useState('');

  const filtered = faqs.map(cat => ({
    ...cat,
    questions: cat.questions.filter(
      q => q.q.toLowerCase().includes(search.toLowerCase()) ||
           q.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.questions.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar />
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">Help Center</h1>
            <p className="text-lg text-slate-500 mb-8">Find answers to common questions.</p>
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search FAQs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {filtered.map((cat) => (
            <div key={cat.category} className="mb-10">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-600" />
                {cat.category}
              </h2>
              <div className="space-y-2">
                {cat.questions.map((item, i) => {
                  const globalIdx = `${cat.category}-${i}`;
                  const isOpen = openIndex === globalIdx;
                  return (
                    <div key={globalIdx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <button onClick={() => setOpenIndex(isOpen ? null : globalIdx)} className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors">
                        <span className="font-semibold text-slate-900 text-sm">{item.q}</span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ml-4 ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-4">{item.a}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">No results found</h3>
              <p className="text-sm text-slate-500">Try different keywords or contact support.</p>
            </div>
          )}

          <div className="text-center mt-12 bg-slate-900 rounded-3xl p-8 text-white">
            <h3 className="text-lg font-bold mb-2">Still have questions?</h3>
            <p className="text-sm text-slate-300 mb-4">Our support team is ready to help.</p>
            <a href="/contact" className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all">
              Contact Support
            </a>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default FAQPage;
