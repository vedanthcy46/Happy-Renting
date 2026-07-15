import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Wallet, Leaf } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────
// Payment Status States
// ─────────────────────────────────────────────────────────────────────────
const PAYMENT_STATE = {
  IDLE: 'idle',
  CREATING_ORDER: 'creating_order',
  MODAL_OPEN: 'modal_open',
  POLLING: 'polling',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20; // 60 seconds total

// ─────────────────────────────────────────────────────────────────────────

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
    paymentMethod: 'bank_transfer',
    transactionId: '',
    note: ''
  });

  const [proofFile, setProofFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // Gateway payment state machine
  const [paymentState, setPaymentState] = useState(PAYMENT_STATE.IDLE);
  const pollTimerRef = useRef(null);
  const pollAttemptsRef = useRef(0);

  const generateIdempotencyKey = useCallback(() => {
    setIdempotencyKey(`${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  // ── Load Cashfree SDK ────────────────────────────────────────────────────
  const loadCashfreeScript = () => {
    return new Promise((resolve) => {
      if (window.Cashfree) { resolve(true); return; }
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // ── Fetch rent record ────────────────────────────────────────────────────
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
    loadCashfreeScript();
  }, [fetchPaymentDetails, generateIdempotencyKey]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // ── Status Polling ───────────────────────────────────────────────────────
  const startPolling = useCallback((orderId) => {
    pollAttemptsRef.current = 0;
    setPaymentState(PAYMENT_STATE.POLLING);

    pollTimerRef.current = setInterval(async () => {
      pollAttemptsRef.current += 1;

      try {
        const { data } = await api.get(`/v2/payments/cashfree/status/${orderId}`);

        if (data.status === 'success') {
          clearInterval(pollTimerRef.current);
          setPaymentState(PAYMENT_STATE.SUCCESS);
          toast.success('Payment confirmed! Your rent has been updated.');
          // Refresh the rent record to show new balance
          await fetchPaymentDetails();
          return;
        }

        if (data.status === 'failed') {
          clearInterval(pollTimerRef.current);
          setPaymentState(PAYMENT_STATE.FAILED);
          toast.error('Payment failed. Please try again.');
          return;
        }

        // If still pending and max attempts reached
        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          clearInterval(pollTimerRef.current);
          setPaymentState(PAYMENT_STATE.IDLE);
          toast.info(
            'Payment is taking longer than expected. Your balance will update automatically when confirmed.'
          );
        }
      } catch (err) {
        // Network error during polling — keep trying unless max attempts
        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          clearInterval(pollTimerRef.current);
          setPaymentState(PAYMENT_STATE.IDLE);
        }
      }
    }, POLL_INTERVAL_MS);
  }, [fetchPaymentDetails, toast]);

  // ── Handle Cashfree Payment ──────────────────────────────────────────────
  const handleCashfreePayment = async () => {
    const amount = Number(form.amount);
    if (!amount || amount < 1 || amount > rentRecord.remainingAmount) {
      return toast.error(`Enter a valid amount between ₹1 and ₹${rentRecord.remainingAmount}`);
    }

    setPaymentState(PAYMENT_STATE.CREATING_ORDER);

    try {
      const isLoaded = await loadCashfreeScript();
      if (!isLoaded) {
        throw new Error('Cashfree SDK failed to load. Check your internet connection.');
      }

      // Step 1: Create order on backend
      const { data: orderData } = await api.post(
        `/v2/payments/cashfree/create-order/${rentRecord._id}`,
        { amount }
      );

      const { orderId, paymentSessionId } = orderData;
      setPaymentState(PAYMENT_STATE.MODAL_OPEN);

      // Step 2: Open Cashfree Checkout modal
      const cfMode = process.env.REACT_APP_CASHFREE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
      console.log('[Cashfree] SDK initializing in mode:', cfMode);

      const cashfree = window.Cashfree({ mode: cfMode });

      const checkoutResult = await cashfree.checkout({
        paymentSessionId,
        redirectTarget: '_modal',
      });

      // Step 3: Modal closed — start polling regardless of result
      // NEVER trust the frontend result. Backend webhook is the source of truth.
      if (checkoutResult?.error) {
        // User cancelled or payment failed in the modal
        setPaymentState(PAYMENT_STATE.CANCELLED);
        toast.info('Payment was cancelled or failed in the checkout modal.');
        return;
      }

      // Payment may have succeeded — start polling backend to confirm
      startPolling(orderId);
    } catch (err) {
      setPaymentState(PAYMENT_STATE.FAILED);
      toast.error(err.response?.data?.message || err.message || 'Failed to initialize payment');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return toast.error('File size exceeds 2MB limit.');
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
    formData.append('tenantId', rentRecord.tenantId?._id || rentRecord.tenantId);
    formData.append('amount', form.amount);
    formData.append('paymentMethod', form.paymentMethod);
    if (form.transactionId) formData.append('transactionId', form.transactionId);
    if (form.note) formData.append('note', form.note);
    if (proofFile) formData.append('image', proofFile);
    formData.append('idempotencyKey', idempotencyKey);

    try {
      await api.post(`/v2/payments/${rentRecord._id}/transactions`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      });
      toast.success('Payment proof submitted! Waiting for owner verification.');
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
      generateIdempotencyKey();
    }
  };

  // ── Derived UI States ────────────────────────────────────────────────────
  const isGatewayBusy = [
    PAYMENT_STATE.CREATING_ORDER,
    PAYMENT_STATE.MODAL_OPEN,
    PAYMENT_STATE.POLLING,
  ].includes(paymentState);

  const gatewayButtonLabel = () => {
    switch (paymentState) {
      case PAYMENT_STATE.CREATING_ORDER: return 'Creating Order...';
      case PAYMENT_STATE.MODAL_OPEN: return 'Waiting for Payment...';
      case PAYMENT_STATE.POLLING: return 'Confirming Payment...';
      default: return 'Pay Online (Gateway)';
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
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

      {/* Success Banner */}
      {paymentState === PAYMENT_STATE.SUCCESS && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-bold">Payment Confirmed!</p>
            <p className="text-sm opacity-80">Your rent balance has been updated.</p>
          </div>
        </div>
      )}

      {/* Polling Banner */}
      {paymentState === PAYMENT_STATE.POLLING && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl flex items-center gap-3">
          <LoadingSpinner size="sm" label="" />
          <div>
            <p className="font-bold">Confirming your payment...</p>
            <p className="text-sm opacity-80">Please wait. This usually takes a few seconds.</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column: Details & Owner Info */}
        <div className="space-y-6">
          <div className="card p-6 border-brand-500/20 bg-brand-500/5">
            <h3 className="text-white font-bold mb-4 uppercase text-xs tracking-wider">Rent Record Details</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Billing Period</span>
                <span className="text-white font-mono text-sm">
                  {rentRecord.billingPeriodStart ? (
                    `${new Date(rentRecord.billingPeriodStart).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} → ${new Date(rentRecord.billingPeriodEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
                  ) : rentRecord.month}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Due Date</span>
                <span className="text-white">{rentRecord.dueDate ? new Date(rentRecord.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
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
            {(rentRecord.ownerId?.upiId || rentRecord.ownerId?.upiNumber || rentRecord.ownerId?.upiDetails?.upiId) && (
              <div className="mt-6 space-y-3 bg-surface border border-surface-border p-4 rounded-xl">
                {(rentRecord.ownerId?.upiDetails?.upiName) && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">UPI Name:</span>
                    <span className="text-white text-sm font-bold">{rentRecord.ownerId.upiDetails.upiName}</span>
                  </div>
                )}
                {(rentRecord.ownerId?.upiId || rentRecord.ownerId?.upiDetails?.upiId) && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">UPI ID:</span>
                    <span className="text-white text-sm font-mono">{rentRecord.ownerId.upiId || rentRecord.ownerId.upiDetails.upiId}</span>
                  </div>
                )}
                {rentRecord.ownerId?.upiNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">UPI Number:</span>
                    <span className="text-white text-sm font-mono">{rentRecord.ownerId.upiNumber}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Payment Form */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                <Wallet className="w-4 h-4 text-brand-400" /> Pay via UPI / Bank
              </h3>
              <div className="flex items-center gap-1.5 bg-success/10 border border-success/20 px-2.5 py-1 rounded-full">
                <Leaf className="w-3 h-3 text-success" />
                <span className="text-[10px] font-bold text-success uppercase tracking-wider">Save charges</span>
              </div>
            </div>

            {rentRecord.remainingAmount <= 0 ? (
              <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-center">
                This month's rent is fully paid. ✅
              </div>
            ) : (
              <form onSubmit={handleSubmitTransaction} className="space-y-5">
                <div>
                  <label className="form-label">Payment Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    max={rentRecord.remainingAmount}
                    className="form-input"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Payment Method</label>
                    <select className="form-select" value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Online Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Ref ID (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.transactionId}
                      onChange={e => setForm(f => ({ ...f, transactionId: e.target.value }))}
                      placeholder="UPI Ref, Cheque #..."
                    />
                  </div>
                </div>

                <div className="border-2 border-dashed border-slate-700 rounded-xl p-4 text-center hover:bg-surface-card transition-colors">
                  <input type="file" id="proof-upload" className="hidden" accept="image/*" onChange={handleFileChange} />
                  <label htmlFor="proof-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="max-h-32 rounded object-contain border border-surface-border shadow-md" />
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-surface-border flex items-center justify-center text-slate-400">📁</div>
                        <span className="text-brand-400 text-xs font-bold">Attach Proof Image (Optional)</span>
                        <span className="text-slate-500 text-[10px]">JPG, PNG up to 2MB</span>
                      </>
                    )}
                  </label>
                </div>

                <div>
                  <label className="form-label">Notes (Optional)</label>
                  <textarea
                    className="form-input text-sm resize-none"
                    rows={2}
                    maxLength={200}
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="Any message for the owner..."
                  />
                </div>

                <button type="submit" disabled={submitting || isGatewayBusy} className="btn-primary w-full mt-4 flex items-center justify-center gap-2 py-3 shadow-glow transition-all">
                  {submitting ? <LoadingSpinner size="sm" label="" /> : null}
                  {submitting ? 'Submitting...' : 'Submit Payment Proof'}
                </button>

                <div className="relative flex py-5 items-center">
                  <div className="flex-grow border-t border-surface-border"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-500 text-[10px] uppercase font-bold tracking-wider">Or</span>
                  <div className="flex-grow border-t border-surface-border"></div>
                </div>

                <button
                  type="button"
                  onClick={handleCashfreePayment}
                  disabled={submitting || isGatewayBusy}
                  className="w-full bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGatewayBusy ? <LoadingSpinner size="sm" label="" /> : '🌐'}
                  {gatewayButtonLabel()}
                </button>

                <p className="text-center text-slate-500 text-[10px]">
                  Secured by Cashfree Payments. UPI, Cards, Net Banking accepted.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="mt-8">
          <h3 className="text-white font-bold mb-4 uppercase text-xs tracking-wider">Transaction History for {rentRecord.month}</h3>
          <div className="space-y-4">
            {transactions.map((txn) => (
              <div key={txn._id} className={`p-4 rounded-xl border flex justify-between items-center ${txn.status === 'reversed' ? 'bg-surface/30 border-red-900/30 opacity-70' : 'bg-surface border-surface-border'}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg text-white">₹{txn.amount.toLocaleString()}</span>
                    <span className="text-[10px] uppercase font-bold text-brand-400 bg-brand-400/10 px-2 py-0.5 rounded">
                      {txn.paymentGateway === 'cashfree' ? 'Cashfree' : txn.paymentMethod.replace('_', ' ')}
                    </span>
                    {txn.status === 'verifying' && (
                      <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">Pending Verification</span>
                    )}
                    {txn.status === 'reversed' && (
                      <span className="text-[10px] uppercase font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded">Reversed</span>
                    )}
                    {txn.status === 'completed' && txn.paymentGateway === 'cashfree' && (
                      <span className="text-[10px] uppercase font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded">Verified ✓</span>
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
