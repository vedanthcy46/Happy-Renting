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
const notificationService = require('./notificationService');
const logger = require('../config/logger');
const logActivity = require('../utils/activityLogger');

const CoOccupant = require('../models/CoOccupant');
const Property = require('../models/Property');

// ── Transaction Fallback Helper ──────────────────────────────────────────────
// Allows local standalone MongoDB to work without throwing Replica Set errors.
const withTransactionOrFallback = async (operation) => {
  let session;
  try {
    session = await mongoose.startSession();
  } catch (err) {
    logger.warn('[TRANSACTION FALLBACK] Could not start session: ' + err.message);
    return operation(undefined);
  }

  try {
    let result;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return result;
  } catch (err) {
    if (err.message.includes('Transaction numbers are only allowed on a replica set member') || 
        err.message.includes('Transactions are not supported') ||
        err.message.includes('does not support retryable writes')) {
      logger.warn('[TRANSACTION FALLBACK] Standalone MongoDB detected. Running without transaction.');
      return operation(undefined);
    }
    throw err;
  } finally {
    await session.endSession();
  }
};

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
  let tenant;

  await withTransactionOrFallback(async (session) => {
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
      { returnDocument: 'after', session }
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
        try {
          const hasVerified = user.emailVerified;
          const verificationToken = hasVerified ? null : (user.emailVerificationToken || null);
          await emailService.sendTenantWelcome(
            user,
            params.tempPassword || '********',
            property,
            room,
            owner.name,
            verificationToken
          );
        } catch (emailErr) {
          logger.error(`[TENANT CREATE] Failed to send welcome email: ${emailErr.message}`);
        }

        // Automatically generate historical bills in the background so they appear instantly
        try {
          const billingServiceV2 = require('./billingServiceV2');
          billingServiceV2.generateMonthlyBills(ownerId).catch(err => {
            logger.error(`[TENANT CREATE] Background billing trigger failed: ${err.message}`);
          });
        } catch (billErr) {
          logger.error(`[TENANT CREATE] Could not initiate background billing: ${billErr.message}`);
        }
      }
    } catch (err) {
      logger.error(`[MOVE-IN] Post-processing error: ${err.message}`);
    }

    return result;
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
  let updatedTenant;

  await withTransactionOrFallback(async (session) => {
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
      { returnDocument: 'after', session }
    );

    if (!updatedTenant) {
      const err = new Error('Tenant is no longer active — possible concurrent move-out.');
      err.statusCode = 409;
      throw err;
    }

    // 2) Mark all co-occupants as inactive
    await CoOccupant.updateMany({ tenantId }, { $set: { status: 'inactive' } }, { session });

    // 3) Decrement room occupancy by totalOccupantsToRemove
    const roomUpdate = await Room.findOneAndUpdate(
      {
        _id: tenant.roomId,
        ownerId: tenant.ownerId,
        currentOccupancy: { $gte: totalOccupantsToRemove },
      },
      { $inc: { currentOccupancy: -totalOccupantsToRemove } },
      { returnDocument: 'after', session }
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
      billingServiceV2.generateMonthlyBills(updatedTenant.ownerId).catch(err => {
          logger.error(`[MOVE-OUT] Auto-billing failed for tenant=${tenantId}: ${err.message}`);
      });
      logger.info(`[MOVE-OUT] Auto-generated final proration and billing records for tenant=${tenantId}`);
    } catch (billErr) {
      logger.error(`[MOVE-OUT] Auto-billing failed for tenant=${tenantId}: ${billErr.message}`);
    }

    logger.info(`[MOVE-OUT] tenant=${tenantId} occupantsRemoved=${totalOccupantsToRemove} room=${tenant.roomId} by=${callerId}`);
    await logActivity(callerId, 'TENANT_VACATED', tenantId, 'Tenant', `Tenant moved out from Room ${tenant.roomId?._id || tenant.roomId}`);

  notificationService.sendPushNotification({
    userId: updatedTenant.userId,
    title: 'Tenancy Ended',
    body: `You have been moved out from your room.`,
    type: 'tenant_move_out',
    data: { tenantId: updatedTenant._id }
  }).catch(err => logger.error(`[Push] Failed: ${err.message}`));

    return updatedTenant;

  return updatedTenant;
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

  await withTransactionOrFallback(async (session) => {
    // 1. Increment room occupancy
    const updatedRoom = await Room.findOneAndUpdate(
      {
        _id: tenant.roomId,
        currentOccupancy: { $lte: room.capacity - totalToAdd }
      },
      { $inc: { currentOccupancy: totalToAdd } },
      { returnDocument: 'after', session }
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

  await withTransactionOrFallback(async (session) => {
    const coOccupant = await CoOccupant.findOne({ _id: coOccupantId, tenantId }).session(session);
    if (!coOccupant) {
      const err = new Error('Co-occupant not found.');
      err.statusCode = 404;
      throw err;
    }

    const roomUpdate = await Room.findOneAndUpdate(
      { _id: tenant.roomId, currentOccupancy: { $gte: 1 } },
      { $inc: { currentOccupancy: -1 } },
      { returnDocument: 'after', session }
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
};

module.exports = { moveIn, moveOut, addCoOccupants, deleteCoOccupant };
