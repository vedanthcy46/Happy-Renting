'use strict';

const crypto = require('crypto');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Room = require('../models/Room');
const CoOccupant = require('../models/CoOccupant');
const Complaint = require('../models/Complaint');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const DataDeletionRequest = require('../models/DataDeletionRequest');
const emailService = require('./emailService');
const notificationService = require('./notificationService');
const logger = require('../config/logger');

const requestTenantDeletion = async ({ userId, reason }) => {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 404 });

  const tenantRecord = await Tenant.findOne({ userId, status: 'active' });
  if (!tenantRecord) {
    throw Object.assign(new Error('No active tenancy found.'), { statusCode: 400 });
  }

  const existingRequest = await DataDeletionRequest.findOne({
    userId, status: { $in: ['pending', 'confirmed', 'owner_approved'] }
  });
  if (existingRequest) {
    throw Object.assign(new Error('A deletion request is already in progress.'), { statusCode: 409 });
  }

  const deletionToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const deleteRequest = await DataDeletionRequest.create({
    userId: user._id,
    email: user.email,
    status: 'pending_owner',
    reason: reason || '',
    role: 'tenant',
    ownerId: tenantRecord.ownerId,
    tenantId: tenantRecord._id,
    deletionToken,
    tokenExpiresAt,
  });

  tenantRecord.deletionRequestedAt = new Date();
  tenantRecord.deletionReason = reason || '';
  await tenantRecord.save();

  const owner = await User.findById(tenantRecord.ownerId);
  if (owner) {
    try {
      await emailService.sendDeletionRequestToOwner(owner, user, tenantRecord, deleteRequest.referenceId);
      deleteRequest.ownerNotified = true;
      deleteRequest.ownerNotificationSentAt = new Date();
      await deleteRequest.save();
    } catch (err) {
      logger.error(`[DELETION] Failed to notify owner: ${err.message}`);
    }
  }

  try {
    await emailService.sendDeletionRequestConfirmation(user, deleteRequest.referenceId);
  } catch (err) {
    logger.error(`[DELETION] Failed to send confirmation to tenant: ${err.message}`);
  }

  notificationService.sendPushNotification({
    userId: tenantRecord.ownerId,
    title: 'Tenant Deletion Request',
    body: `${user.email} has requested account deletion.`,
    type: 'deletion_requested',
    data: { referenceId: deleteRequest.referenceId }
  }).catch(err => logger.error(`[Push] Failed: ${err.message}`));

  logger.info(`[DELETION] Tenant deletion requested: ${user.email}, ref=${deleteRequest.referenceId}`);

  return {
    referenceId: deleteRequest.referenceId,
    message: 'Deletion request sent to your owner for review.',
  };
};

const getValidationChecks = async (tenantRecord) => {
  const checks = { passed: true, blocks: [] };

  const room = await Room.findById(tenantRecord.roomId);
  if (room && room.currentOccupancy > 0) {
    checks.passed = false;
    checks.blocks.push({ check: 'occupancy', message: 'Tenant is still occupying the room. Please vacate first.' });
  }

  const pendingRent = await MonthlyRentRecord.findOne({
    tenantId: tenantRecord._id,
    remainingAmount: { $gt: 0 },
    status: { $in: ['pending', 'partial', 'overdue'] }
  });
  if (pendingRent) {
    checks.passed = false;
    checks.blocks.push({ check: 'pending_rent', message: `Outstanding rent of ₹${pendingRent.remainingAmount.toLocaleString()} must be cleared.` });
  }

  const pendingComplaints = await Complaint.countDocuments({
    tenantId: tenantRecord.userId,
    status: { $in: ['pending', 'in-progress'] }
  });
  if (pendingComplaints > 0) {
    checks.passed = false;
    checks.blocks.push({ check: 'pending_complaints', message: `${pendingComplaints} pending complaint(s) must be resolved first.` });
  }

  return checks;
};

