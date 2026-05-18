import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';

const MyRoomPage = () => {
  const toast = useToast();
  const [tenancy, setTenancy] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRoommate, setShowAddRoommate] = useState(false);
  const [roommateData, setRoommateData] = useState({ name: '', phone: '', idProof: '' });
  const [editRoommateId, setEditRoommateId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchMyRoom = useCallback(async () => {
    try {
      setLoading(true);
      const [roomRes, payRes] = await Promise.all([
        api.get('/tenants/my'),
        api.get('/v2/payments') // fetches tenant's own rent records
      ]);
      setTenancy(roomRes.data.tenant);
      setPayments(payRes.data.rentRecords || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleAddRoommate = async (e) => {
    e.preventDefault();
    if (!roommateData.name) return toast.error('Name is required');
    
    setSubmitting(true);
    try {
      if (editRoommateId) {
        await api.patch(`/tenants/${tenancy._id}/co-occupants/${editRoommateId}`, roommateData);
        toast.success('Roommate updated successfully!');
      } else {
        await api.post(`/tenants/${tenancy._id}/co-occupants`, { coOccupants: [roommateData] });
        toast.success('Roommate added successfully!');
      }
      setShowAddRoommate(false);
      setEditRoommateId(null);
      setRoommateData({ name: '', phone: '', idProof: '' });
      fetchMyRoom(); // Refresh data
    } catch (err) {
      toast.error(err.message || 'Failed to save roommate.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRoommate = async (coId) => {
    if (!window.confirm("Are you sure you want to remove this roommate?")) return;
    try {
      setLoading(true);
      await api.delete(`/tenants/${tenancy._id}/co-occupants/${coId}`);
      toast.success('Roommate removed successfully!');
      fetchMyRoom();
    } catch (err) {
      toast.error(err.message || 'Failed to remove roommate.');
      setLoading(false);
    }
  };

  const openEditRoommate = (co) => {
    setEditRoommateId(co._id);
    setRoommateData({ name: co.name || '', phone: co.phone || '', idProof: co.idProof || '' });
    setShowAddRoommate(true);
  };

  useEffect(() => { fetchMyRoom(); }, [fetchMyRoom]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;

  if (!tenancy) {
    return (
      <div className="card p-12 text-center max-w-2xl mx-auto">
        <div className="text-6xl mb-6">📭</div>
        <h2 className="text-2xl font-bold text-white mb-2">No Active Room</h2>
        <p className="text-slate-400">
          You are currently not assigned to any room. Please contact your property owner.
        </p>
      </div>
    );
  }

  const { roomId: room, propertyId: property } = tenancy;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-title">My Room</h1>
          <p className="text-slate-400 text-sm mt-1">Details of your current accommodation</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${tenancy.status === 'active' ? 'bg-success/10 text-success' : 'bg-slate-500/10 text-slate-500'}`}>
          {tenancy.status.toUpperCase()}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Room Info */}
        <div className="card p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg className="w-24 h-24 text-brand-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 12h2v1h-2v2h-1v-2h-2v-1h2v-2h1v2zm-4-4V7h-4V4H9v3H5v1h4v4h1V8h4v4h1V8zM3 3h18v18H3V3zm16 16V5H5v14h14z"/>
            </svg>
          </div>
          
          <h3 className="text-brand-400 text-sm font-bold uppercase tracking-wider mb-4">Accommodation Details</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-500 text-[10px] uppercase font-bold">Room Number</p>
                <p className="text-xl font-bold text-white">Room {room.roomNumber}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] uppercase font-bold">Floor</p>
                <p className="text-lg text-slate-200">{room.floor || 'N/A'}</p>
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold">Property</p>
              <p className="text-lg text-slate-200">{property.name}</p>
              <p className="text-sm text-slate-400">{property.address}</p>
            </div>
          </div>
        </div>

        {/* Owner Contact Card (New) */}
        <div className="card p-8 border-brand-500/20 bg-brand-500/5 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-5">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <h3 className="text-brand-400 text-sm font-bold uppercase tracking-wider mb-4">Property Owner</h3>
          <div className="space-y-4 relative z-10">
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold">Owner Name</p>
              <p className="text-lg font-bold text-white">{tenancy.ownerId?.name}</p>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold">Phone Number</p>
              <a href={`tel:${tenancy.ownerId?.phone}`} className="text-lg text-brand-400 font-mono hover:underline flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {tenancy.ownerId?.phone || 'Not provided'}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Financial Info */}
        <div className="card p-8">
          <h3 className="text-brand-400 text-sm font-bold uppercase tracking-wider mb-4">Financial Summary</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-xs uppercase font-bold">Monthly Rent</p>
                <p className="text-3xl font-bold text-white">₹{room.monthlyRent?.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-xs uppercase font-bold">Advance Paid</p>
                <p className="text-xl font-semibold text-brand-400">₹{tenancy.advancePaid?.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="pt-6 border-t border-slate-800">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">Join Date</span>
                <span className="text-white font-mono">{new Date(tenancy.joinDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Group Size</span>
                <span className="text-white font-mono">{1 + (tenancy.coOccupants?.length || 0)} Persons</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment QR / UPI Section */}
        <div className="card p-8 border-brand-500/20 bg-brand-500/5 flex flex-col items-center justify-center text-center space-y-4">
          <h3 className="text-brand-400 text-sm font-bold uppercase tracking-wider">Rent Payment</h3>
          
          {tenancy.ownerId?.qrCodeImage?.secureUrl ? (
            <>
              <div className="p-4 bg-white rounded-3xl shadow-glow overflow-hidden w-full max-w-[240px] aspect-square transition-transform hover:scale-105">
                <img 
                  src={tenancy.ownerId.qrCodeImage.secureUrl} 
                  alt="Payment QR" 
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-white font-bold">Scan to Pay via UPI</p>
            </>
          ) : (
            <div className="py-8">
              <div className="text-4xl mb-3 text-slate-600">🚫</div>
              <p className="text-slate-400 text-sm italic">No QR code uploaded by owner.</p>
            </div>
          )}

          {tenancy.ownerId?.upiId && (
            <div className="pt-2">
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">UPI ID</p>
              <p className="text-lg font-mono text-brand-400 bg-brand-400/10 px-4 py-1.5 rounded-lg border border-brand-400/20 select-all">
                {tenancy.ownerId.upiId}
              </p>
            </div>
          )}
          
          {tenancy.ownerId?.upiNumber && (
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">UPI Number / Phone</p>
              <p className="text-white font-mono">{tenancy.ownerId.upiNumber}</p>
            </div>
          )}
        </div>
      </div>

      {/* Group Members / Co-Occupants */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Roommates / Family
          </h3>
          {room.currentOccupancy < room.capacity && (
            <button onClick={() => setShowAddRoommate(true)} className="btn-secondary text-[10px] py-1 px-3">
              + Add Member
            </button>
          )}
        </div>
        {tenancy.coOccupants && tenancy.coOccupants.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tenancy.coOccupants.map((co) => (
              <div key={co._id} className="p-3 rounded-xl bg-surface border border-surface-border relative group">
                <div className="pr-12">
                  <p className="text-sm font-bold text-white truncate">{co.name}</p>
                  {co.phone && <p className="text-xs text-slate-500 font-mono mt-0.5">{co.phone}</p>}
                  {co.idProof && (
                    <div className="mt-2 pt-2 border-t border-surface-border">
                      <span className="text-[10px] text-slate-400 uppercase">ID Proof provided</span>
                    </div>
                  )}
                </div>
                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditRoommate(co)} className="text-brand-400 hover:text-brand-300" title="Edit">
                    ✏️
                  </button>
                  <button onClick={() => handleDeleteRoommate(co._id)} className="text-danger hover:text-red-400" title="Delete">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm italic">You are the primary and only occupant of this room.</p>
        )}
      </div>

      {/* Payment History Timeline */}
      <div className="card p-8">
        <h3 className="text-brand-400 text-sm font-bold uppercase tracking-wider mb-6">Payment History</h3>
        
        {payments.length === 0 ? (
          <p className="text-slate-500 text-center py-4">No payment records found.</p>
        ) : (
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-surface-border before:to-transparent">
            {payments.map((pay, idx) => (
              <div key={pay._id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                {/* Icon */}
                <div className={`flex z-10 items-center justify-center w-10 h-10 rounded-full border-4 border-surface-card shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-glass
                  ${pay.status === 'paid' ? 'bg-success text-white' : 
                    pay.status === 'pending' ? 'bg-warning text-white' : 
                    pay.status === 'overdue' ? 'bg-danger text-white' : 'bg-slate-500 text-white'}`}>
                  {pay.status === 'paid' ? '✓' : pay.status === 'pending' ? '⏳' : '!'}
                </div>
                
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-surface-border bg-surface-card shadow-sm transition-all hover:shadow-glow hover:border-brand-500/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white text-sm">
                      {pay.billingPeriodStart ? (
                        `${new Date(pay.billingPeriodStart).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} → ${new Date(pay.billingPeriodEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
                      ) : (
                        pay.month
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {pay.billingType && pay.billingType !== 'full' && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          pay.billingType === 'prorated_join' 
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
                            : pay.billingType === 'prorated_moveout'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                        }`}>
                          {pay.billingType === 'prorated_join' ? 'Prorated Join' : 'Prorated Move-Out'}
                        </span>
                      )}
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border
                        ${pay.status === 'paid' ? 'bg-success/10 text-success border-success/20' : 
                          pay.status === 'partial' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                          pay.status === 'pending' ? 'bg-warning/10 text-warning border-warning/20' : 
                          pay.status === 'overdue' ? 'bg-danger/10 text-danger border-danger/20' : 
                          'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                        {pay.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Total Rent:</span>
                    <span className="text-white font-bold">₹{pay.totalRent.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-slate-400">Paid:</span>
                    <span className="text-green-400 font-bold">₹{pay.totalPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1 pt-1 border-t border-surface-border">
                    <span className="text-slate-300">Remaining:</span>
                    <span className="text-brand-400 font-bold">₹{pay.remainingAmount.toLocaleString()}</span>
                  </div>
                  {(pay.remainingAmount > 0) && (
                    <div className="mt-4 pt-3 border-t border-surface-border">
                      <Link to={`/tenant/pay/${pay._id}`} className="btn-primary w-full text-xs py-2 justify-center shadow-glow">
                        View / Pay
                      </Link>
                    </div>
                  )}
                  {pay.status === 'paid' && (
                    <div className="mt-4 pt-3 border-t border-surface-border">
                      <Link to={`/tenant/pay/${pay._id}`} className="text-brand-400 hover:text-brand-300 text-xs font-bold underline text-center block">
                        View Ledger & Receipts
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rules / Notes */}
      <div className="card p-6">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Important Notes
        </h3>
        <p className="text-slate-400 text-sm leading-relaxed">
          {tenancy.notes || "No special notes or rules have been added for this room yet. Please ensure timely payment of rent before the 5th of every month."}
        </p>
      </div>

      <Modal isOpen={showAddRoommate} onClose={() => { setShowAddRoommate(false); setEditRoommateId(null); setRoommateData({ name: '', phone: '', idProof: '' }); }} title={editRoommateId ? "Edit Roommate" : "Add Roommate / Member"} size="md">
        <form onSubmit={handleAddRoommate} className="space-y-4">
          {!editRoommateId && (
            <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-lg text-xs text-brand-300 mb-2">
              Remaining Capacity: <strong>{room.capacity - room.currentOccupancy} person(s)</strong>
            </div>
          )}
          <div>
            <label className="form-label">Full Name *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Roommate's name"
              value={roommateData.name}
              onChange={e => setRoommateData({...roommateData, name: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="form-label">Phone Number (Optional)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="10-digit number"
              value={roommateData.phone}
              onChange={e => setRoommateData({...roommateData, phone: e.target.value})}
            />
          </div>
          <div>
            <label className="form-label">ID Proof Info (Optional)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Aadhar / Voter ID number"
              value={roommateData.idProof}
              onChange={e => setRoommateData({...roommateData, idProof: e.target.value})}
            />
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={() => setShowAddRoommate(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
              {submitting ? 'Saving...' : (editRoommateId ? 'Update Roommate' : 'Add Roommate')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MyRoomPage;
