import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';

const AdminWalletPage = () => {
  const toast = useToast();
  const { isSuperAdmin } = useAuth();

  const [wallets, setWallets] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests');

  // Subscription orders state
  const [subscriptionOrders, setSubscriptionOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [reverseModal, setReverseModal] = useState({ open: false, order: null, reason: '' });
  const [reversing, setReversing] = useState(false);

  // Platforms settings editor state
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [monthlySubscription, setMonthlySubscription] = useState(0);
  const [annualSubscription, setAnnualSubscription] = useState(0);
  const [lifetimeSubscription, setLifetimeSubscription] = useState(0);
  const [commissionEnabled, setCommissionEnabled] = useState(false);
  const [commissionPercentage, setCommissionPercentage] = useState(0);
  const [gatewayFeeDeductionEnabled, setGatewayFeeDeductionEnabled] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Settlement completion modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [transferType, setTransferType] = useState('upi_qr');
  const [refNumber, setRefNumber] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [settling, setSettling] = useState(false);

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // UPI QR Modal state
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [generatingQr, setGeneratingQr] = useState(false);

  // Rebuilding wallet state
  const [rebuildingId, setRebuildingId] = useState(null);

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [walRes, wdRes, revRes] = await Promise.all([
        api.get('/v2/admin/wallets'),
        api.get('/v2/admin/withdrawals'),
        api.get('/v2/admin/platform-revenue')
      ]);

      setWallets(walRes.data.wallets || []);
      setWithdrawals(wdRes.data.withdrawals || []);
      setRevenue(revRes.data.revenue);

      // Load config editing state
      const s = revRes.data.settings;
      if (s) {
        setSubscriptionEnabled(s.subscriptionEnabled);
        setMonthlySubscription(s.monthlySubscription);
        setAnnualSubscription(s.annualSubscription);
        setLifetimeSubscription(s.lifetimeSubscription);
        setCommissionEnabled(s.commissionEnabled);
        setCommissionPercentage(s.commissionPercentage);
        setGatewayFeeDeductionEnabled(s.gatewayFeeDeductionEnabled);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to load administration data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Fetch subscription orders
  const fetchSubscriptionOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      const params = orderStatusFilter ? `?status=${orderStatusFilter}` : '';
      const res = await api.get(`/v2/subscriptions/admin/orders${params}`);
      setSubscriptionOrders(res.data.orders || []);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to load subscription orders');
    } finally {
      setOrdersLoading(false);
    }
  }, [toast, orderStatusFilter]);

  useEffect(() => {
    if (activeTab === 'subscriptions') fetchSubscriptionOrders();
  }, [activeTab, fetchSubscriptionOrders]);

  // Handle subscription reverse
  const handleReverseOpen = (order) => {
    setReverseModal({ open: true, order, reason: '' });
  };

  const handleReverseSubmit = async (e) => {
    e.preventDefault();
    try {
      setReversing(true);
      await api.post(`/v2/subscriptions/admin/orders/${reverseModal.order._id}/reverse`, {
        reason: reverseModal.reason
      });
      toast.success('Subscription reversed. Owner downgraded to Free.');
      setReverseModal({ open: false, order: null, reason: '' });
      fetchSubscriptionOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Reversal failed');
    } finally {
      setReversing(false);
    }
  };

  // Handle subscription undo reversal
  const handleUndoReverse = async (order) => {
    if (!window.confirm(`Restore this subscription for ${order.ownerId?.name || 'owner'}? The owner will be put back on their paid plan.`)) return;
    try {
      await api.post(`/v2/subscriptions/admin/orders/${order._id}/undo-reversal`);
      toast.success('Subscription restored.');
      fetchSubscriptionOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to restore subscription');
    }
  };


  // Handle settings update
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      await api.patch('/v2/admin/settings', {
        subscriptionEnabled,
        monthlySubscription: Number(monthlySubscription),
        annualSubscription: Number(annualSubscription),
        lifetimeSubscription: Number(lifetimeSubscription),
        commissionEnabled,
        commissionPercentage: Number(commissionPercentage),
        gatewayFeeDeductionEnabled
      });
      toast.success('Platform settings updated successfully');
      fetchAdminData(); // Refresh revenue math
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update platform settings');
    } finally {
      setSavingSettings(false);
    }
  };



  // Handle Reject Modal open/submit
  const handleRejectOpen = (req) => {
    setSelectedReq(req);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason) {
      toast.error('Rejection reason is required');
      return;
    }
    try {
      setRejecting(true);
      await api.patch(`/v2/admin/withdrawals/${selectedReq._id}/reject`, {
        rejectionReason: rejectReason
      });
      toast.success('Withdrawal request rejected. Funds returned.');
      setShowRejectModal(false);
      fetchAdminData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Rejection failed');
    } finally {
      setRejecting(false);
    }
  };

  // Handle UPI QR Code generation and modal display
  const handleGenerateQr = async (req) => {
    try {
      setGeneratingQr(true);
      const res = await api.post(`/v2/admin/withdrawals/${req._id}/generate-qr`);
      setQrData({
        qrCode: res.data.qrCode,
        upiUri: res.data.upiUri,
        upiId: res.data.upiId,
        ownerName: res.data.ownerName,
        request: res.data.withdrawalRequest || req
      });
      setRefNumber('');
      setSettleNote('');
      setShowQrModal(true);
      fetchAdminData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to generate UPI QR code');
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleDownloadQr = () => {
    if (!qrData?.qrCode) return;
    const link = document.createElement('a');
    link.href = qrData.qrCode;
    link.download = `Settlement_QR_${qrData.request._id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyUpiId = () => {
    if (!qrData?.upiId) return;
    navigator.clipboard.writeText(qrData.upiId);
    toast.success('UPI ID copied to clipboard');
  };

  // Handle Settlement Completion modal open/submit
  const handleCompleteOpen = (req) => {
    setSelectedReq(req);
    setTransferType('upi_qr');
    setRefNumber('');
    setSettleNote('');
    setShowCompleteModal(true);
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!refNumber || refNumber.trim().length < 10 || refNumber.trim().length > 30) {
      toast.error('UTR number must be between 10 and 30 characters');
      return;
    }
    try {
      setSettling(true);
      await api.patch(`/v2/admin/withdrawals/${selectedReq._id}/complete`, {
        settlementMethod: transferType,
        utrNumber: refNumber,
        remarks: settleNote
      });
      toast.success('Withdrawal request completed successfully');
      setShowCompleteModal(false);
      fetchAdminData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Settlement failed');
    } finally {
      setSettling(false);
    }
  };

  // Handle Wallet Self Healing Rebuild
  const handleRebuildWallet = async (ownerId) => {
    try {
      setRebuildingId(ownerId);
      await api.post(`/v2/admin/wallets/${ownerId}/rebuild`);
      toast.success('Wallet rebuilt and self-healed successfully');
      fetchAdminData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Rebuild failed');
    } finally {
      setRebuildingId(null);
    }
  };

  if (loading && wallets.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">Wallet & Revenue Admin</h1>
        <p className="text-slate-400 text-sm mt-1">Configure business settings, verify settlements, and monitor platform revenue</p>
      </div>

      {/* Revenue Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-5 border border-surface-border bg-surface-card">
          <span className="text-xs uppercase font-bold text-slate-500">Gateway MDR Charges</span>
          <p className="text-2xl font-extrabold text-red-400 mt-2">
            ₹{revenue?.totalGatewayCharges?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-500 block mt-1">Platform cost (absorbed fees)</span>
        </div>

        <div className="card p-5 border border-surface-border bg-surface-card">
          <span className="text-xs uppercase font-bold text-slate-500">Subscription Dues</span>
          <p className="text-2xl font-extrabold text-success mt-2">
            ₹{revenue?.totalSubscriptionFees?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-500 block mt-1">Charged to landlords</span>
        </div>

        <div className="card p-5 border border-surface-border bg-surface-card">
          <span className="text-xs uppercase font-bold text-slate-500">Platform Commissions</span>
          <p className="text-2xl font-extrabold text-success mt-2">
            ₹{revenue?.totalCommissions?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-500 block mt-1">Charged on rents</span>
        </div>

        <div className="card p-5 border border-brand-500/20 bg-gradient-to-r from-surface-card to-brand-500/5">
          <span className="text-xs uppercase font-bold text-brand-400 font-bold">Net Platform Revenue</span>
          <p className={`text-2xl font-extrabold mt-2 ${revenue?.netRevenue >= 0 ? 'text-success' : 'text-danger'}`}>
            ₹{revenue?.netRevenue?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-500 block mt-1">Commissions + Subs - Gateway charges</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-border gap-6">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'requests' ? 'border-brand-500 text-white font-bold' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          ⏱️ Withdrawal Requests
        </button>
        <button
          onClick={() => setActiveTab('wallets')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'wallets' ? 'border-brand-500 text-white font-bold' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          🛡️ Landlord Wallets
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'settings' ? 'border-brand-500 text-white font-bold' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          ⚙️ Monetization Settings
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'subscriptions' ? 'border-brand-500 text-white font-bold' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          💎 Subscription Orders
        </button>
      </div>

      {/* TAB CONTENT: WITHDRAWAL REQUESTS */}
      {activeTab === 'requests' && (
        <div className="card bg-surface-card border border-surface-border">
          <div className="px-6 py-5 border-b border-surface-border">
            <h2 className="text-lg font-bold text-white">Pending & Settled Payouts</h2>
          </div>
          <div className="table-wrapper rounded-none border-none overflow-x-auto">
            {withdrawals.length === 0 ? (
              <p className="text-center text-slate-500 py-12 italic">No withdrawal requests found.</p>
            ) : (
              <table className="data-table min-w-[900px]">
                <thead>
                  <tr>
                    <th>Requested At</th>
                    <th>Landlord</th>
                    <th>Amount</th>
                    <th>Destination Bank</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((req) => (
                    <tr key={req._id} className="hover:bg-surface-hover/30">
                      <td className="text-slate-400 text-xs font-mono">
                        {new Date(req.requestedAt).toLocaleString()}
                      </td>
                      <td>
                        <p className="font-semibold text-white">{req.ownerId?.name}</p>
                        <p className="text-xs text-slate-500">{req.ownerId?.email}</p>
                      </td>
                      <td className="font-mono font-bold text-white">₹{req.amount.toLocaleString()}</td>
                      <td className="text-xs text-slate-300">
                        <p><strong>A/C:</strong> {req.bankAccountNumber}</p>
                        <p><strong>IFSC:</strong> {req.ifscCode}</p>
                        <p><strong>Holder:</strong> {req.accountHolderName}</p>
                      </td>
                      <td>
                        <StatusBadge status={req.status} />
                        {req.status === 'completed' && req.settlementDetails?.referenceNumber && (
                          <div className="mt-1.5 text-[9px] text-slate-400 font-mono">
                            Ref: {req.settlementDetails.referenceNumber}
                          </div>
                        )}
                        {req.status === 'rejected' && req.rejectionReason && (
                          <div className="mt-1.5 text-[9px] text-red-400 max-w-[150px] truncate" title={req.rejectionReason}>
                            Reason: {req.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {['pending', 'approved', 'processing'].includes(req.status) && (
                            <button
                              onClick={() => handleGenerateQr(req)}
                              disabled={generatingQr}
                              className="btn-primary btn-sm font-semibold px-3 py-1"
                            >
                              Generate QR
                            </button>
                          )}
                          {req.status === 'qr_generated' && (
                            <button
                              onClick={() => handleGenerateQr(req)}
                              disabled={generatingQr}
                              className="btn-secondary btn-sm font-semibold px-3 py-1 border border-brand-500 text-brand-400 hover:bg-brand-500/10"
                            >
                              👁️ View QR
                            </button>
                          )}
                          {['pending', 'approved', 'processing', 'qr_generated'].includes(req.status) && (
                            <button
                              onClick={() => handleRejectOpen(req)}
                              className="btn-danger btn-sm font-semibold px-3 py-1"
                            >
                              Reject
                            </button>
                          )}
                          {isSuperAdmin && ['pending', 'approved', 'processing', 'qr_generated'].includes(req.status) && (
                            <button
                              onClick={() => handleCompleteOpen(req)}
                              className="btn-success btn-sm font-semibold px-3 py-1"
                            >
                              Settle (Manual)
                            </button>
                          )}
                          {req.status === 'completed' && (
                            <span className="text-xs text-slate-500 font-medium italic">Settled</span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="text-xs text-slate-500 font-medium italic">Rejected</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: LANDLORD WALLETS */}
      {activeTab === 'wallets' && (
        <div className="card bg-surface-card border border-surface-border">
          <div className="px-6 py-5 border-b border-surface-border">
            <h2 className="text-lg font-bold text-white">Owner Wallets Summary</h2>
          </div>
          <div className="table-wrapper rounded-none border-none overflow-x-auto">
            {wallets.length === 0 ? (
              <p className="text-center text-slate-500 py-12 italic">No wallets found.</p>
            ) : (
              <table className="data-table min-w-[800px]">
                <thead>
                  <tr>
                    <th>Landlord</th>
                    <th>Available Bal</th>
                    <th>Pending Bal</th>
                    <th>Total Received</th>
                    <th>Total Settled</th>
                    <th>MDR Fees</th>
                    <th>Subs. Fees</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((w) => (
                    <tr key={w._id} className="hover:bg-surface-hover/30">
                      <td>
                        <p className="font-semibold text-white">{w.ownerId?.name || 'Unknown Owner'}</p>
                        <p className="text-xs text-slate-500">{w.ownerId?.email}</p>
                      </td>
                      <td className="font-mono font-bold text-success">₹{w.availableBalance.toLocaleString()}</td>
                      <td className="font-mono text-warning">₹{w.pendingBalance.toLocaleString()}</td>
                      <td className="font-mono text-slate-300">₹{w.totalReceived.toLocaleString()}</td>
                      <td className="font-mono text-slate-300">₹{w.totalWithdrawn.toLocaleString()}</td>
                      <td className="font-mono text-red-400">₹{w.totalGatewayCharges.toLocaleString()}</td>
                      <td className="font-mono text-red-400">₹{w.totalSubscriptionFees.toLocaleString()}</td>
                      <td>
                        <button
                          onClick={() => handleRebuildWallet(w.ownerId?._id)}
                          disabled={rebuildingId === w.ownerId?._id}
                          className="btn-secondary btn-sm py-1 font-semibold text-xs"
                          title="Recalculate and rebuild balance cache from transactions log ledger"
                        >
                          {rebuildingId === w.ownerId?._id ? 'Rebuilding...' : '🔄 Rebuild'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: PLATFORM SETTINGS */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl card p-6 bg-surface-card border border-surface-border">
          <div className="border-b border-surface-border pb-4 mb-6">
            <h2 className="text-lg font-bold text-white">Monetization & Commission Control</h2>
            <p className="text-xs text-slate-400 mt-1">Configure when gateway charges, subscriptions, and commissions are active</p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Gateway Fee Deduction Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-surface-border bg-surface-hover/10">
              <div>
                <label className="form-label mb-0 text-white font-bold">Deduct Gateway MDR Fees</label>
                <p className="text-xs text-slate-500 mt-1">
                  Enable to pass gateway charges (1.95% + 18% GST) directly onto Owners. Disable for Growth Mode.
                </p>
              </div>
              <input
                type="checkbox"
                checked={gatewayFeeDeductionEnabled}
                onChange={(e) => setGatewayFeeDeductionEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-slate-700 bg-surface accent-brand-500 cursor-pointer"
              />
            </div>

            {/* Commission Settings */}
            <div className="p-4 rounded-xl border border-surface-border bg-surface-hover/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="form-label mb-0 text-white font-bold">Platform commission fees</label>
                  <p className="text-xs text-slate-500 mt-1">Charge commission on every successful rent payment.</p>
                </div>
                <input
                  type="checkbox"
                  checked={commissionEnabled}
                  onChange={(e) => setCommissionEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-700 bg-surface accent-brand-500 cursor-pointer"
                />
              </div>

              {commissionEnabled && (
                <div className="pt-2 animate-fade-in">
                  <label className="form-label text-xs">Commission Percentage (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={commissionPercentage}
                    onChange={(e) => setCommissionPercentage(e.target.value)}
                    className="form-input font-mono max-w-[200px]"
                    required
                  />
                </div>
              )}
            </div>

            {/* Subscription Settings */}
            <div className="p-4 rounded-xl border border-surface-border bg-surface-hover/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="form-label mb-0 text-white font-bold">Premium Subscription Plans</label>
                  <p className="text-xs text-slate-500 mt-1">Enable paid plans and set a price for each billing period. Prices are charged once via Cashfree (no auto-renew).</p>
                </div>
                <input
                  type="checkbox"
                  checked={subscriptionEnabled}
                  onChange={(e) => setSubscriptionEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-700 bg-surface accent-brand-500 cursor-pointer"
                />
              </div>

              {subscriptionEnabled && (
                <div className="pt-2 animate-fade-in space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="form-label text-xs">Monthly Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={monthlySubscription}
                        onChange={(e) => setMonthlySubscription(e.target.value)}
                        className="form-input font-mono max-w-[200px]"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs">Annual Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={annualSubscription}
                        onChange={(e) => setAnnualSubscription(e.target.value)}
                        className="form-input font-mono max-w-[200px]"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs">Lifetime Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={lifetimeSubscription}
                        onChange={(e) => setLifetimeSubscription(e.target.value)}
                        className="form-input font-mono max-w-[200px]"
                        required
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Set a price to 0 to hide that billing option from the app. A plan is only visible when its price is &gt; 0.
                  </p>
                </div>
              )}
            </div>

            {/* Save Buttons */}
            <div className="pt-4 border-t border-surface-border flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="btn-primary px-6"
              >
                {savingSettings ? 'Saving...' : '💾 Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB CONTENT: SUBSCRIPTION ORDERS */}
      {activeTab === 'subscriptions' && (
        <div className="card bg-surface-card border border-surface-border">
          <div className="px-6 py-5 border-b border-surface-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Premium Subscription Orders</h2>
              <p className="text-xs text-slate-400 mt-1">Review purchases, reverse a subscription to downgrade the owner to Free, or undo a reversal.</p>
            </div>
            <select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
              className="form-select w-40 text-xs py-2"
            >
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="reversed">Reversed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="voided">Voided</option>
            </select>
          </div>
          <div className="table-wrapper rounded-none border-none overflow-x-auto">
            {ordersLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner size="md" /></div>
            ) : subscriptionOrders.length === 0 ? (
              <p className="text-center text-slate-500 py-12 italic">No subscription orders found.</p>
            ) : (
              <table className="data-table min-w-[900px]">
                <thead>
                  <tr>
                    <th>Purchased At</th>
                    <th>Owner</th>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Valid Until</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionOrders.map((o) => (
                    <tr key={o._id} className="hover:bg-surface-hover/30">
                      <td className="text-slate-400 text-xs font-mono">
                        {new Date(o.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <p className="font-semibold text-white">{o.ownerId?.name || 'Unknown Owner'}</p>
                        <p className="text-xs text-slate-500">{o.ownerId?.email}</p>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-brand-500/20 text-brand-400 uppercase">
                          💎 {o.plan}
                        </span>
                      </td>
                      <td className="font-mono font-bold text-white">₹{o.amount.toLocaleString()}</td>
                      <td className="text-xs text-slate-300 font-mono">
                        {o.activatedUntil ? new Date(o.activatedUntil).toLocaleDateString() : '—'}
                        {o.plan === 'LIFETIME' ? ' (Lifetime)' : ''}
                      </td>
                      <td>
                        <StatusBadge status={o.status} />
                        {o.status === 'reversed' && o.reversalReason && (
                          <div className="mt-1.5 text-[9px] text-red-400 max-w-[180px] truncate" title={o.reversalReason}>
                            Reason: {o.reversalReason}
                          </div>
                        )}
                        {o.status === 'reversed' && o.reversedAt && (
                          <div className="mt-0.5 text-[9px] text-slate-500 font-mono">
                            Reversed {new Date(o.reversedAt).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {o.status === 'paid' && (
                            <button
                              onClick={() => handleReverseOpen(o)}
                              className="btn-danger btn-sm font-semibold px-3 py-1"
                            >
                              ↩ Reverse
                            </button>
                          )}
                          {o.status === 'reversed' && (
                            <button
                              onClick={() => handleUndoReverse(o)}
                              className="btn-success btn-sm font-semibold px-3 py-1"
                            >
                              ↪ Undo Reversal
                            </button>
                          )}
                          {['pending', 'failed', 'voided'].includes(o.status) && (
                            <span className="text-xs text-slate-500 font-medium italic">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Manual Settlement Details Completion Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Record Manual Settlement details"
      >
        <form onSubmit={handleCompleteSubmit} className="space-y-4">
          <p className="text-sm text-slate-400">
            Please enter the manual transfer details. Confirming this will move the funds of{' '}
            <strong>₹{selectedReq?.amount?.toLocaleString()}</strong> out of the owner's pending balance and mark the request
            as completed.
          </p>

          <div>
            <label className="form-label">Settlement Transfer Type</label>
            <select
              value={transferType}
              onChange={(e) => setTransferType(e.target.value)}
              className="form-select"
              required
            >
              <option value="imps">IMPS Transfer</option>
              <option value="neft">NEFT Transfer</option>
              <option value="rtgs">RTGS Transfer</option>
              <option value="upi">UPI Transfer</option>
              <option value="bank_transfer">Direct Bank Transfer</option>
            </select>
          </div>

          <div>
            <label className="form-label">Transaction Reference Number / UTR</label>
            <input
              type="text"
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
              placeholder="e.g. UTR2817264812"
              className="form-input font-mono"
              required
            />
          </div>

          <div>
            <label className="form-label">Admin note (Optional)</label>
            <textarea
              value={settleNote}
              onChange={(e) => setSettleNote(e.target.value)}
              placeholder="e.g. Transferred manually to landlord account"
              className="form-input text-sm h-20"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-border">
            <button
              type="button"
              onClick={() => setShowCompleteModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={settling}
              className="btn-primary"
            >
              {settling ? 'Completing...' : 'Mark Completed'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Withdrawal Request"
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <p className="text-sm text-slate-400">
            This will reject the withdrawal request of <strong>₹{selectedReq?.amount?.toLocaleString()}</strong> and immediately
            refund the amount back to the owner's available balance.
          </p>

          <div>
            <label className="form-label">Rejection Reason</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Account number or IFSC code incorrect"
              className="form-input text-sm h-24"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-border">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={rejecting}
              className="btn-danger"
            >
              {rejecting ? 'Rejecting...' : 'Reject Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* UPI Settlement QR Modal */}
      <Modal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        title="UPI Settlement QR Code"
      >
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-slate-400 text-sm">
              Scan this QR code using any UPI application (GPay, PhonePe, Paytm, etc.) to pay this landlord.
            </p>
            <div className="bg-slate-800/40 p-4 rounded-xl border border-surface-border inline-block mt-3 w-full">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Landlord Name</p>
              <p className="text-md font-bold text-white mb-2">{qrData?.ownerName}</p>

              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">UPI ID</p>
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="font-mono text-sm text-brand-400">{qrData?.upiId}</span>
                <button
                  type="button"
                  onClick={handleCopyUpiId}
                  className="text-slate-400 hover:text-white transition-colors"
                  title="Copy UPI ID"
                >
                  📋
                </button>
              </div>

              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Settlement Amount</p>
              <p className="text-2xl font-extrabold text-success">
                ₹{qrData?.request?.amount?.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center space-y-4">
            {qrData?.qrCode ? (
              <div className="p-3 bg-white rounded-xl shadow-lg border border-slate-700">
                <img
                  src={qrData.qrCode}
                  alt="UPI QR Code"
                  className="w-48 h-48 select-none"
                />
              </div>
            ) : (
              <LoadingSpinner size="md" />
            )}
            <button
              type="button"
              onClick={handleDownloadQr}
              className="btn-secondary btn-sm px-4 py-1.5 flex items-center gap-2 border border-slate-600 hover:bg-slate-800"
            >
              📥 Download QR Code
            </button>
          </div>

          {isSuperAdmin && (
            <div className="pt-6 border-t border-surface-border space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Complete Settlement Inline</h3>
              <p className="text-xs text-slate-400">
                Once paid, enter the UTR/Reference number (10-30 characters) to complete the withdrawal and update the ledger.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="form-label text-xs">Transaction Reference Number / UTR</label>
                  <input
                    type="text"
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    placeholder="e.g. UTR2817264812"
                    className="form-input font-mono text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="form-label text-xs">Admin note (Optional)</label>
                  <textarea
                    value={settleNote}
                    onChange={(e) => setSettleNote(e.target.value)}
                    placeholder="e.g. Paid via scanned UPI QR code"
                    className="form-input text-xs h-16"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!refNumber || refNumber.trim().length < 10 || refNumber.trim().length > 30) {
                      toast.error('UTR number must be between 10 and 30 characters');
                      return;
                    }
                    try {
                      setSettling(true);
                      await api.patch(`/v2/admin/withdrawals/${qrData.request._id}/complete`, {
                        settlementMethod: 'upi_qr',
                        utrNumber: refNumber,
                        remarks: settleNote
                      });
                      toast.success('Withdrawal request completed successfully');
                      setShowQrModal(false);
                      fetchAdminData();
                    } catch (err) {
                      toast.error(err.response?.data?.message || err.message || 'Settlement failed');
                    } finally {
                      setSettling(false);
                    }
                  }}
                  disabled={settling}
                  className="btn-success w-full font-bold py-2 text-sm rounded-lg"
                >
                  {settling ? 'Completing...' : 'Mark Paid & Completed'}
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-surface-border">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
      {/* Reverse Subscription Modal */}
      <Modal
        isOpen={reverseModal.open}
        onClose={() => setReverseModal({ open: false, order: null, reason: '' })}
        title="Reverse Subscription"
      >
        <form onSubmit={handleReverseSubmit} className="space-y-4">
          <p className="text-sm text-slate-400">
            This will downgrade <strong className="text-white">{reverseModal.order?.ownerId?.name || 'this owner'}</strong>{' '}
            back to the <strong className="text-white">Free</strong> plan immediately. Their tenants will also lose
            premium access. You can undo this later.
          </p>

          <div>
            <label className="form-label">Reversal Reason</label>
            <textarea
              value={reverseModal.reason}
              onChange={(e) => setReverseModal(r => ({ ...r, reason: e.target.value }))}
              placeholder="e.g. Chargeback, fraudulent payment, admin decision"
              className="form-input text-sm h-20"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-border">
            <button
              type="button"
              onClick={() => setReverseModal({ open: false, order: null, reason: '' })}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reversing}
              className="btn-danger"
            >
              {reversing ? 'Reversing...' : 'Reverse Subscription'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminWalletPage;
