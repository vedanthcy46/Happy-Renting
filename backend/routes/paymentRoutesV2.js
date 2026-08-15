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
  triggerBillingSync,
  rentRecordValidation,
  transactionValidation,
} = require('../controllers/paymentControllerV2');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createUploadMiddleware } = require('../middleware/uploadMiddleware');
const { renderMobileCheckout } = require('../controllers/cashfreeController');

const upload = createUploadMiddleware('payment_proofs');

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────────────────

// Mobile SDK Proxy: Must be public because the mobile browser opens it
router.get('/cashfree/checkout', renderMobileCheckout);

// ─────────────────────────────────────────────────────────────────────────
// AUTHENTICATED ROUTES
// ─────────────────────────────────────────────────────────────────────────
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────
// MONTHLY RENT RECORDS
// ─────────────────────────────────────────────────────────────────────────

router.get('/', authorize('superadmin', 'owner', 'tenant'), getRentRecords);
router.get('/:rentRecordId', authorize('superadmin', 'owner', 'tenant'), getRentRecordDetail);
router.post('/', authorize('superadmin', 'owner'), rentRecordValidation, validate, createRentRecord);
router.patch('/:rentRecordId', authorize('superadmin', 'owner'), updateRentRecord);

// ─────────────────────────────────────────────────────────────────────────
// PAYMENT TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────

router.post(
  '/:rentRecordId/transactions',
  authorize('superadmin', 'owner', 'tenant'),
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'proofImage', maxCount: 1 },
  ]),
  transactionValidation,
  validate,
  addPaymentTransaction
);
router.post('/transactions/:transactionId/reverse', authorize('superadmin', 'owner'), reversePaymentTransaction);
router.post('/transactions/:transactionId/verify', authorize('superadmin', 'owner'), verifyPaymentTransaction);
router.post('/transactions/:transactionId/reject', authorize('superadmin', 'owner'), rejectPaymentTransaction);

// ─────────────────────────────────────────────────────────────────────────
// SUMMARIES & DASHBOARDS
// ─────────────────────────────────────────────────────────────────────────

router.get('/summary/metrics', authorize('superadmin', 'owner'), getPaymentSummary);
router.get('/history/transactions', authorize('superadmin', 'owner', 'tenant'), getTransactionHistory);
router.get('/export/csv', authorize('superadmin', 'owner'), exportTransactionsCSV);
router.post('/sync', authorize('superadmin', 'owner', 'tenant'), triggerBillingSync);

// ─────────────────────────────────────────────────────────────────────────
// GATEWAY (Cashfree) ROUTES
// ─────────────────────────────────────────────────────────────────────────

const {
  createCashfreeOrder,
  getCashfreePaymentStatus,
  handleCashfreeWebhook
} = require('../controllers/cashfreeController');

// 1. Create Cashfree order (tenant initiates payment)
router.post('/cashfree/create-order/:rentRecordId', authorize('tenant'), createCashfreeOrder);

// 2. Poll payment status (frontend polls after modal closes — read-only, no side effects)
router.get('/cashfree/status/:orderId', authorize('tenant'), getCashfreePaymentStatus);

// NOTE: Webhook route POST /api/v2/payments/cashfree/webhook is registered
// in server.js BEFORE express.json() so rawBody is available for HMAC verification.

module.exports = router;
