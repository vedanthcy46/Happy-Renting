import React from 'react';
import { FileText } from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const sections = [
  {
    title: '1. Acceptance of Terms',
    content: `By accessing or using Happy Renting ("the Platform"), you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the Platform.`,
  },
  {
    title: '2. Eligibility',
    content: `You must be at least 18 years old to use this Platform. By creating an account, you represent that you are legally capable of entering into binding contracts.`,
  },
  {
    title: '3. User Accounts',
    content: `You are responsible for maintaining the confidentiality of your login credentials. You must notify us immediately of any unauthorized use of your account. We reserve the right to suspend or terminate accounts that violate these terms.`,
  },
  {
    title: '4. Acceptable Use',
    content: `You agree to use the Platform only for lawful purposes. You shall not: (a) misuse the Platform for fraudulent activities, (b) attempt to gain unauthorized access to other accounts, (c) upload malicious content, or (d) interfere with the Platform's operation.`,
  },
  {
    title: '5. Rent Billing and Payments',
    content: `Rent amounts and due dates are set by property owners. Happy Renting facilitates tracking and collection but does not guarantee payment. Online payments are processed through Cashfree Payments India. Payment proofs uploaded for manual verification are subject to owner approval.`,
  },
  {
    title: '6. Manual Payment Verification',
    content: `When tenants upload payment proof screenshots, owners have the discretion to verify or reject them. Happy Renting does not verify the authenticity of uploaded proofs. Disputes regarding manual payments must be resolved between owner and tenant.`,
  },
  {
    title: '7. Intellectual Property',
    content: `The Platform, including its design, code, and content, is the property of Happy Renting. You may not copy, modify, or redistribute any part of the Platform without written permission.`,
  },
  {
    title: '8. Limitation of Liability',
    content: `Happy Renting is provided "as is" without warranties of any kind. We are not liable for: (a) disputes between owners and tenants, (b) financial losses arising from payment disputes, (c) service interruptions due to maintenance or third-party services, or (d) data loss beyond our reasonable control.`,
  },
  {
    title: '9. Data Protection',
    content: `We handle your personal data in accordance with our Privacy Policy. By using the Platform, you consent to the data practices described in the Privacy Policy.`,
  },
  {
    title: '10. Termination',
    content: `We reserve the right to suspend or terminate access to the Platform for violations of these terms. You may request account deletion by contacting support@happyrenting.in.`,
  },
  {
    title: '11. Governing Law',
    content: `These terms are governed by the laws of India. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts in India.`,
  },
  {
    title: '12. Changes to Terms',
    content: `We may update these terms at any time. Users will be notified of material changes via email or in-app notification. Continued use after changes constitutes acceptance.`,
  },
  {
    title: '13. Contact',
    content: `For questions about these terms, contact: support@happyrenting.in.`,
  },
];

const TermsConditionsPage = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
    <Navbar />
    <section className="pt-32 pb-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-2 tracking-tight">Terms &amp; Conditions</h1>
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

export default TermsConditionsPage;
