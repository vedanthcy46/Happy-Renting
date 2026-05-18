'use strict';

/**
 * tenantService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All tenant lifecycle operations are handled here using MongoDB transactions.
 *
 * WHY TRANSACTIONS?
 *   Move-in and move-out each touch TWO collections atomically:
 *     • Tenant (create / update)
 *     • Room (increment / decrement currentOccupancy)
 *   Without a transaction, a server crash between the two writes leaves the
 *   database in an inconsistent state (wrong occupancy count).
 *
 * RACE CONDITION PREVENTION:
 *   The capacity check uses a conditional atomic findOneAndUpdate:
 *     Room.findOneAndUpdate(
 *       { _id, currentOccupancy: { $lt: capacity } },  ← atomic condition
 *       { $inc: { currentOccupancy: 1 } }
 *     )
 *   If two concurrent requests both pass the read check, only ONE will succeed
 *   the update (the other will get null back and be rejected). No double-booking.
 *
 * REQUIREMENTS:
 *   MongoDB must be running as a Replica Set (even a 1-node set) for
 *   transactions to work. Atlas free tier already runs as a replica set.
 */

const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const Room = require('../models/Room');
const User = require('../models/User');
const emailService = require('./emailService');
const logger = require('../config/logger');
const logActivity = require('../utils/activityLogger');

const CoOccupant = require('../models/CoOccupant');
const Property = require('../models/Property');

// ── Move-In ────────────────────────────────────────────────────────────────
/**
 * moveIn(params, performedBy)
 *
 * Atomically:
 *   1. Validates the user, room, and ownerId isolation
 *   2. Ensures the user has no active tenancy
 *   3. Calculates total occupants (1 primary + coOccupants count)
 *   4. Conditionally increments room.currentOccupancy ($lt capacity check)
 *   5. Creates the Tenant record (Primary)
 *   6. Creates CoOccupant records
 *   All within a single MongoDB transaction.
 *
 * @param {{ userId, roomId, propertyId, ownerId, joinDate, advancePaid, notes, phone, idProof, coOccupants }} params
 * @param {ObjectId} performedBy  — req.user._id
 * @returns {Tenant} the created tenant (populated)
 */
