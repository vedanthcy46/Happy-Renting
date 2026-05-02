'use strict';

const Complaint = require('../models/Complaint');
const Tenant    = require('../models/Tenant');
const User      = require('../models/User');
const emailService = require('../services/emailService');
const logger    = require('../config/logger');

// ── GET /api/complaints ────────────────────────────────────────────────────
const getComplaints = async (req, res, next) => {
  try {
    const filter = {};

    if (req.user.role === 'owner') {
      filter.ownerId = req.user._id;
    } else if (req.user.role === 'tenant') {
      // Find the tenant record for this user
      const tenant = await Tenant.findOne({ userId: req.user._id, status: 'active' });
      if (!tenant) return res.status(200).json({ success: true, count: 0, complaints: [] });
      filter.tenantId = tenant._id;
    }

    const complaints = await Complaint.find(filter)
      .populate({
        path: 'tenantId',
        populate: { path: 'userId', select: 'name email' }
      })
      .populate('roomId', 'roomNumber')
      .populate('propertyId', 'name address')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: complaints.length, complaints });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/complaints ───────────────────────────────────────────────────
const createComplaint = async (req, res, next) => {
  try {
    const { title, description, priority } = req.body;

    // Find active tenancy for the user
    const tenant = await Tenant.findOne({ userId: req.user._id, status: 'active' });
    if (!tenant) {
      return res.status(403).json({ success: false, message: 'You must be an active tenant to raise a complaint.' });
    }

    const complaint = await Complaint.create({
      title,
      description,
      priority: priority || 'medium',
      tenantId: tenant._id,
      ownerId: tenant.ownerId,
      propertyId: tenant.propertyId,
      roomId: tenant.roomId,
    });

    // Send Notification to Owner
    try {
      const owner    = await User.findById(tenant.ownerId);
      const property = await complaint.populate('propertyId roomId');
      const tenantUser = await User.findById(req.user._id);
      
      if (owner && owner.email) {
        await emailService.sendComplaintNotification(
          owner, 
          tenantUser, 
          complaint, 
          property.propertyId, 
          property.roomId
        );
      }
    } catch (emailErr) {
      logger.error(`Failed to send complaint email: ${emailErr.message}`);
    }

    logger.info(`[COMPLAINT RAISED] id=${complaint._id} by_tenant=${tenant._id}`);
    res.status(201).json({ success: true, message: 'Complaint raised successfully.', complaint });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/complaints/:id ──────────────────────────────────────────────
const updateComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Owner check
    if (req.user.role === 'owner' && String(complaint.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { status, priority, resolutionNotes } = req.body;

    if (status) {
      complaint.status = status;
      if (status === 'resolved') {
        complaint.resolvedAt = Date.now();
      }
    }
    if (priority) complaint.priority = priority;
    if (resolutionNotes !== undefined) complaint.resolutionNotes = resolutionNotes;

    await complaint.save();

    // Send Notification to Tenant if resolved
    if (status === 'resolved') {
      try {
        const tenant = await Tenant.findById(complaint.tenantId).populate('userId');
        const property = await complaint.populate('propertyId roomId');
        
        if (tenant && tenant.userId && tenant.userId.email) {
          await emailService.sendComplaintResolvedNotification(
            tenant.userId,
            complaint,
            property.propertyId,
            property.roomId
          );
        }
      } catch (emailErr) {
        logger.error(`Failed to send resolution email: ${emailErr.message}`);
      }
    }

    res.status(200).json({ success: true, message: 'Complaint updated.', complaint });
  } catch (err) {
    next(err);
  }
};

module.exports = { getComplaints, createComplaint, updateComplaint };
