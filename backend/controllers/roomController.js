'use strict';

const { body, param } = require('express-validator');
const mongoose        = require('mongoose');
const Room            = require('../models/Room');
const Tenant          = require('../models/Tenant');
const Property        = require('../models/Property');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const logger          = require('../config/logger');
const logActivity     = require('../utils/activityLogger');
const entitlementService = require('../services/entitlementService');

// ── Validation chains ──────────────────────────────────────────────────────
const roomValidation = [
  body('roomNumber')
    .trim().isLength({ min: 1, max: 20 }).escape()
    .withMessage('Room number required (max 20 chars)'),
  body('capacity')
    .isInt({ min: 1, max: 20 })
    .withMessage('Capacity must be an integer between 1 and 20'),
  body('propertyId')
    .isMongoId().withMessage('Valid property ID required'),
  body('monthlyRent')
    .optional().isFloat({ min: 0 })
    .withMessage('Monthly rent must be non-negative'),
  body('securityDeposit')
    .optional().isFloat({ min: 0 })
    .withMessage('Security deposit must be non-negative'),
  body('floor')
    .optional().trim().isLength({ max: 10 }).escape(),
  body('description')
    .optional().trim().isLength({ max: 500 }).escape(),
  body('type')
    .optional().isIn(['rental', 'pg'])
    .withMessage('Room type must be rental or pg'),
  body('beds')
    .optional().isArray({ min: 0, max: 20 })
    .withMessage('beds must be an array of at most 20 beds'),
  body('beds.*.bedNumber')
    .optional().trim().isLength({ min: 1, max: 20 }).escape(),
  body('beds.*.status')
    .optional().isIn(['available', 'occupied', 'reserved', 'maintenance'])
    .withMessage('Invalid bed status'),
  body('beds.*.deposit')
    .optional().isFloat({ min: 0 })
    .withMessage('Bed deposit must be non-negative'),
  body('beds.*.monthlyRent')
    .optional().isFloat({ min: 0 })
    .withMessage('Bed monthly rent must be non-negative'),
];

const bedStatusValidation = [
  param('id').isMongoId().withMessage('Valid room ID required'),
  param('bedId').isMongoId().withMessage('Valid bed ID required'),
  body('status')
    .isIn(['available', 'reserved', 'maintenance'])
    .withMessage('Status must be available, reserved or maintenance'),
];

// ── Helpers ────────────────────────────────────────────────────────────────
// .lean() skips the toJSON transform, so derived fields are added here.
const enrichRoom = (r) => {
  const beds = Array.isArray(r.beds) ? r.beds : [];
  return {
    ...r,
    isFull: r.currentOccupancy >= r.capacity,
    totalBeds: beds.length,
    occupiedBeds: beds.filter(b => b.status === 'occupied').length,
    availableBeds: beds.filter(b => b.status === 'available').length,
    reservedBeds: beds.filter(b => b.status === 'reserved').length,
  };
};

// Normalizes client-supplied beds for create/update. 'occupied' can never be
// sent by the owner directly — it is managed by tenantService on move-in.
const normalizeBeds = (beds, fallbackCapacity) => {
  if (Array.isArray(beds) && beds.length > 0) {
    return beds.map((b, i) => ({
      bedNumber: String(b.bedNumber || '').trim() || `Bed ${i + 1}`,
      status: (b.status && b.status !== 'occupied') ? b.status : 'available',
      deposit: Number(b.deposit) || 0,
      monthlyRent: Number(b.monthlyRent) || 0,
    }));
  }
  const cap = Number(fallbackCapacity) || 1;
  return Array.from({ length: cap }, (_, i) => ({ bedNumber: `Bed ${i + 1}` }));
};

