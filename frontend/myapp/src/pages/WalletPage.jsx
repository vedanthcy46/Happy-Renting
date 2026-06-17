import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';

const WalletPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Pagination for transactions
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [holderName, setHolderName] = useState('');

  const fetchWalletData = useCallback(async () => {
    try {
      setLoading(true);
      const [sumRes, txRes, wdRes] = await Promise.all([
        api.get('/v2/wallet/summary'),
        api.get(`/v2/wallet/transactions?page=${page}&limit=10`),
        api.get('/v2/wallet/withdrawals')
      ]);

      setSummary(sumRes.data.summary);
      setTransactions(txRes.data.transactions || []);
      setTotalPages(txRes.data.pages || 1);
      setWithdrawals(wdRes.data.withdrawals || []);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  // Load bank details template if exists from user info
  const handleOpenWithdrawModal = () => {
    setWithdrawAmount('');
    if (user?.bankDetails) {
      setBankAccount(user.bankDetails.accountNumber || '');
      setIfscCode(user.bankDetails.ifscCode || user.bankDetails.ifsc || '');
      setHolderName(user.bankDetails.accountHolder || user.name || '');
    } else {
      setBankAccount('');
      setIfscCode('');
      setHolderName(user?.name || '');
    }
    setShowWithdrawModal(true);
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid positive withdrawal amount');
      return;
    }

    if (amountNum > (summary?.availableBalance || 0)) {
      toast.error('Withdrawal amount cannot exceed available balance');
      return;
    }

    // Ensure there is at least bank details OR a registered UPI ID
    const upiId = user?.upiDetails?.upiId || user?.upiId;
    if (!bankAccount && !upiId) {
      toast.error('Please enter bank details or configure a UPI ID in your profile settings to request a settlement');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/v2/wallet/withdraw', {
        amount: amountNum,
        bankAccountNumber: bankAccount || null,
        ifscCode: ifscCode || null,
        accountHolderName: holderName || null
      });

      toast.success('Withdrawal request submitted successfully');
      setShowWithdrawModal(false);
      // Reload details
      fetchWalletData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to submit withdrawal request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && page === 1) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">My Wallet</h1>
          <p className="text-slate-400 text-sm mt-1">Manage collected rent, gateway fees, and request settlements</p>
        </div>
        <button
          onClick={handleOpenWithdrawModal}
          disabled={!summary || summary.availableBalance <= 0}
          className="btn-primary py-3 px-6 rounded-xl shadow-glow disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          💰 Request Withdrawal
        </button>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Available Balance */}
        <div className="card p-6 bg-gradient-to-br from-surface-card to-brand-900/10 border-brand-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <span className="text-6xl">💵</span>
          </div>
          <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Available Balance</span>
          <h2 className="text-3xl font-extrabold text-white mt-2">
            ₹{summary?.availableBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-xs text-slate-500 mt-2 font-medium">Ready to transfer to bank account</p>
        </div>

        {/* Pending Settlements */}
        <div className="card p-6 bg-gradient-to-br from-surface-card to-warning/5 border-warning/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <span className="text-6xl">⏳</span>
          </div>
          <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Pending Settlements</span>
          <h2 className="text-3xl font-extrabold text-warning mt-2">
            ₹{summary?.pendingWithdrawals?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-xs text-slate-500 mt-2 font-medium">Processing manual transfer by admin</p>
        </div>

        {/* Net Earnings */}
        <div className="card p-6 bg-gradient-to-br from-surface-card to-success/5 border-success/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <span className="text-6xl">📈</span>
          </div>
          <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Net Earnings</span>
          <h2 className="text-3xl font-extrabold text-success mt-2">
            ₹{summary?.netEarnings?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-xs text-slate-500 mt-2 font-medium">Total rent collected minus gateway/platform fees</p>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="card p-6 bg-surface-card border border-surface-border">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Wallet Balance Accounting</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-surface-border">
          <div className="px-4">
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Gross Rent Collected</p>
            <p className="text-xl font-bold text-white">₹{summary?.totalRentCollected?.toLocaleString()}</p>
          </div>
          <div className="px-4">
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Gateway MDR Charges</p>
            <p className="text-xl font-bold text-red-400">₹{summary?.totalGatewayCharges?.toLocaleString()}</p>
          </div>
          <div className="px-4">
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Platform Subscription Fees</p>
            <p className="text-xl font-bold text-red-400">₹{summary?.totalSubscriptionFees?.toLocaleString()}</p>
          </div>
          <div className="px-4">
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Settled (Withdrawn)</p>
            <p className="text-xl font-bold text-brand-400">₹{summary?.totalWithdrawn?.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Double Column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ledger Transaction History (2 cols) */}
        <div className="lg:col-span-2 card bg-surface-card border border-surface-border flex flex-col">
          <div className="px-6 py-5 border-b border-surface-border flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Wallet Ledger Transactions</h2>
            <span className="text-xs text-slate-500 font-mono">Real-time audit trail</span>
          </div>

          <div className="table-wrapper rounded-none border-none overflow-x-auto">
            {transactions.length === 0 ? (
              <p className="text-center text-slate-500 py-12 italic">No wallet transactions recorded yet.</p>
            ) : (
              <table className="data-table min-w-[700px]">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Tenant</th>
                    <th>Type</th>
                    <th>Gross</th>
                    <th>Gateway Fee</th>
                    <th>Comm. Fee</th>
                    <th>Net Amount</th>
                    <th>Bal After</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-surface-hover/30">
                      <td className="text-slate-400 text-xs font-mono">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                      <td className="text-slate-300 font-medium">{tx.tenantId?.name || '—'}</td>
                      <td>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                            tx.type === 'rent_received'
                              ? 'bg-success/10 text-success border border-success/20'
                              : tx.type === 'withdrawal'
                              ? 'bg-warning/10 text-warning border border-warning/20'
                              : tx.type === 'settlement'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : tx.type === 'reversal'
                              ? 'bg-danger/10 text-danger border border-danger/20'
                              : 'bg-slate-500/10 text-slate-300 border border-slate-500/20'
                          }`}
                        >
                          {tx.type.replace('_', ' ')}
                        </span>
                        {tx.remarks && <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] truncate">{tx.remarks}</p>}
                      </td>
                      <td className="text-slate-300 font-mono">₹{tx.grossAmount.toLocaleString()}</td>
                      <td className="text-red-400/80 font-mono">
                        {tx.gatewayFee > 0 ? `₹${tx.gatewayFee.toLocaleString()}` : '—'}
                      </td>
                      <td className="text-red-400/80 font-mono">
                        {tx.platformFee > 0 ? `₹${tx.platformFee.toLocaleString()}` : '—'}
                      </td>
                      <td className={`font-mono font-bold ${tx.netAmount >= 0 ? 'text-success' : 'text-danger'}`}>
                        {tx.netAmount >= 0 ? '+' : ''}₹{tx.netAmount.toLocaleString()}
                      </td>
                      <td className="text-slate-300 font-mono">₹{tx.balanceAfter.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-6 py-4 border-t border-surface-border">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary py-1.5 px-3 btn-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary py-1.5 px-3 btn-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Withdrawal/Payout requests (1 col) */}
        <div className="card bg-surface-card border border-surface-border flex flex-col">
          <div className="px-6 py-5 border-b border-surface-border">
            <h2 className="text-lg font-bold text-white">Settlement History</h2>
          </div>
          <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
            {withdrawals.length === 0 ? (
              <p className="text-center text-slate-500 italic py-12">No settlement requests yet.</p>
            ) : (
              withdrawals.map((req) => (
                <div
                  key={req._id}
                  className="p-4 rounded-xl border border-surface-border bg-surface-hover/10 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-slate-500">Requested</p>
                      <p className="text-sm font-semibold text-white font-mono">
                        {new Date(req.requestedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Amount</p>
                      <p className="text-base font-extrabold text-white font-mono">
                        ₹{req.amount.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <StatusBadge status={req.status} />
                    {req.status === 'completed' && req.settlementDetails?.transferType && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        via {req.settlementDetails.transferType.toUpperCase()}
                      </span>
                    )}
                  </div>

                  {req.rejectionReason && (
                    <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/20 text-xs text-red-400">
                      <strong>Rejection Reason:</strong> {req.rejectionReason}
                    </div>
                  )}

                  {req.settlementDetails?.referenceNumber && (
                    <div className="p-2.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-xs text-slate-300 font-mono">
                      <strong>Ref:</strong> {req.settlementDetails.referenceNumber}
                      {req.settlementDetails.note && (
                        <p className="text-[10px] text-slate-400 mt-1 italic">{req.settlementDetails.note}</p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Withdrawal Request Modal */}
      <Modal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        title="Request Settlement Transfer"
      >
        <form onSubmit={handleWithdrawSubmit} className="space-y-4">
          <div className="bg-brand-500/10 border border-brand-500/20 rounded-lg p-3 text-xs text-brand-300 leading-relaxed">
            💡 <strong>Faster Settlements:</strong> Add your <strong>UPI ID</strong> and <strong>UPI Registered Name</strong> in your <a href="/profile" className="text-brand-400 underline hover:text-brand-300">Profile Settings</a> to enable instant UPI QR-code settlements.
          </div>
          <div>
            <label className="form-label">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="e.g. 5000"
              className="form-input font-mono text-lg"
              max={summary?.availableBalance}
              min="1"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Maximum available for withdrawal: <strong>₹{summary?.availableBalance?.toLocaleString()}</strong>
            </p>
          </div>

          <div className="border-t border-surface-border pt-4">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
              🏦 Destination Bank Details
            </h4>

            <div className="space-y-3">
              <div>
                <label className="form-label text-xs">Account Holder Name (Optional)</label>
                <input
                  type="text"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="form-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">Bank Account Number (Optional)</label>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="e.g. 918273645012"
                    className="form-input font-mono"
                  />
                </div>
                <div>
                  <label className="form-label text-xs">IFSC Code (Optional)</label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="e.g. HDFC0000281"
                    className="form-input font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-border">
            <button
              type="button"
              onClick={() => setShowWithdrawModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? 'Submitting...' : 'Confirm Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default WalletPage;
