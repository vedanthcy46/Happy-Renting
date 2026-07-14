'use strict';

const { body, param, query, validationResult } = require('express-validator');
const accountDeletionService = require('../services/accountDeletionService');
const logger = require('../config/logger');

const validateDeletionRequest = [
  body('reason').optional().trim().isLength({ max: 1000 }).withMessage('Reason cannot exceed 1000 characters'),
];

const requestTenantDeletion = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, message: 'Validation failed.', errors: errors.array() });
    }
    const result = await accountDeletionService.requestTenantDeletion({
      userId: req.user._id,
      reason: req.body.reason,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
};

const getMyDeletionStatus = async (req, res, next) => {
  try {
    const result = await accountDeletionService.getTenantRequest(req.user._id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const cancelMyDeletion = async (req, res, next) => {
  try {
    const result = await accountDeletionService.cancelDeletion(req.user._id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
};

const ownerGetRequests = async (req, res, next) => {
  try {
    const ownerId = req.user.role === 'superadmin' ? req.query.ownerId : req.user._id;
    const { status } = req.query;
    const requests = await accountDeletionService.getOwnerRequests(ownerId, status);
    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (err) {
    next(err);
  }
};

const ownerApproveDeletion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ownerId = req.user._id;
    const result = await accountDeletionService.ownerApproveDeletion(id, ownerId);
    logger.info(`Owner ${ownerId} approved deletion request ${id}`);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message, checks: err.checks });
    next(err);
  }
};

const ownerRejectDeletion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const result = await accountDeletionService.ownerRejectDeletion(id, req.user._id, reason);
    logger.info(`Owner ${req.user._id} rejected deletion request ${id}`);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
};

const adminGetAllRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const requests = await accountDeletionService.getAllRequests(status);
    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (err) {
    next(err);
  }
};

const adminForceDelete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await accountDeletionService.adminForceDelete(id, req.user._id);
    logger.info(`Admin ${req.user._id} force-deleted request ${id}`);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
};

const adminApproveDeletion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await accountDeletionService.adminApproveDeletion(id, req.user._id);
    logger.info(`Admin ${req.user._id} approved deletion request ${id}`);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
};

const adminRejectDeletion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    const result = await accountDeletionService.adminRejectDeletion(id, req.user._id, reason);
    logger.info(`Admin ${req.user._id} rejected deletion request ${id}`);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
};

module.exports = {
  requestTenantDeletion,
  getMyDeletionStatus,
  cancelMyDeletion,
  ownerGetRequests,
  ownerApproveDeletion,
  ownerRejectDeletion,
  adminGetAllRequests,
  adminForceDelete,
  adminApproveDeletion,
  adminRejectDeletion,
  validateDeletionRequest,
};
