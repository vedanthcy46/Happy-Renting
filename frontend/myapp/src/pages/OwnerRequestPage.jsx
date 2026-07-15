import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Send, CheckCircle2, ShieldCheck, Mail, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const STEPS = { EMAIL: 'email', OTP: 'otp', FORM: 'form', DONE: 'done' };

const OwnerRequestPage = () => {
  const { showToast } = useToast();
  const [step, setStep] = useState(STEPS.EMAIL);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verifiedToken, setVerifiedToken] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef([]);
  const timerRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    propertyName: '',
    propertyLocation: ''
  });

  // ── Step 1: Send OTP ────────────────────────────────────────────
  const startResendTimer = () => {
    clearInterval(timerRef.current);
    setResendTimer(60);
    timerRef.current = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async (e) => {
    e?.preventDefault();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return showToast('Please enter a valid email address.', 'error');
    }
    setLoading(true);
    try {
      await api.post('/owner-requests/verify-email/send-otp', { email });
      showToast('OTP sent! Check your inbox.', 'success');
      setOtp(['', '', '', '', '', '']);
      setStep(STEPS.OTP);
      startResendTimer();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      showToast(err.message || 'Failed to send OTP.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP Input Handling ───────────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d !== '') && newOtp.join('').length === 6) {
      handleVerifyOTP(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ── Step 2: Verify OTP ───────────────────────────────────────
  const handleVerifyOTP = async (otpCode) => {
    const code = otpCode || otp.join('');
    if (code.length !== 6) return showToast('Please enter the full 6-digit OTP.', 'error');
    setLoading(true);
    try {
      const res = await api.post('/owner-requests/verify-email/verify-otp', { email, otp: code });
      setVerifiedToken(res.data.verifiedToken);
      showToast('Email verified! Please complete the form.', 'success');
      setStep(STEPS.FORM);
    } catch (err) {
      showToast(err.message || 'Invalid OTP.', 'error');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Submit Form ───────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return showToast('Name is required.', 'error');
    if (!formData.phone.trim()) return showToast('Phone number is required.', 'error');
    setLoading(true);
    try {
      const res = await api.post('/owner-requests', {
        name: formData.name,
        email,
        phone: formData.phone,
        propertyName: formData.propertyName,
        propertyLocation: formData.propertyLocation,
        verifiedToken,
      });
      if (res.data.success) {
        setStep(STEPS.DONE);
      }
    } catch (err) {
      showToast(err.message || 'Failed to submit request.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Render: Done ───────────────────────────────────────────
  if (step === STEPS.DONE) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-10 text-center border border-transparent dark:border-gray-800">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Request Submitted!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Thank you! Our admin team will review your request and send your account credentials to <span className="font-bold text-gray-900 dark:text-white">{email}</span>.
          </p>
          <Link to="/" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4 py-12">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <Home className="text-blue-600 dark:text-blue-400 w-6 h-6" />
        <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Happy Renting</span>
      </div>

      <div className="max-w-xl w-full bg-white dark:bg-gray-900 rounded-3xl shadow-xl overflow-hidden border border-transparent dark:border-gray-800">
        {/* Header */}
        <div className="bg-blue-600 px-8 py-10 text-white">
          <h1 className="text-3xl font-bold mb-2">Request Owner Access</h1>
          <p className="opacity-90 text-sm">Fill out the form below and start managing your properties.</p>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-5">
            {[{label: '1', title: 'Email'}, {label: '2', title: 'Verify'}, {label: '3', title: 'Details'}].map((s, i) => {
              const stepKeys = [STEPS.EMAIL, STEPS.OTP, STEPS.FORM];
              const isActive = step === stepKeys[i];
              const isDone = stepKeys.indexOf(step) > i;
              return (
                <React.Fragment key={i}>
                  <div className={`flex items-center gap-1.5 text-xs font-bold ${
                    isDone ? 'text-green-300' : isActive ? 'text-white' : 'text-blue-300'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      isDone ? 'bg-green-400 border-green-400 text-white' :
                      isActive ? 'bg-white border-white text-blue-600' :
                      'bg-transparent border-blue-400 text-blue-200'
                    }`}>
                      {isDone ? '✓' : s.label}
                    </div>
                    {s.title}
                  </div>
                  {i < 2 && <div className="flex-1 h-px bg-blue-400/40" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="p-8">

          {/* ── Step 1: Email ── */}
          {step === STEPS.EMAIL && (
            <form onSubmit={handleSendOTP} className="space-y-6">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-5 leading-relaxed">
                  We'll send a 6-digit verification code to your email to confirm your identity before you submit a request.
                </p>
                <InputField
                  label="Email Address"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-blue-200 dark:hover:shadow-blue-900/20"
              >
                {loading ? 'Sending...' : <><Mail className="w-5 h-5" /> Send Verification Code</>}
              </button>
              <div className="text-center">
                <Link to="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">Cancel and return to home</Link>
              </div>
            </form>
          )}

          {/* ── Step 2: OTP ── */}
          {step === STEPS.OTP && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-gray-800 dark:text-gray-200 font-semibold text-lg">Check your inbox</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                  We sent a 6-digit code to <span className="font-bold text-gray-900 dark:text-white">{email}</span>
                </p>
              </div>

              {/* OTP boxes */}
              <div className="flex justify-center gap-3">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className={`w-12 h-14 text-center text-2xl font-bold bg-gray-50 dark:bg-gray-800 border-2 rounded-xl outline-none transition-all ${
                      digit ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
                    } focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20`}
                  />
                ))}
              </div>

              <button
                onClick={() => handleVerifyOTP()}
                disabled={loading || otp.join('').length < 6}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
              >
                {loading ? 'Verifying...' : <><ShieldCheck className="w-5 h-5" /> Verify Code</>}
              </button>

              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  disabled={resendTimer > 0 || loading}
                  onClick={handleSendOTP}
                  className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline disabled:opacity-40 disabled:no-underline transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(STEPS.EMAIL)}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 transition-colors"
                >
                  ← Use a different email
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Full Form ── */}
          {step === STEPS.FORM && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-green-800 dark:text-green-300 font-bold text-sm">Email Verified</p>
                  <p className="text-green-700 dark:text-green-400 text-xs">{email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <InputField
                  label="Full Name"
                  name="name"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={e => setFormData(f => ({...f, name: e.target.value}))}
                  required
                />
                <InputField
                  label="Phone Number"
                  name="phone"
                  placeholder="+91 XXXXX XXXXX"
                  value={formData.phone}
                  onChange={e => setFormData(f => ({...f, phone: e.target.value}))}
                  required
                />
                <InputField
                  label="Property Name (Optional)"
                  name="propertyName"
                  placeholder="e.g. Green Valley"
                  value={formData.propertyName}
                  onChange={e => setFormData(f => ({...f, propertyName: e.target.value}))}
                />
              </div>
              <InputField
                label="Property Location (Optional)"
                name="propertyLocation"
                placeholder="City, Area, or Landmark"
                value={formData.propertyLocation}
                onChange={e => setFormData(f => ({...f, propertyLocation: e.target.value}))}
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-blue-200 dark:hover:shadow-blue-900/20"
              >
                {loading ? 'Submitting...' : <><Send className="w-5 h-5" /> Submit Access Request</>}
              </button>
              <div className="text-center">
                <Link to="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">Cancel and return to home</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const InputField = ({ label, name, type = 'text', placeholder, value, onChange, required = false }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={name} className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      id={name}
      name={name}
      type={type}
      required={required}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
    />
  </div>
);

export default OwnerRequestPage;
