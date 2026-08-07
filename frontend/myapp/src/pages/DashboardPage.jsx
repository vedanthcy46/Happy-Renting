import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import {
  Shield,
  Building2,
  Users,
  Home,
  Lock,
  DoorOpen,
  CreditCard,
  CheckCircle,
  ArrowRight,
  IndianRupee,
  BarChart3,
  Bell,
  Settings,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
} from 'lucide-react';

const StatCard = ({ label, value, sub, icon, color, trend }) => (
  <div className="stat-card animate-fade-in">
    <div className="flex items-center justify-between mb-3">
      <span className="text-slate-400 text-sm font-medium">{label}</span>
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white`}>
        {icon}
      </div>
    </div>
    <div className="stat-value">{value ?? '\u2014'}</div>
    {sub && (
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
        {trend === 'up' && <ArrowUpRight className="w-3 h-3 text-success" />}
        {trend === 'down' && <ArrowDownRight className="w-3 h-3 text-danger" />}
        <span>{sub}</span>
      </div>
    )}
  </div>
);

const DashboardPage = () => {
  const { user, isTenant, isSuperAdmin, isOwner, refreshUser } = useAuth();
  const toast = useToast();

  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [mapping, setMapping] = useState([]);
  const [logs, setLogs] = useState([]);
  const [vacantRooms, setVacantRooms] = useState([]);
  const [finance, setFinance] = useState({ income: 0, today: 0, pending: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [currentPayment, setCurrentPayment] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      if (isOwner) {
        await refreshUser().catch(() => {});
      }

      if (isTenant) {
        const [tenantRes, payRes] = await Promise.all([
          api.get('/tenants/my'),
          api.get('/v2/payments')
        ]);
        setStats({ tenancy: tenantRes.data.tenant });
        if (payRes.data.rentRecords?.length > 0) {
          setCurrentPayment(payRes.data.rentRecords[0]);
        }
      } else if (isSuperAdmin) {
        const [statsRes, mappingRes, logsRes] = await Promise.all([
          api.get('/users/admin/stats'),
          api.get('/users/admin/mapping'),
          api.get('/users/admin/activity-logs'),
        ]);
        setStats(statsRes.data.stats);
        setMapping(mappingRes.data.mapping);
        setLogs(logsRes.data.logs || []);
      } else {
        const [roomsRes, tenantsRes, summaryRes] = await Promise.all([
          api.get('/rooms'),
          api.get('/tenants?status=active'),
          api.get('/v2/payments/summary/metrics'),
        ]);
        const rooms = roomsRes.data.rooms;
        const tenants = tenantsRes.data.tenants;
        const metrics = summaryRes.data.metrics || {};

        const outstandingCount = (metrics.pendingCount || 0) + (metrics.partialCount || 0) + (metrics.overdueCount || 0);
        const totalOutstandingRupees = (metrics.totalPending || 0) + (metrics.totalOverdue || 0);

        setStats({
          totalRooms: rooms.length,
          fullRooms: rooms.filter(r => r.isFull).length,
          activeTenants: tenants.length,
          pendingCount: outstandingCount,
          pendingAmount: totalOutstandingRupees,
        });
        setRecent(tenants.slice(0, 5));
        setVacantRooms(rooms.filter(r => !r.isFull));

        setFinance({
          income: metrics.totalCollected || 0,
          today: metrics.collectionsToday || 0,
          pending: metrics.totalPending || 0,
          overdue: metrics.totalOverdue || 0,
        });
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [isTenant, isSuperAdmin, isOwner, refreshUser, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // ── SUPER ADMIN VIEW ──────────────────────────────────────────────────
  if (isSuperAdmin) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="page-title">Admin Overview</h1>
          <p className="text-slate-400 text-sm mt-1">System-wide performance and owner management</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard label="Total Owners" value={stats?.totalOwners} icon={<Shield className="w-5 h-5" />} color="bg-brand-600" />
          <StatCard label="Total Properties" value={stats?.totalProperties} icon={<Building2 className="w-5 h-5" />} color="bg-indigo-600" />
          <StatCard label="Total Tenants" value={stats?.totalTenants} icon={<Users className="w-5 h-5" />} color="bg-success" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 card min-w-0">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Owner to Property Mapping</h2>
              <Link to="/users" className="btn-ghost btn-sm text-brand-400" aria-label="Manage Owners">
                Manage Owners
              </Link>
            </div>
            <div className="table-wrapper rounded-none border-none overflow-x-auto">
              <table className="data-table min-w-[700px]">
                <thead>
                  <tr>
                    <th>Owner Name</th>
                    <th>Email</th>
                    <th>Properties</th>
                    <th>Tenants</th>
                  </tr>
                </thead>
                <tbody>
                  {mapping.map(item => (
                    <tr key={item._id}>
                      <td className="font-medium text-white">{item.name}</td>
                      <td className="text-slate-400">{item.email}</td>
                      <td className="text-slate-300 font-mono">{item.propertyCount}</td>
                      <td className="text-slate-300 font-mono">{item.tenantCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card flex flex-col h-[500px]">
            <div className="px-6 py-4 border-b border-surface-border">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-400" />
                Recent Activity Logs
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {logs.length === 0 ? (
                <p className="text-center text-slate-500 mt-10">No recent activity.</p>
              ) : (
                logs.map(log => (
                  <div key={log._id} className="relative pl-4 border-l border-brand-500/30">
                    <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-brand-500" />
                    <p className="text-xs text-brand-400 font-bold mb-0.5">{log.actionType}</p>
                    <p className="text-sm text-white">{log.details}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      By {log.ownerId?.name} &bull; {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── TENANT VIEW ───────────────────────────────────────────────────────
  if (isTenant) {
    const t = stats?.tenancy;
    if (!t || t.status === 'vacated') {
      return (
        <div className="max-w-lg mx-auto mt-20 text-center animate-fade-in">
          <div className="card p-10 shadow-glass">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
              <DoorOpen className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {t ? 'Tenancy Ended' : 'No Active Tenancy'}
            </h2>
            <p className="text-slate-400 text-sm">
              {t
                ? `Your stay at Room ${t.roomId?.roomNumber} concluded on ${new Date(t.exitDate).toLocaleDateString()}.`
                : "You haven't been assigned to a room yet."}
            </p>
            <div className="mt-8 pt-6 border-t border-surface-border">
              <p className="text-sm text-slate-500">Need help? Contact the property manager.</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto animate-slide-up space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title text-3xl flex items-center gap-3">
              Hello, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-slate-400 text-sm mt-1">Welcome to your tenant dashboard</p>
            <p className="text-slate-500 text-[11px] mt-1">
              🤖 Powered by AI — Happy Renting&apos;s Copilot may assist with queries. Always confirm payment and tenancy details with your owner.
            </p>
          </div>
          <StatusBadge status="active" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6 min-w-0">
            <div className="card p-8 bg-gradient-to-br from-surface-card to-brand-900/10">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Home className="w-5 h-5 text-brand-400" />
                My Room Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Room</p>
                  <p className="text-xl text-white font-bold">{t.roomId?.roomNumber || '\u2014'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Floor</p>
                  <p className="text-xl text-white font-bold">{t.roomId?.floor || '\u2014'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Rent</p>
                  <p className="text-xl text-brand-400 font-bold">
                    <IndianRupee className="w-4 h-4 inline" />
                    {t.roomId?.monthlyRent?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Joined</p>
                  <p className="text-white">{new Date(t.joinDate).toLocaleDateString()}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Property</p>
                  <p className="text-white font-medium">{t.propertyId?.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.propertyId?.address}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Link to="/payments" className="btn-primary flex-1 justify-center py-4 text-lg">
                <CreditCard className="w-5 h-5" />
                View All Payments
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card p-6 border-brand-500/30 bg-brand-500/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <IndianRupee className="w-16 h-16 text-brand-500" />
              </div>
              <h3 className="font-bold text-white mb-4 uppercase text-xs tracking-widest text-brand-400">
                Current Month Bill
              </h3>

              {currentPayment ? (
                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-slate-500 text-[10px] uppercase font-bold">Billing Period</p>
                      <p className="text-sm font-bold text-white font-mono">
                        {currentPayment.billingPeriodStart ? (
                          `${new Date(currentPayment.billingPeriodStart).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} \u2192 ${new Date(currentPayment.billingPeriodEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
                        ) : (
                          currentPayment.month
                        )}
                      </p>
                      {currentPayment.billingType && currentPayment.billingType !== 'full' && (
                        <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          currentPayment.billingType === 'prorated_join'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : currentPayment.billingType === 'prorated_moveout'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        }`}>
                          {currentPayment.billingType === 'prorated_join' ? 'Prorated Join' : 'Prorated Move-Out'}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-[10px] uppercase font-bold">Due Date</p>
                      <p className={`text-sm font-mono ${currentPayment.status === 'overdue' ? 'text-danger font-bold' : 'text-white'}`}>
                        {currentPayment.dueDate
                          ? new Date(currentPayment.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                          : '\u2014'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Status</p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <StatusBadge status={currentPayment.status} />
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">
                          <IndianRupee className="w-4 h-4 inline" />
                          {currentPayment.remainingAmount?.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-400">Remaining</p>
                      </div>
                    </div>
                  </div>

                  {currentPayment.remainingAmount > 0 ? (
                    <Link to={`/tenant/pay/${currentPayment._id}`} className="btn-primary w-full mt-4 py-3 justify-center shadow-glow">
                      Pay Now
                    </Link>
                  ) : (
                    <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/20 text-center">
                      <p className="text-xs text-success font-bold uppercase tracking-widest flex items-center justify-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Fully Paid
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">Thank you for timely payment.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-slate-500 italic text-sm">No bills generated yet.</p>
                </div>
              )}
            </div>

            <div className="card p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand-400" />
                Quick Support
              </h3>
              <p className="text-sm text-slate-400 mb-4">Having trouble with your room? Raise a complaint directly to the owner.</p>
              <Link to="/complaints" className="btn-secondary w-full text-center">
                Raise Complaint
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── OWNER VIEW ────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Management Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span>All systems online</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Rooms"
          value={stats?.totalRooms}
          icon={<Building2 className="w-5 h-5" />}
          color="bg-brand-600"
          sub="Active inventory"
        />
        <StatCard
          label="Full Rooms"
          value={stats?.fullRooms}
          icon={<Lock className="w-5 h-5" />}
          color="bg-danger"
          sub="Maximum capacity"
        />
        <StatCard
          label="Active Tenants"
          value={stats?.activeTenants}
          icon={<Users className="w-5 h-5" />}
          color="bg-success"
          sub="Current residents"
          trend="up"
        />
        <StatCard
          label="Pending Rent"
          value={`\u20B9${(stats?.pendingAmount || 0).toLocaleString()}`}
          icon={<IndianRupee className="w-5 h-5" />}
          color="bg-warning"
          sub={`${stats?.pendingCount || 0} ${stats?.pendingCount === 1 ? 'payment' : 'payments'} due`}
          trend={stats?.pendingCount > 0 ? 'down' : undefined}
        />
      </div>

      <div className="card p-6 border border-brand-500/20 bg-gradient-to-r from-surface-card to-brand-500/5">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-brand-400" />
          Rent Summary Dashboard
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x divide-surface-border">
          <div className="px-4 pb-4 md:pb-0">
            <p className="text-xs uppercase font-bold text-slate-500 mb-2">Total Collected</p>
            <p className="text-2xl sm:text-3xl font-bold text-success">
              <IndianRupee className="w-5 h-5 inline" />
              {finance.income.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">All time</p>
          </div>
          <div className="px-4 pb-4 md:pb-0">
            <p className="text-xs uppercase font-bold text-slate-500 mb-2">Collected Today</p>
            <p className="text-2xl sm:text-3xl font-bold text-brand-400">
              <IndianRupee className="w-5 h-5 inline" />
              {finance.today.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">Today only</p>
          </div>
          <div className="px-4 py-4 md:py-0">
            <p className="text-xs uppercase font-bold text-slate-500 mb-2">Pending Dues</p>
            <p className="text-2xl sm:text-3xl font-bold text-warning">
              <IndianRupee className="w-5 h-5 inline" />
              {finance.pending.toLocaleString()}
            </p>
          </div>
          <div className="px-4 pt-4 md:pt-0">
            <p className="text-xs uppercase font-bold text-slate-500 mb-2">Overdue Amount</p>
            <p className="text-2xl sm:text-3xl font-bold text-danger">
              <IndianRupee className="w-5 h-5 inline" />
              {finance.overdue.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <Link
          to="/tenants/add"
          className="card p-6 hover:border-brand-500 transition-all hover:-translate-y-1 duration-300 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
            <UserPlus className="w-6 h-6 text-brand-500" />
          </div>
          <h3 className="font-bold text-white text-lg">Move In Tenant</h3>
          <p className="text-slate-400 text-sm mt-1">Assign a new resident to a room</p>
        </Link>
        <Link
          to="/rooms"
          className="card p-6 hover:border-brand-500 transition-all hover:-translate-y-1 duration-300 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
            <Building2 className="w-6 h-6 text-brand-500" />
          </div>
          <h3 className="font-bold text-white text-lg">Manage Rooms</h3>
          <p className="text-slate-400 text-sm mt-1">Monitor occupancy and status</p>
        </Link>
        <Link
          to="/profile"
          className="card p-6 hover:border-brand-500 transition-all hover:-translate-y-1 duration-300 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
            <CreditCard className="w-6 h-6 text-brand-500" />
          </div>
          <h3 className="font-bold text-white text-lg">Payment Logs</h3>
          <p className="text-slate-400 text-sm mt-1">Review and record rent payments</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {recent.length > 0 && (
            <div className="card shadow-glass">
              <div className="flex items-center justify-between px-6 py-5 border-b border-surface-border">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-400" />
                  Recent Active Tenants
                </h2>
                <Link to="/tenants" className="text-brand-400 text-sm font-semibold hover:text-brand-300">
                  View All Tenants
                  <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                </Link>
              </div>
              <div className="table-wrapper rounded-none border-none">
                <table className="data-table">
                  <thead>
                    <tr><th>Name</th><th>Room</th><th>Joined</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {recent.map(t => (
                      <tr key={t._id}>
                        <td className="text-white font-semibold">{t.userId?.name}</td>
                        <td className="text-slate-300">
                          <p className="font-semibold text-white">Room {t.roomId?.roomNumber}</p>
                          <p className="text-[10px] text-slate-400">{t.propertyId?.name}</p>
                        </td>
                        <td className="text-slate-400 text-xs">{t.joinDate ? new Date(t.joinDate).toLocaleDateString() : '\u2014'}</td>
                        <td><StatusBadge status={t.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {vacantRooms.length > 0 && (
            <div className="card shadow-glass mt-6">
              <div className="flex items-center justify-between px-6 py-5 border-b border-surface-border">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  Vacancy Tracker
                </h2>
                <Link to="/rooms" className="text-brand-400 text-sm font-semibold hover:text-brand-300">
                  Manage Rooms
                  <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                </Link>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {vacantRooms.slice(0, 6).map(r => (
                  <div key={r._id} className="p-4 rounded-xl border border-success/20 bg-success/5 flex flex-col items-center justify-center text-center">
                    <p className="font-bold text-white text-lg mb-1">Room {r.roomNumber}</p>
                    <p className="text-xs text-slate-400 mb-2 truncate w-full">{r.propertyId?.name}</p>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-success bg-success/10 px-2 py-1 rounded">
                      {r.capacity - r.currentOccupancy} bed{r.capacity - r.currentOccupancy !== 1 ? 's' : ''} available
                    </span>
                  </div>
                ))}
                {vacantRooms.length > 6 && (
                  <div className="p-4 rounded-xl border border-dashed border-slate-600 flex flex-col items-center justify-center text-center">
                    <p className="text-slate-400 font-medium">+{vacantRooms.length - 6} more</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6 border-brand-500/20 bg-brand-500/5 flex flex-col items-center text-center">
            <h2 className="text-lg font-bold text-white mb-1">Payment Setup</h2>
            <p className="text-xs text-slate-500 mb-6 font-medium uppercase tracking-widest">Active QR Code</p>

            <div className="w-full max-w-[180px] aspect-square bg-white rounded-2xl shadow-glow overflow-hidden mb-6 flex items-center justify-center p-2 border-4 border-white/5">
              {user?.qrCodeImage?.secureUrl ? (
                <img
                  src={user.qrCodeImage.secureUrl}
                  alt="UPI QR Code for receiving payments"
                  className="w-full h-full object-contain"
                  width={180}
                  height={180}
                />
              ) : (
                <div className="text-slate-400 italic text-xs flex flex-col items-center gap-2">
                  <CreditCard className="w-8 h-8 text-slate-500" />
                  <span>No QR Code</span>
                </div>
              )}
            </div>

            <div className="w-full space-y-4">
              <div>
                <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">UPI ID</p>
                <p className="text-sm font-mono text-brand-400 truncate px-3 py-2 bg-brand-400/5 rounded-lg border border-brand-400/10">
                  {user?.upiId || 'Not configured'}
                </p>
              </div>
              <Link to="/profile" className="btn-secondary w-full text-xs font-bold py-2.5">
                <Settings className="w-3.5 h-3.5" />
                Update Payment Info
              </Link>
            </div>
          </div>

          <div className="card p-5">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-brand-400" />
              System Status
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-slate-400">Server Status: Online</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-slate-400">Database: Connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
