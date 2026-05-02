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

  const handleAction = async (id, status) => {
    const reason = status === 'rejected' ? prompt('Reason for rejection (optional):') : null;
    if (status === 'rejected' && reason === null) return; // User cancelled prompt

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
          <h1 className="text-2xl font-bold text-gray-900">Owner Access Requests</h1>
          <p className="text-gray-500 text-sm">Review and approve new property owners.</p>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search by name, email..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="text-gray-300 w-8 h-8" />
            </div>
            <p className="text-gray-500 font-medium">No pending requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Applicant</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Property Details</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRequests.map((request) => (
                  <tr key={request._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">{request.name}</span>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                          <Mail className="w-3 h-3" />
                          {request.email}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                          <Phone className="w-3 h-3" />
                          {request.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          {request.propertyName || <span className="text-gray-300 italic">Not specified</span>}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          {request.propertyLocation || <span className="text-gray-300 italic">N/A</span>}
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
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
                        <span className="text-xs text-gray-400 italic">
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
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-amber-50 text-amber-700 border-amber-100',
    approved: 'bg-green-50 text-green-700 border-green-100',
    rejected: 'bg-red-50 text-red-700 border-red-100',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${styles[status]}`}>
      {status.toUpperCase()}
    </span>
  );
};

export default AdminOwnerRequests;
