import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';

const ComplaintDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isOwner, user } = useAuth();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Comments
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Status Update (Owner only)
  const [status, setStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchComplaint = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/complaints/${id}`);
      setComplaint(data.complaint);
      setStatus(data.complaint.status);
      setResolutionNotes(data.complaint.resolutionNotes || '');
    } catch (err) {
      toast.error(err.message || 'Failed to load complaint');
      navigate('/complaints');
    } finally {
      setLoading(false);
    }
  }, [id, toast, navigate]);

  const fetchComplaintSilent = useCallback(async () => {
    try {
      const { data } = await api.get(`/complaints/${id}`);
      setComplaint(prev => {
        // Only update if there's an actual change in comments length or status to avoid unnecessary re-renders
        if (!prev || prev.comments.length !== data.complaint.comments.length || prev.status !== data.complaint.status) {
          return data.complaint;
        }
        return prev;
      });
    } catch (err) {
      // Ignore polling errors
    }
  }, [id]);

  useEffect(() => {
    fetchComplaint();
    
    // Poll every 5 seconds for real-time communication
    const interval = setInterval(() => {
      fetchComplaintSilent();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchComplaint, fetchComplaintSilent]);

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post(`/complaints/${id}/comments`, { message });
      setComplaint(data.complaint);
      setMessage('');
      toast.success('Message sent');
    } catch (err) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const { data } = await api.patch(`/complaints/${id}`, { status, resolutionNotes });
      setComplaint(data.complaint);
      toast.success('Complaint status updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!complaint) return null;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-4 min-w-0">
        <button onClick={() => navigate('/complaints')} className="p-2 hover:bg-surface-border rounded-full transition-colors" aria-label="Go back to complaints">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="page-title mb-0">Complaint Details</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Details */}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{complaint.title}</h2>
              <StatusBadge status={complaint.status} />
            </div>
            
            <div className="flex flex-wrap gap-3 mb-6">
              <span className={`text-xs uppercase font-bold px-2 py-0.5 rounded border
                ${complaint.priority === 'urgent' ? 'bg-danger/10 text-danger border-danger/20' : 
                  complaint.priority === 'high' ? 'bg-warning/10 text-warning border-warning/20' : 
                  'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                Priority: {complaint.priority}
              </span>
              <span className="text-xs uppercase font-bold px-2 py-0.5 rounded border bg-brand-500/10 text-brand-400 border-brand-500/20">
                {complaint.category}
              </span>
              <span className="text-xs uppercase font-bold px-2 py-0.5 rounded border bg-slate-500/10 text-slate-400 border-slate-500/20">
                Created: {new Date(complaint.createdAt).toLocaleDateString()}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-surface-border/30 rounded-lg">
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{complaint.description}</p>
            </div>

            {complaint.resolutionNotes && (
              <div className="mt-6 p-4 rounded-xl bg-success/5 border border-success/20">
                <p className="text-xs text-success font-bold uppercase mb-2">Resolution Notes</p>
                <p className="text-sm text-success/90">{complaint.resolutionNotes}</p>
                {complaint.resolvedAt && (
                  <p className="text-xs text-success/70 mt-2">Resolved on {new Date(complaint.resolvedAt).toLocaleString()}</p>
                )}
              </div>
            )}
          </div>

          {/* Conversation History */}
          <div className="card p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Conversation History</h3>
            
            <div className="space-y-4 mb-6">
              {complaint.comments && complaint.comments.length > 0 ? (
                complaint.comments.map((comment) => {
                  const isOwn = comment.author === user._id || (comment.authorRole === user.role);
                  return (
                    <div key={comment._id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-2xl ${
                        isOwn 
                          ? 'bg-brand-500 text-white rounded-tr-sm' 
                          : 'bg-slate-100 dark:bg-surface-border text-slate-800 dark:text-slate-200 rounded-tl-sm'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold uppercase ${isOwn ? 'text-brand-100' : 'text-slate-400'}`}>
                            {comment.authorRole}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{comment.message}</p>
                        <p className={`text-xs mt-2 ${isOwn ? 'text-brand-200' : 'text-slate-500'}`}>
                          {new Date(comment.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>No messages yet. Send a message to start the conversation.</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSendComment} className="flex gap-2">
              <input
                type="text"
                name="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={['resolved', 'closed', 'rejected'].includes(complaint.status) ? "This complaint is closed. Open a new one if needed." : "Type a message..."}
                className="form-input flex-1 disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-800"
                disabled={sending || ['resolved', 'closed', 'rejected'].includes(complaint.status)}
                autoComplete="off"
              />
              <button 
                type="submit" 
                className="btn-primary whitespace-nowrap"
                disabled={!message.trim() || sending || ['resolved', 'closed', 'rejected'].includes(complaint.status)}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tenant/Room Info */}
          <div className="card p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Location & Contact</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Property & Room</p>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{complaint.propertyId?.name} - Room {complaint.roomId?.roomNumber}</p>
              </div>
              {isOwner && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tenant Name</p>
                  <p className="text-sm text-slate-900 dark:text-white font-medium">{complaint.tenantId?.userId?.name || 'Unknown Tenant'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Owner Actions */}
          {isOwner && complaint.status !== 'resolved' && (
            <div className="card p-6 border-brand-500/30 border">
              <h3 className="text-sm font-bold text-brand-400 uppercase tracking-wider mb-4">Update Status</h3>
              <form onSubmit={handleUpdateStatus} className="space-y-4">
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    id="status"
                    name="status"
                    className="form-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                
                {(status === 'resolved' || status === 'rejected') && (
                  <div>
                    <label htmlFor="resolutionNotes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Resolution Notes</label>
                    <textarea
                      id="resolutionNotes"
                      name="resolutionNotes"
                      className="form-input h-24"
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Enter notes about how this was resolved..."
                      required
                    />
                  </div>
                )}

                <button 
                  type="submit" 
                  className="btn-primary w-full"
                  disabled={updating}
                >
                  {updating ? 'Updating…' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplaintDetailsPage;
