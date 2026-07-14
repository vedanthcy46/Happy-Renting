import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Loader2, AlertTriangle, UserX, Shield } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';

const statusConfig = {
  pending: { label: 'Pending Review', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  pending_owner: { label: 'Pending Review', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  owner_approved: { label: 'Approved - Grace Period', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  owner_rejected: { label: 'Rejected', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  cancelled: { label: 'Cancelled', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  completed: { label: 'Completed', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

const OwnerDeletionRequestsPage = () => {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const { data } = await api.get(`/account/delete/owner${params}`);
      setRequests(data.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load deletion requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await api.post(`/account/delete/owner/${selectedRequest._id}/approve`);
      toast.success(`Deletion approved. Scheduled for deletion after 30 days.`);
      setShowApproveModal(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      const checks = err.checks;
      if (checks && Array.isArray(checks.blocks)) {
        toast.error(`Cannot approve: ${checks.blocks.map(b => b.message).join('; ')}`);
      } else {
        toast.error(err.message || 'Failed to approve');
      }
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
      await api.post(`/account/delete/owner/${selectedRequest._id}/reject`, { reason: rejectReason });
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

  const pendingCount = requests.filter(r => r.status === 'pending_owner' || r.status === 'pending').length;

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
          <h1 className="text-xl font-extrabold text-white">Tenant Deletion Requests</h1>
          <p className="text-sm text-slate-400">Review and manage tenant account deletion requests</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-400">{pendingCount} Pending Review</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Status</option>
            <option value="pending_owner">Pending Review</option>
            <option value="owner_approved">Approved</option>
            <option value="owner_rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="bg-slate-800/50 rounded-3xl border border-slate-700 p-12 text-center">
          <UserX className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No deletion requests from your tenants</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-3xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/80">
                  <th className="text-left px-4 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider">Tenant</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider">Room</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider">Reason</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider">Requested</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {requests.map((req) => {
                  const cfg = statusConfig[req.status] || statusConfig.pending_owner;
                  return (
                    <tr key={req._id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-white font-medium">{req.userId?.name || 'Unknown'}</span>
                        <span className="text-xs text-slate-500 block">{req.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-400">{req.tenantId?.roomId || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                          {cfg.label}
                        </span>
                        {req.scheduledDeletionAt && (
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Del: {new Date(req.scheduledDeletionAt).toLocaleDateString('en-IN')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500 max-w-[150px] block truncate">
                          {req.reason || (req.rejectionReason ? `Rejected: ${req.rejectionReason}` : '—')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500">
                          {new Date(req.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(req.status === 'pending_owner' || req.status === 'pending') && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => { setSelectedRequest(req); setShowApproveModal(true); }}
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
                          </div>
                        )}
                        {req.status === 'owner_approved' && (
                          <span className="text-xs text-blue-400">Approved</span>
                        )}
                        {req.status === 'owner_rejected' && (
                          <span className="text-xs text-red-400">Rejected</span>
                        )}
                        {req.status === 'cancelled' && (
                          <span className="text-xs text-slate-500">Cancelled by tenant</span>
                        )}
                        {req.status === 'completed' && (
                          <span className="text-xs text-emerald-400">Processed</span>
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

      <Modal isOpen={showApproveModal} onClose={() => setShowApproveModal(false)} title="Approve Deletion Request" size="md">
        <div className="space-y-4">
          <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-300 font-semibold mb-1">Approve deletion for {selectedRequest?.userId?.name}?</p>
                <p className="text-xs text-blue-400/70">
                  Their account will be permanently deleted after a 30-day grace period. During this time they can cancel. Payment records will be retained for compliance.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
            <p className="text-xs text-amber-300 font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Validation checks will be performed before approval
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setShowApproveModal(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800/50 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {actionLoading ? 'Checking...' : 'Confirm Approval'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Deletion Request" size="md">
        <div className="space-y-4">
          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                Rejecting <strong className="text-white">{selectedRequest?.userId?.name}</strong>'s deletion request. They will be notified via email.
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

export default OwnerDeletionRequestsPage;
