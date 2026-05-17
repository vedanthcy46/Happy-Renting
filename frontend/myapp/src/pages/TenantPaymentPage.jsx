import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

const TenantPaymentPage = () => {
  const { id } = useParams(); // rentRecordId
  const navigate = useNavigate();
  const toast = useToast();

  const [rentRecord, setRentRecord] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [form, setForm] = useState({
    amount: '',
    paymentMethod: 'online',
    transactionId: '',
    note: ''
  });
  
  const [proofFile, setProofFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const generateIdempotencyKey = () => {
    setIdempotencyKey(`${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  };

  const fetchPaymentDetails = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/v2/payments/${id}`);
      setRentRecord(data.rentRecord);
      setTransactions(data.transactions || []);
      setForm(f => ({ ...f, amount: data.rentRecord.remainingAmount.toString() }));
    } catch (err) {
      toast.error(err.message || 'Payment record not found.');
      navigate('/payments');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    fetchPaymentDetails();
    generateIdempotencyKey();
  }, [fetchPaymentDetails]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        return toast.error('File size exceeds 2MB limit.');
      }
      setProofFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    if (Number(form.amount) <= 0 || Number(form.amount) > rentRecord.remainingAmount) {
      return toast.error(`Please enter a valid amount up to ₹${rentRecord.remainingAmount}`);
    }
    
    setSubmitting(true);
    const formData = new FormData();
    formData.append('tenantId', rentRecord.tenantId);
    formData.append('amount', form.amount);
    formData.append('paymentMethod', form.paymentMethod);
    if (form.transactionId) formData.append('transactionId', form.transactionId);
    if (form.note) formData.append('note', form.note);
    if (proofFile) formData.append('image', proofFile);
    formData.append('idempotencyKey', idempotencyKey);

    try {
      await api.post(`/v2/payments/${rentRecord._id}/transactions`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Payment recorded successfully! Waiting for owner verification if applicable.');
      navigate('/payments');
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('This payment was already submitted.');
        navigate('/payments');
      } else {
        toast.error(err.message || 'Payment submission failed.');
      }
    } finally {
      setSubmitting(false);
      generateIdempotencyKey(); // Reset for future submissions if they stay on page
    }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!rentRecord) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <button onClick={() => navigate(-1)} className="text-brand-400 hover:text-brand-300 text-sm font-bold flex items-center gap-1 mb-4">
          ← Back
        </button>
        <h1 className="page-title">Make a Payment</h1>
        <p className="text-slate-400 text-sm mt-1">Pay your rent or add a partial transaction.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column: Details & Owner Info */}
        <div className="space-y-6">
          <div className="card p-6 border-brand-500/20 bg-brand-500/5">
            <h3 className="text-white font-bold mb-4 uppercase text-xs tracking-wider">Rent Record Details</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Month</span>
                <span className="text-white font-bold">{rentRecord.month}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Due Date</span>
                <span className="text-white">{rentRecord.dueDate ? new Date(rentRecord.dueDate).toLocaleDateString() : '—'}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-700 pt-4 mt-4">
                <span className="text-slate-400">Total Rent</span>
                <span className="text-white">₹{rentRecord.totalRent?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Paid So Far</span>
                <span className="text-green-400 font-bold">₹{rentRecord.totalPaid?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-lg border-t border-slate-700 pt-4">
                <span className="text-slate-300 font-bold">Remaining Due</span>
                <span className="text-brand-400 font-bold text-xl">₹{rentRecord.remainingAmount?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-white font-bold mb-4 uppercase text-xs tracking-wider">Owner Payment Info</h3>
            {rentRecord.ownerId?.qrCodeImage?.secureUrl ? (
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-48 h-48 bg-white p-2 rounded-xl shadow-glow">
                  <img src={rentRecord.ownerId.qrCodeImage.secureUrl} alt="Owner QR Code" className="w-full h-full object-contain" />
                </div>
                <p className="text-sm font-bold text-slate-300">Scan to Pay via UPI</p>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 italic text-sm border border-dashed border-slate-700 rounded-xl">
                No QR Code available.
              </div>
            )}
            
            {(rentRecord.ownerId?.upiId || rentRecord.ownerId?.upiNumber) && (
              <div className="mt-6 space-y-3 bg-surface border border-surface-border p-4 rounded-xl">
                {rentRecord.ownerId.upiId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-sm">UPI ID:</span>
                    <span className="text-white text-sm font-mono">{rentRecord.ownerId.upiId}</span>
                  </div>
                )}
                {rentRecord.ownerId.upiNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-sm">UPI Number:</span>
                    <span className="text-white text-sm font-mono">{rentRecord.ownerId.upiNumber}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Transaction Form */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-white font-bold mb-4 uppercase text-xs tracking-wider flex items-center gap-2">
              <span className="text-brand-400">🧾</span> Record a Transaction
            </h3>
            
            {rentRecord.remainingAmount <= 0 ? (
              <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-center">
                This month's rent is fully paid.
              </div>
            ) : (
              <form onSubmit={handleSubmitTransaction} className="space-y-5">
                <div>
                  <label className="form-label">Payment Amount (₹)</label>
                  <input type="number" min="1" max={rentRecord.remainingAmount} className="form-input"
                    value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Payment Method</label>
                    <select className="form-select" value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                      <option value="upi">UPI</option>
                      <option value="online">Online Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Ref ID (Optional)</label>
                    <input type="text" className="form-input" value={form.transactionId}
                      onChange={e => setForm(f => ({ ...f, transactionId: e.target.value }))} placeholder="UPI Ref, Cheque #..." />
                  </div>
                </div>

                <div className="border-2 border-dashed border-slate-700 rounded-xl p-4 text-center hover:bg-surface-card transition-colors">
                  <input 
                    type="file" 
                    id="proof-upload" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange}
                  />
                  <label htmlFor="proof-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="max-h-32 rounded object-contain border border-surface-border shadow-md" />
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-surface-border flex items-center justify-center text-slate-400">
                          📁
                        </div>
                        <span className="text-brand-400 text-xs font-bold">Attach Proof Image (Optional)</span>
                        <span className="text-slate-500 text-[10px]">JPG, PNG up to 2MB</span>
                      </>
                    )}
                  </label>
                </div>

                <div>
                  <label className="form-label">Notes (Optional)</label>
                  <textarea className="form-input text-sm resize-none" rows={2} maxLength={200}
                    value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Any message for the owner..." />
                </div>
                
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="btn-primary w-full shadow-glow mt-4"
                >
                  {submitting ? <LoadingSpinner size="sm" label="" /> : null}
                  {submitting ? 'Submitting...' : 'Submit Payment'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Transaction History Timeline for Tenant */}
      {transactions.length > 0 && (
        <div className="mt-8">
          <h3 className="text-white font-bold mb-4 uppercase text-xs tracking-wider">Transaction History for {rentRecord.month}</h3>
          <div className="space-y-4">
            {transactions.map((txn) => (
              <div key={txn._id} className={`p-4 rounded-xl border flex justify-between items-center ${txn.status === 'reversed' ? 'bg-surface/30 border-red-900/30 opacity-70' : 'bg-surface border-surface-border'}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg text-white">₹{txn.amount.toLocaleString()}</span>
                    <span className="text-[10px] uppercase font-bold text-brand-400 bg-brand-400/10 px-2 py-0.5 rounded">{txn.paymentMethod.replace('_', ' ')}</span>
                    {txn.status === 'reversed' && (
                      <span className="text-[10px] uppercase font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded">Reversed</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-4">
                    <span>{new Date(txn.paymentDate).toLocaleDateString()}</span>
                    {txn.transactionId && <span>Ref: {txn.transactionId}</span>}
                  </div>
                  {txn.note && <p className="text-xs text-slate-300 mt-2 italic">"{txn.note}"</p>}
                </div>
                {txn.proofImage?.secureUrl && (
                  <a href={txn.proofImage.secureUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 w-16 h-16 rounded overflow-hidden border border-surface-border hover:opacity-80 transition-opacity">
                    <img src={txn.proofImage.secureUrl} alt="Proof" className="w-full h-full object-cover" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantPaymentPage;