// ── GET /api/rooms ─────────────────────────────────────────────────────────
// currentOccupancy is NOW a stored field — no aggregation needed.
// isFull is derived in toJSON transform (capacity check).
const getRooms = async (req, res, next) => {
  try {
    const filter = { isActive: true };

    // ownerId isolation
    if (req.user.role === 'owner') {
      filter.ownerId = req.user._id;
    } else if (req.user.role === 'superadmin' && req.query.ownerId) {
      filter.ownerId = req.query.ownerId;
    }

    // Whitelist-validated query filters
    const { propertyId } = req.query;
    if (propertyId && /^[a-f\d]{24}$/i.test(propertyId)) {
      filter.propertyId = propertyId;
    }

    const rooms = await Room.find(filter)
      .populate('propertyId', 'name address')
      .sort({ roomNumber: 1 })
      .lean({ virtuals: true, getters: true });

    // Manual enrichment since .lean() skips toJSON transform
    const enriched = rooms.map(enrichRoom);

    res.status(200).json({ success: true, count: enriched.length, rooms: enriched });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/rooms/:id ─────────────────────────────────────────────────────
const getRoom = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID.' });
    }

    const room = await Room.findById(req.params.id)
      .populate('propertyId', 'name address')
      .lean({ virtuals: true });

    if (!room || !room.isActive) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    // ownerId isolation
    if (req.user.role === 'owner' && String(room.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.status(200).json({
      success: true,
      room: enrichRoom({ ...room, isFull: room.currentOccupancy >= room.capacity }),
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/rooms ────────────────────────────────────────────────────────
const createRoom = async (req, res, next) => {
  try {
    const { roomNumber, propertyId, capacity, floor, monthlyRent, securityDeposit, description, type, beds } = req.body;

    // ownerId always from session — never from body
    const ownerId = req.user.role === 'owner'
      ? req.user._id
      : req.body.ownerId;

    // ── Restriction: Free plan room limit (owners only) ──────────────────────
    if (req.user.role === 'owner') {
      const guard = await entitlementService.getCreationGuard(req.user, 'rooms');
      if (!guard.ok) {
        return res.status(403).json({
          success: false,
          code: 'PLAN_LIMIT_REACHED',
          message: guard.message,
          entitlement: { plan: guard.plan, used: guard.used, limit: guard.limit },
        });
      }
    }

    // ── Restriction: Check if Property is Active ────────────────────────────
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }
    if (!property.isActive) {
      return res.status(400).json({ success: false, message: 'Cannot add rooms to inactive property.' });
    }

    const roomType = type === 'pg' ? 'pg' : 'rental';

    // PG rooms: build the bed list (from request or auto-generate from capacity).
    // For PG rooms capacity is ALWAYS derived from the number of beds.
    let bedList = [];
    let roomCapacity = Number(capacity) || 1;
    if (roomType === 'pg') {
      bedList = normalizeBeds(beds, capacity);
      roomCapacity = bedList.length;
    }

    const room = await Room.create({
      roomNumber,
      propertyId,
      capacity: roomCapacity,
      floor,
      monthlyRent,
      securityDeposit,
      description,
      type: roomType,
      beds: bedList,
      ownerId,
      currentOccupancy: 0,  // always starts at 0 — explicit for clarity
    });

    logger.info(`[ROOM CREATED] room=${room._id} by=${req.user._id} type=${roomType}`);
    await logActivity(req.user._id, 'ROOM_CREATED', room._id, 'Room', `Created Room ${roomNumber}`, req.ip);
    res.status(201).json({ success: true, message: 'Room created.', room: enrichRoom(room.toObject()) });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/rooms/:id ───────────────────────────────────────────────────
const updateRoom = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID.' });
    }

    const room = await Room.findById(req.params.id);
    if (!room || !room.isActive) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    // ownerId isolation
    if (req.user.role === 'owner' && String(room.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { roomNumber, capacity, floor, monthlyRent, securityDeposit, description, type, beds } = req.body;

    // Prevent reducing capacity below current occupancy (only meaningful for
    // rental rooms — PG rooms derive capacity from their bed list).
    if (capacity !== undefined && beds === undefined && Number(capacity) < room.currentOccupancy) {
      return res.status(400).json({
        success: false,
        message: `Cannot reduce capacity to ${capacity} — room currently has ${room.currentOccupancy} active tenant(s).`,
      });
    }

    // PG rooms: rebuild the bed list, preserving occupied beds. Any occupied
    // bed that would be removed blocks the update.
    if (beds !== undefined) {
      const existing = room.beds || [];
      const incoming = Array.isArray(beds) ? beds : [];
      const usedNumbers = new Set();
      const merged = [];
      for (const b of incoming) {
        const num = String(b.bedNumber || '').trim() || `Bed ${merged.length + 1}`;
        usedNumbers.add(num);
        const prev = existing.find(e => e.bedNumber === num && e.status === 'occupied' && e.currentTenantId);
        if (prev) {
          merged.push({
            _id: prev._id,
            bedNumber: num,
            status: 'occupied',
            currentTenantId: prev.currentTenantId,
            deposit: prev.deposit,
            monthlyRent: prev.monthlyRent,
          });
        } else {
          merged.push({
            bedNumber: num,
            status: (b.status && b.status !== 'occupied') ? b.status : 'available',
            currentTenantId: null,
            deposit: Number(b.deposit) || 0,
            monthlyRent: Number(b.monthlyRent) || 0,
          });
        }
      }
      const droppedOccupied = existing.filter(e => !usedNumbers.has(e.bedNumber) && e.status === 'occupied' && e.currentTenantId);
      if (droppedOccupied.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot remove ${droppedOccupied.length} occupied bed(s) — move the resident(s) out first.`,
        });
      }
      room.beds = merged;
      room.capacity = merged.length;
      room.type = 'pg';
    }

    const oldMonthlyRent = room.monthlyRent;
    if (roomNumber  !== undefined) room.roomNumber  = roomNumber;
    if (capacity    !== undefined && beds === undefined) room.capacity = capacity;
    if (floor       !== undefined) room.floor       = floor;
    if (monthlyRent !== undefined) room.monthlyRent = monthlyRent;
    if (securityDeposit !== undefined) room.securityDeposit = securityDeposit;
    if (description !== undefined) room.description = description;
    if (type       !== undefined) room.type = type === 'pg' ? 'pg' : 'rental';

    // NOTE: currentOccupancy is NEVER updated here — only via tenantService transactions
    await room.save();

    // Feature: Security deposit propagation — keep every active tenant in sync with the room
    if (securityDeposit !== undefined) {
      try {
        const newDeposit = Number(securityDeposit);
        const result = await Tenant.updateMany(
          { roomId: room._id, status: 'active', advancePaid: { $lte: newDeposit } },
          { $set: { securityDeposit: newDeposit } }
        );
        const skipped = await Tenant.countDocuments({
          roomId: room._id,
          status: 'active',
          advancePaid: { $gt: newDeposit },
        });
        logger.info(`Propagated securityDeposit ${newDeposit} to ${result.modifiedCount} active tenant(s) of room ${room._id}`);
        if (skipped > 0) {
          logger.warn(`Skipped securityDeposit propagation for ${skipped} tenant(s) of room ${room._id}: advancePaid exceeds new deposit ${newDeposit}`);
        }
      } catch (propErr) {
        logger.error(`Security deposit propagation failed for room ${room._id}: ${propErr.message}`);
      }
    }

    // Feature A: Rent propagation logic
    if (monthlyRent !== undefined && Number(monthlyRent) !== Number(oldMonthlyRent)) {
      try {
        const activeTenants = await Tenant.find({ roomId: room._id, status: 'active' });
        const now = new Date();
        const currentMonthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        for (const tenant of activeTenants) {
          const unpaidRecord = await MonthlyRentRecord.findOne({
            tenantId: tenant._id,
            month: currentMonthString,
            status: { $nin: ['paid', 'overpaid'] }
          });
          
          if (unpaidRecord) {
            // Check if it's prorated
            if (oldMonthlyRent && oldMonthlyRent > 0) {
               const ratio = unpaidRecord.totalRent / oldMonthlyRent;
               unpaidRecord.totalRent = Math.round(Number(monthlyRent) * ratio);
            } else {
               unpaidRecord.totalRent = Number(monthlyRent);
            }
            await unpaidRecord.save();
            logger.info(`Propagated new rent ${monthlyRent} to tenant ${tenant._id} for month ${currentMonthString}`);
          }
        }
      } catch (propErr) {
        logger.error(`Rent propagation failed for room ${room._id}: ${propErr.message}`);
      }
    }

    await logActivity(req.user._id, 'ROOM_UPDATED', room._id, 'Room', `Updated Room ${room.roomNumber}`, req.ip);
    res.status(200).json({ success: true, message: 'Room updated.', room });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/rooms/:id (soft delete) ───────────────────────────────────
const deleteRoom = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID.' });
    }

    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    // ownerId isolation
    if (req.user.role === 'owner' && String(room.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Prevent deleting a room with active tenants — use stored field (fast)
    if (room.currentOccupancy > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot remove room — ${room.currentOccupancy} active tenant(s) still assigned. Move them out first.`,
      });
    }

    room.isActive = false;
    await room.save({ validateBeforeSave: false });

    logger.info(`[ROOM DELETED] room=${room._id} by=${req.user._id}`);
    await logActivity(req.user._id, 'ROOM_DELETED', room._id, 'Room', `Deleted Room ${room.roomNumber}`, req.ip);
    res.status(200).json({ success: true, message: 'Room removed successfully.' });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/rooms/:id/beds/:bedId ──────────────────────────────────────
// Owner-managed bed states only: available | reserved | maintenance.
// 'occupied' is set exclusively by tenantService on move-in and freed on
// move-out, so occupied beds cannot be changed through this endpoint.
const updateBedStatus = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.bedId)) {
      return res.status(400).json({ success: false, message: 'Invalid room or bed ID.' });
    }

    const room = await Room.findById(req.params.id);
    if (!room || !room.isActive) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    // ownerId isolation
    if (req.user.role === 'owner' && String(room.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (room.type !== 'pg') {
      return res.status(400).json({ success: false, message: 'Bed management is only available for PG rooms.' });
    }

    const bed = room.beds.id(req.params.bedId);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found.' });
    }

    if (bed.status === 'occupied' || bed.currentTenantId) {
      return res.status(400).json({
        success: false,
        message: 'Occupied beds are managed automatically — the bed frees when the resident moves out.',
      });
    }

    bed.status = req.body.status;
    await room.save();

    logger.info(`[BED STATUS] room=${room._id} bed=${req.params.bedId} status=${req.body.status} by=${req.user._id}`);
    await logActivity(req.user._id, 'BED_STATUS_UPDATED', room._id, 'Room', `Bed ${bed.bedNumber} → ${req.body.status}`, req.ip);
    res.status(200).json({ success: true, message: 'Bed status updated.', room: enrichRoom(room.toObject()) });
  } catch (err) {
    next(err);
  }
};

module.exports = { getRooms, getRoom, createRoom, updateRoom, deleteRoom, updateBedStatus, roomValidation, bedStatusValidation };
