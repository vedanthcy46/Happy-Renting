import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import DashboardFilters from '../components/common/DashboardFilters';
import Modal from '../components/common/Modal';

const TenantsPage = () => {
  const toast = useToast();
  const [tenants,    setTenants]    = useState([]);
  const [tab,        setTab]        = useState('active');
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [filters,    setFilters]    = useState({ ownerId: '', propertyId: '', roomId: '' });
  
  // Move-out modal state
  const [moveOut,    setMoveOut]    = useState({ open: false, tenant: null });
  const [exitDate,   setExitDate]   = useState('');
  const [exitNotes,  setExitNotes]  = useState('');
  const [exiting,    setExiting]    = useState(false);
  const [exitError,  setExitError]  = useState('');

  // Edit Advance modal state
  // Edit Advance/Profile modal state
  const [editAdv,    setEditAdv]    = useState({ open: false, tenant: null, amount: '', total: '', rentDueDay: 5, name: '', email: '', phone: '', idProof: '' });
  const [editTab,    setEditTab]    = useState('finance'); // 'finance' or 'profile'
  const [updatingAdv, setUpdatingAdv] = useState(false);

  // Co-Occupant modal state (for both add and edit)
  const [coOccModal, setCoOccModal] = useState({ open: false, tenant: null, coOccupant: null, mode: 'add' });
  const [coOccData,  setCoOccData]  = useState({ name: '', phone: '', idProof: '' });
  const [savingCoOcc, setSavingCoOcc] = useState(false);

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('status', tab);
      if (filters.ownerId)    params.append('ownerId',    filters.ownerId);
      if (filters.propertyId) params.append('propertyId', filters.propertyId);
      if (filters.roomId)     params.append('roomId',     filters.roomId);

      const { data } = await api.get(`/tenants?${params.toString()}`);
      setTenants(data.tenants);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, filters, toast]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const openMoveOut = (tenant) => {
    setMoveOut({ open: true, tenant });
    setExitDate(new Date().toISOString().split('T')[0]);
    setExitNotes('');
    setExitError('');
  };

  const handleMoveOut = async (e) => {
    e.preventDefault();
    if (!exitDate) return setExitError('Exit date is required');
    if (exiting) return;

    setExiting(true);
    setExitError('');
    try {
      await api.patch(`/tenants/${moveOut.tenant._id}/moveout`, {
        exitDate,
        notes: exitNotes,
      });
      toast.success(`${moveOut.tenant.userId?.name} has been moved out successfully.`);
      setMoveOut({ open: false, tenant: null });
      fetchTenants();
    } catch (err) {
      setExitError(err.message);
    } finally {
      setExiting(false);
    }
  };

  const openEditAdvance = (tenant) => {
    setEditAdv({ 
      open: true, 
      tenant, 
      amount: tenant.advancePaid || 0,
      total: tenant.securityDeposit || tenant.roomId?.securityDeposit || 0,
      rentDueDay: tenant.rentDueDay || 5,
      name: tenant.userId?.name || '',
      email: tenant.userId?.email || '',
      phone: tenant.phone || '',
      idProof: tenant.idProof || ''
    });
    setEditTab('finance');
  };

    const handleUpdateAdvance = async (e) => {
    e.preventDefault();
    if (updatingAdv) return;

    if (Number(editAdv.amount) > Number(editAdv.total)) {
      return toast.error('Initial advance or advance paid should be less than or equal to the security deposit.');
    }

    setUpdatingAdv(true);
    try {
      await api.patch(`/tenants/${editAdv.tenant._id}`, { 
        advancePaid: Number(editAdv.amount),
        securityDeposit: Number(editAdv.total),
        rentDueDay: Number(editAdv.rentDueDay),
        name: editAdv.name,
        email: editAdv.email,
        phone: editAdv.phone,
        idProof: editAdv.idProof
      });
      toast.success('Tenant details updated successfully.');
      setEditAdv({ open: false, tenant: null, amount: '', total: '', rentDueDay: 5, name: '', email: '', phone: '', idProof: '' });
      fetchTenants();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdatingAdv(false);
    }
  };

  const openAddCoOccupant = (tenant) => {
    setCoOccModal({ open: true, tenant, coOccupant: null, mode: 'add' });
    setCoOccData({ name: '', phone: '', idProof: '' });
  };

  const openEditCoOccupant = (tenant, co) => {
    setCoOccModal({ open: true, tenant, coOccupant: co, mode: 'edit' });
    setCoOccData({ name: co.name || '', phone: co.phone || '', idProof: co.idProof || '' });
  };

  const handleSaveCoOccupant = async (e) => {
    e.preventDefault();
    if (!coOccData.name) return toast.error('Name is required');
    if (savingCoOcc) return;

    setSavingCoOcc(true);
    try {
      if (coOccModal.mode === 'add') {
        await api.post(`/tenants/${coOccModal.tenant._id}/co-occupants`, {
          coOccupants: [coOccData]
        });
        toast.success(`Co-occupant added.`);
      } else {
        await api.patch(`/tenants/${coOccModal.tenant._id}/co-occupants/${coOccModal.coOccupant._id}`, coOccData);
        toast.success(`Co-occupant updated.`);
      }
      setCoOccModal({ open: false, tenant: null, coOccupant: null, mode: 'add' });
      fetchTenants();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingCoOcc(false);
    }
  };

  const handleDeleteCoOccupant = async (tenantId, coId) => {
    if (!window.confirm('Are you sure you want to remove this co-occupant?')) return;
    try {
      await api.delete(`/tenants/${tenantId}/co-occupants/${coId}`);
      toast.success('Co-occupant removed.');
      fetchTenants();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const [expanded, setExpanded] = useState({});

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = tenants.filter(t =>
    !search ||
    t.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.roomId?.roomNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Tenants</h1>
          <p className="text-slate-400 text-sm mt-1">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/tenants/add" id="add-tenant-link" className="btn-primary w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Tenant
        </Link>
      </div>

      {/* Filters */}
      <DashboardFilters onFilterChange={setFilters} showOwnerFilter={true} />

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Filter tabs */}
        <div className="flex rounded-xl bg-surface-card border border-surface-border p-1 gap-1">
          {[
            { key: 'active',  label: 'Active Tenants' },
            { key: 'vacated', label: 'Past Tenants' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                ${tab === t.key ? 'bg-brand-600 text-white shadow-glow' : 'text-slate-400 hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search name or room…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input pl-9 w-full"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">{tab === 'active' ? '👥' : '📋'}</div>
          <p className="text-slate-400">No {tab} tenants found for the selected filters.</p>
          {tab === 'active' && (
            <Link to="/tenants/add" className="btn-primary mt-4 inline-flex">Add First Tenant</Link>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Primary Tenant</th>
                <th>Room / Property</th>
                <th className="text-center">People</th>
                <th>Joined</th>
                {tab === 'vacated' && <th>Exited</th>}
                <th>Advance</th>
                {tab === 'active' && <th>Due Day</th>}
                <th>Status</th>
                {tab === 'active' && <th className="text-right">Actions</th>}
                {tab === 'vacated' && <th className="text-right">Refund</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <React.Fragment key={t._id}>
                  <tr className={expanded[t._id] ? 'bg-surface/50' : ''}>
                    <td>
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleExpand(t._id)} className={`p-1 rounded hover:bg-surface transition-transform ${expanded[t._id] ? 'rotate-90' : ''}`}>
                          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <div>
                          <p className="font-bold text-white">{t.userId?.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{t.phone || t.userId?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-slate-300">
                      <p className="font-semibold text-white">Room {t.roomId?.roomNumber}</p>
                      <p className="text-[10px] text-slate-400">{t.propertyId?.name} — {t.propertyId?.address}</p>
                    </td>
                    <td className="text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface-card border border-surface-border text-xs text-white">
                        {1 + (t.coOccupants?.length || 0)}
                      </span>
                    </td>
                    <td className="text-slate-400 text-xs">{t.joinDate ? new Date(t.joinDate).toLocaleDateString() : '—'}</td>
                    {tab === 'vacated' && (
                      <td className="text-slate-400 text-xs">{t.exitDate ? new Date(t.exitDate).toLocaleDateString() : '—'}</td>
                    )}
                    <td className="text-slate-300 group relative text-sm">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <span>₹{t.advancePaid?.toLocaleString() || 0}</span>
                          {t.securityDeposit > 0 && t.advancePaid >= t.securityDeposit && (
                            <svg className="w-3.5 h-3.5 text-success animate-in zoom-in duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        {t.securityDeposit > 0 && (
                          <span className="text-[10px] text-slate-500 font-bold">
                            / ₹{t.securityDeposit.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {tab === 'active' && (
                        <button onClick={() => openEditAdvance(t)} className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-brand-400 hover:text-brand-300 transition-opacity p-2">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </td>
                    {tab === 'active' && (
                      <td className="text-white font-mono text-xs">
                        <span className="bg-brand-500/10 text-brand-400 px-2 py-1 rounded border border-brand-500/20">
                          {t.rentDueDay || 5}th
                        </span>
                      </td>
                    )}
                    <td><StatusBadge status={t.status} /></td>
                    {tab === 'active' && (
                      <td className="text-right">
                        <button onClick={() => openMoveOut(t)} className="btn btn-danger btn-sm text-[10px] uppercase font-bold tracking-wider">Vacate</button>
                      </td>
                    )}
                    {tab === 'vacated' && (
                      <td className="text-right">
                        {(t.advanceRefundAmount > 0 || t.advancePaid > 0) ? (
                          t.refundSettled ? (
                            <span className="inline-flex flex-col items-end">
                              <span className="text-[10px] font-bold text-success uppercase">✓ Settled</span>
                              <span className="text-[9px] text-slate-500 font-mono">{new Date(t.refundSettledAt).toLocaleDateString()}</span>
                            </span>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[10px] font-bold text-warning uppercase">💰 Refund Due</span>
                              <button onClick={() => {
                                const note = window.prompt("Enter an optional note for marking this refund as settled:");
                                if (note !== null) {
                                  api.patch(`/tenants/${t._id}/mark-refund-settled`, { note }).then(() => {
                                    toast.success('Refund marked as settled!');
                                    fetchTenants();
                                  }).catch(e => toast.error('Failed to settle refund: ' + e.message));
                                }
                              }} className="btn-secondary py-0.5 px-2 text-[9px] uppercase font-bold border-warning/30 text-warning hover:bg-warning/10">
                                Mark Settled
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                  {expanded[t._id] && (
                    <tr className="bg-surface/30 animate-fade-in border-l-2 border-brand-500">
                      <td colSpan={8} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Primary Details */}
                          <div className="space-y-3">
                            <h4 className="text-[10px] uppercase font-bold text-brand-400">Primary Tenant Info</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Email</p>
                                <p className="text-sm text-white">{t.userId?.email}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Phone</p>
                                <p className="text-sm text-white">{t.phone || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold">ID Proof</p>
                                <p className="text-sm text-white">{t.idProof || '—'}</p>
                              </div>
                            </div>
                            {t.notes && (
                              <div className="mt-2">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Internal Notes</p>
                                <p className="text-xs text-slate-400 italic">{t.notes}</p>
                              </div>
                            )}
                          </div>

                          {/* Co-Occupants List */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-[10px] uppercase font-bold text-brand-400">Co-Occupants ({t.coOccupants?.length || 0})</h4>
                              {tab === 'active' && (
                                <button 
                                  onClick={() => openAddCoOccupant(t)}
                                  className="text-[9px] uppercase font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add Co-Occupant
                                </button>
                              )}
                            </div>
                            {!t.coOccupants || t.coOccupants.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">No co-occupants registered.</p>
                            ) : (
                              <div className="space-y-2">
                                {t.coOccupants.map((co, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-surface-card border border-surface-border group/co">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-white truncate">{co.name}</p>
                                      {(co.phone || co.idProof) && (
                                        <p className="text-[9px] text-slate-500 truncate">
                                          {co.phone}{co.phone && co.idProof ? ' • ' : ''}{co.idProof && `ID: ${co.idProof}`}
                                        </p>
                                      )}
                                    </div>
                                    {tab === 'active' && (
                                      <div className="flex items-center gap-1 opacity-0 group-hover/co:opacity-100 transition-opacity">
                                        <button 
                                          onClick={() => openEditCoOccupant(t, co)}
                                          className="p-1.5 rounded-md hover:bg-brand-500/10 text-brand-400 transition-colors"
                                          title="Edit Co-Occupant"
                                        >
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                          </svg>
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteCoOccupant(t._id, co._id)}
                                          className="p-1.5 rounded-md hover:bg-danger/10 text-danger transition-colors"
                                          title="Remove Co-Occupant"
                                        >
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Move-Out Modal */}
      <Modal isOpen={moveOut.open} onClose={() => setMoveOut({ open: false, tenant: null })} title="Move Out Tenant" size="sm">
        <div className="mb-4 p-4 rounded-xl bg-surface border border-surface-border">
          <p className="text-sm text-slate-400">Moving out:</p>
          <p className="text-white font-semibold mt-1">{moveOut.tenant?.userId?.name}</p>
          <p className="text-slate-400 text-sm">Room {moveOut.tenant?.roomId?.roomNumber}</p>
        </div>
        {exitError && <div className="mb-4 p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">{exitError}</div>}
        <form onSubmit={handleMoveOut} noValidate className="space-y-4">
          <div>
            <label className="form-label">Exit Date *</label>
            <input type="date" className="form-input" value={exitDate} onChange={e => setExitDate(e.target.value)} min={moveOut.tenant?.joinDate?.split('T')[0]} max={new Date().toISOString().split('T')[0]} />
          </div>
          <div>
            <label className="form-label">Notes (optional)</label>
            <textarea className="form-input resize-none" rows={2} value={exitNotes} onChange={e => setExitNotes(e.target.value)} placeholder="Reason for moving out…" maxLength={500} />
          </div>
          <div className="p-3 rounded-xl bg-warning/10 border border-warning/30">
            <p className="text-warning text-xs">⚠️ This will mark the tenant as vacated and free up the room.</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setMoveOut({ open: false, tenant: null })} className="btn-secondary flex-1">Cancel</button>
            <button id="confirm-moveout" type="submit" disabled={exiting} className="btn-danger flex-1">{exiting ? 'Processing…' : 'Confirm Move Out'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={editAdv.open} onClose={() => setEditAdv({ open: false, tenant: null, amount: '', total: '', rentDueDay: 5 })} title="Update Tenant Details" size="sm">
        <div className="flex rounded-xl bg-surface border border-surface-border p-1 gap-1 mb-4">
          <button 
            type="button" 
            onClick={() => setEditTab('finance')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex-1 ${editTab === 'finance' ? 'bg-brand-600 text-white shadow-glow' : 'text-slate-400 hover:text-white'}`}
          >
            Finance
          </button>
          <button 
            type="button" 
            onClick={() => setEditTab('profile')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex-1 ${editTab === 'profile' ? 'bg-brand-600 text-white shadow-glow' : 'text-slate-400 hover:text-white'}`}
          >
            Profile
          </button>
        </div>

        <form onSubmit={handleUpdateAdvance} className="space-y-4">
          {editTab === 'finance' ? (
            <>
              <div>
                <label className="form-label">Rent Due Day (1-31)</label>
                <input type="number" min="1" max="31" className="form-input" 
                  value={editAdv.rentDueDay} onChange={e => setEditAdv(a => ({ ...a, rentDueDay: e.target.value }))} />
                <p className="text-[10px] text-slate-500 mt-1">Day of the month rent is due.</p>
              </div>
              <div className="pt-2 border-t border-surface-border"></div>
              <div>
                <label className="form-label">Target Security Deposit (Total ₹)</label>
                <input type="number" min="0" className="form-input" 
                  value={editAdv.total} onChange={e => setEditAdv(a => ({ ...a, total: e.target.value }))} />
                <p className="text-[10px] text-slate-500 mt-1">This is the total amount the tenant is expected to pay.</p>
              </div>
              <div>
                <label className="form-label">Currently Paid (₹)</label>
                <input type="number" min="0" className="form-input" 
                  value={editAdv.amount} onChange={e => setEditAdv(a => ({ ...a, amount: e.target.value }))} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="form-label">Full Name</label>
                <input type="text" className="form-input" 
                  value={editAdv.name} onChange={e => setEditAdv(a => ({ ...a, name: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" className="form-input" 
                  value={editAdv.email} onChange={e => setEditAdv(a => ({ ...a, email: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input type="tel" className="form-input" 
                  value={editAdv.phone} onChange={e => setEditAdv(a => ({ ...a, phone: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">ID Proof Info</label>
                <input type="text" className="form-input" 
                  value={editAdv.idProof} onChange={e => setEditAdv(a => ({ ...a, idProof: e.target.value }))} />
              </div>
            </>
          )}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setEditAdv({ open: false, tenant: null, amount: '', total: '', rentDueDay: 5 })} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={updatingAdv} className="btn-primary flex-1">{updatingAdv ? 'Updating…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Co-Occupant Modal (Add/Edit) */}
      <Modal 
        isOpen={coOccModal.open} 
        onClose={() => setCoOccModal({ open: false, tenant: null, coOccupant: null, mode: 'add' })} 
        title={coOccModal.mode === 'add' ? 'Add Co-Occupant' : 'Edit Co-Occupant'} 
        size="sm"
      >
        <div className="mb-4 p-4 rounded-xl bg-surface border border-surface-border">
          <p className="text-xs text-slate-500 uppercase font-bold mb-1">
            {coOccModal.mode === 'add' ? 'Adding To' : 'Editing For'} Room {coOccModal.tenant?.roomId?.roomNumber}
          </p>
          <p className="text-white font-bold">{coOccModal.tenant?.userId?.name}</p>
        </div>
        <form onSubmit={handleSaveCoOccupant} className="space-y-4">
          <div>
            <label className="form-label">Name *</label>
            <input 
              type="text" 
              className="form-input" 
              value={coOccData.name} 
              onChange={e => setCoOccData(n => ({ ...n, name: e.target.value }))}
              placeholder="Full Name"
              required 
            />
          </div>
          <div>
            <label className="form-label">Phone</label>
            <input 
              type="tel" 
              className="form-input" 
              value={coOccData.phone} 
              onChange={e => setCoOccData(n => ({ ...n, phone: e.target.value }))}
              placeholder="Phone Number" 
            />
          </div>
          <div>
            <label className="form-label">ID Proof Info</label>
            <input 
              type="text" 
              className="form-input" 
              value={coOccData.idProof} 
              onChange={e => setCoOccData(n => ({ ...n, idProof: e.target.value }))}
              placeholder="Aadhar / Passport #" 
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setCoOccModal({ open: false, tenant: null, coOccupant: null, mode: 'add' })} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={savingCoOcc} className="btn-primary flex-1">
              {savingCoOcc ? <LoadingSpinner size="sm" label="" /> : null}
              {savingCoOcc ? 'Saving…' : (coOccModal.mode === 'add' ? 'Add Co-Occupant' : 'Save Changes')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TenantsPage;
