import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import OccupancyBar from '../components/common/OccupancyBar';

const AddTenantPage = () => {
  const toast    = useToast();
  const navigate = useNavigate();

  const [rooms,       setRooms]       = useState([]);
  const [users,       setUsers]       = useState([]);  // tenant-role users without active tenancy
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);

  const [form, setForm] = useState({
    userId      : '',
    roomId      : '',
    propertyId  : '',
    joinDate    : new Date().toISOString().split('T')[0],
    advancePaid : '',
    rentDueDay  : 5,
    notes       : '',
    phone       : '',
    idProof     : '',
    coOccupants : [], // { name: '', phone: '', idProof: '' }
    // New user creation fields
    createUser  : false,
    name        : '',
    email       : '',
    password    : 'Tenant@123',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [roomsRes, usersRes] = await Promise.all([
          api.get('/rooms'),
          api.get('/users?role=tenant'),
        ]);
        if (!cancelled) {
          setRooms(roomsRes.data.rooms);
          setUsers(usersRes.data.users);
        }
      } catch (err) {
        toast.error(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [toast]);

  const handleRoomChange = (roomId) => {
    const room = rooms.find(r => r._id === roomId);
    setSelectedRoom(room || null);
    setForm(f => ({ 
      ...f, 
      roomId, 
      propertyId: room?.propertyId?._id || '',
      advancePaid: room?.securityDeposit ?? '',
      securityDeposit: room?.securityDeposit ?? ''
    }));
    if (errors.roomId) setErrors(e => ({ ...e, roomId: '' }));
  };

  const addCoOccupant = () => {
    setForm(f => ({
      ...f,
      coOccupants: [...f.coOccupants, { name: '', phone: '', idProof: '' }]
    }));
  };

  const removeCoOccupant = (index) => {
    setForm(f => ({
      ...f,
      coOccupants: f.coOccupants.filter((_, i) => i !== index)
    }));
  };

  const updateCoOccupant = (index, field, value) => {
    setForm(f => {
      const newCo = [...f.coOccupants];
      newCo[index] = { ...newCo[index], [field]: value };
      return { ...f, coOccupants: newCo };
    });
  };

  const validate = () => {
    const errs = {};
    const totalOccupants = 1 + form.coOccupants.length;

    if (!form.roomId) {
      errs.roomId = 'Room is required';
    } else if (selectedRoom) {
      if (selectedRoom.currentOccupancy + totalOccupants > selectedRoom.capacity) {
        errs.roomId = `Room capacity exceeded. Max ${selectedRoom.capacity} people allowed. Current: ${selectedRoom.currentOccupancy}, Adding: ${totalOccupants}`;
      }
    }

    if (!form.joinDate) errs.joinDate = 'Join date is required';
    if (!form.phone)    errs.phone = 'Primary phone is required';
    if (form.advancePaid && Number(form.advancePaid) < 0) errs.advancePaid = 'Must be non-negative';
    if (form.securityDeposit && Number(form.securityDeposit) < 0) errs.securityDeposit = 'Must be non-negative';
    if (form.advancePaid && form.securityDeposit && Number(form.advancePaid) > Number(form.securityDeposit)) {
      errs.advancePaid = 'Initial advance or advance paid should be less than or equal to the security deposit.';
    }
    if (form.rentDueDay < 1 || form.rentDueDay > 31) errs.rentDueDay = 'Day must be 1-31';
    
    if (form.createUser) {
      if (!form.name.trim()) errs.name = 'Name required';
      if (!form.email)       errs.email = 'Email required';
      if (!form.password || form.password.length < 8) errs.password = 'Password min 8 chars';
    } else {
      if (!form.userId) errs.userId = 'Select a tenant user';
    }

    // Co-occupant validation
    form.coOccupants.forEach((co, idx) => {
      if (!co.name.trim()) errs[`co_name_${idx}`] = 'Name is required';
    });

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);
    if (submitting) return;

    setSubmitting(true);
    try {
      let userId = form.userId;

      // Create user account first if requested
      if (form.createUser) {
        const { data } = await api.post('/auth/register', {
          name    : form.name.trim(),
          email   : form.email.trim().toLowerCase(),
          password: form.password,
          role    : 'tenant',
        });
        userId = data.user._id;
      }

      await api.post('/tenants', {
        userId,
        roomId      : form.roomId,
        propertyId  : form.propertyId,
        joinDate    : form.joinDate,
        advancePaid : form.advancePaid ? Number(form.advancePaid) : 0,
        notes       : form.notes,
        phone       : form.phone,
        rentDueDay  : Number(form.rentDueDay) || 5,
        idProof     : form.idProof,
        coOccupants : form.coOccupants,
        tempPassword: form.password, // Pass password for email onboarding
      });

      toast.success('Tenant moved in successfully!');
      navigate('/tenants');
    } catch (err) {
      toast.error(err.message);
      setErrors({ general: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="page-title">Add Tenant (Move-In)</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="card p-6 space-y-6">

        {errors.general && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
            {errors.general}
          </div>
        )}

        {/* Room selection */}
        <div>
          <label className="form-label">Assign Room *</label>
          <select
            id="room-select"
            className={`form-select ${errors.roomId ? 'border-danger' : ''}`}
            value={form.roomId}
            onChange={e => handleRoomChange(e.target.value)}
          >
            <option value="">Select a room…</option>
            {rooms.map(r => (
              <option key={r._id} value={r._id} disabled={r.isFull}>
                Room {r.roomNumber} — {r.propertyId?.name} ({r.propertyId?.address}) {r.isFull ? '(Full)' : `(${r.currentOccupancy}/${r.capacity} occupied)`}
              </option>
            ))}
          </select>
          {errors.roomId && <p className="form-error">{errors.roomId}</p>}

          {/* Occupancy indicator */}
          {selectedRoom && (
            <div className={`mt-3 p-4 rounded-xl border ${selectedRoom.isFull ? 'bg-danger/10 border-danger/30' : 'bg-success/10 border-success/30'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">Room {selectedRoom.roomNumber} Occupancy</span>
                {selectedRoom.isFull && (
                  <span className="text-danger text-xs font-semibold">FULL — Cannot assign</span>
                )}
              </div>
              <OccupancyBar
                current={selectedRoom.currentOccupancy}
                capacity={selectedRoom.capacity}
              />
              <p className="text-xs text-slate-400 mt-2">
                Adding <span className="text-white font-bold">{1 + form.coOccupants.length}</span> people.
                Total will be <span className="text-white font-bold">{selectedRoom.currentOccupancy + 1 + form.coOccupants.length}</span> / {selectedRoom.capacity}
              </p>
              {selectedRoom.monthlyRent > 0 && (
                <div className="flex justify-between mt-3">
                  <p className="text-xs text-slate-400">Monthly rent: <span className="text-white font-bold">₹{selectedRoom.monthlyRent.toLocaleString()}</span></p>
                  {selectedRoom.securityDeposit > 0 && (
                    <p className="text-xs text-slate-400">Suggested Advance: <span className="text-brand-400 font-bold">₹{selectedRoom.securityDeposit.toLocaleString()}</span></p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tenant selection mode */}
        <div>
          <div className="flex rounded-xl bg-surface border border-surface-border p-1 gap-1 w-fit mb-4">
            <button type="button"
              onClick={() => setForm(f => ({ ...f, createUser: false }))}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                ${!form.createUser ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              Existing User
            </button>
            <button type="button"
              onClick={() => setForm(f => ({ ...f, createUser: true, userId: '' }))}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                ${form.createUser ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              Create New Account
            </button>
          </div>

          {!form.createUser ? (
            <div>
              <label className="form-label">Select Tenant User *</label>
              <select
                id="user-select"
                className={`form-select ${errors.userId ? 'border-danger' : ''}`}
                value={form.userId}
                onChange={e => { setForm(f => ({ ...f, userId: e.target.value })); setErrors(er => ({ ...er, userId: '' })); }}
              >
                <option value="">Select user…</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name} — {u.email}</option>)}
              </select>
              {errors.userId && <p className="form-error">{errors.userId}</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Full Name *</label>
                  <input className={`form-input ${errors.name ? 'border-danger' : ''}`}
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Tenant Name" maxLength={60} />
                  {errors.name && <p className="form-error">{errors.name}</p>}
                </div>
                <div>
                  <label className="form-label">Email *</label>
                  <input type="email" className={`form-input ${errors.email ? 'border-danger' : ''}`}
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="tenant@email.com" maxLength={100} />
                  {errors.email && <p className="form-error">{errors.email}</p>}
                </div>
              </div>
              <div>
                <label className="form-label">Temporary Password *</label>
                <input type="password" className={`form-input ${errors.password ? 'border-danger' : ''}`}
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="min 8 chars" maxLength={128} />
                <p className="text-[10px] text-slate-500 mt-1">Default: <span className="text-brand-400 font-mono">Tenant@123</span>. Tenant will be forced to change this on login.</p>
                {errors.password && <p className="form-error">{errors.password}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Contact & ID Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Phone Number *</label>
            <input className={`form-input ${errors.phone ? 'border-danger' : ''}`}
              value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              maxLength={10}
              placeholder="+91 00000 00000" />
            {errors.phone && <p className="form-error">{errors.phone}</p>}
          </div>
          <div>
            <label className="form-label">ID Proof (Primary)</label>
            <input className="form-input"
              value={form.idProof} onChange={e => setForm(f => ({ ...f, idProof: e.target.value }))}
              placeholder="e.g. Aadhaar Number" />
          </div>
        </div>

        {/* Co-Occupants */}
        <div className="space-y-4 pt-4 border-t border-surface-border">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold">Co-Occupants (Family/Group)</h3>
            <button type="button" onClick={addCoOccupant} className="btn-secondary btn-sm">
              + Add Person
            </button>
          </div>
          
          {form.coOccupants.length === 0 ? (
            <p className="text-slate-500 text-sm">No co-occupants added.</p>
          ) : (
            <div className="space-y-3">
              {form.coOccupants.map((co, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-surface border border-surface-border relative animate-scale-in">
                  <button type="button" onClick={() => removeCoOccupant(idx)} className="absolute top-2 right-2 text-slate-500 hover:text-danger">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Name *</label>
                      <input className={`form-input form-input-sm ${errors[`co_name_${idx}`] ? 'border-danger' : ''}`}
                        value={co.name} onChange={e => updateCoOccupant(idx, 'name', e.target.value)}
                        placeholder="Name" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Phone</label>
                      <input className="form-input form-input-sm"
                        value={co.phone} onChange={e => updateCoOccupant(idx, 'phone', e.target.value)}
                        placeholder="Phone (opt)" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">ID Proof</label>
                      <input className="form-input form-input-sm"
                        value={co.idProof} onChange={e => updateCoOccupant(idx, 'idProof', e.target.value)}
                        placeholder="ID (opt)" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dates & payment */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Join Date *</label>
            <input type="date" className={`form-input ${errors.joinDate ? 'border-danger' : ''}`}
              value={form.joinDate} onChange={e => setForm(f => ({ ...f, joinDate: e.target.value }))}
              max={new Date().toISOString().split('T')[0]} />
            {errors.joinDate && <p className="form-error">{errors.joinDate}</p>}
          </div>
          <div>
            <label className="form-label">Rent Due Day (Monthly) *</label>
            <input type="number" min="1" max="31" className={`form-input ${errors.rentDueDay ? 'border-danger' : ''}`}
              value={form.rentDueDay} onChange={e => setForm(f => ({ ...f, rentDueDay: e.target.value }))}
              placeholder="e.g. 5" />
            <p className="text-[10px] text-slate-500 mt-1">Day of month (1-31). Default: 5th</p>
            {errors.rentDueDay && <p className="form-error">{errors.rentDueDay}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Total Security Deposit (₹)</label>
            <input type="number" min="0" className={`form-input ${errors.securityDeposit ? 'border-danger' : ''}`}
              value={form.securityDeposit} onChange={e => setForm(f => ({ ...f, securityDeposit: e.target.value }))}
              placeholder="Total advance required" />
            {errors.securityDeposit && <p className="form-error">{errors.securityDeposit}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="form-label">Initial Advance Paid (₹)</label>
            <div className="relative">
              <input type="number" min="0" className={`form-input pr-16 ${errors.advancePaid ? 'border-danger' : ''}`}
                value={form.advancePaid} onChange={e => setForm(f => ({ ...f, advancePaid: e.target.value }))}
                placeholder="Amount paid today" />
              {form.securityDeposit > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 pointer-events-none">
                  / {form.securityDeposit}
                </div>
              )}
            </div>
            {errors.advancePaid && <p className="form-error">{errors.advancePaid}</p>}
          </div>
        </div>

        <div>
          <label className="form-label">Notes (optional)</label>
          <textarea className="form-input resize-none" rows={2} maxLength={500}
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Any additional notes…" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate('/tenants')} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            id="submit-tenant"
            type="submit"
            disabled={submitting || selectedRoom?.isFull}
            className="btn-primary flex-1"
          >
            {submitting ? <LoadingSpinner size="sm" label="" /> : null}
            {submitting ? 'Moving In…' : 'Move In Tenant'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddTenantPage;
