import React, { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passLoading, setPassLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    upiId: '',
    upiNumber: '',
    upiDetails: {
      upiId: '',
      upiName: ''
    },
    bankDetails: {
      accountHolder: '',
      accountNumber: '',
      bankName: '',
      ifscCode: ''
    }
  });

  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/users/profile');
      const profile = data.user;
      
      // Update global user context to keep everything in sync
      updateUser(profile);

      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        upiId: profile.upiId || '',
        upiNumber: profile.upiNumber || '',
        upiDetails: {
          upiId: profile.upiDetails?.upiId || profile.upiId || '',
          upiName: profile.upiDetails?.upiName || profile.name || ''
        },
        bankDetails: {
          accountHolder: profile.bankDetails?.accountHolder || '',
          accountNumber: profile.bankDetails?.accountNumber || '',
          bankName:      profile.bankDetails?.bankName || '',
          ifscCode:      profile.bankDetails?.ifscCode || ''
        }
      });
    } catch (err) {
      toast.error('Failed to load profile details.');
    }
  }, [updateUser, toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('bank.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        bankDetails: {
          ...prev.bankDetails,
          [field]: value
        }
      }));
    } else if (name.startsWith('upiDetails.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        upiDetails: {
          ...prev.upiDetails,
          [field]: value
        },
        // Sync top-level upiId for compatibility
        ...(field === 'upiId' ? { upiId: value } : {})
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.patch('/users/profile', formData);
      updateUser(data.user);
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Update failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQRUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('File size exceeds 2MB limit.');

    setUploading(true);
    const form = new FormData();
    form.append('image', file);

    try {
      const { data } = await api.post('/users/owner/upload-qr', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateUser({ ...user, qrCodeImage: data.qrCodeImage });
      toast.success('QR Code updated successfully!');
    } catch (err) {
      toast.error(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passForm.newPassword !== passForm.confirmPassword) {
      return toast.error('New passwords do not match.');
    }
    if (passForm.newPassword.length < 8) {
      return toast.error('Password must be at least 8 characters.');
    }

    setPassLoading(true);
    try {
      await api.patch('/users/profile/password', {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword
      });
      toast.success('Password changed successfully!');
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to change password.');
    } finally {
      setPassLoading(false);
    }
  };

  const isOwner = user?.role === 'owner' || user?.role === 'superadmin';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="page-title">My Profile</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your personal and payment information</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="card p-8 space-y-6">
            <h3 className="text-white font-bold flex items-center gap-2 border-b border-slate-800 pb-4">
              <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Basic Information
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="form-label">Full Name</label>
                <input 
                  type="text" name="name" className="form-input" 
                  value={formData.name} onChange={handleChange} required 
                />
              </div>
              <div>
                <label className="form-label">Email Address *</label>
                <input 
                  type="email" name="email" className="form-input" 
                  value={formData.email} onChange={handleChange} required 
                />
                <p className="text-[10px] text-brand-400/70 mt-1 italic">Note: This will also change your login email.</p>
              </div>
              <div>
                <label className="form-label">Phone Number</label>
                <input 
                  type="tel" name="phone" className="form-input" 
                  value={formData.phone} onChange={handleChange} placeholder="e.g. +91 9876543210"
                />
              </div>
              <div>
                <label className="form-label">Role</label>
                <div className="form-input bg-surface-card opacity-60 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                  <span className="capitalize">{user?.role}</span>
                </div>
              </div>
            </div>

            {isOwner && (
              <>
                <h3 className="text-white font-bold flex items-center gap-2 border-b border-slate-800 pb-4 pt-4">
                  <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Payment Information (UPI)
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="form-label">UPI ID</label>
                    <input 
                      type="text" name="upiDetails.upiId" className="form-input" 
                      value={formData.upiDetails.upiId} onChange={handleChange} placeholder="e.g. name@upi"
                    />
                  </div>
                  <div>
                    <label className="form-label">UPI Registered Name</label>
                    <input 
                      type="text" name="upiDetails.upiName" className="form-input" 
                      value={formData.upiDetails.upiName} onChange={handleChange} placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <label className="form-label">UPI Number</label>
                    <input 
                      type="text" name="upiNumber" className="form-input" 
                      value={formData.upiNumber} onChange={handleChange} placeholder="e.g. 9876543210"
                    />
                  </div>
                </div>

                <h3 className="text-white font-bold flex items-center gap-2 border-b border-slate-800 pb-4 pt-4">
                  <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Bank Details
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="form-label">Account Holder Name</label>
                    <input 
                      type="text" name="bank.accountHolder" className="form-input" 
                      value={formData.bankDetails.accountHolder} onChange={handleChange} 
                    />
                  </div>
                  <div>
                    <label className="form-label">Account Number</label>
                    <input 
                      type="text" name="bank.accountNumber" className="form-input" 
                      value={formData.bankDetails.accountNumber} onChange={handleChange} 
                    />
                  </div>
                  <div>
                    <label className="form-label">Bank Name</label>
                    <input 
                      type="text" name="bank.bankName" className="form-input" 
                      value={formData.bankDetails.bankName} onChange={handleChange} 
                    />
                  </div>
                  <div>
                    <label className="form-label">IFSC Code</label>
                    <input 
                      type="text" name="bank.ifscCode" className="form-input" 
                      value={formData.bankDetails.ifscCode} onChange={handleChange} 
                    />
                  </div>
                </div>
              </>
            )}

            <div className="pt-4">
              <button type="submit" disabled={loading} className="btn-primary w-full shadow-glow">
                {loading ? <LoadingSpinner size="sm" label="" /> : null}
                {loading ? 'Saving Changes...' : 'Update Profile'}
              </button>
            </div>
          </form>

          {/* Change Password Card */}
          <form onSubmit={handlePasswordSubmit} className="card p-8 space-y-6">
            <h3 className="text-white font-bold flex items-center gap-2 border-b border-slate-800 pb-4">
              <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Change Password
            </h3>

            <div className="grid md:grid-cols-1 gap-6">
              <div>
                <label className="form-label">Current Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={passForm.currentPassword} 
                  onChange={e => setPassForm({...passForm, currentPassword: e.target.value})}
                  required 
                />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="form-label">New Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    value={passForm.newPassword} 
                    onChange={e => setPassForm({...passForm, newPassword: e.target.value})}
                    required 
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="form-label">Confirm New Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    value={passForm.confirmPassword} 
                    onChange={e => setPassForm({...passForm, confirmPassword: e.target.value})}
                    required 
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button type="submit" disabled={passLoading} className="btn-secondary w-full">
                {passLoading ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </form>

          {/* ── Tenant: Account Deletion ────────────────────────────────── */}
          {!isOwner && (
            <TenantDeletionSection />
          )}
        </div>

        {/* Right Column: QR & Misc */}
        <div className="space-y-6">
          {isOwner && (
            <div className="card p-8 text-center space-y-4">
              <h3 className="text-white font-bold uppercase tracking-widest text-xs">Payment QR Code</h3>
              <div className="mx-auto aspect-square rounded-2xl bg-white border-4 border-white shadow-glow overflow-hidden flex items-center justify-center max-w-[300px]">
                {user?.qrCodeImage?.secureUrl ? (
                  <img src={user.qrCodeImage.secureUrl} alt="QR Code" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-slate-300 italic text-xs p-6">No QR code uploaded</div>
                )}
              </div>
              <div className="pt-2">
                <input 
                  type="file" id="qr-input" className="hidden" 
                  accept="image/*" onChange={handleQRUpload} 
                />
                <label 
                  htmlFor="qr-input" 
                  className={`btn-secondary w-full text-xs font-bold cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {uploading ? 'Uploading...' : 'Replace QR Code'}
                </label>
              </div>
              <p className="text-[10px] text-slate-500 italic">This QR will be shown to your tenants for rent payment.</p>
            </div>
          )}

          <div className="card p-6 border-brand-500/20 bg-brand-500/5">
            <h4 className="text-brand-400 font-bold text-sm mb-2 flex items-center gap-2">
              <span className="text-lg">🛡️</span> Security Note
            </h4>
            <p className="text-[11px] text-brand-300/80 leading-relaxed">
              Your sensitive information is encrypted and stored securely. Ensure your UPI and Bank details are correct to avoid payment delays.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const TenantDeletionSection = () => {
  const toast = useToast();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/account/delete/my-status');
      setRequest(data.data);
    } catch {
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleRequest = async () => {
    setSubmitting(true);
    try {
      await api.post('/account/delete/request', { reason });
      toast.success('Deletion request submitted. Your owner will review it.');
      setShowRequestModal(false);
      setReason('');
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit deletion request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel your deletion request? Your account will remain active.')) return;
    setSubmitting(true);
    try {
      await api.post('/account/delete/cancel');
      toast.success('Deletion request cancelled.');
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-8 space-y-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <LoadingSpinner size="sm" label="" />
          Loading deletion status...
        </div>
      </div>
    );
  }

  const statusConfig = {
    pending: { label: 'Awaiting Owner Review', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    pending_owner: { label: 'Awaiting Owner Review', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    owner_approved: { label: 'Approved - 30 Day Grace Period', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    owner_rejected: { label: 'Not Approved', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
    cancelled: { label: 'Cancelled', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
    completed: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  };

  return (
    <div className="card p-8 space-y-4">
      <h3 className="text-white font-bold flex items-center gap-2 border-b border-slate-800 pb-4">
        <Trash2 className="w-5 h-5 text-red-400" />
        Account Deletion
      </h3>

      {!request || request.status === 'owner_rejected' || request.status === 'cancelled' ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Request permanent deletion of your account and personal data. Your owner must approve before processing.
          </p>
          {request?.status === 'owner_rejected' && (
            <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10">
              <p className="text-xs text-red-400 font-semibold">Previous request was not approved.</p>
              {request.deletionRejectedReason && (
                <p className="text-xs text-red-400/80 mt-1">Reason: {request.deletionRejectedReason}</p>
              )}
            </div>
          )}
          {request?.status === 'cancelled' && (
            <div className="rounded-xl p-3 border border-slate-500/30 bg-slate-500/10">
              <p className="text-xs text-slate-400">Previous request was cancelled.</p>
            </div>
          )}
          <button
            onClick={() => setShowRequestModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
          >
            Request Account Deletion
          </button>
        </div>
      ) : (
        <div className={`rounded-xl p-4 border ${statusConfig[request.status]?.border || 'border-slate-700'} ${statusConfig[request.status]?.bg || 'bg-slate-800/50'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-sm font-bold ${statusConfig[request.status]?.color || 'text-slate-300'}`}>
              <Trash2 className="w-4 h-4 inline mr-1.5" />
              {statusConfig[request.status]?.label || request.status}
            </span>
            {(request.status === 'pending_owner' || request.status === 'owner_approved') && (
              <button
                onClick={handleCancel}
                disabled={submitting}
                className="text-xs text-slate-400 hover:text-white underline transition-colors"
              >
                {submitting ? 'Cancelling...' : 'Cancel Request'}
              </button>
            )}
          </div>
          {request.referenceId && (
            <p className="text-xs text-slate-500 font-mono">Ref: {request.referenceId}</p>
          )}
          {request.scheduledDeletionAt && (
            <p className="text-xs text-blue-400 mt-1">
              Scheduled for: {new Date(request.scheduledDeletionAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}
          {request.status === 'owner_rejected' && (
            <p className="text-xs text-red-400 mt-1">
              {request.deletionRejectedReason ? `Reason: ${request.deletionRejectedReason}` : 'Rejected by owner.'}
            </p>
          )}
        </div>
      )}

      <Modal isOpen={showRequestModal} onClose={() => setShowRequestModal(false)} title="Request Account Deletion" size="md">
        <div className="space-y-4">
          <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
            <p className="text-sm text-red-300">
              This will notify your owner. After approval, your account will be permanently deleted after a 30-day grace period. Payment records will be retained for legal compliance.
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Let your owner know why you're leaving..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setShowRequestModal(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRequest}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-800/50 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
              {submitting ? <LoadingSpinner size="sm" label="" /> : <Trash2 className="w-4 h-4" />}
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProfilePage;
