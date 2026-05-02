import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

const ForceChangePassword = () => {
  const { logout, updateUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (form.newPassword.length < 8) {
      return toast.error('Password must be at least 8 characters');
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });

      // Update local user state so mustChangePassword becomes false
      if (data.user) {
        updateUser(data.user);
      }

      toast.success('Security setup complete! Redirecting to your dashboard...');
      
      // Give the user a moment to see the success message
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (err) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear(); // Nuclear option to ensure no stale data
    logout();
    navigate('/login', { replace: true });
    toast.info('You have been signed out.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600/10 text-brand-400 mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Setup Your Password</h1>
          <p className="text-slate-400 mt-2">To secure your account, please change your temporary password before proceeding.</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Temporary Password</label>
              <input 
                type="password" 
                className="form-input"
                value={form.currentPassword}
                onChange={e => setForm({...form, currentPassword: e.target.value})}
                required
                placeholder="Enter the password from email"
              />
            </div>
            <div>
              <label className="form-label">New Password</label>
              <input 
                type="password" 
                className="form-input"
                value={form.newPassword}
                onChange={e => setForm({...form, newPassword: e.target.value})}
                required
                placeholder="Min 8 characters"
                minLength={8}
              />
            </div>
            <div>
              <label className="form-label">Confirm New Password</label>
              <input 
                type="password" 
                className="form-input"
                value={form.confirmPassword}
                onChange={e => setForm({...form, confirmPassword: e.target.value})}
                required
                placeholder="Repeat new password"
              />
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={loading}
                className="btn-primary w-full py-3"
              >
                {loading ? <LoadingSpinner size="sm" label="" /> : null}
                {loading ? 'Updating…' : 'Secure My Account'}
              </button>
            </div>
            
            <button 
              type="button" 
              onClick={handleLogout}
              className="text-slate-500 hover:text-white text-sm w-full text-center mt-4 transition-colors"
            >
              Sign out and setup later
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForceChangePassword;
