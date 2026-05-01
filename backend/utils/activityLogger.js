'use strict';

const ActivityLog = require('../models/ActivityLog');
const logger = require('../config/logger');

/**
 * Logs an owner action to the database.
 * @param {string} ownerId - ID of the owner performing the action
 * @param {string} actionType - Enum action type
 * @param {string} targetId - ID of the document affected
 * @param {string} targetModel - Model name of the affected document
 * @param {string} details - Optional details
 * @param {string} ipAddress - Optional IP address
 */
const logActivity = async (ownerId, actionType, targetId, targetModel, details = '', ipAddress = '') => {
  try {
    await ActivityLog.create({
      ownerId,
      actionType,
      targetId,
      targetModel,
      details,
      ipAddress
    });
  } catch (err) {
    logger.error(`Failed to log activity: ${err.message}`);
  }
};

module.exports = logActivity;
