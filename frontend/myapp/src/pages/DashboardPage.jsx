import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';

const StatCard = ({ label, value, sub, icon, color }) => (
  <div className="stat-card animate-fade-in min-w-0">
    <div className="flex items-center justify-between mb-3 gap-3">
      <span className="text-slate-400 text-sm break-words">{label}</span>

      <div
        className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white text-xl shrink-0`}
      >
        {icon}
      </div>
    </div>

    <div className="stat-value break-words">{value ?? '—'}</div>

    {sub && (
      <div className="text-xs text-slate-500 mt-1 break-words">
        {sub}
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

  const [finance, setFinance] = useState({
    income: 0,
    pending: 0,
    overdue: 0,
  });

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
          api.get('/payments?limit=1'),
        ]);

        setStats({ tenancy: tenantRes.data.tenant });

        if (payRes.data.payments?.length > 0) {
          setCurrentPayment(payRes.data.payments[0]);
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
        const [roomsRes, tenantsRes, paymentsRes, summaryRes] =
          await Promise.all([
            api.get('/rooms'),
            api.get('/tenants?status=active'),
            api.get('/payments?status=pending'),
            api.get('/payments/summary'),
          ]);

        const rooms = roomsRes.data.rooms;
        const tenants = tenantsRes.data.tenants;
        const payments = paymentsRes.data.payments;

        setStats({
          totalRooms: rooms.length,
          fullRooms: rooms.filter((r) => r.isFull).length,
          activeTenants: tenants.length,
          pendingPayments: payments.length,
        });

        setRecent(tenants.slice(0, 5));

        setVacantRooms(rooms.filter((r) => !r.isFull));

        const sumData = summaryRes.data.summary || [];

        const paidAmount =
          sumData.find((s) => s._id === 'paid')?.totalAmount || 0;

        const pendAmount =
          sumData.find((s) => s._id === 'pending')?.totalAmount || 0;

        const overAmount =
          sumData.find((s) => s._id === 'overdue')?.totalAmount || 0;

        setFinance({
          income: paidAmount,
          pending: pendAmount,
          overdue: overAmount,
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

  // ───────────────── SUPER ADMIN ─────────────────
  if (isSuperAdmin) {
    return (
      <div className="w-full max-w-full overflow-x-hidden">
        <div className="space-y-6 sm:space-y-8 animate-fade-in">
          <div>
            <h1 className="page-title">Admin Overview</h1>

            <p className="text-slate-400 text-sm mt-1">
              System-wide performance & owner management
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            <StatCard
              label="Total Owners"
              value={stats?.totalOwners}
              icon="🛡️"
              color="bg-brand-600"
            />

            <StatCard
              label="Total Properties"
              value={stats?.totalProperties}
              icon="🏢"
              color="bg-purple-600"
            />

            <StatCard
              label="Total Tenants"
              value={stats?.totalTenants}
              icon="👥"
              color="bg-success"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8">
            <div className="lg:col-span-2 card min-w-0">
              <div className="px-4 sm:px-6 py-4 border-b border-surface-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">
                  Owner → Property Mapping
                </h2>

                <Link
                  to="/users"
                  className="btn-ghost btn-sm text-brand-400 w-full sm:w-auto text-center"
                >
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
                    {mapping.map((item) => (
                      <tr key={item._id}>
                        <td className="font-medium text-white">
                          {item.name}
                        </td>

                        <td className="text-slate-400">{item.email}</td>

                        <td className="text-slate-300 font-mono">
                          {item.propertyCount}
                        </td>

                        <td className="text-slate-300 font-mono">
                          {item.tenantCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card flex flex-col h-[500px] min-w-0">
              <div className="px-6 py-4 border-b border-surface-border">
                <h2 className="text-lg font-semibold text-white">
                  Recent Activity Logs
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {logs.length === 0 ? (
                  <p className="text-center text-slate-500 mt-10">
                    No recent activity.
                  </p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log._id}
                      className="relative pl-4 border-l border-brand-500/30"
                    >
                      <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-brand-500"></div>

                      <p className="text-xs text-brand-400 font-bold mb-0.5">
                        {log.actionType}
                      </p>

                      <p className="text-sm text-white break-words">
                        {log.details}
                      </p>

                      <p className="text-[10px] text-slate-500 mt-1 break-words">
                        By {log.ownerId?.name} •{' '}
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────── TENANT ─────────────────
  if (isTenant) {
    const t = stats?.tenancy;

    if (!t || t.status === 'vacated') {
      return (
        <div className="w-full max-w-full overflow-x-hidden">
          <div className="max-w-lg mx-auto mt-10 sm:mt-20 text-center animate-fade-in px-4">
            <div className="card p-6 sm:p-10 shadow-glass border-brand-500/20">
              <div className="text-6xl mb-6">🚪</div>

              <h2 className="text-2xl font-bold text-white mb-2">
                {t ? 'Tenancy Ended' : 'No Active Tenancy'}
              </h2>

              <p className="text-slate-400 break-words">
                {t
                  ? `Your stay at Room ${t.roomId?.roomNumber} concluded on ${new Date(
                      t.exitDate
                    ).toLocaleDateString()}.`
                  : "You haven't been assigned to a room yet."}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full max-w-full overflow-x-hidden">
        <div className="max-w-4xl mx-auto animate-slide-up space-y-6 sm:space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="page-title text-2xl sm:text-3xl break-words">
              Hello, {user?.name.split(' ')[0]} 👋
            </h1>

            <StatusBadge status="active" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6 min-w-0">
              <div className="card p-4 sm:p-8 bg-gradient-to-br from-surface-card to-brand-900/10">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <span className="text-brand-400">🏠</span>
                  My Room Details
                </h2>

                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">
                      Room
                    </p>

                    <p className="text-xl text-white font-bold">
                      {t.roomId?.roomNumber}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">
                      Floor
                    </p>

                    <p className="text-xl text-white font-bold">
                      {t.roomId?.floor || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">
                      Rent
                    </p>

                    <p className="text-xl text-brand-400 font-bold">
                      ₹{t.roomId?.monthlyRent?.toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">
                      Joined
                    </p>

                    <p className="text-white">
                      {new Date(t.joinDate).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">
                      Property
                    </p>

                    <p className="text-white font-medium break-words">
                      {t.propertyId?.name}
                    </p>

                    <p className="text-xs text-slate-400 mt-0.5 break-words">
                      {t.propertyId?.address}
                    </p>
                  </div>
                </div>
              </div>

              <Link
                to="/payments"
                className="btn-primary w-full justify-center py-4 text-lg flex"
              >
                💳 View All Payments
              </Link>
            </div>

            <div className="space-y-6">
              <div className="card p-4 sm:p-6 border-brand-500/30 bg-brand-500/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <span className="text-6xl">💸</span>
                </div>

                <h3 className="font-bold text-white mb-4 uppercase text-xs tracking-widest text-brand-400">
                  Current Month Bill
                </h3>

                {currentPayment ? (
                  <div className="space-y-4 relative z-10">
                    <div className="flex justify-between items-end gap-4">
                      <div>
                        <p className="text-slate-500 text-[10px] uppercase font-bold">
                          Month
                        </p>

                        <p className="text-xl font-bold text-white">
                          {currentPayment.month}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-slate-500 text-[10px] uppercase font-bold">
                          Due Date
                        </p>

                        <p className="text-sm font-mono text-white">
                          {currentPayment.dueDate
                            ? new Date(
                                currentPayment.dueDate
                              ).toLocaleDateString()
                            : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">
                        Status
                      </p>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <StatusBadge status={currentPayment.status} />

                        <p className="text-2xl font-bold text-white">
                          ₹{currentPayment.amount?.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {(currentPayment.status === 'pending' ||
                      currentPayment.status === 'overdue' ||
                      currentPayment.status === 'failed') && (
                      <Link
                        to={`/tenant/pay/${currentPayment._id}`}
                        className="btn-primary w-full mt-4 py-3 justify-center shadow-glow flex"
                      >
                        Pay Now
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-slate-500 italic text-sm">
                      No bills generated yet.
                    </p>
                  </div>
                )}
              </div>

              <div className="card p-6">
                <h3 className="font-bold text-white mb-4">
                  Quick Support
                </h3>

                <p className="text-sm text-slate-400 mb-4 break-words">
                  Having trouble with your room? Raise a complaint directly to
                  the owner.
                </p>

                <Link
                  to="/complaints"
                  className="btn-secondary w-full text-center"
                >
                  Raise Complaint
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────── OWNER ─────────────────
  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="space-y-6 sm:space-y-8 animate-fade-in">
        <div>
          <h1 className="page-title">Management Dashboard</h1>

          <p className="text-slate-400 text-sm mt-1">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          <StatCard
            label="Total Rooms"
            value={stats?.totalRooms}
            icon="🏠"
            color="bg-brand-600"
            sub="Active inventory"
          />

          <StatCard
            label="Full Rooms"
            value={stats?.fullRooms}
            icon="🔒"
            color="bg-danger"
            sub="Maximum capacity"
          />

          <StatCard
            label="Active Tenants"
            value={stats?.activeTenants}
            icon="👥"
            color="bg-success"
            sub="Current residents"
          />

          <StatCard
            label="Pending Rent"
            value={stats?.pendingPayments}
            icon="💰"
            color="bg-warning"
            sub="Payments due"
          />
        </div>

        <div className="card p-4 sm:p-6 border border-brand-500/20 bg-gradient-to-r from-surface-card to-brand-500/5">
          <h2 className="text-lg font-bold text-white mb-6">
            Rent Summary Dashboard
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-surface-border">
            <div className="px-4">
              <p className="text-xs uppercase font-bold text-slate-500 mb-2">
                Collected Income
              </p>

              <p className="text-3xl font-bold text-success break-words">
                ₹{finance.income.toLocaleString()}
              </p>
            </div>

            <div className="px-4 pt-4 md:pt-0">
              <p className="text-xs uppercase font-bold text-slate-500 mb-2">
                Pending Dues
              </p>

              <p className="text-3xl font-bold text-warning break-words">
                ₹{finance.pending.toLocaleString()}
              </p>
            </div>

            <div className="px-4 pt-4 md:pt-0">
              <p className="text-xs uppercase font-bold text-slate-500 mb-2">
                Overdue Amount
              </p>

              <p className="text-3xl font-bold text-danger break-words">
                ₹{finance.overdue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          <Link
            to="/tenants/add"
            className="card p-6 hover:border-brand-500 transition-all hover:-translate-y-1 duration-300 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-2xl mb-4">
              ➕
            </div>

            <h3 className="font-bold text-white text-lg">
              Move In Tenant
            </h3>

            <p className="text-slate-400 text-sm mt-1">
              Assign a new resident to a room
            </p>
          </Link>

          <Link
            to="/rooms"
            className="card p-6 hover:border-brand-500 transition-all hover:-translate-y-1 duration-300 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-2xl mb-4">
              🛏️
            </div>

            <h3 className="font-bold text-white text-lg">
              Manage Rooms
            </h3>

            <p className="text-slate-400 text-sm mt-1">
              Monitor occupancy & status
            </p>
          </Link>

          <Link
            to="/profile"
            className="card p-6 hover:border-brand-500 transition-all hover:-translate-y-1 duration-300 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-2xl mb-4">
              💳
            </div>

            <h3 className="font-bold text-white text-lg">
              Payment Logs
            </h3>

            <p className="text-slate-400 text-sm mt-1">
              Review & record rent payments
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;