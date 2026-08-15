import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import OccupancyBar from '../components/common/OccupancyBar';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import DashboardFilters from '../components/common/DashboardFilters';
import PlanLimitBanner from '../components/common/PlanLimitBanner';
import useOwnerEntitlement from '../hooks/useOwnerEntitlement';

const RoomsPage = () => {
  const toast = useToast();
  const location = useLocation();
  const { isOwner } = useAuth();
  const { loading: entLoading, limits, hitRoomLimit } = useOwnerEntitlement();

  const queryParams = new URLSearchParams(location.search);
  const initialProp = queryParams.get('propertyId') || '';

  const [rooms,      setRooms]      = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filters,    setFilters]    = useState({ ownerId: '', propertyId: initialProp, roomId: '' });
  const [showAdd,    setShowAdd]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [form,       setForm]       = useState({
    roomNumber: '', propertyId: '', capacity: '', floor: '', monthlyRent: '', securityDeposit: '', description: '',
  });
  const [formErrors, setFormErrors] = useState({});

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.ownerId)    params.append('ownerId',    filters.ownerId);
      if (filters.propertyId) params.append('propertyId', filters.propertyId);

      const { data } = await api.get(`/rooms?${params.toString()}`);
      setRooms(data.rooms);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  useEffect(() => {
    api.get('/properties').then(({ data }) => setProperties(data.properties)).catch(() => {});
  }, []);

  const validateForm = () => {
    const errs = {};
    if (!form.roomNumber.trim()) errs.roomNumber = 'Room number required';
    if (!form.propertyId)        errs.propertyId = 'Property required';
    if (!form.capacity || Number(form.capacity) < 1) errs.capacity = 'Capacity must be ≥ 1';
    
    // Safeguard: capacity cannot be less than current occupancy when editing
    if (editingRoom && Number(form.capacity) < editingRoom.currentOccupancy) {
      errs.capacity = `Cannot be less than current occupancy (${editingRoom.currentOccupancy})`;
    }
    
    if (form.monthlyRent && Number(form.monthlyRent) < 0) errs.monthlyRent = 'Must be non-negative';
    return errs;
  };

  const handleOpenAdd = () => {
    setEditingRoom(null);
    setForm({ roomNumber: '', propertyId: '', capacity: '', floor: '', monthlyRent: '', securityDeposit: '', description: '' });
    setFormErrors({});
    setShowAdd(true);
  };

  const handleOpenEdit = (room) => {
    setEditingRoom(room);
    setForm({
      roomNumber: room.roomNumber,
      propertyId: room.propertyId?._id || '',
      capacity: room.capacity,
      floor: room.floor || '',
      monthlyRent: room.monthlyRent || '',
      securityDeposit: room.securityDeposit || '',
      description: room.description || '',
    });
    setFormErrors({});
    setShowAdd(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errs = validateForm();
    if (Object.keys(errs).length) return setFormErrors(errs);
    if (submitting) return;

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        capacity   : Number(form.capacity),
        monthlyRent: form.monthlyRent ? Number(form.monthlyRent) : 0,
        securityDeposit: form.securityDeposit ? Number(form.securityDeposit) : 0,
      };

      if (editingRoom) {
        await api.patch(`/rooms/${editingRoom._id}`, payload);
        toast.success('Room updated successfully!');
      } else {
        await api.post('/rooms', payload);
        toast.success('Room created successfully!');
      }
      
      setShowAdd(false);
      fetchRooms();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this room? This action cannot be undone if there are no active tenants.')) return;
    try {
      await api.delete(`/rooms/${id}`);
      toast.success('Room removed successfully.');
      fetchRooms();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Rooms</h1>
          <p className="text-slate-400 text-sm mt-1">{rooms.length} room{rooms.length !== 1 ? 's' : ''} total</p>
        </div>
        {isOwner && (
          <button
            id="add-room-btn"
            onClick={handleOpenAdd}
            disabled={!entLoading && hitRoomLimit}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            title={hitRoomLimit ? 'Free plan limit reached — upgrade from the app' : undefined}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Room
          </button>
        )}
      </div>

      <PlanLimitBanner
        show={hitRoomLimit}
        used={limits.rooms?.used}
        limit={limits.rooms?.limit}
        resource="rooms"
      />

      {/* Filters */}
      <DashboardFilters onFilterChange={setFilters} showOwnerFilter={true} hideRoomFilter={true} />

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : rooms.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">🏠</div>
          <p className="text-slate-400">No rooms found for the selected filters.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Property</th>
                <th>Floor</th>
                <th>Rent / Advance</th>
                <th>Occupancy</th>
                <th>Status</th>
                {isOwner && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => (
                <tr key={room._id}>
                  <td className="font-semibold text-white">{room.roomNumber}</td>
                  <td className="text-slate-300">
                    <p className="font-medium text-white">{room.propertyId?.name || '—'}</p>
                    {room.propertyId?.address && <p className="text-[10px] text-slate-400">{room.propertyId.address}</p>}
                  </td>
                  <td className="text-slate-400">{room.floor || '—'}</td>
                  <td className="text-slate-300">
                    <p className="font-semibold text-white">₹{room.monthlyRent?.toLocaleString()}</p>
                    <p className="text-[10px] text-brand-400">Sec. Dep: ₹{room.securityDeposit?.toLocaleString() || 0}</p>
                  </td>
                  <td className="min-w-[160px]">
                    <OccupancyBar current={room.currentOccupancy} capacity={room.capacity} />
                  </td>
                  <td>
                    <StatusBadge status={room.isFull ? 'full' : 'available'} />
                  </td>
                  {isOwner && (
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleOpenEdit(room)} className="btn btn-sm btn-secondary p-1.5" title="Edit">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(room._id)} className="btn btn-sm btn-danger p-1.5" title="Delete">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Room Modal (Add/Edit) */}
      <Modal isOpen={showAdd} onClose={() => { setShowAdd(false); setFormErrors({}); }} title={editingRoom ? 'Edit Room' : 'Add New Room'}>
        <form onSubmit={handleSave} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Room Number *</label>
              <input className={`form-input ${formErrors.roomNumber ? 'border-danger' : ''}`}
                value={form.roomNumber} onChange={e => setForm(f => ({ ...f, roomNumber: e.target.value }))}
                placeholder="e.g. 101" maxLength={20} />
              {formErrors.roomNumber && <p className="form-error">{formErrors.roomNumber}</p>}
            </div>
            <div>
              <label className="form-label">Capacity *</label>
              <input type="number" min="1" max="20" className={`form-input ${formErrors.capacity ? 'border-danger' : ''}`}
                value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                placeholder="e.g. 3" />
              {formErrors.capacity && <p className="form-error">{formErrors.capacity}</p>}
              {editingRoom && <p className="text-[10px] text-slate-500 mt-1">Current occupancy: {editingRoom.currentOccupancy}</p>}
            </div>
          </div>
          <div>
            <label className="form-label">Property *</label>
            <select className={`form-select ${formErrors.propertyId ? 'border-danger' : ''}`}
              disabled={!!editingRoom}
              value={form.propertyId} onChange={e => setForm(f => ({ ...f, propertyId: e.target.value }))}>
              <option value="">Select property…</option>
              {properties.map(p => (
                <option key={p._id} value={p._id} disabled={p.isActive === false}>
                  {p.name} — {p.address}{p.isActive === false ? ' (Inactive)' : ''}
                </option>
              ))}
            </select>
            {formErrors.propertyId && <p className="form-error">{formErrors.propertyId}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Floor</label>
              <input className="form-input" value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} placeholder="e.g. 1st" maxLength={10} />
            </div>
            <div>
              <label className="form-label">Monthly Rent (₹) *</label>
              <input type="number" min="0" className={`form-input ${formErrors.monthlyRent ? 'border-danger' : ''}`}
                value={form.monthlyRent} onChange={e => setForm(f => ({ ...f, monthlyRent: e.target.value }))} placeholder="0" />
              {formErrors.monthlyRent && <p className="form-error">{formErrors.monthlyRent}</p>}
              {editingRoom && (
                <p className="text-[10px] text-amber-500 mt-1 leading-tight font-medium">
                  ⚠️ Changing rent will also update the current month's unpaid bills for active tenants in this room.
                </p>
              )}
            </div>
            <div>
              <label className="form-label">Security Deposit (Total Advance ₹)</label>
              <input type="number" min="0" className="form-input"
                value={form.securityDeposit} onChange={e => setForm(f => ({ ...f, securityDeposit: e.target.value }))} placeholder="e.g. 25000" />
            </div>
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea className="form-input resize-none" rows={2} maxLength={500}
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional notes…" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            <button id="submit-room" type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? <LoadingSpinner size="sm" label="" /> : null}
              {submitting ? (editingRoom ? 'Updating…' : 'Creating…') : (editingRoom ? 'Update Room' : 'Create Room')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RoomsPage;