const ownerApproveDeletion = async (requestId, ownerId) => {
  const request = await DataDeletionRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Request not found.'), { statusCode: 404 });
  if (request.status !== 'pending' && request.status !== 'confirmed' && request.status !== 'pending_owner') {
    throw Object.assign(new Error('Request is not in a pending state.'), { statusCode: 400 });
  }

  const tenantRecord = await Tenant.findById(request.tenantId);
  if (!tenantRecord) throw Object.assign(new Error('Tenant record not found.'), { statusCode: 404 });

  if (String(tenantRecord.ownerId) !== String(ownerId)) {
    throw Object.assign(new Error('Unauthorized: this tenant does not belong to you.'), { statusCode: 403 });
  }

  const checks = await getValidationChecks(tenantRecord);
  if (!checks.passed) {
    throw Object.assign(new Error(checks.blocks.map(b => b.message).join('\n')), { statusCode: 400, checks });
  }

  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + 30);

  request.status = 'owner_approved';
  request.ownerActionAt = new Date();
  request.scheduledDeletionAt = deletionDate;
  await request.save();

  tenantRecord.status = 'pending_deletion';
  tenantRecord.deletionApprovedAt = new Date();
  tenantRecord.deletionApprovedBy = ownerId;
  tenantRecord.deletionScheduledFor = deletionDate;
  await tenantRecord.save();

  const tenantUser = await User.findById(request.userId);
  if (tenantUser) {
    try {
      await emailService.sendDeletionApprovedTenant(tenantUser, request.referenceId, deletionDate);
    } catch (err) {
      logger.error(`[DELETION] Failed to notify tenant of approval: ${err.message}`);
    }
  }

  const ownerUser = await User.findById(ownerId).select('name');
  const roomRecord = await Room.findById(tenantRecord.roomId).select('roomNumber');
  try {
    const admins = await User.find({ role: 'superadmin' }).select('email');
    const adminEmailPayload = {
      tenantName: tenantUser?.name || 'Unknown',
      tenantEmail: request.email,
      ownerName: ownerUser?.name || 'Owner',
      roomNumber: roomRecord?.roomNumber || 'N/A',
      referenceId: request.referenceId,
      scheduledDeletionAt: deletionDate,
    };
    for (const admin of admins) {
      emailService.sendDeletionApprovedToAdmin(admin.email, adminEmailPayload).catch(err =>
        logger.error(`[DELETION] Failed to notify admin ${admin.email}: ${err.message}`)
      );
    }
  } catch (err) {
    logger.error(`[DELETION] Failed to notify admins: ${err.message}`);
  }

  notificationService.sendPushNotification({
    userId: request.userId,
    title: 'Deletion Approved',
    body: `Your account deletion has been approved.`,
    type: 'deletion_approved',
    data: { referenceId: request.referenceId, scheduledDeletionAt: deletionDate }
  }).catch(err => logger.error(`[Push] Failed: ${err.message}`));

  logger.info(`[DELETION] Owner approved deletion: ref=${request.referenceId}, scheduled=${deletionDate}`);

  return {
    referenceId: request.referenceId,
    message: `Deletion approved. Account will be permanently deleted on ${deletionDate.toLocaleDateString('en-IN')} unless cancelled.`,
    scheduledDeletionAt: deletionDate,
  };
};

const ownerRejectDeletion = async (requestId, ownerId, reason) => {
  const request = await DataDeletionRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Request not found.'), { statusCode: 404 });

  const tenantRecord = await Tenant.findById(request.tenantId);
  if (!tenantRecord) throw Object.assign(new Error('Tenant record not found.'), { statusCode: 404 });

  if (String(tenantRecord.ownerId) !== String(ownerId)) {
    throw Object.assign(new Error('Unauthorized.'), { statusCode: 403 });
  }

  request.status = 'owner_rejected';
  request.ownerActionAt = new Date();
  request.adminComment = reason || '';
  await request.save();

  tenantRecord.status = 'active';
  tenantRecord.deletionRejectedAt = new Date();
  tenantRecord.deletionRejectedReason = reason || '';
  tenantRecord.deletionRequestedAt = null;
  tenantRecord.deletionReason = '';
  await tenantRecord.save();

  const tenantUser = await User.findById(request.userId);
  if (tenantUser) {
    try {
      await emailService.sendDeletionRejectedTenant(tenantUser, request.referenceId, reason);
    } catch (err) {
      logger.error(`[DELETION] Failed to notify tenant of rejection: ${err.message}`);
    }
  }

  notificationService.sendPushNotification({
    userId: request.userId,
    title: 'Deletion Request Rejected',
    body: `Your deletion request was rejected.`,
    type: 'deletion_rejected',
    data: { referenceId: request.referenceId }
  }).catch(err => logger.error(`[Push] Failed: ${err.message}`));

  logger.info(`[DELETION] Owner rejected deletion: ref=${request.referenceId}`);

  return { referenceId: request.referenceId, message: 'Deletion request rejected.' };
};

