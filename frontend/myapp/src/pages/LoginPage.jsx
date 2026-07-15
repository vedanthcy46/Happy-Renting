import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { ArrowLeft, Home, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const LoginPage = () => {
  const { login } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [form,     setForm]     = useState({ email: '', password: '' });
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Check for auto-logout reasons
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reason = params.get('reason');
    if (reason === 'deleted') {
      setErrors({ general: 'Your account has been deleted.' });
    } else if (reason === 'deactivated') {
      setErrors({ general: 'Your account has been deactivated. Please contact support.' });
    } else if (reason === 'expired') {
      toastError('Session expired. Please log in again.');
    }
  }, [location, toastError]);

  const validate = () => {
    const errs = {};
    if (!form.email)   errs.email    = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      const firstKey = Object.keys(errs)[0];
      document.getElementById(firstKey)?.focus();
      return setErrors(errs);
    }

    setLoading(true);
    try {
      const user = await login(form.email.trim().toLowerCase(), form.password);
      toastSuccess(`Welcome back, ${user.name}!`);

      if (user.mustChangePassword) {
        navigate('/setup-password', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      toastError(err.message || 'Login failed. Please try again.');
      setErrors({ general: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4 relative overflow-hidden">
      <div className="absolute top-8 left-8 z-20">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg px-2 py-1"
          aria-label="Back to home page"
        >
          <div className="p-2 rounded-full bg-surface-card border border-surface-border group-hover:bg-surface-hover transition-all">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">Back to Home</span>
        </button>
      </div>

      <div className="absolute top-0 left-0 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow mb-4">
            <Home className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Happy Renting</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Rental Management Platform</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">Sign in to your account</h2>

          {errors.general && (
            <div className="mb-4 p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm flex items-center gap-2" role="alert">
              <div className="w-1.5 h-1.5 rounded-full bg-danger flex-shrink-0" />
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="email" className="form-label">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-slate-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  className={`form-input pl-10 ${errors.email ? 'border-danger focus:ring-danger' : ''}`}
                  placeholder="you@example.com"
                  disabled={loading}
                  maxLength={100}
                  spellCheck={false}
                />
              </div>
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="form-label">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  className={`form-input pl-10 pr-12 ${errors.password ? 'border-danger focus:ring-danger' : ''}`}
                  placeholder="Enter your password"
                  disabled={loading}
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="form-error">{errors.password}</p>}
            </div>

            <div className="flex items-center justify-end mb-6">
              <Link
                to="/reset-password"
                className="text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full btn-lg"
            >
              {loading ? <LoadingSpinner size="sm" label="" /> : null}
              {loading ? 'Signing in\u2026' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
