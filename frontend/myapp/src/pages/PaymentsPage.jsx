import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';

const PaymentsPage = () => {
  const toast = useToast();
  const { isTenant, isOwner } = useAuth();

  const [payments, setPayments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  // Proof Modal State
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [failureReason, setFailureReason] = useState('');

  const [form, setForm] = useState({
    tenantId: '', month: '', amount: '', method: 'cash', status: 'paid', paidDate: new Date().toISOString().split('T')[0], notes: '',
  });
  const [formErrors, setFormErrors] = useState({});

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const params = filterStatus ? `?status=${filterStatus}` : '';
      const { data } = await api.get(`/payments${params}`);
      setPayments(data.payments);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, toast]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  useEffect(() => {
    if (!isTenant) {
      api.get('/tenants?status=active').then(({ data }) => setTenants(data.tenants)).catch(() => { });
    }
  }, [isTenant]);

  // Auto-calculate Due Date based on tenant's preference
  useEffect(() => {
    if (form.tenantId && form.month) {
      const tenant = tenants.find(t => t._id === form.tenantId);
      const dueDay = tenant?.rentDueDay || 5;
      const [year, month] = form.month.split('-');
      // Format YYYY-MM-DD for date input
      const dateStr = `${year}-${month}-${String(dueDay).padStart(2, '0')}`;
      setForm(f => ({ ...f, dueDate: dateStr }));
    }
  }, [form.tenantId, form.month, tenants]);

  const validateForm = () => {
    const errs = {};
    if (!form.tenantId) errs.tenantId = 'Tenant required';
    if (!form.month) errs.month = 'Month required';
    if (!form.amount || Number(form.amount) <= 0) errs.amount = 'Valid amount required';
    return errs;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const errs = validateForm();
    if (Object.keys(errs).length) return setFormErrors(errs);
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post('/payments', { ...form, amount: Number(form.amount) });
      toast.success('Payment recorded successfully!');
      setShowAdd(false);
      setForm({ tenantId: '', month: '', amount: '', method: 'cash', status: 'paid', paidDate: new Date().toISOString().split('T')[0], notes: '' });
      setFormErrors({});
      fetchPayments();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (paymentId) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.patch(`/payments/${paymentId}`, { status: 'paid', paidDate: new Date() });
      toast.success('Payment verified successfully!');
      setShowProofModal(false);
      fetchPayments();
    } catch (err) {
      toast.error(err.message || 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (paymentId) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.patch(`/payments/${paymentId}`, {
        status: 'failed',
        failureReason: failureReason || 'Payment proof rejected by owner.'
      });
      toast.warning('Payment proof rejected.');
      setShowProofModal(false);
      setFailureReason('');
      fetchPayments();
    } catch (err) {
      toast.error(err.message || 'Rejection failed.');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Rent Management</h1>
          <p className="text-slate-400 text-sm mt-1">
            Automated billing is active. Bills are generated monthly for all active tenants.
          </p>
        </div>
        {!isTenant && (
          <button id="add-payment-btn" onClick={() => setShowAdd(true)} className="btn-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Manual Entry
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-3 items-center">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="form-select w-40">
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="verification_pending">Verifying</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : payments.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">💰</div>
          <p className="text-slate-400">No payment records found.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {!isTenant && <th>Tenant</th>}
                <th>Room / Property</th>
                <th>Month</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Paid Date</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p._id}>
                  {!isTenant && <td className="font-medium text-white">{p.userId?.name}</td>}
                  <td className="text-slate-300">
                    <p className="font-semibold text-white">Room {p.roomId?.roomNumber}</p>
                    <p className="text-[10px] text-slate-400">{p.propertyId?.name} ({p.propertyId?.address})</p>
                  </td>
                  <td className="text-slate-400 font-mono">{p.month}</td>
                  <td className="text-white font-semibold">₹{p.amount?.toLocaleString()}</td>
                  <td className={`text-xs font-mono ${p.status === 'overdue' ? 'text-danger font-bold' : 'text-slate-400'}`}>
                    {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="text-slate-400 text-xs">{p.paidDate ? new Date(p.paidDate).toLocaleDateString() : '—'}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className="text-right">
                    {isTenant ? (
                      <div className="flex flex-col items-end gap-2">
                        {(p.status === 'pending' || p.status === 'failed' || p.status === 'overdue') && (
                          <Link
                            to={`/tenant/pay/${p._id}`}
                            className="btn btn-sm btn-primary bg-brand-600 hover:bg-brand-500 text-[10px] uppercase font-bold text-center"
                          >
                            Pay Now
                          </Link>
                        )}
                        {p.status === 'processing' && (
                          <div className="flex items-center justify-end gap-2 text-brand-400 text-[10px] font-bold">
                            <LoadingSpinner size="xs" label="" /> PROCESSING
                          </div>
                        )}

                        {p.proofImage?.secureUrl && (
                          <a
                            href={p.proofImage.secureUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-400 hover:text-brand-300 text-[10px] font-bold underline decoration-brand-400/30"
                          >
                            View Proof
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-2">
                        {p.proofImage?.secureUrl && (
                          <button
                            onClick={() => { setSelectedPayment(p); setShowProofModal(true); }}
                            className="text-brand-400 hover:text-brand-300 text-[10px] font-bold underline decoration-brand-400/30"
                          >
                            View Proof
                          </button>
                        )}
                        {p.status === 'verification_pending' && (
                          <div className="flex gap-2">
                            <button onClick={() => handleVerify(p._id)} className="text-success hover:underline text-[9px] font-bold">VERIFY</button>
                            <button onClick={() => handleReject(p._id)} className="text-danger hover:underline text-[9px] font-bold">REJECT</button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Payment Modal */}
      <Modal isOpen={showAdd} onClose={() => { setShowAdd(false); setFormErrors({}); }} title="Manual Payment Entry" size="md">
        <div className="mb-4 p-3 bg-brand-500/10 border border-brand-500/20 rounded-lg text-[11px] text-brand-300">
          <strong>Note:</strong> Monthly rent is already generated automatically. Use this form only for manual corrections or extra payments.
        </div>
        <form onSubmit={handleAdd} noValidate className="space-y-4">
          <div>
            <label className="form-label">Tenant *</label>
            <select className={`form-select ${formErrors.tenantId ? 'border-danger' : ''}`}
              value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}>
              <option value="">Select tenant…</option>
              {tenants.map(t => (
                <option key={t._id} value={t._id}>
                  {t.userId?.name} — Room {t.roomId?.roomNumber} (Due: {t.rentDueDay || 5}th)
                </option>
              ))}
            </select>
            {formErrors.tenantId && <p className="form-error">{formErrors.tenantId}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Month (YYYY-MM) *</label>
              <input type="month" className={`form-input ${formErrors.month ? 'border-danger' : ''}`}
                value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} />
              {formErrors.month && <p className="form-error">{formErrors.month}</p>}
            </div>
            <div>
              <label className="form-label">Amount (₹) *</label>
              <input type="number" min="0" className={`form-input ${formErrors.amount ? 'border-danger' : ''}`}
                value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
              {formErrors.amount && <p className="form-error">{formErrors.amount}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Method</label>
              <select className="form-select" value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="online">Online</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Due Date</label>
              <input type="date" className="form-input" value={form.dueDate || ''}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              <p className="text-[10px] text-slate-500 mt-1">Default: 5th of month</p>
            </div>
            <div>
              <label className="form-label">Paid Date</label>
              <input type="date" className="form-input" value={form.paidDate}
                onChange={e => setForm(f => ({ ...f, paidDate: e.target.value }))}
                max={new Date().toISOString().split('T')[0]} />
            </div>
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input resize-none" rows={2} maxLength={300}
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            <button id="submit-payment" type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? <LoadingSpinner size="sm" label="" /> : null}
              {submitting ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Verify Proof Modal (Owner) */}
      <Modal isOpen={showProofModal} onClose={() => setShowProofModal(false)} title="Verify Payment Proof" size="md">
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-surface border border-surface-border">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Tenant</p>
                <p className="text-white font-bold">{selectedPayment?.userId?.name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase font-bold">Amount</p>
                <p className="text-brand-400 font-bold">₹{selectedPayment?.amount?.toLocaleString()}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400">For {selectedPayment?.month}</p>
          </div>

          <div className="rounded-xl overflow-hidden border border-surface-border bg-black/20">
            {selectedPayment?.proofImage?.secureUrl ? (
              <img src={selectedPayment.proofImage.secureUrl} alt="Payment Proof" className="w-full max-h-[400px] object-contain" />
            ) : (
              <div className="py-20 text-center text-slate-500 italic">No proof image found.</div>
            )}
          </div>
          
          {selectedPayment?.status === 'verification_pending' && isOwner && (
            <div className="pt-2 border-t border-surface-border">
              <label className="form-label text-[10px] uppercase font-bold text-slate-500">Reason for Rejection (Visible to Tenant)</label>
              <textarea 
                className="form-input text-sm mt-1" 
                placeholder="e.g. Transaction ID not visible, amount mismatch..."
                value={failureReason}
                onChange={e => setFailureReason(e.target.value)}
                rows={2}
                maxLength={300}
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setShowProofModal(false)} className="btn-secondary flex-1">Close</button>
            {selectedPayment?.status === 'verification_pending' && isOwner && (
              <>
                <button 
                  onClick={() => handleReject(selectedPayment._id)} 
                  disabled={submitting} 
                  className="btn-danger flex-1"
                >
                  Reject
                </button>
                <button 
                  onClick={() => handleVerify(selectedPayment._id)} 
                  disabled={submitting} 
                  className="btn-success flex-1"
                >
                  Verify & Mark Paid
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PaymentsPage;