const cancelDeletion = async (userId) => {
  const request = await DataDeletionRequest.findOne({
    userId,
    status: { $in: ['pending', 'confirmed', 'pending_owner', 'owner_approved'] }
  });
  if (!request) throw Object.assign(new Error('No active deletion request found.'), { statusCode: 404 });

  request.status = 'cancelled';
  request.cancelledAt = new Date();
  await request.save();

  const tenantRecord = await Tenant.findOne({ userId, deletionRequestedAt: { $ne: null } });
  if (tenantRecord) {
    tenantRecord.status = 'active';
    tenantRecord.deletionCancelledAt = new Date();
    tenantRecord.deletionRequestedAt = null;
    tenantRecord.deletionApprovedAt = null;
    tenantRecord.deletionApprovedBy = null;
    tenantRecord.deletionReason = '';
    tenantRecord.deletionScheduledFor = null;
    await tenantRecord.save();
  }

  logger.info(`[DELETION] Tenant cancelled deletion: userId=${userId}`);
  return { message: 'Deletion request cancelled.' };
};

const processScheduledDeletions = async () => {
  const now = new Date();
  const dueTenants = await Tenant.find({
    status: 'pending_deletion',
    deletionScheduledFor: { $lte: now }
  });

  let processed = 0;
  for (const tenantRecord of dueTenants) {
    try {
      const request = await DataDeletionRequest.findOne({ tenantId: tenantRecord._id, status: 'owner_approved' });
      await performDeletion(tenantRecord, request);
      processed++;
    } catch (err) {
      logger.error(`[DELETION CRON] Failed to process tenant ${tenantRecord._id}: ${err.message}`);
    }
  }

  logger.info(`[DELETION CRON] Processed ${processed} scheduled deletions.`);
  return processed;
};

const performDeletion = async (tenantRecord, request) => {
  const userId = tenantRecord.userId;

  await CoOccupant.deleteMany({ tenantId: tenantRecord._id });
  await Complaint.deleteMany({ tenantId: userId });

  const user = await User.findById(userId);
  if (user) {
    user.name = 'Deleted Tenant';
    user.email = `deleted+${user._id}@deleted.local`;
    user.phone = null;
    user.upiId = null;
    user.upiNumber = null;
    user.upiDetails = {};
    user.bankDetails = {};
    user.qrCodeImage = {};
    user.expoPushTokens = [];
    user.isActive = false;
    user.lastLogin = null;
    user.mustChangePassword = false;
    await user.save({ validateBeforeSave: false });
  }

  tenantRecord.phone = '';
  tenantRecord.idProof = '';
  tenantRecord.privacyDataPurged = true;
  tenantRecord.status = 'deleted';
  tenantRecord.exitDate = new Date();
  await tenantRecord.save({ validateBeforeSave: false });

  if (request) {
    request.status = 'completed';
    request.processedAt = new Date();
    request.anonymizedAt = new Date();
    await request.save();

    try {
      await emailService.sendDeletionCompleteEmail(
        request.email,
        request.referenceId
      );
    } catch (err) {
      logger.error(`[DELETION] Completion email failed: ${err.message}`);
    }
  }

  notificationService.sendPushNotification({
    userId: tenantRecord.ownerId,
    title: 'Tenant Account Deleted',
    body: `A tenant account has been permanently deleted.`,
    type: 'deletion_completed',
    data: { tenantId: tenantRecord._id }
  }).catch(err => logger.error(`[Push] Failed: ${err.message}`));

  logger.info(`[DELETION] Completed: tenant=${tenantRecord._id}, user=${userId}`);
};

const adminForceDelete = async (requestId, adminId) => {
  const request = await DataDeletionRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Request not found.'), { statusCode: 404 });

  const tenantRecord = await Tenant.findById(request.tenantId);
  if (!tenantRecord) throw Object.assign(new Error('Tenant record not found.'), { statusCode: 404 });

  request.adminId = adminId;
  await performDeletion(tenantRecord, request);

  logger.info(`[DELETION] Admin force-deleted: ref=${request.referenceId}, admin=${adminId}`);
  return { referenceId: request.referenceId, message: 'Account force-deleted by admin.' };
};

const getOwnerRequests = async (ownerId, status) => {
  const filter = { ownerId, role: 'tenant' };
  if (status) filter.status = status;
  const requests = await DataDeletionRequest.find(filter)
    .populate('userId', 'name email')
    .populate('tenantId', 'roomId')
    .sort({ createdAt: -1 });
  return requests;
};

