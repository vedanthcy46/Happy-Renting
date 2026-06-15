'use strict';

/**
 * paymentRoutesV2.js
 * ─────────────────────────────────────────────────────────────────────────────
 * API routes for ledger-based payment system
 */

const router = require('express').Router();
const {
  getRentRecords,
  getRentRecordDetail,
  createRentRecord,
  updateRentRecord,
  addPaymentTransaction,
  reversePaymentTransaction,
  verifyPaymentTransaction,
  rejectPaymentTransaction,
  getPaymentSummary,
  getTransactionHistory,
  exportTransactionsCSV,
  rentRecordValidation,
  transactionValidation,
} = require('../controllers/paymentControllerV2');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createUploadMiddleware } = require('../middleware/uploadMiddleware');

const upload = createUploadMiddleware('payment_proofs');

router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────
// MONTHLY RENT RECORDS
// ─────────────────────────────────────────────────────────────────────────

// List all rent records
router.get(
  '/',
  authorize('superadmin', 'owner', 'tenant'),
  getRentRecords
);

// Get single rent record with transactions
router.get(
  '/:rentRecordId',
  authorize('superadmin', 'owner', 'tenant'),
  getRentRecordDetail
);

// Create rent record (manual or auto-generation)
router.post(
  '/',
  authorize('superadmin', 'owner'),
  rentRecordValidation,
  validate,
  createRentRecord
);

// Update rent record (notes, flags, etc.)
router.patch(
  '/:rentRecordId',
  authorize('superadmin', 'owner'),
  updateRentRecord
);

// ─────────────────────────────────────────────────────────────────────────
// PAYMENT TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────

// Add payment transaction to a rent record
router.post(
  '/:rentRecordId/transactions',
  authorize('superadmin', 'owner', 'tenant'),
  upload.single('image'),
  transactionValidation,
  validate,
  addPaymentTransaction
);

// Reverse a payment transaction
router.post(
  '/transactions/:transactionId/reverse',
  authorize('superadmin', 'owner'),
  reversePaymentTransaction
);

// Verify a pending payment transaction
router.post(
  '/transactions/:transactionId/verify',
  authorize('superadmin', 'owner'),
  verifyPaymentTransaction
);

// Reject a pending payment transaction
router.post(
  '/transactions/:transactionId/reject',
  authorize('superadmin', 'owner'),
  rejectPaymentTransaction
);

// ─────────────────────────────────────────────────────────────────────────
// SUMMARIES & DASHBOARDS
// ─────────────────────────────────────────────────────────────────────────

// Get payment summary metrics
router.get(
  '/summary/metrics',
  authorize('superadmin', 'owner'),
  getPaymentSummary
);

// Get transaction history timeline
router.get(
  '/history/transactions',
  authorize('superadmin', 'owner', 'tenant'),
  getTransactionHistory
);

// Export transactions as CSV stream
router.get(
  '/export/csv',
  authorize('superadmin', 'owner'),
  exportTransactionsCSV
);

// Manually trigger billing generation and overdue status sync
router.post(
  '/sync',
  authorize('superadmin', 'owner'),
  triggerBillingSync
);

module.exports = router;
