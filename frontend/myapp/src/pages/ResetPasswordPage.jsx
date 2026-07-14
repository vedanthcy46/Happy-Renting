import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/axios';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { CheckCircle, Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [sending, setSending] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Please enter your email address.'); return; }
    setSending(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setEmailSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both fields');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
    if (!passwordRegex.test(newPassword)) {
      setError('Password must include uppercase, lowercase, number, and a special character (@$!%*?&)');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token, newPassword });
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.message || 'Failed to reset password');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'The link may have expired or is invalid. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar />
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm">
            {success ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Password Reset!</h1>
                <p className="text-sm text-slate-500 mb-6">Your password has been updated successfully.</p>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-all w-full"
                >
                  Sign In
                </Link>
              </div>
            ) : !token ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <Link to="/login" className="text-slate-400 hover:text-slate-600 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </Link>
                  <h1 className="text-2xl font-bold text-slate-900">Forgot Password</h1>
                </div>

                {emailSent ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                      <Mail className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mb-2">Check Your Email</h2>
                    <p className="text-sm text-slate-500 mb-2">
                      If an account exists for <strong className="text-slate-700">{email}</strong>, we've sent a password reset link.
                    </p>
                    <p className="text-xs text-slate-400">The link expires in 1 hour. Didn't receive it? Check your spam folder.</p>
                    <button
                      onClick={() => { setEmailSent(false); setError(''); }}
                      className="mt-6 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Send again
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-500 mb-6">
                      Enter your registered email address and we'll send you a link to reset your password.
                    </p>

                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-4 mb-6">{error}</div>
                    )}

                    <form onSubmit={handleForgotSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="you@example.com"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={sending}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {sending ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          'Send Reset Link'
                        )}
                      </button>
                    </form>

                    <p className="text-center text-sm text-slate-400 mt-6">
                      <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-semibold">Back to Login</Link>
                    </p>
                  </>
                )}
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Reset Password</h1>
                <p className="text-sm text-slate-500 mb-6">
                  Enter your new password. Must be at least 8 characters with uppercase, lowercase, number, and special character.
                </p>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-4 mb-6">{error}</div>
                )}

                <form onSubmit={handleResetSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
                    <div className="relative">
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Enter new password"
                      />
                      <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Confirm new password"
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Reset Password'
                    )}
                  </button>
                </form>

                <p className="text-center text-sm text-slate-400 mt-6">
                  <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-semibold">Back to Login</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default ResetPasswordPage;
