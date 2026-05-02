import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/axios';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error');
        setMessage('No verification token provided.');
        return;
      }

      try {
        const { data } = await api.post('/auth/verify-email', { token });
        setStatus('success');
        setMessage(data.message || 'Email verified successfully!');
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed. The link may be invalid or expired.');
      }
    };
    verify();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="card p-8 text-center">
          {status === 'verifying' && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <LoadingSpinner size="lg" />
              </div>
              <h1 className="text-2xl font-bold text-white">Verifying your email…</h1>
              <p className="text-slate-400">Please wait while we activate your account.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center text-success animate-bounce">
                  <CheckCircle2 size={48} />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white">Account Activated!</h1>
              <p className="text-slate-400">{message}</p>
              <div className="pt-4">
                <Link to="/login" className="btn-primary w-full flex items-center justify-center gap-2">
                  Proceed to Login <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-danger/10 flex items-center justify-center text-danger">
                  <XCircle size={48} />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white">Verification Failed</h1>
              <p className="text-slate-400">{message}</p>
              <div className="pt-4 space-y-3">
                <Link to="/login" className="btn-secondary w-full">
                  Back to Login
                </Link>
                <p className="text-xs text-slate-500">
                  Try logging in to request a new verification link.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