const moveIn = async (params, performedBy) => {
  const {
    userId, roomId, propertyId, ownerId, joinDate, moveInDate, advancePaid, securityDeposit, notes,
    phone, idProof, coOccupants = [], customBillingDay, isMigratedTenant
  } = params;

  // ── Pre-transaction checks ──
  const [user, room] = await Promise.all([
    User.findById(userId).select('role isActive email emailVerified emailVerificationToken'),
    Room.findById(roomId).select('roomNumber capacity currentOccupancy ownerId isActive propertyId'),
  ]);

  if (!user || !user.isActive) {
    const err = new Error('User not found or account deactivated.');
    err.statusCode = 400;
    throw err;
  }
  if (user.role !== 'tenant') {
    const err = new Error('Only users with the tenant role can be assigned as a primary tenant.');
    err.statusCode = 400;
    throw err;
  }
  if (!room || !room.isActive) {
    const err = new Error('Room not found or inactive.');
    err.statusCode = 404;
    throw err;
  }

  if (String(room.ownerId) !== String(ownerId)) {
    const err = new Error('Room does not belong to your account.');
    err.statusCode = 403;
    throw err;
  }

  // Calculate total occupants being added
  const totalOccupantsToAdd = 1 + coOccupants.length;

  if (room.currentOccupancy + totalOccupantsToAdd > room.capacity) {
    const err = new Error(
      `Room ${room.roomNumber} has insufficient capacity. ` +
      `Space for ${room.capacity - room.currentOccupancy}, but adding ${totalOccupantsToAdd}.`
    );
    err.statusCode = 400;
    throw err;
  }

  if (advancePaid && securityDeposit && Number(advancePaid) > Number(securityDeposit)) {
    const err = new Error('Initial advance or advance paid should be less than or equal to the security deposit.');
    err.statusCode = 400;
    throw err;
  }

  // ── Transaction ──
  const session = await mongoose.startSession();
  let tenant;

  try {
    await session.withTransaction(async () => {
      // 1) Ensure user has no active tenancy
      const existing = await Tenant.findOne({ userId, status: 'active' }).session(session);
      if (existing) {
        const err = new Error('This user already has an active tenancy.');
        err.statusCode = 409;
        throw err;
      }

      // 2) Ensure room has no active main tenant (One tenancy per room rule)
      const roomOccupied = await Tenant.findOne({ roomId, status: 'active' }).session(session);
      if (roomOccupied) {
        const err = new Error('Already People are there, look for other room.');
        err.statusCode = 409;
        throw err;
      }

      // 3) Atomic capacity check + increment by totalOccupantsToAdd
      const updatedRoom = await Room.findOneAndUpdate(
        {
          _id: roomId,
          ownerId,
          isActive: true,
          currentOccupancy: { $lte: room.capacity - totalOccupantsToAdd },
        },
        { $inc: { currentOccupancy: totalOccupantsToAdd } },
        { new: true, session }
      );

      if (!updatedRoom) {
        const err = new Error(
          `Room ${room.roomNumber} no longer has enough capacity. Another tenant may have just been assigned.`
        );
        err.statusCode = 409;
        throw err;
      }

      // 3) Create primary tenant record
      [tenant] = await Tenant.create(
        [
          {
            userId,
            roomId,
            propertyId,
            ownerId,
            joinDate,
            moveInDate: moveInDate || joinDate,
            phone,
            idProof,
            advancePaid: advancePaid || 0,
            securityDeposit: securityDeposit || 0,
            notes,
            status: 'active',
            customBillingDay: customBillingDay !== undefined ? customBillingDay : null,
            isMigratedTenant: !!isMigratedTenant,
          },
        ],
        { session, ordered: true }
      );

      // 4) Create co-occupants
      if (coOccupants.length > 0) {
        const coOccupantDocs = coOccupants.map(co => ({
          tenantId: tenant._id,
          ownerId,
          name: co.name,
          phone: co.phone || '',
          idProof: co.idProof || '',
        }));
        await CoOccupant.create(coOccupantDocs, { session, ordered: true });
      }
    });

    // Populate outside transaction
    await tenant.populate([
      { path: 'userId', select: 'name email' },
      { path: 'roomId', select: 'roomNumber floor monthlyRent currentOccupancy capacity' },
      { path: 'propertyId', select: 'name address' },
    ]);

    // Attach coOccupants for the return response
    const finalCoOccupants = await CoOccupant.find({ tenantId: tenant._id }).lean();
    const result = tenant.toObject();
    result.coOccupants = finalCoOccupants;

    logger.info(`[MOVE-IN] tenant=${tenant._id} occupants=${totalOccupantsToAdd} room=${roomId} by=${performedBy}`);
    await logActivity(performedBy, 'TENANT_ADDED', tenant._id, 'Tenant', `Added tenant to Room ${roomId}`);

    // ── Send Welcome Email ──
    try {
      const [owner, property] = await Promise.all([
        User.findById(tenant.ownerId),
        Property.findById(tenant.propertyId)
      ]);

      if (owner && property) {
        // tempPassword should be passed in params or retrieved
        await emailService.sendTenantWelcome(
          tenant.userId,
          params.tempPassword || '********',
          property,
          tenant.roomId,
          owner.name,
          user.emailVerificationToken
        );
      }
    } catch (emailErr) {
      logger.error(`Failed to send welcome email: ${emailErr.message}`);
    }

    return result;

  } finally {
    await session.endSession();
  }
};

