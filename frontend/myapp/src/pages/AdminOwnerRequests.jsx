import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, UserX, Clock, MapPin, Building2, Phone, Mail, Search } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/common/Skeleton.jsx';

const AdminOwnerRequests = () => {
  const { showToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

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

    const reason = status === 'rejected' ? prompt('Reason for rejection (optional):') : null;
    if (status === 'rejected' && reason === null) return;

    setProcessingId(id);
    try {
      const res = await api.patch(`/owner-requests/${id}/status`, { status, reason });
      if (res.data.success) {
        showToast(`Request ${status} successfully!`, 'success');
        fetchRequests();
      }
    } catch (err) {
      showToast(err.message || 'Action failed.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Owner Access Requests</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Review and approve new property owners.</p>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search by name, email..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Applicant</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Property Details</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredRequests.map((request) => (
                  <tr key={request._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 dark:text-white">{request.name}</span>
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
                      <StatusBadge status={request.status} />
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
