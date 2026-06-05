import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';

const PaymentsPage = () => {
  const toast = useToast();
  const { isTenant, isOwner } = useAuth();

  const [rentRecords, setRentRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const defaultDate = new Date();
  defaultDate.setMonth(defaultDate.getMonth() - 1);
  const [filterMonth, setFilterMonth] = useState((defaultDate.getMonth() + 1).toString());
  const [filterYear, setFilterYear] = useState(defaultDate.getFullYear().toString());
  const [filterProperty, setFilterProperty] = useState('');
  const [properties, setProperties] = useState([]);

  // Fetch properties on mount if owner
  useEffect(() => {
    if (isOwner) {
      api.get('/properties').then(res => {
        setProperties(res.data.properties || []);
      }).catch(() => {});
    }
  }, [isOwner]);

  // Add Transaction Modal State
  const [showAddTxn, setShowAddTxn] = useState(false);
  const [selectedRecordForTxn, setSelectedRecordForTxn] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [txnForm, setTxnForm] = useState({
    amount: '', method: 'cash', transactionType: 'cash', note: '', paymentDate: new Date().toISOString().split('T')[0], transactionId: ''
  });

  // Transaction History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedRecordHistory, setSelectedRecordHistory] = useState(null);
  const [historyTransactions, setHistoryTransactions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterMonth) params.append('month', filterMonth);
      if (filterYear) params.append('year', filterYear);
      if (filterProperty) params.append('propertyId', filterProperty);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const { data } = await api.get(`/v2/payments${queryString}`);
      setRentRecords(data.rentRecords || []);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterMonth, filterYear, filterProperty, toast]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handleAddTransactionClick = (record) => {
    setSelectedRecordForTxn(record);
    setTxnForm({
      amount: Math.max(0, record.remainingAmount || 0).toString(),
      method: 'cash',
      transactionType: 'cash',
      note: '',
      paymentDate: new Date().toISOString().split('T')[0],
      transactionId: ''
    });
    setProofFile(null);
    setShowAddTxn(true);
  };

  const handleAddTransactionSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!txnForm.amount || Number(txnForm.amount) <= 0) {
      return toast.error('Please enter a valid amount');
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('amount', Number(txnForm.amount));
      formData.append('paymentMethod', txnForm.method);
      formData.append('transactionType', txnForm.transactionType || txnForm.method);
      formData.append('paymentDate', txnForm.paymentDate);
      if (txnForm.note) formData.append('note', txnForm.note);
      if (txnForm.transactionId) formData.append('transactionId', txnForm.transactionId);
      if (proofFile) {
        formData.append('image', proofFile);
      }

      await api.post(`/v2/payments/${selectedRecordForTxn._id}/transactions`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Transaction recorded successfully!');
      setShowAddTxn(false);
      setProofFile(null);
      fetchPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to record transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewHistory = async (record) => {
    setSelectedRecordHistory(record);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const { data } = await api.get(`/v2/payments/${record._id}`);
      setHistoryTransactions(data.transactions || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleReverseTransaction = async (transactionId, isReversing) => {
    const confirmMsg = isReversing
      ? "Are you sure you want to reverse this transaction? This action will restore the remaining balance."
      : "Are you sure you want to undo this reversal? This action will re-apply the payment to the rent record.";
    if (!window.confirm(confirmMsg)) return;
    
    setSubmitting(true);
    try {
      await api.post(`/v2/payments/transactions/${transactionId}/reverse`, { 
        reason: isReversing ? 'Reversed by admin/owner' : 'Reversal undone / Re-activated' 
      });
      toast.success(isReversing ? 'Transaction reversed successfully' : 'Reversal undone successfully');
      // Refresh history
      const { data } = await api.get(`/v2/payments/${selectedRecordHistory._id}`);
      setHistoryTransactions(data.transactions || []);
      fetchPayments(); // Refresh list to update totals
    } catch (err) {
      toast.error(err.message || 'Failed to update transaction status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyTransaction = async (transactionId) => {
    if (!window.confirm("Are you sure you want to verify and approve this payment? This will credit the payment amount to the tenant's invoice.")) return;
    
    setSubmitting(true);
    try {
      await api.post(`/v2/payments/transactions/${transactionId}/verify`);
      toast.success('Payment approved and credited successfully');
      // Refresh history
      const { data } = await api.get(`/v2/payments/${selectedRecordHistory._id}`);
      setHistoryTransactions(data.transactions || []);
      fetchPayments(); // Refresh list to update totals
    } catch (err) {
      toast.error(err.message || 'Failed to verify transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectTransaction = async (transactionId) => {
    const reason = window.prompt("Please enter a reason for rejecting this payment proof (optional):");
    if (reason === null) return; // cancelled
    
    setSubmitting(true);
    try {
      await api.post(`/v2/payments/transactions/${transactionId}/reject`, { reason: reason || 'Rejected by owner / Invalid proof' });
      toast.success('Payment proof rejected successfully');
      // Refresh history
      const { data } = await api.get(`/v2/payments/${selectedRecordHistory._id}`);
      setHistoryTransactions(data.transactions || []);
      fetchPayments(); // Refresh list to update totals
    } catch (err) {
      toast.error(err.message || 'Failed to reject transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = { paid: 'bg-green-500', partial: 'bg-blue-500', pending: 'bg-gray-500', overdue: 'bg-red-500' };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Rent Ledger</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage monthly rent records and transaction history.
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3 items-center flex-wrap bg-surface p-3 rounded-lg border border-surface-border">
        {isOwner && (
          <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)} className="form-select w-40 text-sm">
            <option value="">All Properties</option>
            {properties.map(p => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
        )}

        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="form-select w-32 text-sm">
          <option value="">All Years</option>
          {Array.from({ length: new Date().getFullYear() - 2024 + 1 }, (_, i) => 2024 + i).map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>

        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="form-select w-36 text-sm">
          <option value="">All Months</option>
          <option value="1">January</option>
          <option value="2">February</option>
          <option value="3">March</option>
          <option value="4">April</option>
          <option value="5">May</option>
          <option value="6">June</option>
          <option value="7">July</option>
          <option value="8">August</option>
          <option value="9">September</option>
          <option value="10">October</option>
          <option value="11">November</option>
          <option value="12">December</option>
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="form-select w-40 text-sm">
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
        </select>
        
        {/* Reset Filters button */}
        {(filterStatus || filterMonth || filterYear || filterProperty) && (
          <button 
            onClick={() => {
              setFilterStatus('');
              setFilterMonth('');
              setFilterYear('');
              setFilterProperty('');
            }}
            className="text-xs text-brand-400 hover:text-brand-300 font-bold underline ml-2"
          >
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : rentRecords.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">💰</div>
          <p className="text-slate-400">No rent records found.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {!isTenant && <th>Tenant</th>}
                <th>Room / Property</th>
                <th>Month</th>
                <th>Rent Due</th>
                <th>Paid</th>
                <th>Remaining</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rentRecords.map(record => {
                const percentPaid = Math.min(100, Math.max(0, (record.totalPaid / record.totalRent) * 100)) || 0;
                return (
                  <tr key={record._id}>
                    {!isTenant && <td className="font-medium text-white">{record.userId?.name}</td>}
                    <td className="text-slate-300">
                      <p className="font-semibold text-white">Room {record.roomId?.roomNumber}</p>
                      <p className="text-[10px] text-slate-400">{record.propertyId?.name}</p>
                    </td>
                    <td className="text-slate-300 font-mono text-xs">
                      <p className="text-white font-semibold">
                        {record.billingPeriodStart ? (
                          `${new Date(record.billingPeriodStart).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} → ${new Date(record.billingPeriodEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
                        ) : (
                          record.month
                        )}
                      </p>
                      {record.billingType && record.billingType !== 'full' && (
                        <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          record.billingType === 'prorated_join' 
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                            : record.billingType === 'prorated_moveout'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        }`}>
                          {record.billingType === 'prorated_join' ? 'Prorated Join' : 'Prorated Move-Out'}
                        </span>
                      )}
                    </td>
                    <td className="text-white font-semibold">₹{record.totalRent?.toLocaleString()}</td>
                    
                    {/* Progress Bar Cell */}
                    <td className="w-32">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-white">₹{record.totalPaid?.toLocaleString()}</span>
                        <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full ${getStatusColor(record.status)} transition-all`} style={{ width: `${percentPaid}%` }}></div>
                        </div>
                      </div>
                    </td>
                    
                    <td className={`font-mono text-sm ${record.remainingAmount > 0 ? 'text-brand-400' : 'text-slate-500'}`}>
                      ₹{record.remainingAmount?.toLocaleString()}
                    </td>
                    <td><StatusBadge status={record.status} /></td>
                    
                    <td className="text-right">
                      <div className="flex flex-col items-end gap-2">
                        {isOwner && (
                          <button
                            onClick={() => handleAddTransactionClick(record)}
                            className="btn btn-sm btn-primary bg-brand-600 hover:bg-brand-500 text-[10px] uppercase font-bold px-2 py-1"
                          >
                            Add Txn
                          </button>
                        )}
                        <button
                          onClick={() => handleViewHistory(record)}
                          className="text-slate-400 hover:text-white text-[10px] font-bold underline decoration-slate-600 hover:decoration-white"
                        >
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Transaction Modal */}
      <Modal isOpen={showAddTxn} onClose={() => setShowAddTxn(false)} title="Record Payment Transaction" size="md">
        {selectedRecordForTxn && (
           <div className="mb-4 p-3 bg-surface border border-surface-border rounded-lg">
             <div className="flex justify-between items-center mb-1">
               <span className="text-xs text-slate-400">Total Rent</span>
               <span className="font-bold text-white">₹{selectedRecordForTxn.totalRent.toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center mb-1">
               <span className="text-xs text-slate-400">Total Paid</span>
               <span className="font-bold text-green-400">₹{selectedRecordForTxn.totalPaid.toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center pt-1 border-t border-surface-border">
               <span className="text-xs font-bold text-slate-300">Remaining</span>
               <span className="font-bold text-brand-400">₹{selectedRecordForTxn.remainingAmount.toLocaleString()}</span>
             </div>
           </div>
        )}
        <form onSubmit={handleAddTransactionSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Amount (₹) *</label>
              <input type="number" min="1" className="form-input"
                value={txnForm.amount} onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="form-label">Transaction Type *</label>
              <select className="form-select" value={txnForm.transactionType} onChange={e => {
                const val = e.target.value;
                const method = (val === 'adjustment' || val === 'waiver') ? 'other' : val;
                setTxnForm(f => ({ ...f, transactionType: val, method }));
              }}>
                <option value="cash">Cash Payment</option>
                <option value="upi">UPI Transfer</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque Payment</option>
                <option value="waiver">Rent Waiver (Adjustment)</option>
                <option value="adjustment">Manual Adjustment</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" value={txnForm.paymentDate}
                onChange={e => setTxnForm(f => ({ ...f, paymentDate: e.target.value }))} max={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="form-label">Ref ID (Optional)</label>
              <input type="text" className="form-input" value={txnForm.transactionId}
                onChange={e => setTxnForm(f => ({ ...f, transactionId: e.target.value }))} placeholder="UPI Ref, Cheque #..." />
            </div>
          </div>
          <div>
            <label className="form-label">Upload Proof (Optional)</label>
            <input type="file" accept="image/*" className="form-input text-xs"
              onChange={e => setProofFile(e.target.files[0])} />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input resize-none" rows={2} maxLength={300}
              value={txnForm.note} onChange={e => setTxnForm(f => ({ ...f, note: e.target.value }))} placeholder="Optional notes about this payment…" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowAddTxn(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? <LoadingSpinner size="sm" label="" /> : 'Add Transaction'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Transaction History Modal */}
      <Modal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} title="Transaction History" size="lg">
        {loadingHistory ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : historyTransactions.length === 0 ? (
          <div className="py-10 text-center text-slate-400">No transactions recorded yet.</div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {historyTransactions.map((txn, idx) => (
              <div key={txn._id} className={`p-4 rounded-xl border relative ${txn.status === 'reversed' ? 'bg-surface/30 border-red-900/30 opacity-70' : 'bg-surface border-surface-border'}`}>
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  {txn.status === 'reversed' && (
                    <span className="text-[10px] font-bold text-red-500 border border-red-500/30 px-2 py-0.5 rounded bg-red-500/10 uppercase">
                      Reversed
                    </span>
                  )}
                  {txn.status === 'verifying' && (
                    <span className="text-[10px] font-bold text-yellow-500 border border-yellow-500/30 px-2 py-0.5 rounded bg-yellow-500/10 uppercase animate-pulse">
                      Verifying
                    </span>
                  )}
                  {txn.status === 'failed' && (
                    <span className="text-[10px] font-bold text-rose-500 border border-rose-500/30 px-2 py-0.5 rounded bg-rose-500/10 uppercase">
                      Rejected
                    </span>
                  )}
                  {txn.status === 'completed' && (
                    <span className="text-[10px] font-bold text-green-500 border border-green-500/30 px-2 py-0.5 rounded bg-green-500/10 uppercase">
                      Verified
                    </span>
                  )}
                </div>
                <div className="flex justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg text-white">₹{txn.amount.toLocaleString()}</span>
                    <span className="text-xs uppercase font-bold text-brand-400 bg-brand-400/10 px-2 py-0.5 rounded">
                      {txn.transactionType || txn.paymentMethod}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {txn.entrySource ? txn.entrySource.replace('_', ' ') : 'system generated'}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-1">{new Date(txn.paymentDate).toLocaleDateString()}</span>
                </div>
                
                <div className="text-sm text-slate-300 mb-2">
                  {txn.note ? <p>"{txn.note}"</p> : <p className="italic text-slate-500">No notes</p>}
                </div>
                
                <div className="flex justify-between items-end border-t border-surface-border/50 pt-2 mt-2">
                  <div className="text-[10px] text-slate-500 space-y-1">
                    <p>Recorded by: <span className="text-white font-medium">{txn.recordedBy?.name || 'Admin'}</span> ({txn.createdByRole || 'system'})</p>
                    {txn.transactionId && <p>Ref: <span className="font-mono text-slate-300">{txn.transactionId}</span></p>}
                    {txn.proofImage?.secureUrl && (
                      <p className="pt-1">
                        <a href={txn.proofImage.secureUrl} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300 font-bold underline flex items-center gap-1">
                          View Proof Document 🖼️
                        </a>
                      </p>
                    )}
                  </div>
                  {isOwner && txn.status === 'verifying' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleVerifyTransaction(txn._id)} 
                        disabled={submitting}
                        className="text-[10px] font-bold text-green-400 hover:text-green-300 underline decoration-green-400/30"
                      >
                        Verify & Approve
                      </button>
                      <button 
                        onClick={() => handleRejectTransaction(txn._id)} 
                        disabled={submitting}
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 underline decoration-rose-400/30"
                      >
                        Reject Proof
                      </button>
                    </div>
                  )}
                  {isOwner && (txn.status === 'completed' || txn.status === 'reversed') && (
                    <button 
                      onClick={() => handleReverseTransaction(txn._id, txn.status === 'completed')} 
                      disabled={submitting}
                      className={`text-[10px] font-bold underline ${txn.status === 'completed' ? 'text-red-400 hover:text-red-300 decoration-red-400/30' : 'text-green-400 hover:text-green-300 decoration-green-400/30'}`}
                    >
                      {txn.status === 'completed' ? 'Reverse' : 'Undo Reversal'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PaymentsPage;