const moveOut = async (tenantId, { exitDate, notes }, callerRole, callerId) => {
  // ── Pre-transaction read ──
  const tenant = await Tenant.findById(tenantId).select(
    'status ownerId roomId userId joinDate exitDate vacatedBy notes'
  );

  if (!tenant) {
    const err = new Error('Tenant record not found.');
    err.statusCode = 404;
    throw err;
  }
  if (tenant.status === 'vacated') {
    const err = new Error('Tenant has already moved out.');
    err.statusCode = 400;
    throw err;
  }

  if (callerRole === 'owner' && String(tenant.ownerId) !== String(callerId)) {
    const err = new Error('Access denied. This tenant does not belong to your account.');
    err.statusCode = 403;
    throw err;
  }

  // Date validation
  const exit = new Date(exitDate);
  const join = new Date(tenant.joinDate);
  if (isNaN(exit.getTime())) {
    const err = new Error('Invalid exit date.');
    err.statusCode = 400;
    throw err;
  }
  if (exit < join) {
    const err = new Error('Exit date cannot be before join date.');
    err.statusCode = 400;
    throw err;
  }

  // Count co-occupants to know how much to decrement
  const coOccupantCount = await CoOccupant.countDocuments({ tenantId });
  const totalOccupantsToRemove = 1 + coOccupantCount;

  // ── Transaction ──
  const session = await mongoose.startSession();
  let updatedTenant;

  try {
    await session.withTransaction(async () => {
      // 1) Update primary tenant status
      updatedTenant = await Tenant.findOneAndUpdate(
        { _id: tenantId, status: 'active' },
        {
          $set: {
            status: 'vacated',
            exitDate: exit,
            vacatedBy: callerId,
            ...(notes ? { notes } : {}),
          },
        },
        { new: true, session }
      );

      if (!updatedTenant) {
        const err = new Error('Tenant is no longer active — possible concurrent move-out.');
        err.statusCode = 409;
        throw err;
      }

      // 2) Remove all co-occupants
      await CoOccupant.deleteMany({ tenantId }, { session });

      // 3) Decrement room occupancy by totalOccupantsToRemove
      const roomUpdate = await Room.findOneAndUpdate(
        {
          _id: tenant.roomId,
          ownerId: tenant.ownerId,
          currentOccupancy: { $gte: totalOccupantsToRemove },
        },
        { $inc: { currentOccupancy: -totalOccupantsToRemove } },
        { new: true, session }
      );

      if (!roomUpdate) {
        logger.warn(
          `[MOVE-OUT] Consistency warning: could not decrement occupancy by ${totalOccupantsToRemove} for room=${tenant.roomId}. ` +
          `Falling back to safety decrement.`
        );
        // If the atomic decrement failed (e.g. occupancy was somehow less than totalOccupantsToRemove),
        // we at least try to set it to 0 or decrement as much as possible to avoid negative numbers.
        await Room.findByIdAndUpdate(tenant.roomId, { $set: { currentOccupancy: 0 } }, { session });
      }
    });

    // Populate outside transaction
    await updatedTenant.populate([
      { path: 'userId', select: 'name email' },
      { path: 'roomId', select: 'roomNumber floor currentOccupancy capacity' },
    ]);

    // ── Instant Final Month Prorated Billing Settlement ──
    try {
      const billingServiceV2 = require('./billingServiceV2');
      await billingServiceV2.generateMonthlyBills(updatedTenant.ownerId);
      logger.info(`[MOVE-OUT] Auto-generated final proration and billing records for tenant=${tenantId}`);
    } catch (billErr) {
      logger.error(`[MOVE-OUT] Auto-billing failed for tenant=${tenantId}: ${billErr.message}`);
    }

    logger.info(`[MOVE-OUT] tenant=${tenantId} occupantsRemoved=${totalOccupantsToRemove} room=${tenant.roomId} by=${callerId}`);
    await logActivity(callerId, 'TENANT_VACATED', tenantId, 'Tenant', `Tenant moved out from Room ${tenant.roomId?._id || tenant.roomId}`);
    return updatedTenant;

  } finally {
    await session.endSession();
  }
};

