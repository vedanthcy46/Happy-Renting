'use strict';

const { body } = require('express-validator');
const Property = require('../models/Property');
const logger   = require('../config/logger');
const logActivity = require('../utils/activityLogger');
const entitlementService = require('../services/entitlementService');

const propertyValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).escape().withMessage('Name 2-100 chars required'),
  body('address').optional().trim().isLength({ min: 5, max: 200 }).escape().withMessage('Address 5-200 chars required'),
  body('city').optional().trim().isLength({ max: 60 }).escape(),
];

// ── GET /api/properties ────────────────────────────────────────────────────
const getProperties = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'owner') {
      filter.ownerId = req.user._id;
    } else if (req.user.role === 'superadmin' && req.query.ownerId) {
      filter.ownerId = req.query.ownerId;
    }
    const properties = await Property.find(filter)
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: properties.length, properties });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/properties ───────────────────────────────────────────────────
const createProperty = async (req, res, next) => {
  try {
    if (req.user.role === 'owner') {
      const guard = await entitlementService.getCreationGuard(req.user, 'properties');
      if (!guard.ok) {
        return res.status(403).json({
          success: false,
          code: 'PLAN_LIMIT_REACHED',
          message: guard.message,
          entitlement: { plan: guard.plan, used: guard.used, limit: guard.limit },
        });
      }
    }

    const { name, address, city } = req.body;
    const property = await Property.create({
      name,
      address,
      city,
      ownerId: req.user.role === 'owner' ? req.user._id : req.body.ownerId,
    });
    logger.info(`Property created: ${property._id} by ${req.user._id}`);
    await logActivity(req.user._id, 'PROPERTY_CREATED', property._id, 'Property', `Created property: ${name}`, req.ip);
    res.status(201).json({ success: true, message: 'Property created.', property });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/properties/:id ──────────────────────────────────────────────
const updateProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: 'Property not found.' });
    if (req.user.role === 'owner' && String(property.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const { name, address, city, isActive } = req.body;
    if (name)    property.name    = name;
    if (address) property.address = address;
    if (city)    property.city    = city;
    if (isActive !== undefined) property.isActive = isActive;
    await property.save();
    await logActivity(req.user._id, 'PROPERTY_UPDATED', property._id, 'Property', `Updated property: ${property.name}`, req.ip);
    res.status(200).json({ success: true, message: 'Property updated.', property });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/properties/:id (soft delete) ───────────────────────────────
const deleteProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: 'Property not found.' });
    if (req.user.role === 'owner' && String(property.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    property.isActive = false;
    await property.save({ validateBeforeSave: false });
    await logActivity(req.user._id, 'PROPERTY_DELETED', property._id, 'Property', `Deleted property: ${property.name}`, req.ip);
    res.status(200).json({ success: true, message: 'Property removed.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProperties, createProperty, updateProperty, deleteProperty, propertyValidation };
