'use strict';

/**
 * subscriptionRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Premium subscription purchase endpoints (Cashfree-powered).
 */

const router = require('express').Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authenticate, authorize } = require('../middleware/auth');

// Public: plan catalog with admin-set prices
router.get('/plans', subscriptionController.getPlans);

// Authenticated (owner only): purchase flow
router.use(authenticate);
router.post('/create-order', authorize('owner', 'superadmin'), subscriptionController.createOrder);
router.get('/status/:orderId', authorize('owner', 'superadmin'), subscriptionController.getOrderStatus);
router.get('/me', authorize('owner', 'superadmin'), subscriptionController.getMySubscription);

// Superadmin: order management (list / reverse / undo reversal)
router.get('/admin/orders', authorize('superadmin'), subscriptionController.adminGetOrders);
router.post('/admin/orders/:orderId/reverse', authorize('superadmin'), subscriptionController.adminReverseOrder);
router.post('/admin/orders/:orderId/undo-reversal', authorize('superadmin'), subscriptionController.adminUndoReverseOrder);

module.exports = router;