const addCoOccupants = async (tenantId, newOccupants, callerId, callerRole) => {
  if (!newOccupants || !newOccupants.length) return null;

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    const err = new Error('Tenant record not found.');
    err.statusCode = 404;
    throw err;
  }

  if (callerRole === 'tenant' && String(tenant.userId) !== String(callerId)) {
    const err = new Error('Access denied. You can only add roommates to your own room.');
    err.statusCode = 403;
    throw err;
  }

  if (callerRole === 'owner' && String(tenant.ownerId) !== String(callerId)) {
    const err = new Error('Access denied.');
    err.statusCode = 403;
    throw err;
  }

  if (tenant.status === 'vacated') {
    const err = new Error('Cannot add co-occupants to a vacated tenancy.');
    err.statusCode = 400;
    throw err;
  }

  const room = await Room.findById(tenant.roomId);
  const totalToAdd = newOccupants.length;

  if (room.currentOccupancy + totalToAdd > room.capacity) {
    const err = new Error(`Insufficient room capacity. Space for ${room.capacity - room.currentOccupancy}, but adding ${totalToAdd}.`);
    err.statusCode = 400;
    throw err;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // 1. Increment room occupancy
      const updatedRoom = await Room.findOneAndUpdate(
        {
          _id: tenant.roomId,
          currentOccupancy: { $lte: room.capacity - totalToAdd }
        },
        { $inc: { currentOccupancy: totalToAdd } },
        { new: true, session }
      );

      if (!updatedRoom) {
        throw new Error('Concurrency error: Room capacity changed.');
      }

      // 2. Create co-occupant records
      const coOccupantDocs = newOccupants.map(co => ({
        tenantId,
        ownerId: tenant.ownerId,
        name: co.name,
        phone: co.phone || '',
        idProof: co.idProof || ''
      }));

      await CoOccupant.create(coOccupantDocs, { session, ordered: true });
    });

    logger.info(`[CO-OCCUPANTS ADDED] tenant=${tenantId} count=${totalToAdd} by=${callerId}`);
    await logActivity(callerId, 'CO_OCCUPANT_ADDED', tenantId, 'Tenant', `Added ${totalToAdd} co-occupant(s) to tenant ${tenantId}`);
    return await CoOccupant.find({ tenantId }).lean();
  } finally {
    await session.endSession();
  }
};

const deleteCoOccupant = async (tenantId, coOccupantId, callerId, callerRole) => {
  const tenant = await Tenant.findById(tenantId).select('status ownerId roomId userId');
  if (!tenant) {
    const err = new Error('Tenant record not found.');
    err.statusCode = 404;
    throw err;
  }

  if (tenant.status !== 'active') {
    const err = new Error('Cannot remove co-occupants from a vacated tenancy.');
    err.statusCode = 400;
    throw err;
  }

  if (callerRole === 'tenant' && String(tenant.userId) !== String(callerId)) {
    const err = new Error('Access denied. You can only remove your own co-occupants.');
    err.statusCode = 403;
    throw err;
  }

  if (callerRole === 'owner' && String(tenant.ownerId) !== String(callerId)) {
    const err = new Error('Access denied.');
    err.statusCode = 403;
    throw err;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const coOccupant = await CoOccupant.findOne({ _id: coOccupantId, tenantId }).session(session);
      if (!coOccupant) {
        const err = new Error('Co-occupant not found.');
        err.statusCode = 404;
        throw err;
      }

      const roomUpdate = await Room.findOneAndUpdate(
        { _id: tenant.roomId, currentOccupancy: { $gte: 1 } },
        { $inc: { currentOccupancy: -1 } },
        { new: true, session }
      );

      if (!roomUpdate) {
        logger.warn(
          `[CO-OCCUPANT DELETE] Failed atomic decrement for room=${tenant.roomId}. ` +
          'Setting occupancy to 0 to avoid negative counts.'
        );
        await Room.findByIdAndUpdate(tenant.roomId, { $set: { currentOccupancy: 0 } }, { session });
      }

      await CoOccupant.deleteOne({ _id: coOccupantId, tenantId }).session(session);
    });

    logger.info(`[CO-OCCUPANT DELETED] tenant=${tenantId} coOccupant=${coOccupantId} by=${callerId}`);
    await logActivity(callerId, 'CO_OCCUPANT_REMOVED', tenantId, 'Tenant', `Removed co-occupant ${coOccupantId} from tenant ${tenantId}`);
    return true;
  } finally {
    await session.endSession();
  }
};

module.exports = { moveIn, moveOut, addCoOccupants, deleteCoOccupant };
