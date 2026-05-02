import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';

const PropertiesPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { isSuperAdmin, isOwner } = useAuth();

  const [properties, setProperties] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showAdd,    setShowAdd]    = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', city: '' });
  const [formErrors, setFormErrors] = useState({});

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/properties');
      setProperties(data.properties);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const validateForm = () => {
    const errs = {};
    if (!form.name.trim())    errs.name = 'Property name required';
    if (!form.address.trim()) errs.address = 'Address required';
    return errs;
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setForm({ name: '', address: '', city: '' });
    setFormErrors({});
    setShowAdd(true);
  };

  const openEditModal = (p) => {
    setIsEditing(true);
    setEditingId(p._id);
    setForm({ name: p.name, address: p.address, city: p.city });
    setFormErrors({});
    setShowAdd(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateForm();
    if (Object.keys(errs).length) return setFormErrors(errs);
    if (submitting) return;

    setSubmitting(true);
    try {
      if (isEditing) {
        await api.patch(`/properties/${editingId}`, form);
        toast.success('Property updated successfully!');
      } else {
        await api.post('/properties', form);
        toast.success('Property added successfully!');
      }
      setShowAdd(false);
      setForm({ name: '', address: '', city: '' });
      setFormErrors({});
      fetchProperties();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure? This will not delete the property but mark it as inactive.')) return;
    try {
      await api.patch(`/properties/${id}`, { isActive: false });
      toast.success('Property deactivated.');
      fetchProperties();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Properties</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isSuperAdmin ? 'View all platform properties' : 'Manage your real estate assets'}
          </p>
        </div>
        {(isOwner || isSuperAdmin) && (
          <button onClick={openAddModal} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Property
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : properties.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">🏠</div>
          <p className="text-slate-400">No properties found.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map(p => (
            <div key={p._id} className="card p-6 flex flex-col group hover:border-brand-500 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-2xl">
                  🏘️
                </div>
                {(isOwner || isSuperAdmin) && (
                  <div className="flex gap-1">
                    <button onClick={() => openEditModal(p)} className="text-slate-500 hover:text-brand-400 p-1 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(p._id)} className="text-slate-500 hover:text-danger p-1 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{p.name}</h3>
              <p className="text-slate-400 text-sm mb-4 flex-1">{p.address}, {p.city}</p>
              
              <div className="pt-4 border-t border-surface-border flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${p.isActive ? 'bg-success/10 text-success' : 'bg-slate-500/10 text-slate-500'}`}>
                  {p.isActive ? 'Active' : 'Inactive'}
                </span>
                {(isOwner || isSuperAdmin) && (
                  <button 
                    onClick={() => navigate(`/rooms?propertyId=${p._id}`)}
                    className="text-brand-400 text-sm font-semibold hover:underline"
                  >
                    Manage Rooms →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Property Modal (Add/Edit) */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title={isEditing ? 'Edit Property' : 'Add New Property'}>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="form-label">Property Name *</label>
            <input className={`form-input ${formErrors.name ? 'border-danger' : ''}`}
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Sunshine Apartments" maxLength={100} />
            {formErrors.name && <p className="form-error">{formErrors.name}</p>}
          </div>
          <div>
            <label className="form-label">Address *</label>
            <input className={`form-input ${formErrors.address ? 'border-danger' : ''}`}
              value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Street address" maxLength={200} />
            {formErrors.address && <p className="form-error">{formErrors.address}</p>}
          </div>
          <div>
            <label className="form-label">City</label>
            <input className="form-input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              placeholder="City name" maxLength={60} />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? (isEditing ? 'Updating…' : 'Adding…') : (isEditing ? 'Update Property' : 'Add Property')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PropertiesPage;
