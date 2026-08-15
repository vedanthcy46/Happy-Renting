'use strict';

const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const logger = require('../config/logger');

/**
 * authenticate
 * Validates the Bearer JWT in Authorization header.
 * Attaches req.user (full DB document) if valid.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const message =
        err.name === 'TokenExpiredError'
          ? 'Token has expired. Please log in again.'
          : 'Invalid token. Please log in again.';
      return res.status(401).json({ success: false, message });
    }

    // Check database to ensure user still exists and hasn't been deactivated
    // since the token was issued. Include subscription so entitlement-based
    // checks (plan resolution, resource limits) see the live plan.
    const user = await User.findById(decoded.id).select('isActive ownerId role roles subscription').lean();
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Account deleted. Please log in again.',
      });
    }

    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been disabled by an Administrator. Please contact support.',
      });
    }

    // Attach minimal user object. If a controller needs the full mongoose document,
    // it will fetch it explicitly (e.g., changePassword).
    req.user = {
      _id: user._id,
      role: user.role,
      roles: user.roles?.length > 0 ? user.roles : [user.role],
      ownerId: user.ownerId,
      isActive: user.isActive,
      subscription: user.subscription,
    };

    next();
  } catch (err) {
    logger.error(`authenticate middleware: ${err.message}`);
    next(err);
  }
};

/**
 * authorize(...roles)
 * Role-gate middleware — call after authenticate.
 * Usage: router.get('/admin', authenticate, authorize('superadmin'), handler)
 */
const authorize = (...roles) => (req, res, next) => {
  const userRoles = req.user.roles?.length > 0 ? req.user.roles : [req.user.role];
  const hasRole = roles.some(r => userRoles.includes(r));
  if (!hasRole) {
    logger.warn(
      `Unauthorized access attempt: user=${req.user._id} roles=${userRoles.join(',')} tried to access ${req.path}`
    );
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action.',
    });
  }
  next();
};

/**
 * ownerIsolation
 * Multi-tenant guard — call after authenticate.
 * Attaches req.ownerId for easy filtering.
 */
const ownerIsolation = (req, res, next) => {
  // Super admin can see everything, so we don't force ownerId
  if (req.user.role === 'superadmin') {
    return next();
  }

  // Determine the owner context
  const ownerId = req.user.role === 'owner' ? req.user._id : req.user.ownerId;

  if (!ownerId && req.user.role !== 'superadmin') {
    logger.error(`Owner isolation failure: No owner context for user ${req.user._id} (${req.user.role})`);
    return res.status(403).json({
      success: false,
      message: 'Access denied. Account is not associated with an owner context.',
    });
  }

  req.ownerId = ownerId;
  next();
};

module.exports = { authenticate, authorize, ownerIsolation };
