import React from 'react';
import { Shield } from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const sections = [
  {
    title: '1. Information We Collect',
    content: `We collect your name, email address, phone number, payment proof images, and ID proof documents that you voluntarily provide. We also collect device information (model, OS version) for push notification delivery, and IP address for security logging. If you enable biometric authentication (Face ID / Fingerprint), biometric data is stored locally on your device and never sent to our servers.`,
  },
  {
    title: '2. How We Use Your Information',
    content: `Your information is used to manage your tenancy, process rent payments (including UPI and bank details for owner payouts), send billing notifications, communicate maintenance requests, and detect fraud. We do not sell your data to third parties.`,
  },
  {
    title: '3. Data Sharing',
    content: `Your tenancy details and payment history are shared with your property owner as necessary to manage your tenancy. We use third-party services: Cashfree Payments (PCI-DSS compliant) for online rent collection, Expo for push notifications, Cloudinary for image storage, Resend for emails, and MongoDB Atlas for database hosting. Each provider has its own privacy policy governing data handling.`,
  },
  {
    title: '4. Data Storage and Security',
    content: `Passwords are hashed with bcrypt (12 rounds). Auth tokens are stored in SecureStore (mobile) or HTTP-only cookies (web). All API communication is over HTTPS. Uploaded images are stored on Cloudinary with private access controls. Database is hosted on MongoDB Atlas with encryption at rest.`,
  },
  {
    title: '5. Data Retention',
    content: `Personal data is retained for the duration of your tenancy plus 30 days. Payment records are retained for 7 years as required by Indian tax and financial regulations. Server logs are retained for 14 days. Push notification tokens are retained until you disable notifications or delete your account.`,
  },
  {
    title: '6. Your Rights',
    content: `You may request access, correction, deletion, or portability of your data by contacting support@happyrenting.in. We will respond within 30 days. You may also withdraw consent for push notifications or biometric login at any time via app settings. Note that financial records may be retained beyond account deletion as required by law.`,
  },
  {
    title: '7. Children & International Transfers',
    content: `Our Platform is not intended for users under 18. We do not knowingly collect data from children. Your data may be processed in India and the United States with appropriate safeguards (Standard Contractual Clauses). We do not use cookies for advertising or tracking.`,
  },
  {
    title: '8. Changes to This Policy',
    content: `We may update this policy from time to time. Material changes will be notified via email or in-app notification. Continued use after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: '9. Contact Us',
    content: `For privacy questions or requests, contact: support@happyrenting.in or visit happyrenting.netlify.app.`,
  },
];

const PrivacyPolicyPage = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
    <Navbar />
    <section className="pt-32 pb-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-2 tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-slate-400">Last updated: July 13, 2026</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-12 space-y-8">
          {sections.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-bold text-slate-900 mb-3">{s.title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{s.content}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
    <Footer />
  </div>
);

export default PrivacyPolicyPage;
