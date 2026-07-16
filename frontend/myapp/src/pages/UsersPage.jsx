import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';

const UsersPage = () => {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const filterId = searchParams.get('id');

  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [submitting,setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'owner' });
  const [formErrors, setFormErrors] = useState({});
  const [roleFilter, setRoleFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [impactModal, setImpactModal] = useState({ open: false, user: null, impact: null, loading: false });
  const [confirmText, setConfirmText] = useState('');
  const [forceResetLoading, setForceResetLoading] = useState(null);
  const [resendVerifLoading, setResendVerifLoading] = useState(null);

  // Password Reset Modal
  const [resetModal, setResetModal] = useState({ open: false, user: null, password: '' });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = roleFilter ? `?role=${roleFilter}` : '';
      const { data } = await api.get(`/users${params}`);
      setUsers(data.users);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const validateForm = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Valid email required';
    if (!form.password || form.password.length < 8) errs.password = 'Password must be at least 8 chars';
    return errs;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const errs = validateForm();
    if (Object.keys(errs).length) return setFormErrors(errs);
    if (submitting) return;

    setSubmitting(true);
    try {
      await api.post('/users', form);
      toast.success('User account created successfully!');
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', role: 'owner' });
      setFormErrors({});
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user) => {
    // For owners being DEACTIVATED, first check impact
    if (user.role === 'owner' && user.isActive) {
      setImpactModal({ open: true, user, impact: null, loading: true });
      setConfirmText('');
      try {
        const { data } = await api.get(`/users/${user._id}/impact`);
        setImpactModal(m => ({ ...m, impact: data.impact, loading: false }));
      } catch {
        setImpactModal(m => ({ ...m, impact: { activeTenants: '?', pendingPayments: '?', openComplaints: '?' }, loading: false }));
      }
      return;
    }
    // For all other cases (enable, or non-owner disable), proceed directly
    try {
      await api.patch(`/users/${user._id}`, { isActive: !user.isActive });
      toast.success(`Account ${user.isActive ? 'deactivated' : 'activated'}.`);
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (confirmText !== 'CONFIRM') return;
    setImpactModal(m => ({ ...m, loading: true }));
    try {
      await api.patch(`/users/${impactModal.user._id}`, { isActive: false });
      toast.success('Account deactivated.');
      setImpactModal({ open: false, user: null, impact: null, loading: false });
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
      setImpactModal(m => ({ ...m, loading: false }));
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.role === 'superadmin') return toast.error('Cannot delete superadmins.');
    
    const msg = user.role === 'owner' 
      ? `WARNING: This will completely delete the owner '${user.name}', ALL their properties, rooms, tenants, payments, complaints, and activity logs.\n\nAre you absolutely sure? This cannot be undone.`
      : `WARNING: This will completely delete the tenant '${user.name}' and all their payment/complaint history.\n\nAre you absolutely sure? This cannot be undone.`;
      
    if (!window.confirm(msg)) return;
    
    // Double confirmation for all hard deletes
    const typeName = window.prompt(`Type the user's name "${user.name}" to confirm complete deletion:`);
    if (typeName !== user.name) return toast.error('Name did not match. Deletion cancelled.');

    try {
      await api.delete(`/users/${user._id}`);
      toast.success(`User ${user.name} and all data completely deleted.`);
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleForceReset = async (user) => {
    if (!window.confirm(`Force ${user.name} to reset their password on next login?`)) return;
    setForceResetLoading(user._id);
    try {
      await api.patch(`/users/${user._id}/force-reset`);
      toast.success(`${user.name} will be prompted to reset password on next login.`);
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setForceResetLoading(null);
    }
  };

  const handleResendVerification = async (user) => {
    setResendVerifLoading(user._id);
    try {
      await api.post(`/users/${user._id}/resend-verification`);
      toast.success(`Verification email sent to ${user.email}.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResendVerifLoading(null);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetModal.password.length < 8) return toast.error('Password must be 8+ chars.');
    
    setSubmitting(true);
    try {
      await api.patch(`/users/${resetModal.user._id}/reset-password`, { newPassword: resetModal.password });
      toast.success(`Password for ${resetModal.user.name} reset successfully!`);
      setResetModal({ open: false, user: null, password: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabel = (role) => {
    const map = { superadmin: 'Admin', owner: 'Owner', tenant: 'Tenant' };
    return map[role] || role;
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = !searchTerm ||
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = !statusFilter ||
        (statusFilter === 'active' && u.isActive) ||
        (statusFilter === 'inactive' && !u.isActive);
      return matchSearch && matchStatus;
    });
  }, [users, searchTerm, statusFilter]);

  const getDaysSinceLogin = (lastLogin) => {
    if (!lastLogin) return null;
    const days = Math.floor((Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="text-slate-400 text-sm mt-1">Manage all platform accounts and security</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search name or email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="form-input w-48 text-xs py-2"
          />
          <select 
            className="form-select w-32 text-xs py-2"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="superadmin">Admins</option>
            <option value="owner">Owners</option>
            <option value="tenant">Tenants</option>
          </select>
          <select
            className="form-select w-32 text-xs py-2"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button id="add-user-btn" onClick={() => setShowAdd(true)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New User
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : users.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">🛡️</div>
          <p className="text-slate-400">No user accounts found.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u._id} className={`${!u.isActive ? 'opacity-50' : ''} ${filterId === u._id ? 'bg-brand-500/10' : ''}`}>
                  <td className="font-bold text-white">
                    <div className="flex flex-col gap-0.5">
                      <span>{u.name}</span>
                      {(() => {
                        const days = getDaysSinceLogin(u.lastLogin);
                        if (days === null) return <span className="text-[10px] text-slate-600">Never logged in</span>;
                        if (days >= 60) return <span className="text-[10px] text-amber-500">Inactive {days}d</span>;
                        return <span className="text-[10px] text-slate-500">{days}d ago</span>;
                      })()}
                    </div>
                  </td>
                  <td className="text-slate-400">{u.email}</td>
                  <td>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${u.role === 'superadmin' ? 'bg-brand-500/20 text-brand-400' : u.role === 'owner' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-500/20 text-slate-400'}`}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td>
                    {u.role !== 'superadmin' ? (
                      u.emailVerified ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 uppercase">✓ Verified</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 uppercase">⚠ Unverified</span>
                      )
                    ) : (
                      <span className="text-[10px] text-slate-600">—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={u.isActive ? 'active' : 'inactive'} />
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {u.role !== 'superadmin' && (
                        <>
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`btn-ghost btn-sm ${u.isActive ? 'text-danger' : 'text-success'}`}
                          >
                            {u.isActive ? 'Disable' : 'Enable'}
                          </button>
                          {u.isActive && (
                            <>
                              <button
                                onClick={() => setResetModal({ open: true, user: u, password: '' })}
                                className="btn-ghost btn-sm text-brand-400"
                              >
                                Reset Password
                              </button>
                              {!u.emailVerified && (
                                <button
                                  onClick={() => handleResendVerification(u)}
                                  disabled={resendVerifLoading === u._id}
                                  className="btn-ghost btn-sm text-blue-400"
                                  title="Resend verification email"
                                >
                                  {resendVerifLoading === u._id ? '...' : 'Resend Email'}
                                </button>
                              )}
                              <button
                                onClick={() => handleForceReset(u)}
                                disabled={forceResetLoading === u._id}
                                className="btn-ghost btn-sm text-orange-400"
                                title="Force password reset on next login"
                              >
                                {forceResetLoading === u._id ? '...' : 'Force Reset'}
                              </button>
                            </>
                          )}
                          
                          {/* Superadmin Hard Delete Action */}
                          {currentUser?.role === 'superadmin' && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="btn-ghost btn-sm text-danger"
                              title="Completely delete user and all associated data"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      <Modal isOpen={showAdd} onClose={() => { setShowAdd(false); setFormErrors({}); }} title="Create User Account">
        <form onSubmit={handleAdd} noValidate className="space-y-4">
          <div>
            <label className="form-label">Account Role *</label>
            <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="owner">Property Owner</option>
              <option value="superadmin">Platform Admin</option>
            </select>
          </div>
          <div>
            <label className="form-label">Full Name *</label>
            <input className={`form-input ${formErrors.name ? 'border-danger' : ''}`}
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. John Doe" maxLength={60} />
            {formErrors.name && <p className="form-error">{formErrors.name}</p>}
          </div>
          <div>
            <label className="form-label">Email Address *</label>
            <input type="email" className={`form-input ${formErrors.email ? 'border-danger' : ''}`}
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="user@example.com" maxLength={100} />
            {formErrors.email && <p className="form-error">{formErrors.email}</p>}
          </div>
          <div>
            <label className="form-label">Initial Password *</label>
            <input type="password" className={`form-input ${formErrors.password ? 'border-danger' : ''}`}
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••" maxLength={128} />
            {formErrors.password && <p className="form-error">{formErrors.password}</p>}
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            <button id="submit-user" type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={resetModal.open} onClose={() => setResetModal({ open: false, user: null, password: '' })} title="Reset User Password">
        {resetModal.user && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="p-4 rounded-xl bg-surface border border-surface-border">
               <p className="text-xs text-slate-500 uppercase font-bold">Target User</p>
               <p className="text-white font-bold">{resetModal.user.name}</p>
               <p className="text-xs text-slate-400">{resetModal.user.email}</p>
            </div>
            <div>
              <label className="form-label">New Password *</label>
              <input 
                type="password" 
                className="form-input" 
                value={resetModal.password} 
                onChange={e => setResetModal(r => ({ ...r, password: e.target.value }))}
                placeholder="Enter new 8+ char password"
                required
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setResetModal({ open: false, user: null, password: '' })} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-danger flex-1">
                {submitting ? 'Resetting…' : 'Confirm Reset'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Owner Deactivation Warning Modal */}
      {impactModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-surface border border-surface-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-danger/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-danger text-lg">⚠</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Deactivate Owner Account?</h3>
                <p className="text-slate-400 text-sm mt-1">This will block <strong className="text-white">{impactModal.user?.name}</strong> and all their tenants from accessing the platform.</p>
              </div>
            </div>

            {impactModal.loading ? (
              <div className="flex justify-center py-4"><LoadingSpinner /></div>
            ) : impactModal.impact && (
              <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 space-y-2">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-3">Impact Summary</p>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Active Tenants</span>
                  <span className={`font-bold text-sm ${impactModal.impact.activeTenants > 0 ? 'text-danger' : 'text-slate-400'}`}>{impactModal.impact.activeTenants}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Pending Payments</span>
                  <span className={`font-bold text-sm ${impactModal.impact.pendingPayments > 0 ? 'text-amber-400' : 'text-slate-400'}`}>{impactModal.impact.pendingPayments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Open Complaints</span>
                  <span className={`font-bold text-sm ${impactModal.impact.openComplaints > 0 ? 'text-amber-400' : 'text-slate-400'}`}>{impactModal.impact.openComplaints}</span>
                </div>
              </div>
            )}

            <div>
              <label className="form-label">Type <strong>CONFIRM</strong> to proceed</label>
              <input
                className="form-input mt-1"
                placeholder="CONFIRM"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setImpactModal({ open: false, user: null, impact: null, loading: false })}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeactivate}
                disabled={confirmText !== 'CONFIRM' || impactModal.loading}
                className="btn-danger flex-1"
              >
                {impactModal.loading ? 'Deactivating...' : 'Deactivate Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
