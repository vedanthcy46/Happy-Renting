import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';

const UsersPage = () => {
  const toast = useToast();
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
    try {
      await api.patch(`/users/${user._id}`, { isActive: !user.isActive });
      toast.success(`Account ${user.isActive ? 'deactivated' : 'activated'}.`);
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="text-slate-400 text-sm mt-1">Manage all platform accounts and security</p>
        </div>
        <div className="flex gap-2">
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
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} className={`${!u.isActive ? 'opacity-50' : ''} ${filterId === u._id ? 'bg-brand-500/10' : ''}`}>
                  <td className="font-bold text-white">
                    {u.name}
                  </td>
                  <td className="text-slate-400">{u.email}</td>
                  <td>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${u.role === 'superadmin' ? 'bg-brand-500/20 text-brand-400' : u.role === 'owner' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-500/20 text-slate-400'}`}>
                      {roleLabel(u.role)}
                    </span>
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
                          <button
                            onClick={() => setResetModal({ open: true, user: u, password: '' })}
                            className="btn-ghost btn-sm text-brand-400"
                          >
                            Reset Password
                          </button>
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
              <option value="tenant">Standalone Tenant</option>
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
    </div>
  );
};

export default UsersPage;
