'use strict';

const { body, param } = require('express-validator');
const mongoose        = require('mongoose');
const Room            = require('../models/Room');
const Tenant          = require('../models/Tenant');
const logger          = require('../config/logger');
const logActivity     = require('../utils/activityLogger');

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
];

// ── GET /api/rooms ─────────────────────────────────────────────────────────
// currentOccupancy is NOW a stored field — no aggregation needed.
// isFull is derived in toJSON transform (capacity check).
const getRooms = async (req, res, next) => {
  try {
    const filter = { isActive: true };

    // ownerId isolation — always scoped
    if (req.user.role === 'owner') filter.ownerId = req.user._id;

    // Whitelist-validated query filters
    const { propertyId } = req.query;
    if (propertyId && /^[a-f\d]{24}$/i.test(propertyId)) {
      filter.propertyId = propertyId;
    }

    const rooms = await Room.find(filter)
      .populate('propertyId', 'name address')
      .sort({ roomNumber: 1 })
      .lean({ virtuals: true, getters: true });

    // Manually add isFull since .lean() skips toJSON transform
    const enriched = rooms.map(r => ({
      ...r,
      isFull: r.currentOccupancy >= r.capacity,
    }));

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
      room: { ...room, isFull: room.currentOccupancy >= room.capacity },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/rooms ────────────────────────────────────────────────────────
const createRoom = async (req, res, next) => {
  try {
    const { roomNumber, propertyId, capacity, floor, monthlyRent, securityDeposit, description } = req.body;

    // ownerId always from session — never from body
    const ownerId = req.user.role === 'owner'
      ? req.user._id
      : req.body.ownerId;

    const room = await Room.create({
      roomNumber,
      propertyId,
      capacity,
      floor,
      monthlyRent,
      securityDeposit,
      description,
      ownerId,
      currentOccupancy: 0,  // always starts at 0 — explicit for clarity
    });

    logger.info(`[ROOM CREATED] room=${room._id} by=${req.user._id}`);
    await logActivity(req.user._id, 'ROOM_CREATED', room._id, 'Room', `Created Room ${roomNumber}`, req.ip);
    res.status(201).json({ success: true, message: 'Room created.', room });
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

    const { roomNumber, capacity, floor, monthlyRent, securityDeposit, description } = req.body;

    // Prevent reducing capacity below current occupancy
    if (capacity !== undefined && Number(capacity) < room.currentOccupancy) {
      return res.status(400).json({
        success: false,
        message: `Cannot reduce capacity to ${capacity} — room currently has ${room.currentOccupancy} active tenant(s).`,
      });
    }

    if (roomNumber  !== undefined) room.roomNumber  = roomNumber;
    if (capacity    !== undefined) room.capacity    = capacity;
    if (floor       !== undefined) room.floor       = floor;
    if (monthlyRent !== undefined) room.monthlyRent = monthlyRent;
    if (securityDeposit !== undefined) room.securityDeposit = securityDeposit;
    if (description !== undefined) room.description = description;

    // NOTE: currentOccupancy is NEVER updated here — only via tenantService transactions
    await room.save();
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

module.exports = { getRooms, getRoom, createRoom, updateRoom, deleteRoom, roomValidation };
