import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const DashboardFilters = ({ onFilterChange, showOwnerFilter = false, hidePropertyFilter = false, hideRoomFilter = false }) => {
  const { isSuperAdmin } = useAuth();
  const [owners, setOwners] = useState([]);
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [selectedOwner, setSelectedOwner] = useState('');
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');

  // 1. Fetch Owners (Admin only)
  useEffect(() => {
    if (isSuperAdmin && showOwnerFilter) {
      api.get('/users?role=owner')
        .then(res => setOwners(res.data.users))
        .catch(err => console.error('Failed to fetch owners:', err));
    }
  }, [isSuperAdmin, showOwnerFilter]);

  // 2. Fetch Properties
  useEffect(() => {
    let url = '/properties';
    const params = new URLSearchParams();
    
    if (isSuperAdmin && selectedOwner) {
      params.append('ownerId', selectedOwner);
    }
    
    if (params.toString()) url += `?${params.toString()}`;

    // Reset property and room when owner changes
    if (isSuperAdmin) {
        setSelectedProperty('');
        setSelectedRoom('');
    }

    api.get(url)
      .then(res => setProperties(res.data.properties))
      .catch(err => console.error('Failed to fetch properties:', err));
  }, [selectedOwner, isSuperAdmin]);

  // 3. Fetch Rooms
  useEffect(() => {
    if (selectedProperty) {
      api.get(`/rooms?propertyId=${selectedProperty}`)
        .then(res => setRooms(res.data.rooms))
        .catch(err => console.error('Failed to fetch rooms:', err));
    } else {
      setRooms([]);
    }
    setSelectedRoom('');
  }, [selectedProperty]);

  // 4. Notify Parent
  useEffect(() => {
    onFilterChange({
      ownerId: selectedOwner,
      propertyId: selectedProperty,
      roomId: selectedRoom
    });
  }, [selectedOwner, selectedProperty, selectedRoom, onFilterChange]);

  const handleReset = () => {
    setSelectedOwner('');
    setSelectedProperty('');
    setSelectedRoom('');
  };

  return (
    <div className="flex flex-wrap items-center gap-4 bg-surface-card/50 p-4 rounded-2xl border border-surface-border">
      {( (isSuperAdmin && showOwnerFilter) || !hidePropertyFilter || !hideRoomFilter ) && (
        <div className="flex items-center gap-2 text-slate-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-sm font-medium">Filters:</span>
        </div>
      )}

      {isSuperAdmin && showOwnerFilter && (
        <div className="flex-1 min-w-[200px]">
          <select 
            className="form-input text-sm py-1.5"
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value)}
          >
            <option value="">All Owners</option>
            {owners.map(o => (
              <option key={o._id} value={o._id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      {!hidePropertyFilter && (
        <div className="flex-1 min-w-[200px]">
          <select 
            className="form-input text-sm py-1.5"
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
          >
            <option value="">All Properties</option>
            {properties.map(p => (
              <option key={p._id} value={p._id}>{p.name} — {p.address}</option>
            ))}
          </select>
        </div>
      )}

      {!hideRoomFilter && (
        <div className="flex-1 min-w-[200px]">
          <select 
            className="form-input text-sm py-1.5"
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
          >
            <option value="">All Rooms</option>
            {rooms.map(r => (
              <option key={r._id} value={r._id}>Room {r.roomNumber}</option>
            ))}
          </select>
        </div>
      )}

      {(selectedOwner || selectedProperty || selectedRoom) && (
        <button 
          onClick={handleReset}
          className="text-xs text-slate-500 hover:text-white transition-colors underline underline-offset-4"
        >
          Reset Filters
        </button>
      )}
    </div>
  );
};

export default DashboardFilters;
