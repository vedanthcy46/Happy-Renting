'use strict';

/**
 * analyticsRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Premium owner analytics routes.
 */

const router = require('express').Router();
const { getOwnerAnalytics } = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/owner', authorize('owner'), getOwnerAnalytics);

module.exports = router;