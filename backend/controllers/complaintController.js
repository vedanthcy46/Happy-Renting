'use strict';

const Complaint = require('../models/Complaint');
const Tenant    = require('../models/Tenant');
const User      = require('../models/User');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
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
    const { title, description, priority, category } = req.body;

    // Find active tenancy for the user
    const tenant = await Tenant.findOne({ userId: req.user._id, status: 'active' });
    if (!tenant) {
      return res.status(403).json({ success: false, message: 'You must be an active tenant to raise a complaint.' });
    }

    const complaintData = {
      title,
      description,
      priority: priority || 'medium',
      category: category || 'other',
      tenantId: tenant._id,
      ownerId: tenant.ownerId,
      propertyId: tenant.propertyId,
      roomId: tenant.roomId,
    };

    if (req.file) {
      complaintData.images = [req.file.path];
    }

    const complaint = await Complaint.create(complaintData);

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

    notificationService.sendPushNotification({
      userId: tenant.ownerId,
      title: 'New Complaint',
      body: `New complaint: ${complaint.title}`,
      type: 'complaint_raised',
      data: { complaintId: complaint._id }
    }).catch(err => logger.error(`[Push] Failed: ${err.message}`));

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
        
        if (tenant && tenant.userId) {
          if (tenant.userId.email) {
            await emailService.sendComplaintResolvedNotification(
              tenant.userId,
              complaint,
              property.propertyId,
              property.roomId
            );
          }

          notificationService.sendPushNotification({
            userId: tenant.userId._id,
            title: 'Complaint Resolved',
            body: `Your complaint "${complaint.title}" has been resolved.`,
            type: 'complaint_resolved',
            data: { complaintId: complaint._id }
          }).catch(err => logger.error(`[Push] Failed: ${err.message}`));
        }
      } catch (err) {
        logger.error(`Failed to send resolution notifications: ${err.message}`);
      }
    }

    res.status(200).json({ success: true, message: 'Complaint updated.', complaint });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/complaints/:id ─────────────────────────────────────────────────
const getComplaintById = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate({
        path: 'tenantId',
        populate: { path: 'userId', select: 'name email phone' }
      })
      .populate('roomId', 'roomNumber')
      .populate('propertyId', 'name address')
      .populate('ownerId', 'name email phone');

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Security check
    if (req.user.role === 'owner' && String(complaint.ownerId._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (req.user.role === 'tenant' && String(complaint.tenantId.userId._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.status(200).json({ success: true, complaint });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/complaints/:id/comments ───────────────────────────────────────
const addComplaintComment = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Comment message is required.' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Security check
    if (req.user.role === 'owner' && String(complaint.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (req.user.role === 'tenant') {
      const tenant = await Tenant.findOne({ userId: req.user._id, status: 'active' });
      if (!tenant || String(complaint.tenantId) !== String(tenant._id)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const userRec = await require('../models/User').findById(req.user._id).select('name');
    
    complaint.comments.push({
      message: message.trim(),
      authorName: userRec ? userRec.name : 'User',
      authorRole: req.user.role,
      createdAt: Date.now()
    });

    await complaint.save();

    if (req.user.role === 'tenant') {
      notificationService.sendPushNotification({
        userId: complaint.ownerId,
        title: 'New Comment on Complaint',
        body: `${userRec ? userRec.name : 'Tenant'} commented: ${message}`,
        type: 'complaint_comment',
        data: { complaintId: complaint._id }
      }).catch(err => logger.error(`[Push] Failed: ${err.message}`));
    } else {
      const tenantRec = await Tenant.findById(complaint.tenantId).populate('userId');
      if (tenantRec?.userId) {
        notificationService.sendPushNotification({
          userId: tenantRec.userId._id,
          title: 'New Comment on Your Complaint',
          body: `${userRec ? userRec.name : 'Owner'} (owner) commented: ${message}`,
          type: 'complaint_comment',
          data: { complaintId: complaint._id }
        }).catch(err => logger.error(`[Push] Failed: ${err.message}`));
      }
    }

    res.status(200).json({ success: true, message: 'Comment added successfully.', comments: complaint.comments });
  } catch (err) {
    next(err);
  }
};

module.exports = { getComplaints, createComplaint, updateComplaint, getComplaintById, addComplaintComment };
