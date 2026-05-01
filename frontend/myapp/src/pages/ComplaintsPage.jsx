'use strict';

import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';

const ComplaintsPage = () => {
  const toast = useToast();
  const { user, isTenant, isOwner } = useAuth();

  const [complaints, setComplaints] = useState([]);
  const [loading,    setLoading]    = useState(true);
  
  // Create Modal
  const [showAdd,    setShowAdd]    = useState(false);
  const [form,       setForm]       = useState({ title: '', description: '', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);

  // Update Modal (Owner)
  const [editing,    setEditing]    = useState(null);
  const [updateForm, setUpdateForm] = useState({ status: '', resolutionNotes: '' });

  const fetchComplaints = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/complaints');
      setComplaints(data.complaints);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      return toast.error('Please fill in title and description.');
    }
    setSubmitting(true);
    try {
      await api.post('/complaints', form);
      toast.success('Complaint raised successfully.');
      setShowAdd(false);
      setForm({ title: '', description: '', priority: 'medium' });
      fetchComplaints();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.patch(`/complaints/${editing._id}`, updateForm);
      toast.success('Complaint updated.');
      setEditing(null);
      fetchComplaints();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openUpdate = (complaint) => {
    setEditing(complaint);
    setUpdateForm({
      status: complaint.status,
      resolutionNotes: complaint.resolutionNotes || ''
    });
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Complaints & Maintenance</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isTenant ? 'Report and track your issues' : 'Manage tenant requests'}
          </p>
        </div>
        {isTenant && (
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            Raise Complaint
          </button>
        )}
      </div>

      {complaints.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">🛠️</div>
          <p className="text-slate-400">No complaints found.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {complaints.map(c => (
            <div key={c._id} className="card p-5 hover:border-brand-500/30 transition-all group">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={c.status} />
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border
                      ${c.priority === 'urgent' ? 'bg-danger/10 text-danger border-danger/20' : 
                        c.priority === 'high' ? 'bg-warning/10 text-warning border-warning/20' : 
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                      {c.priority}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors">{c.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{c.description}</p>
                  
                  <div className="flex flex-wrap gap-4 pt-2">
                    <div className="text-[10px]">
                      <span className="text-slate-500 uppercase font-bold mr-2">Location:</span>
                      <span className="text-slate-300">Room {c.roomId?.roomNumber} — {c.propertyId?.name}</span>
                    </div>
                    {isOwner && (
                      <div className="text-[10px]">
                        <span className="text-slate-500 uppercase font-bold mr-2">From:</span>
                        <span className="text-slate-300">{c.tenantId?.userId?.name}</span>
                      </div>
                    )}
                  </div>

                  {c.resolutionNotes && (
                    <div className="mt-4 p-3 rounded-xl bg-surface border border-surface-border italic">
                      <p className="text-[10px] text-brand-400 uppercase font-bold mb-1">Resolution Notes</p>
                      <p className="text-sm text-slate-300">{c.resolutionNotes}</p>
                      {c.resolvedAt && (
                        <p className="text-[9px] text-slate-500 mt-2">Resolved on {new Date(c.resolvedAt).toLocaleDateString()}</p>
                      )}
                    </div>
                  )}
                </div>

                {isOwner && c.status !== 'resolved' && (
                  <button onClick={() => openUpdate(c)} className="btn-secondary btn-sm whitespace-nowrap self-start">
                    Update Status
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Raise Complaint Modal (Tenant) */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Raise New Complaint">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="form-label">Title *</label>
            <input className="form-input" placeholder="e.g. Leaking Tap, Power Issue"
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={100} />
          </div>
          <div>
            <label className="form-label">Priority</label>
            <select className="form-select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="form-label">Description *</label>
            <textarea className="form-input resize-none" rows={4} placeholder="Describe the issue in detail..."
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={1000} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Raising...' : 'Submit Complaint'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Complaint Modal (Owner) */}
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Update Complaint Status">
        <form onSubmit={handleUpdateStatus} className="space-y-4">
          {editing && (
            <div className="p-4 rounded-xl bg-surface border border-surface-border mb-4">
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">Issue</p>
              <p className="text-white font-bold">{editing.title}</p>
              <p className="text-slate-400 text-xs mt-1">From: {editing.tenantId?.userId?.name} (Room {editing.roomId?.roomNumber})</p>
            </div>
          )}
          <div>
            <label className="form-label">Status</label>
            <select className="form-select" value={updateForm.status} onChange={e => setUpdateForm({ ...updateForm, status: e.target.value })}>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="form-label">Resolution Notes / Comments</label>
            <textarea className="form-input resize-none" rows={3} placeholder="Provide updates or resolution details..."
              value={updateForm.resolutionNotes} onChange={e => setUpdateForm({ ...updateForm, resolutionNotes: e.target.value })} maxLength={500} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Updating...' : 'Update Complaint'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ComplaintsPage;
