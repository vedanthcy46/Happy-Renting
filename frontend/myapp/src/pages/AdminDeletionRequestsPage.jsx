import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, CheckCircle, XCircle, Loader2, Clock, AlertTriangle, UserX, Ban, Calendar, Shield } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';

const statusConfig = {
  pending: { label: 'Pending Owner', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: Clock },
  pending_owner: { label: 'Pending Owner', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: Clock },
  owner_approved: { label: 'Grace Period', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: Calendar },
  owner_rejected: { label: 'Rejected', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', icon: XCircle },
  cancelled: { label: 'Cancelled', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', icon: Ban },
  completed: { label: 'Completed', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle },
};

const AdminDeletionRequestsPage = () => {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const { data } = await api.get(`/account/delete/admin${params}`);
      setRequests(data.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load deletion requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (request) => {
    if (!window.confirm(`Approve deletion for ${request.userId?.name || request.email}? A 30-day grace period will start.`)) return;
    setActionLoading(true);
    try {
      const { data } = await api.post(`/account/delete/admin/${request._id}/approve`);
      if (data.data?.scheduledDeletionAt) {
        toast.success(`Deletion approved. Scheduled for ${new Date(data.data.scheduledDeletionAt).toLocaleDateString('en-IN')}`);
      } else {
        toast.success('Deletion approved');
      }
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceDelete = async (request) => {
    if (!window.confirm(
      `FORCE DELETE ${request.userId?.name || request.email} immediately?\n\nThis cannot be undone.\nPersonal data will be anonymized immediately.`
    )) return;
    setActionLoading(true);
    try {
      await api.post(`/account/delete/admin/${request._id}/force-delete`);
      toast.success('Account force-deleted');
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      toast.error(err.message || 'Failed to force-delete');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.warning('Please provide a reason for rejection');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/account/delete/admin/${selectedRequest._id}/reject`, { reason: rejectReason });
      toast.success('Deletion request rejected');
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      toast.error(err.message || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingOwnerCount = requests.filter(r => r.status === 'pending_owner' || r.status === 'pending').length;
  const gracePeriodCount = requests.filter(r => r.status === 'owner_approved').length;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white">Data Deletion Requests</h1>
          <p className="text-sm text-slate-400">Manage account deletion requests across all tenants</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-400">{pendingOwnerCount} Awaiting Review</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-slate-400">{gracePeriodCount} Grace Period</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Status</option>
            <option value="pending_owner">Pending Owner</option>
            <option value="owner_approved">Grace Period</option>
            <option value="owner_rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="bg-slate-800/50 rounded-3xl border border-slate-700 p-12 text-center">
          <UserX className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No deletion requests found</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-3xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/80">
                  <th className="text-left px-4 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider">Reference</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider">Owner</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider">Reason</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider">Scheduled</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {requests.map((req) => {
                  const cfg = statusConfig[req.status] || statusConfig.pending_owner;
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={req._id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-white">{req.referenceId}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-200">{req.userId?.name || 'Unknown'}</span>
                        <span className="text-xs text-slate-500 block">{req.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-400">
                          {req.ownerId?.name ? (
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3 text-slate-500" />
                              {req.ownerId.name}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                        {req.status === 'owner_approved' && req.ownerId?.name && (
                          <span className="text-[10px] text-slate-500 block mt-0.5">by {req.ownerId.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500 max-w-[150px] block truncate">
                          {req.reason || (req.rejectionReason ? `Rejected: ${req.rejectionReason}` : '—')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {req.scheduledDeletionAt ? (
                          <span className="text-xs text-slate-400 font-mono">
                            {new Date(req.scheduledDeletionAt).toLocaleDateString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(req.status === 'pending_owner' || req.status === 'pending') && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(req)}
                              disabled={actionLoading}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Approve
                            </button>
                            <button
                              onClick={() => { setSelectedRequest(req); setShowRejectModal(true); }}
                              disabled={actionLoading}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" />
                              Reject
                            </button>
                            <button
                              onClick={() => handleForceDelete(req)}
                              disabled={actionLoading}
                              className="bg-red-800/50 hover:bg-red-700 text-red-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                              title="Force delete immediately"
                            >
                              <Trash2 className="w-3 h-3" />
                              Force
                            </button>
                          </div>
                        )}
                        {req.status === 'owner_approved' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleForceDelete(req)}
                              disabled={actionLoading}
                              className="bg-red-800/50 hover:bg-red-700 text-red-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              Force Delete
                            </button>
                          </div>
                        )}
                        {req.status === 'owner_rejected' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(req)}
                              disabled={actionLoading}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Override
                            </button>
                            <button
                              onClick={() => handleForceDelete(req)}
                              disabled={actionLoading}
                              className="bg-red-800/50 hover:bg-red-700 text-red-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              Force
                            </button>
                          </div>
                        )}
                        {req.status === 'completed' && (
                          <span className="text-xs text-emerald-400 font-semibold">Processed</span>
                        )}
                        {req.status === 'cancelled' && (
                          <span className="text-xs text-slate-500">Cancelled by tenant</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Deletion Request" size="md">
        <div className="space-y-4">
          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                Rejecting <strong className="text-white">{selectedRequest?.userId?.name || selectedRequest?.email}</strong>'s deletion request. They will be notified via email.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">Reason for Rejection *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why the request is being rejected..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setShowRejectModal(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading || !rejectReason.trim()}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-800/50 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {actionLoading ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminDeletionRequestsPage;