const getTenantRequest = async (userId) => {
  const request = await DataDeletionRequest.findOne({ userId }).sort({ createdAt: -1 });
  if (!request) return null;
  const tenantRecord = await Tenant.findOne({ userId }).select('status deletionScheduledFor deletionRejectedReason');
  return {
    referenceId: request.referenceId,
    status: request.status,
    reason: request.reason,
    createdAt: request.createdAt,
    ownerActionAt: request.ownerActionAt,
    scheduledDeletionAt: request.scheduledDeletionAt,
    cancelledAt: request.cancelledAt,
    tenantStatus: tenantRecord?.status,
    deletionRejectedReason: tenantRecord?.deletionRejectedReason,
  };
};

const getRequestByReference = async (referenceId) => {
  return DataDeletionRequest.findOne({ referenceId })
    .populate('userId', 'name email')
    .populate('ownerId', 'name email')
    .populate('tenantId');
};

const adminApproveDeletion = async (requestId, adminId) => {
  const request = await DataDeletionRequest.findById(requestId).populate('tenantId');
  if (!request) throw Object.assign(new Error('Request not found.'), { statusCode: 404 });
  if (request.status !== 'pending_owner') {
    throw Object.assign(new Error(`Cannot approve: request is ${request.status}.`), { statusCode: 400 });
  }

  const tenantRecord = await Tenant.findById(request.tenantId);
  if (!tenantRecord) throw Object.assign(new Error('Tenant record not found.'), { statusCode: 404 });

  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + 30);

  request.status = 'owner_approved';
  request.ownerId = adminId; // admin acts as proxy owner
  request.ownerActionAt = new Date();
  request.scheduledDeletionAt = deletionDate;
  await request.save();

  tenantRecord.status = 'pending_deletion';
  tenantRecord.deletionApprovedAt = new Date();
  tenantRecord.deletionApprovedBy = adminId;
  tenantRecord.deletionScheduledFor = deletionDate;
  await tenantRecord.save();

  const user = await User.findById(request.userId);
  if (user) {
    await emailService.sendDeletionApprovedTenant(user, request.referenceId, deletionDate);
  }

  logger.info(`[DELETION] Admin ${adminId} approved deletion request ${requestId}`);
  return { referenceId: request.referenceId, scheduledDeletionAt: deletionDate, message: 'Deletion approved by admin.' };
};

const adminRejectDeletion = async (requestId, adminId, reason) => {
  if (!reason) throw Object.assign(new Error('Rejection reason is required.'), { statusCode: 400 });

  const request = await DataDeletionRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Request not found.'), { statusCode: 404 });
  if (request.status !== 'pending_owner') {
    throw Object.assign(new Error(`Cannot reject: request is ${request.status}.`), { statusCode: 400 });
  }

  const tenantRecord = await Tenant.findById(request.tenantId);
  if (tenantRecord) {
    tenantRecord.status = 'active';
    tenantRecord.deletionRejectedAt = new Date();
    tenantRecord.deletionRejectedReason = reason;
    tenantRecord.deletionRequestedAt = null;
    tenantRecord.deletionReason = '';
    await tenantRecord.save();
  }

  request.status = 'owner_rejected';
  request.ownerId = adminId;
  request.ownerActionAt = new Date();
  request.rejectionReason = reason;
  await request.save();

  const user = await User.findById(request.userId);
  if (user) {
    await emailService.sendDeletionRejectedTenant(user, request.referenceId, reason);
  }

  logger.info(`[DELETION] Admin ${adminId} rejected deletion request ${requestId}`);
  return { referenceId: request.referenceId, message: 'Deletion rejected by admin.' };
};

const getAllRequests = async (statusFilter) => {
  const filter = {};
  if (statusFilter) filter.status = statusFilter;
  return DataDeletionRequest.find(filter)
    .populate('userId', 'name email')
    .populate('ownerId', 'name email')
    .populate('adminId', 'name email')
    .sort({ createdAt: -1 });
};

module.exports = {
  requestTenantDeletion,
  getValidationChecks,
  ownerApproveDeletion,
  ownerRejectDeletion,
  cancelDeletion,
  processScheduledDeletions,
  adminForceDelete,
  adminApproveDeletion,
  adminRejectDeletion,
  getOwnerRequests,
  getTenantRequest,
  getRequestByReference,
  getAllRequests,
};
