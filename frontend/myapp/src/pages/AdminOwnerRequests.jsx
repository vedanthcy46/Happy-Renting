import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, UserX, Clock, MapPin, Building2, Phone, Mail, Search, Star, StickyNote, ChevronDown, ChevronUp, Send as SendIcon, Archive } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/common/Skeleton.jsx';

const AdminOwnerRequests = () => {
  const { showToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [rejectionModal, setRejectionModal] = useState({ open: false, requestId: null });
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get('/owner-requests');
      if (res.data.success) {
        setRequests(res.data.requests);
      }
    } catch (err) {
      showToast('Failed to load owner requests.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [tempPassword, setTempPassword] = useState('');

  // Notes & Priority state
  const [expandedNotes, setExpandedNotes] = useState({}); // { [requestId]: boolean }
  const [noteInputs, setNoteInputs] = useState({});       // { [requestId]: string }
  const [savingNote, setSavingNote] = useState(null);     // requestId being saved
  const [togglingPriority, setTogglingPriority] = useState(null); // requestId
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkRejectionModal, setBulkRejectionModal] = useState(false);
  const [clearingExpired, setClearingExpired] = useState(false);

  const handleOpenModal = (request) => {
    setSelectedRequest(request);
    setTempPassword(Math.random().toString(36).slice(-8) + 'A1!'); // Initial random pass
    setIsModalOpen(true);
  };

  const handleConfirmApproval = async () => {
    if (!tempPassword) return showToast('Please set a password', 'error');
    
    setProcessingId(selectedRequest._id);
    try {
      const res = await api.patch(`/owner-requests/${selectedRequest._id}/status`, { 
        status: 'approved', 
        password: tempPassword 
      });
      if (res.data.success) {
        showToast('Owner approved and account created!', 'success');
        setIsModalOpen(false);
        fetchRequests();
      }
    } catch (err) {
      showToast(err.message || 'Approval failed.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleAction = async (id, status) => {
    if (status === 'approved') {
      const req = requests.find(r => r._id === id);
      handleOpenModal(req);
      return;
    }
    if (status === 'rejected') {
      setRejectionReason('');
      setRejectionModal({ open: true, requestId: id });
      return;
    }
  };

  const handleConfirmRejection = async () => {
    if (!rejectionReason.trim() || rejectionReason.trim().length < 5) {
      return showToast('Please provide a reason (min 5 characters).', 'error');
    }
    setProcessingId(rejectionModal.requestId);
    setRejectionModal({ open: false, requestId: null });
    try {
      const res = await api.patch(`/owner-requests/${rejectionModal.requestId}/status`, {
        status: 'rejected',
        reason: rejectionReason.trim()
      });
      if (res.data.success) {
        showToast('Request rejected.', 'success');
        fetchRequests();
      }
    } catch (err) {
      showToast(err.message || 'Action failed.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleTogglePriority = async (requestId, current) => {
    setTogglingPriority(requestId);
    try {
      const res = await api.patch(`/owner-requests/${requestId}/priority`);
      if (res.data.success) {
        setRequests(prev => prev.map(r =>
          r._id === requestId ? { ...r, isPriority: res.data.isPriority } : r
        ));
      }
    } catch (err) {
      showToast('Failed to update priority.', 'error');
    } finally {
      setTogglingPriority(null);
    }
  };

  const handleAddNote = async (requestId) => {
    const note = (noteInputs[requestId] || '').trim();
    if (note.length < 3) return showToast('Note must be at least 3 characters.', 'error');
    setSavingNote(requestId);
    try {
      const res = await api.post(`/owner-requests/${requestId}/notes`, { note });
      if (res.data.success) {
        setRequests(prev => prev.map(r =>
          r._id === requestId ? { ...r, adminNotes: res.data.adminNotes } : r
        ));
        setNoteInputs(prev => ({ ...prev, [requestId]: '' }));
        showToast('Note saved.', 'success');
      }
    } catch (err) {
      showToast('Failed to save note.', 'error');
    } finally {
      setSavingNote(null);
    }
  };

  const toggleSelectAll = () => {
    const pendingIds = filteredRequests.filter(r => r.status === 'pending').map(r => r._id);
    if (selectedIds.length === pendingIds.length) {
      setSelectedIds([]); // deselect all
    } else {
      setSelectedIds(pendingIds); // select all pending
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleClearExpired = async () => {
    if (!window.confirm("This will expire all pending requests older than 14 days. Proceed?")) return;
    setClearingExpired(true);
    try {
      const res = await api.post('/owner-requests/expire-old');
      showToast(res.data.message, 'success');
      fetchRequests();
    } catch (err) {
      showToast('Failed to clear expired requests.', 'error');
    } finally {
      setClearingExpired(false);
    }
  };

  const handleBulkApprove = async () => {
    if (!window.confirm(`Approve ${selectedIds.length} requests? (Passwords will be auto-generated and emailed)`)) return;
    setBulkProcessing(true);
    try {
      const res = await api.patch('/owner-requests/bulk-status', {
        requestIds: selectedIds,
        status: 'approved'
      });
      showToast(res.data.message, 'success');
      setSelectedIds([]);
      fetchRequests();
    } catch (err) {
      showToast('Bulk approve failed.', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (!rejectionReason.trim() || rejectionReason.trim().length < 5) {
      return showToast('Please provide a reason (min 5 characters).', 'error');
    }
    setBulkProcessing(true);
    try {
      const res = await api.patch('/owner-requests/bulk-status', {
        requestIds: selectedIds,
        status: 'rejected',
        reason: rejectionReason.trim()
      });
      showToast(res.data.message, 'success');
      setBulkRejectionModal(false);
      setSelectedIds([]);
      fetchRequests();
    } catch (err) {
      showToast('Bulk reject failed.', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const filteredRequests = requests
    .filter(r =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.phone.includes(searchTerm)
    )
    .filter(r => !statusFilter || r.status === statusFilter)
    .sort((a, b) => {
      if (a.status === 'pending' && b.status === 'pending') {
        if (a.isPriority && !b.isPriority) return -1;
        if (!a.isPriority && b.isPriority) return 1;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Owner Access Requests</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Review and approve new property owners.</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleClearExpired}
            disabled={clearingExpired}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <Archive className="w-4 h-4" />
            {clearingExpired ? 'Clearing...' : 'Clear Expired (>14d)'}
          </button>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name, email..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="py-2 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            value={statusFilter || ''}
            onChange={e => setStatusFilter(e.target.value || null)}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="text-gray-300 dark:text-gray-600 w-8 h-8" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No pending requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-left">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={filteredRequests.filter(r => r.status === 'pending').length > 0 && selectedIds.length === filteredRequests.filter(r => r.status === 'pending').length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Applicant</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Property Details</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredRequests.map((request) => (
                  <React.Fragment key={request._id}>
                  <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-5">
                      {request.status === 'pending' ? (
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedIds.includes(request._id)}
                          onChange={() => toggleSelect(request._id)}
                        />
                      ) : null}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white">{request.name}</span>
                          <button
                            onClick={() => handleTogglePriority(request._id, request.isPriority)}
                            disabled={togglingPriority === request._id}
                            title={request.isPriority ? 'Remove priority' : 'Mark as priority'}
                            className={`p-0.5 rounded transition-colors disabled:opacity-40 ${
                              request.isPriority
                                ? 'text-amber-400 hover:text-amber-500'
                                : 'text-gray-300 dark:text-gray-600 hover:text-amber-400'
                            }`}
                          >
                            <Star className={`w-4 h-4 ${request.isPriority ? 'fill-amber-400' : ''}`} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <Mail className="w-3 h-3" />
                          {request.email}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <Phone className="w-3 h-3" />
                          {request.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                          <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          {request.propertyName || <span className="text-gray-300 dark:text-gray-600 italic">Not specified</span>}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <MapPin className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                          {request.propertyLocation || <span className="text-gray-300 dark:text-gray-600 italic">N/A</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={request.status} />
                        {new Date(request.updatedAt) - new Date(request.createdAt) > 1000 && (
                          <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                            RESUBMITTED
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {request.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleAction(request._id, 'rejected')}
                            disabled={processingId === request._id}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Reject Request"
                          >
                            <UserX className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleAction(request._id, 'approved')}
                            disabled={processingId === request._id}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                          >
                            <UserCheck className="w-4 h-4" />
                            Approve
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                          Processed on {new Date(request.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                  </tr>
                  {/* Admin Notes expandable row */}
                  <tr key={`notes-${request._id}`}>
                    <td colSpan={5} className="px-6 pb-0 pt-0">
                      <div className="border-t border-gray-50 dark:border-gray-800/50">
                        {/* Notes toggle button */}
                        <button
                          onClick={() => setExpandedNotes(prev => ({ ...prev, [request._id]: !prev[request._id] }))}
                          className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 py-2 transition-colors"
                        >
                          <StickyNote className="w-3.5 h-3.5" />
                          <span>
                            {(request.adminNotes?.length || 0) > 0
                              ? `${request.adminNotes.length} admin note${request.adminNotes.length > 1 ? 's' : ''}`
                              : 'Add admin note'
                            }
                          </span>
                          {expandedNotes[request._id]
                            ? <ChevronUp className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />
                          }
                        </button>

                        {/* Notes panel */}
                        {expandedNotes[request._id] && (
                          <div className="pb-4 space-y-3">
                            {/* Existing notes */}
                            {(request.adminNotes || []).length > 0 && (
                              <div className="space-y-2">
                                {request.adminNotes.map((n, idx) => (
                                  <div key={idx} className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-xl px-4 py-3">
                                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{n.note}</p>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
                                      {n.addedBy} · {new Date(n.addedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* New note input */}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={noteInputs[request._id] || ''}
                                onChange={e => setNoteInputs(prev => ({ ...prev, [request._id]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleAddNote(request._id)}
                                placeholder="Add an internal note..."
                                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
                              />
                              <button
                                onClick={() => handleAddNote(request._id)}
                                disabled={savingNote === request._id || !(noteInputs[request._id]?.trim().length >= 3)}
                                className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center gap-1.5 text-sm font-medium"
                              >
                                <SendIcon className="w-3.5 h-3.5" />
                                {savingNote === request._id ? '...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 border border-gray-700 dark:border-gray-200">
          <span className="font-bold whitespace-nowrap">{selectedIds.length} Selected</span>
          <div className="flex gap-2">
            <button
              onClick={() => { setRejectionReason(''); setBulkRejectionModal(true); }}
              disabled={bulkProcessing}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <UserX className="w-4 h-4" /> Reject
            </button>
            <button
              onClick={handleBulkApprove}
              disabled={bulkProcessing}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <UserCheck className="w-4 h-4" /> Approve
            </button>
          </div>
        </div>
      )}

      {/* Bulk Rejection Modal */}
      {bulkRejectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-gray-800">
            <div className="bg-red-600 p-6 text-white">
              <h3 className="text-xl font-bold">Reject {selectedIds.length} Requests</h3>
              <p className="text-red-100 text-sm mt-1">Provide a reason — this will be emailed to all selected applicants.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1 block mb-1.5">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="e.g. The property details provided are incomplete."
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all resize-none text-sm"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setBulkRejectionModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkReject}
                  disabled={!rejectionReason.trim() || rejectionReason.trim().length < 5 || bulkProcessing}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none disabled:opacity-50"
                >
                  {bulkProcessing ? 'Rejecting...' : 'Confirm Bulk Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-gray-800">
            <div className="bg-blue-600 p-6 text-white">
              <h3 className="text-xl font-bold">Approve Owner Access</h3>
              <p className="text-blue-100 text-sm mt-1">Review details and set temporary password.</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl space-y-2">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Applicant</p>
                  <p className="font-bold text-gray-900 dark:text-white">{selectedRequest?.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedRequest?.email}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">Temporary Password</label>
                  <input 
                    type="text"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="Enter password for owner"
                  />
                  <p className="text-[10px] text-gray-500 ml-1">This password will be sent to the owner's email.</p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmApproval}
                  disabled={processingId}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200 dark:shadow-none disabled:opacity-50"
                >
                  {processingId ? 'Approving...' : 'Confirm Approval'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-gray-800">
            <div className="bg-red-600 p-6 text-white">
              <h3 className="text-xl font-bold">Reject Owner Request</h3>
              <p className="text-red-100 text-sm mt-1">Provide a reason — this will be emailed to the applicant.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1 block mb-1.5">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="e.g. The property details provided are incomplete. Please resubmit with your property address and name."
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all resize-none text-sm placeholder:text-gray-400"
                />
                {rejectionReason.trim().length > 0 && rejectionReason.trim().length < 5 && (
                  <p className="text-xs text-red-500 mt-1 ml-1">Minimum 5 characters required.</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setRejectionModal({ open: false, requestId: null })}
                  className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRejection}
                  disabled={!rejectionReason.trim() || rejectionReason.trim().length < 5}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30',
    approved: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900/30',
    rejected: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${styles[status]}`}>
      {status.toUpperCase()}
    </span>
  );
};

export default AdminOwnerRequests;
