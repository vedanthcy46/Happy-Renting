'use strict';

const express = require('express');
const router  = express.Router();
const { submitRequest, getRequests, updateRequestStatus, validateRequest, sendRequestOTP, verifyRequestOTP, togglePriority, addAdminNote, bulkUpdateStatus, expireOldRequests } = require('../controllers/ownerRequestController');
const controller = { submitRequest, getRequests, updateRequestStatus, validateRequest, sendRequestOTP, verifyRequestOTP, togglePriority, addAdminNote, bulkUpdateStatus, expireOldRequests };
const { authenticate, authorize } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiter for submissions (prevent spam)
const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 requests per hour
  message: { success: false, message: 'Too many requests. Please try again after an hour.' }
});

// Public: Submit request
router.post('/', submissionLimiter, controller.validateRequest, controller.submitRequest);

// Public: OTP email verification for request form
router.post('/verify-email/send-otp', submissionLimiter, controller.sendRequestOTP);
router.post('/verify-email/verify-otp', submissionLimiter, controller.verifyRequestOTP);

// Admin Only: Get and update requests
router.use(authenticate);
router.use(authorize('superadmin'));

router.patch('/bulk-status', controller.bulkUpdateStatus);
router.post('/expire-old',   controller.expireOldRequests);
router.get('/', controller.getRequests);
router.patch('/:id/status',   controller.updateRequestStatus);
router.patch('/:id/priority', controller.togglePriority);
router.post('/:id/notes',     controller.addAdminNote);

module.exports = router;
