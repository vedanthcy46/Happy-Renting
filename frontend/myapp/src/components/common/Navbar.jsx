import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

const Icon = ({ name }) => {
  const icons = {
    grid: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />,
    door: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    users: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
    coin: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    shield: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
    home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    wallet: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
    clock: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
    logout: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
    menu: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />,
    close: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />,
    chat: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />,
    user: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
    bell: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
    trash: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
    chart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />,
    'chevron-down': <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />,
  };
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {icons[name]}
    </svg>
  );
};

// Notification type styling
const typeIcons = {
  billing:     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  alert:       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
  lifecycle:   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  maintenance: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
  system:      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
};

const NotifIcon = ({ name }) => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    {typeIcons[name]}
  </svg>
);

// ── NotificationBell component ────────────────────────────────────────────
const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/system/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // silent — avoid noise in Navbar
    }
  }, []);

  // Poll every 60 s for new notifications
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
  };

  const markRead = async (id) => {
    try {
      await api.patch(`/system/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/system/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const timeAgo = (date) => {
    const secs = Math.floor((Date.now() - new Date(date)) / 1000);
    if (secs < 60) return 'just now';
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        onClick={handleOpen}
        className="relative btn-ghost p-2 rounded-lg hover:bg-surface-hover transition-colors"
        title="Notifications"
        aria-label="Open notifications"
      >
        <Icon name="bell" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center text-[9px] font-bold text-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          id="notification-panel"
          className="absolute right-0 top-12 w-80 sm:w-96 bg-surface-card border border-surface-border rounded-2xl shadow-2xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Notifications
              {unreadCount > 0 && (
                <span className="text-[10px] bg-brand-500 text-white rounded-full px-1.5 py-0.5 font-bold">{unreadCount}</span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] font-bold text-brand-400 hover:text-brand-300 underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
            {loading ? (
              <div className="py-10 text-center text-slate-500 text-sm">Loading\u2026</div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-slate-500 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const iconKey = Object.prototype.hasOwnProperty.call(typeIcons, n.type) ? n.type : 'system';
                return (
                  <button
                    key={n._id}
                    onClick={() => { if (!n.read) markRead(n._id); }}
                    className={`w-full text-left flex gap-3 px-4 py-3 border-b border-surface-border/50 transition-colors
                      ${n.read ? 'opacity-55 hover:opacity-75' : 'bg-brand-500/5 hover:bg-brand-500/10'}`}
                  >
                    <span className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      iconKey === 'billing' ? 'bg-blue-500/10 text-blue-400'
                      : iconKey === 'alert' ? 'bg-yellow-500/10 text-yellow-400'
                      : iconKey === 'lifecycle' ? 'bg-green-500/10 text-green-400'
                      : iconKey === 'maintenance' ? 'bg-orange-500/10 text-orange-400'
                      : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      <NotifIcon name={iconKey} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-bold truncate ${n.read ? 'text-slate-400' : 'text-white'}`}>
                          {n.title}
                        </p>
                        <span className="text-[9px] text-slate-500 shrink-0 mt-0.5">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                    {!n.read && (
                      <span className="mt-2 w-2 h-2 rounded-full shrink-0 bg-brand-400" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── NavDropdown ────────────────────────────────────────────────────────────
const NavDropdown = ({ label, icon, children, isActive }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={label}
        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0
          ${isActive
            ? 'bg-brand-600/20 text-brand-400'
            : 'text-slate-400 hover:text-white hover:bg-surface-hover'
          }`}
      >
        <Icon name={icon} />
        <span className="hidden lg:inline">{label}</span>
        <Icon name="chevron-down" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-surface-card border border-surface-border rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
};

// ── Nav Structure ──────────────────────────────────────────────────────────
const navGroups = [
  {
    label: 'Manage', icon: 'grid',
    roles: ['superadmin', 'owner'],
    children: [
      { path: '/properties', label: 'Properties', icon: 'home', roles: ['superadmin', 'owner'] },
      { path: '/rooms', label: 'Rooms', icon: 'door', roles: ['superadmin', 'owner'] },
      { path: '/tenants', label: 'Tenants', icon: 'users', roles: ['superadmin', 'owner'] },
      { path: '/complaints', label: 'Complaints', icon: 'chat', roles: ['owner'] },
      { path: '/owner/deletion-requests', label: 'Deletions', icon: 'trash', roles: ['owner'] },
    ],
  },
  {
    label: 'Finance', icon: 'coin',
    roles: ['superadmin', 'owner', 'tenant'],
    children: [
      { path: '/payments', label: 'Payments', icon: 'coin', roles: ['superadmin', 'owner', 'tenant'] },
      { path: '/wallet', label: 'Wallet', icon: 'wallet', roles: ['owner'] },
      { path: '/wallet-admin', label: 'Wallet Admin', icon: 'wallet', roles: ['superadmin'] },
    ],
  },
  {
    label: 'Admin', icon: 'shield',
    roles: ['superadmin'],
    children: [
      { path: '/users', label: 'Owners', icon: 'shield' },
      { path: '/requests', label: 'Requests', icon: 'clock' },
      { path: '/deletion-requests', label: 'Deletions', icon: 'trash' },
    ],
  },
  {
    label: 'Tenant', icon: 'home',
    roles: ['tenant'],
    children: [
      { path: '/my-room', label: 'My Room', icon: 'door' },
      { path: '/complaints', label: 'Complaints', icon: 'chat' },
    ],
  },
];

const standaloneLinks = [
  { path: '/dashboard', label: 'Dashboard', icon: 'chart', roles: ['superadmin', 'owner', 'tenant'] },
  { path: '/profile', label: 'Profile', icon: 'user', roles: ['superadmin', 'owner', 'tenant'] },
];

// All links flat (for mobile drawer)
const navLinks = [
  ...standaloneLinks,
  { path: '/properties', label: 'Properties', icon: 'home', roles: ['superadmin', 'owner'] },
  { path: '/rooms', label: 'Rooms', icon: 'door', roles: ['superadmin', 'owner'] },
  { path: '/tenants', label: 'Tenants', icon: 'users', roles: ['superadmin', 'owner'] },
  { path: '/payments', label: 'Payments', icon: 'coin', roles: ['superadmin', 'owner', 'tenant'] },
  { path: '/wallet', label: 'Wallet', icon: 'wallet', roles: ['owner'] },
  { path: '/wallet-admin', label: 'Wallet Admin', icon: 'wallet', roles: ['superadmin'] },
  { path: '/users', label: 'Owners', icon: 'shield', roles: ['superadmin'] },
  { path: '/requests', label: 'Requests', icon: 'clock', roles: ['superadmin'] },
  { path: '/my-room', label: 'My Room', icon: 'home', roles: ['tenant'] },
  { path: '/complaints', label: 'Complaints', icon: 'chat', roles: ['owner', 'tenant'] },
  { path: '/owner/deletion-requests', label: 'Deletions', icon: 'trash', roles: ['owner', 'superadmin'] },
];


const Navbar = () => {
  const { user, role, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resending, setResending] = useState(false);

  const visibleLinks = navLinks.filter(l => l.roles.includes(role));

  // Filter groups and their children by user role
  const visibleGroups = navGroups
    .filter(g => g.roles.includes(role))
    .map(g => ({
      ...g,
      children: g.children.filter(c => !c.roles || c.roles.includes(role)),
    }))
    .filter(g => g.children.length > 0);

  const visibleStandalone = standaloneLinks.filter(l => l.roles.includes(role));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleResendVerification = async () => {
    if (resending) return;
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: user.email });
      alert('Verification email resent! Please check your inbox.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to resend email.');
    } finally {
      setResending(false);
    }
  };

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const anyGroupActive = (group) =>
    group.children.some(c => isActive(c.path));

  const showVerificationBanner = user && !user.emailVerified;

  return (
    <>
      <nav className="fixed top-0  left-0 right-0 z-40 h-16 bg-surface-card/80 backdrop-blur-md border-b border-surface-border">
        {showVerificationBanner && (
          <div className="absolute top-16 left-0 right-0 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-500 text-xs text-center py-2 px-4">
            Your email is not verified. Please check your inbox or{' '}
            <button onClick={handleResendVerification} className="underline font-bold" disabled={resending}>
              {resending ? 'Sending...' : 'click here to resend.'}
            </button>
          </div>
        )}
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Happy Renting Home">
            <img
              src="/main-app-icon.png"
              alt=""
              className="h-9 sm:h-10 w-auto block"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <span className="text-base sm:text-lg font-extrabold text-white tracking-tight leading-none whitespace-nowrap">
              Happy<span className="text-brand-400"> Renting</span>
            </span>
          </Link>

          {/* Desktop Nav — groups + standalone, hidden on mobile */}
          <div className="hidden md:flex items-center gap-1 flex-1 mx-4 overflow-y-visible">
            {visibleGroups.map(group => (
              <NavDropdown key={group.label} label={group.label} icon={group.icon} isActive={anyGroupActive(group)}>
                  {group.children.map(child => (
                    <Link
                      key={child.path}
                      to={child.path}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors
                        ${isActive(child.path)
                          ? 'bg-brand-600/20 text-brand-400'
                          : 'text-slate-400 hover:bg-surface-hover hover:text-white'
                        }`}
                    >
                      <Icon name={child.icon} />
                      {child.label}
                    </Link>
                  ))}
                </NavDropdown>
              ))}
              {visibleStandalone.map(link => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0
                    ${isActive(link.path)
                      ? 'bg-brand-600/20 text-brand-400'
                      : 'text-slate-400 hover:text-white hover:bg-surface-hover'
                    }`}
                >
                  <Icon name={link.icon} />
                  <span className="hidden lg:inline">{link.label}</span>
                </Link>
              ))}
          </div>

          {/* Right section */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* User info */}
            <div className="hidden sm:flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-medium text-white leading-none">{user?.name}</p>
                <p className="text-xs text-slate-400 capitalize mt-0.5">{role}</p>
              </div>
            </div>

            {/* 🔔 Notification Bell */}
            <NotificationBell />

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="btn-ghost btn-sm flex items-center gap-1 p-2"
              title="Logout"
              aria-label="Logout"
            >
              <Icon name="logout" />
              <span className="hidden sm:block text-xs">Logout</span>
            </button>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden btn-ghost p-2"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
            >
              <Icon name={mobileOpen ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 pt-16 bg-surface/95 backdrop-blur-sm">
          <div className="p-4 flex flex-col gap-2">
            {visibleLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors
                  ${isActive(link.path)
                    ? 'bg-brand-600/20 text-brand-400'
                    : 'text-slate-300 hover:bg-surface-hover hover:text-white'
                  }`}
              >
                <Icon name={link.icon} />
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
